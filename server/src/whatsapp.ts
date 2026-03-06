import { Request, Response, Router } from "express";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import prisma, { logActivity } from "./logger";
import { analyzeImage } from "./ai";
import { uploadFileToDrive } from "./drive";
import { computeImageHash, checkDuplicateImage } from "./fraud";

const router = Router();

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Ticket Context Helpers ─────────────────────────────────────────

function inferTicketDetails(source: string, buttonId: string): { category: string; description: string } {
    // From gate screen
    if (source === "gate_screen") {
        return {
            category: "general",
            description: "User requested help from the welcome screen before starting verification"
        };
    }

    // From language/name selection
    if (source === "LANGUAGE_SELECT" || source === "NAME_CONFIRM" || source === "AWAITING_NAME_INPUT") {
        return {
            category: "technical_problem",
            description: `User requested help during ${source === "LANGUAGE_SELECT" ? "language selection" : "name confirmation"}`
        };
    }

    // From GPS/photo flow
    if (source === "AWAITING_GPS") {
        return {
            category: "technical_problem",
            description: "User having trouble sharing location"
        };
    }
    if (source === "AWAITING_PHOTO") {
        return {
            category: "technical_problem",
            description: "User having trouble uploading photo"
        };
    }
    if (source === "PROCESSING") {
        return {
            category: "technical_problem",
            description: "User requested help while submission was being processed"
        };
    }

    // From reward screen
    if (buttonId === "btn_reward_help" || source === "REWARD") {
        return {
            category: "payment_issue",
            description: "User has questions about their reward or payment"
        };
    }

    // From review acknowledgment
    if (source === "REVIEW_ACK") {
        return {
            category: "verification_query",
            description: "User's submission is pending review and they need assistance"
        };
    }

    // Completed session
    if (source === "COMPLETED") {
        return {
            category: "general",
            description: "User requested help after completing verification"
        };
    }

    // Default
    return {
        category: "general",
        description: `Help requested from ${source || "unknown context"}`
    };
}

function determinePriority(source: string): string {
    // High priority if stuck in verification flow
    if (["AWAITING_GPS", "AWAITING_PHOTO", "PROCESSING"].includes(source)) {
        return "HIGH";
    }
    // Medium priority for payment/reward questions
    if (source === "REWARD" || source === "REVIEW_ACK") {
        return "MEDIUM";
    }
    // Low priority for general help
    return "LOW";
}

// ─── Webhook Verification (GET) ─────────────────────────────────────
router.get("/", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
        console.log("✅ Webhook verified");
        res.status(200).send(challenge);
    } else {
        console.log("❌ Webhook verification failed");
        res.sendStatus(403);
    }
});

// ─── Incoming Messages (POST) ────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
    res.sendStatus(200); // Always respond 200 immediately

    try {
        const body = req.body;
        const entry = body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return; // Status update, not a message

        const from = message.from as string;
        const msgType = message.type as string;
        const profileName = value?.contacts?.[0]?.profile?.name || null;

        // Get or create user
        const user = await getOrCreateUser(from, profileName);

        // Check for active session
        let session = await getActiveSession(from);

        // Handle interactive button replies
        if (msgType === "interactive") {
            const interactive = message.interactive;
            const buttonId = interactive?.button_reply?.id || interactive?.list_reply?.id || "";
            await handleButtonReply(from, user, session, buttonId);
            return;
        }

        // Handle text messages
        if (msgType === "text") {
            const text = (message.text?.body as string || "").trim();
            await handleTextMessage(from, user, session, text);
            return;
        }

        // Handle location
        if (msgType === "location") {
            const lat = message.location?.latitude as number;
            const lng = message.location?.longitude as number;
            await handleLocation(from, user, session, lat, lng);
            return;
        }

        // Handle image
        if (msgType === "image") {
            const mediaId = message.image?.id as string;
            await handleImage(from, user, session, mediaId);
            return;
        }

        // Unknown message type → show gate
        if (!session) {
            await sendGateScreen(from);
        }
    } catch (err) {
        console.error("Webhook processing error:", err);
    }
});

// ─── Button Reply Handler ────────────────────────────────────────────

async function handleButtonReply(
    phone: string,
    user: { id: string; phone: string; name: string | null; language: string },
    session: SessionData | null,
    buttonId: string
): Promise<void> {
    // Gate screen buttons
    if (buttonId === "btn_scan_qr") {
        await sendWhatsAppMessage(phone, "📱 Please scan the QR code printed on your GG biochar bag.\n\nThe QR will automatically open this chat with the bag registered.");
        return;
    }
    if (buttonId === "btn_enter_bag_id") {
        // Set a flag so next text message is treated as bag ID input
        await prisma.activityLog.create({
            data: { event: "BAG_ID_INPUT_REQUESTED", phone, level: "INFO" },
        });
        await sendWhatsAppMessage(phone, "📝 Type your Bag ID below.\n\nExample: GG-P1-2026-03-B00001");
        return;
    }
    if (buttonId === "btn_need_help" || buttonId === "btn_reward_help") {
        // Capture context for the ticket
        const source = session ? session.state : "gate_screen";
        const { category, description } = inferTicketDetails(source, buttonId);
        const priority = determinePriority(source);

        // Find linked submission if session exists
        let submissionId: string | null = null;
        let bagId: string | null = null;
        if (session) {
            const submission = await prisma.submission.findUnique({
                where: { sessionId: session.id },
                select: { id: true, bagId: true }
            });
            submissionId = submission?.id || null;
            bagId = submission?.bagId || session.bagId || null;
        }

        await logActivity({
            event: "HELP_REQUESTED",
            sessionId: session?.id,
            phone,
            details: { context: source, category, submissionId, bagId }
        });

        // Create ticket with full context
        const ticket = await prisma.ticket.create({
            data: {
                phone,
                userId: user.id,
                source,
                sessionId: session?.id || null,
                submissionId,
                bagId,
                category,
                description,
                priority
            }
        });

        // Create initial status history record
        await prisma.ticketStatusChange.create({
            data: {
                ticketId: ticket.id,
                fromStatus: null,
                toStatus: "OPEN",
                changedBy: "system"
            }
        });

        const ticketId = `GG-TKT-${String(ticket.ticketNumber).padStart(3, "0")}`;

        const lang = session?.language || "en";
        const msg = lang === "en"
            ? `We are always here to help! Your customer support ticket is *${ticketId}*\n\nSomeone from the GG Team will be getting in touch with you shortly 🤩\n\n📞 If you need immediate assistance, please call our hotline: 1800-123-4567\n\nThank you for your cooperation 🙏`
            : `हम आपकी मदद के लिए हमेशा यहाँ हैं! आपका ग्राहक सहायता टिकट *${ticketId}* है\n\nGG टीम से कोई व्यक्ति जल्द ही आपसे संपर्क करेगा 🤩\n\n📞 यदि आपको तत्काल सहायता की आवश्यकता है, तो कृपया हमारे हेल्पलाइन पर कॉल करें: 1800-123-4567\n\nआपके सहयोग के लिए धन्यवाद 🙏`;

        await sendWhatsAppMessage(phone, msg);
        return;
    }
    if (buttonId === "btn_explore_more") {
        await logActivity({ event: "EXPLORE_MORE", phone, details: { context: "gate_screen" } });
        await sendInteractiveList(phone,
            "🌱 GG Krishi — Coming Soon",
            "Explore upcoming features:",
            "Features",
            [
                { id: "feat_geo", title: "📍 Geo-boundary Validation" },
                { id: "feat_carbon", title: "🌍 Carbon Math Engine" },
                { id: "feat_wallet", title: "💰 UPI Wallet Integration" },
                { id: "feat_registry", title: "📋 Registry Export" },
            ]
        );
        return;
    }

    // Feature list selections → coming soon
    if (buttonId.startsWith("feat_")) {
        await sendWhatsAppMessage(phone, "🚧 Coming soon! Stay tuned.\n\nWhen you're ready, send your Bag ID to start verification.");
        return;
    }

    // ── Session flow buttons ──

    if (!session) {
        await sendNoActiveSessionGuidance(phone, user.language, buttonId);
        return;
    }

    // Language selection
    if (buttonId === "lang_en" || buttonId === "lang_hi") {
        if (session.state !== "LANGUAGE_SELECT") {
            await sendStateGuidance(phone, session);
            return;
        }
        const lang = buttonId === "lang_en" ? "en" : "hi";
        await prisma.session.update({ where: { id: session.id }, data: { language: lang, state: "NAME_CONFIRM" } });
        await prisma.user.update({ where: { id: user.id }, data: { language: lang } });
        await logActivity({ event: "LANGUAGE_SELECTED", sessionId: session.id, bagId: session.bagId, phone, details: { language: lang } });

        // Ask name confirmation
        const displayName = user.name || "Farmer";
        const msg = lang === "en"
            ? `Is your name *${displayName}*?`
            : `क्या आपका नाम *${displayName}* है?`;
        await sendInteractiveButtons(phone, msg, [
            { id: "name_yes", title: lang === "en" ? "✅ Yes" : "✅ हाँ" },
            { id: "name_edit", title: lang === "en" ? "✏️ Edit" : "✏️ बदलें" },
        ]);
        return;
    }

    // Name confirmation
    if (buttonId === "name_yes") {
        if (session.state !== "NAME_CONFIRM") {
            await sendStateGuidance(phone, session);
            return;
        }
        const name = user.name || "Farmer";
        await prisma.session.update({ where: { id: session.id }, data: { userName: name, state: "AWAITING_GPS" } });
        await logActivity({ event: "NAME_CONFIRMED", sessionId: session.id, phone, details: { name, edited: false } });
        await sendLocationRequest(phone, session.language || "en", name);
        return;
    }
    if (buttonId === "name_edit") {
        if (session.state !== "NAME_CONFIRM") {
            await sendStateGuidance(phone, session);
            return;
        }
        await prisma.session.update({ where: { id: session.id }, data: { state: "AWAITING_NAME_INPUT" } });
        const msg = (session.language || "en") === "en"
            ? "📝 Please type your name:"
            : "📝 कृपया अपना नाम लिखें:";
        await sendWhatsAppMessage(phone, msg);
        // State is now AWAITING_NAME_INPUT, next text input = name edit
        return;
    }


    // Reward screen buttons
    if (buttonId === "btn_finish") {
        await prisma.session.update({ where: { id: session.id }, data: { state: "COMPLETED", completedAt: new Date() } });
        await logActivity({ event: "SESSION_COMPLETED", sessionId: session.id, bagId: session.bagId, phone });
        const msg = (session.language || "en") === "en"
            ? "🙏 Thank you for contributing to carbon removal!\n\nGG Krishi — Growing Green, Growing Gold."
            : "🙏 कार्बन हटाने में योगदान के लिए धन्यवाद!\n\nGG Krishi — Growing Green, Growing Gold.";
        await sendWhatsAppMessage(phone, msg);
        return;
    }
    if (buttonId === "btn_withdrawal") {
        await logActivity({ event: "WITHDRAWAL_REQUESTED", sessionId: session.id, bagId: session.bagId, phone });
        const msg = (session.language || "en") === "en"
            ? "💰 Your withdrawal request has been logged. Our team will process it and contact you."
            : "💰 आपका निकासी अनुरोध दर्ज हो गया है। हमारी टीम आपसे संपर्क करेगी।";
        await sendWhatsAppMessage(phone, msg);
        return;
    }
    // (btn_reward_help is now handled globally at the top of handleButtonReply)

    await sendStateGuidance(phone, session);
}

// ─── Text Message Handler ────────────────────────────────────────────

async function handleTextMessage(
    phone: string,
    user: { id: string; phone: string; name: string | null; language: string },
    session: SessionData | null,
    text: string
): Promise<void> {
    // Check for structured QR payload: GGKRISHI|BAG_ID|BATCH_ID|TOKEN
    if (text.toUpperCase().startsWith("GGKRISHI|")) {
        await handleQRPayload(phone, user, text);
        return;
    }

    // Check for plain bag label (GG-... format — manual entry or legacy QR)
    if (text.toUpperCase().startsWith("GG-")) {
        await handleBagEntry(phone, user, text.toUpperCase(), "PILOT_MRV");
        return;
    }

    // If session is in AWAITING_NAME_INPUT state, treat text as name edit
    if (session && session.state === "AWAITING_NAME_INPUT") {
        const editedName = text.trim().substring(0, 100);
        await prisma.user.update({ where: { id: user.id }, data: { name: editedName } });
        await prisma.session.update({ where: { id: session.id }, data: { userName: editedName, state: "AWAITING_GPS" } });
        await logActivity({ event: "NAME_CONFIRMED", sessionId: session.id, phone, details: { name: editedName, edited: true } });
        await sendLocationRequest(phone, session.language || "en", editedName);
        return;
    }

    // If in an active session, guide user to correct input
    if (session) {
        await sendStateGuidance(phone, session);
        return;
    }

    // Check if user was asked for bag ID (last log is BAG_ID_INPUT_REQUESTED)
    const lastLog = await prisma.activityLog.findFirst({
        where: { phone, event: "BAG_ID_INPUT_REQUESTED" },
        orderBy: { timestamp: "desc" },
    });
    if (lastLog && (Date.now() - lastLog.timestamp.getTime()) < 5 * 60 * 1000) {
        // Treat text as bag ID
        await handleBagEntry(phone, user, text.toUpperCase().trim(), "PILOT_MRV");
        return;
    }

    // No session, no QR → show gate screen
    await sendGateScreen(phone);
}

// ─── QR Payload Parser ───────────────────────────────────────────────

async function handleQRPayload(
    phone: string,
    user: { id: string },
    payload: string
): Promise<void> {
    const parts = payload.split("|");
    if (parts.length < 4) {
        await sendWhatsAppMessage(phone, "❌ Invalid QR code format. Please try scanning again.");
        return;
    }

    const [, bagLabel, , token] = parts;
    const policy = token?.toUpperCase() === "DEMO" ? "DEMO_AUTO" : "PILOT_MRV";

    await handleBagEntry(phone, user, bagLabel.toUpperCase(), policy);
}

// ─── Bag Entry (shared by QR and manual) ─────────────────────────────

async function handleBagEntry(
    phone: string,
    user: { id: string },
    label: string,
    policy: string
): Promise<void> {
    // Look up bag
    const bag = await prisma.bag.findUnique({ where: { label } });

    if (!bag) {
        await logActivity({ event: "BAG_NOT_FOUND", phone, details: { label } });
        await sendWhatsAppMessage(phone, "❌ Unknown bag ID. Please check the QR code or bag label and try again.");
        await sendGateScreen(phone);
        return;
    }

    if (bag.status !== "unused") {
        await logActivity({
            event: "BAG_CLAIM_REJECTED",
            bagId: bag.bagId,
            phone,
            details: { reason: "already used", currentStatus: bag.status },
        });
        await sendWhatsAppMessage(phone,
            `⚠️ Bag ${label} has already been used.\n\nThis bag cannot be verified again. If you believe this is an error, tap Need Help.`
        );
        return;
    }

    // Expire any stale sessions for this user
    await expireOldSessions(phone);

    // Create session
    const session = await prisma.session.create({
        data: {
            userId: user.id,
            bagId: bag.bagId,
            verificationPolicy: policy,
            state: "LANGUAGE_SELECT",
        },
    });

    // Mark bag as in_session
    await prisma.bag.update({
        where: { bagId: bag.bagId },
        data: { status: "in_session", assignedUserId: user.id },
    });

    await logActivity({
        event: "SESSION_STARTED",
        sessionId: session.id,
        bagId: bag.bagId,
        phone,
        details: { label, policy },
    });

    // Skip gate, go directly to language selection
    await sendInteractiveButtons(phone, "🌱 *GG Krishi*\n\nSelect your language:", [
        { id: "lang_en", title: "English" },
        { id: "lang_hi", title: "हिंदी" },
        { id: "btn_need_help", title: "❓ Need Help" },
    ]);
}

// ─── Location Handler ────────────────────────────────────────────────

async function handleLocation(
    phone: string,
    user: { id: string },
    session: SessionData | null,
    lat: number,
    lng: number
): Promise<void> {
    if (!session || session.state !== "AWAITING_GPS") {
        if (!session) await sendGateScreen(phone);
        else await sendStateGuidance(phone, session);
        return;
    }

    // Create submission with location
    await prisma.submission.create({
        data: {
            sessionId: session.id,
            userId: user.id,
            bagId: session.bagId,
            latitude: lat,
            longitude: lng,
            locationTimestamp: new Date(),
            verificationPolicy: session.verificationPolicy,
        },
    });

    await prisma.session.update({ where: { id: session.id }, data: { state: "AWAITING_PHOTO" } });

    await logActivity({
        event: "GPS_RECEIVED",
        sessionId: session.id,
        bagId: session.bagId,
        phone,
        details: { lat, lng },
    });

    const lang = session.language || "en";

    // Use the backend static asset for the reference image
    const baseUrl = process.env.APP_URL || "http://localhost:3001";
    const REFERENCE_IMAGE_URL = `${baseUrl}/assets/reference_image.png`;

    // Send reference image with full instructions in caption (single message — no ordering issues)
    const referenceMsg = lang === "en"
        ? "✅ Location received!\n\n📸 *Step 2: Take a photo like this example* 👆\n\nTap the 📎 icon below → Choose *Camera* → Take photo\n\n(Or select from *Gallery* if you already have one)"
        : "✅ लोकेशन मिल गई!\n\n📸 *चरण 2: इस उदाहरण की तरह फोटो लें* 👆\n\nनीचे 📎 आइकन टैप करें → *कैमरा* चुनें → फोटो लें\n\n(या *गैलरी* से चुनें यदि पहले से है)";

    await sendMediaMessage(phone, REFERENCE_IMAGE_URL, referenceMsg);
}

// ─── Image Handler ───────────────────────────────────────────────────

async function handleImage(
    phone: string,
    user: { id: string },
    session: SessionData | null,
    mediaId: string
): Promise<void> {
    if (!session || session.state !== "AWAITING_PHOTO") {
        if (!session) await sendGateScreen(phone);
        else await sendStateGuidance(phone, session);
        return;
    }

    // Find the submission for this session
    const submission = await prisma.submission.findUnique({ where: { sessionId: session.id } });
    if (!submission) {
        await sendWhatsAppMessage(phone, "❌ Something went wrong. Please try again.");
        return;
    }

    await prisma.session.update({ where: { id: session.id }, data: { state: "PROCESSING" } });

    const lang = session.language || "en";
    const processingMsg = lang === "en" ? "⏳ Analyzing your submission..." : "⏳ आपका सबमिशन जाँचा जा रहा है...";
    await sendWhatsAppMessage(phone, processingMsg);

    try {
        // Download image into memory buffer
        const buffer = await downloadWhatsAppMedia(mediaId, submission.id);
        const hash = computeImageHash(buffer);

        let driveFileId: string;
        try {
            driveFileId = await uploadFileToDrive(buffer, `${submission.id}.jpg`, "image/jpeg");
        } catch (uploadErr) {
            console.error("Drive upload failed", uploadErr);
            await logActivity({
                event: "DRIVE_UPLOAD_FAILED",
                sessionId: session.id,
                bagId: session.bagId,
                submissionId: submission.id,
                level: "ERROR",
                details: { error: String(uploadErr) },
            });
            throw uploadErr;
        }

        await logActivity({
            event: "IMAGE_RECEIVED",
            sessionId: session.id,
            bagId: session.bagId,
            submissionId: submission.id,
            phone,
            details: { imageSha256: hash, driveFileId },
        });

        // Check for duplicate image
        const duplicateId = await checkDuplicateSubmission(hash, submission.id);
        if (duplicateId) {
            await logActivity({
                event: "IMAGE_DUPLICATE",
                sessionId: session.id,
                bagId: session.bagId,
                submissionId: submission.id,
                phone,
                details: { matchedSubmissionId: duplicateId },
            });
        }

        // ─── DEMO_AUTO: instant verify ───
        if (session.verificationPolicy === "DEMO_AUTO") {
            await new Promise((r) => setTimeout(r, 2500)); // Simulated 2.5s delay

            await prisma.submission.update({
                where: { id: submission.id },
                data: {
                    mediaUrl: driveFileId,
                    mediaHash: hash,
                    verificationStatus: "VERIFIED",
                    aiConfidence: 0.99,
                    aiResponse: JSON.stringify({ mode: "DEMO_AUTO", auto_verified: true }),
                    fraudScore: 0,
                },
            });

            await prisma.bag.update({ where: { bagId: session.bagId }, data: { status: "used" } });
            await prisma.session.update({ where: { id: session.id }, data: { state: "REWARD" } });

            await logActivity({
                event: "DEMO_VERIFICATION",
                sessionId: session.id,
                bagId: session.bagId,
                submissionId: submission.id,
                phone,
                details: { policy: "DEMO_AUTO" },
            });

            await sendRewardScreen(phone, session, lang);
            return;
        }

        // ─── PILOT_MRV: rule-based + optional AI ───

        // Rule checks
        const ruleFlags: string[] = [];

        // 1. Bag exists and unused — already verified at entry
        // 2. Location exists
        if (!submission.latitude || !submission.longitude) {
            ruleFlags.push("MISSING_LOCATION");
        }
        // 3. Image exists — we have it
        // 4. Duplicate check
        if (duplicateId) {
            ruleFlags.push("IMAGE_DUPLICATE_HASH");
        }

        // 5. AI image sanity check (liberal threshold)
        let aiResult;
        try {
            aiResult = await analyzeImage({ buffer, mimeType: "image/jpeg" });
            await logActivity({
                event: "AI_ANALYSIS_COMPLETE",
                sessionId: session.id,
                bagId: session.bagId,
                submissionId: submission.id,
                details: { confidence: aiResult.confidence, aiResponse: aiResult },
            });

            // Liberal threshold — only flag if clearly bad
            if (aiResult.confidence < 0.3) {
                ruleFlags.push("VERY_LOW_AI_CONFIDENCE");
            }
            if (aiResult.screen_capture_detected) {
                ruleFlags.push("SCREEN_CAPTURE_DETECTED");
            }
        } catch (aiErr) {
            await logActivity({
                event: "AI_ANALYSIS_FAILED",
                sessionId: session.id,
                bagId: session.bagId,
                submissionId: submission.id,
                level: "ERROR",
                details: { error: String(aiErr) },
            });
            // AI failure is not a blocker — continue without it
            aiResult = { confidence: null, flags: ["AI_UNAVAILABLE"] } as any;
            ruleFlags.push("AI_UNAVAILABLE");
        }

        // Decision
        const hasIssues = ruleFlags.length > 0;
        const verificationStatus = hasIssues ? "PENDING_REVIEW" : "VERIFIED";

        await prisma.submission.update({
            where: { id: submission.id },
            data: {
                mediaUrl: driveFileId,
                mediaHash: hash,
                verificationStatus,
                verificationPolicy: "PILOT_MRV",
                reviewFlag: hasIssues,
                aiConfidence: aiResult?.confidence ?? null,
                aiResponse: aiResult ? JSON.stringify(aiResult) : null,
                fraudScore: ruleFlags.length > 0 ? ruleFlags.length * 0.25 : 0,
                fraudFlags: ruleFlags.length > 0 ? JSON.stringify(ruleFlags) : null,
            },
        });

        await prisma.bag.update({ where: { bagId: session.bagId }, data: { status: "used" } });
        await prisma.session.update({ where: { id: session.id }, data: { state: "REWARD" } });

        const eventName = verificationStatus === "VERIFIED" ? "VERIFICATION_APPROVED" : "VERIFICATION_PENDING";
        await logActivity({
            event: eventName,
            sessionId: session.id,
            bagId: session.bagId,
            submissionId: submission.id,
            phone,
            details: { verificationStatus, flags: ruleFlags, confidence: aiResult?.confidence },
        });

        if (verificationStatus === "VERIFIED") {
            await sendRewardScreen(phone, session, lang);
        } else {
            // PENDING_REVIEW
            const msg = lang === "en"
                ? "⏳ Your submission is under review.\n\nOur team will verify and notify you once it's approved. Thank you for your patience!"
                : "⏳ आपका सबमिशन समीक्षा में है।\n\nहमारी टीम जाँच करके आपको सूचित करेगी। धन्यवाद!";
            await sendInteractiveButtons(phone, msg, [
                { id: "btn_finish", title: lang === "en" ? "👋 OK" : "👋 ठीक" },
                { id: "btn_reward_help", title: lang === "en" ? "❓ Need Help" : "❓ मदद" },
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { state: "REVIEW_ACK" } });
        }

    } catch (err) {
        console.error("Image processing error:", err);
        await sendWhatsAppMessage(phone, "❌ Something went wrong processing your image. Please try sending it again.");
        await prisma.session.update({ where: { id: session.id }, data: { state: "AWAITING_PHOTO" } });
    }
}

// ─── Reward Screen ───────────────────────────────────────────────────

export async function sendRewardScreen(phone: string, session: any, lang: string): Promise<void> {
    const bag = await prisma.bag.findUnique({ where: { bagId: session.bagId } });
    const bagLabel = bag?.label || "Unknown";

    const msg = lang === "en"
        ? `✅ *Verification Successful!*\n\n🏷 Bag: ${bagLabel}\n💰 ₹1111 added to your GG Wallet\n🌍 1,500 kg CO₂ permanently sequestered\n\nThank you for contributing to carbon removal!`
        : `✅ *सत्यापन सफल!*\n\n🏷 बैग: ${bagLabel}\n💰 ₹1111 आपके GG वॉलेट में जोड़े गए\n🌍 1,500 kg CO₂ स्थायी रूप से अलग किया गया\n\nकार्बन हटाने में योगदान के लिए धन्यवाद!`;

    await sendInteractiveButtons(phone, msg, [
        { id: "btn_finish", title: lang === "en" ? "✅ Finish" : "✅ समाप्त" },
        { id: "btn_withdrawal", title: lang === "en" ? "💰 Withdrawal" : "💰 निकासी" },
        { id: "btn_reward_help", title: lang === "en" ? "❓ Help" : "❓ मदद" },
    ]);
}

// ─── Gate Screen ─────────────────────────────────────────────────────

async function sendGateScreen(phone: string): Promise<void> {
    await sendInteractiveButtons(
        phone,
        "🌱 *Welcome to GG Krishi*\n\nTo begin, scan your GG bag QR or enter your Bag ID.",
        [
            { id: "btn_scan_qr", title: "📱 Scan QR" },
            { id: "btn_enter_bag_id", title: "📝 Enter Bag ID" },
            { id: "btn_need_help", title: "❓ Need Help" },
        ]
    );
    // Note: WhatsApp buttons max is 3. "Explore More" sent as follow-up.
    // We could use a list instead but keeping it button-first for simplicity.
}

// ─── State Guidance ──────────────────────────────────────────────────

async function sendStateGuidance(phone: string, session: SessionData): Promise<void> {
    const lang = session.language || "en";

    if (session.state === "AWAITING_GPS") {
        await sendLocationRequest(phone, lang, session.userName || "Farmer");
    } else if (session.state === "AWAITING_PHOTO") {
        const msg = lang === "en"
            ? "📸 Please tap the 📎 icon below to send a photo of biochar applied on soil.\n\nChoose *Camera* to take a new photo, or *Gallery* to select an existing one."
            : "📸 कृपया नीचे 📎 आइकन टैप करें और मिट्टी पर लगाए गए बायोचार की फोटो भेजें।\n\n*कैमरा* चुनें नई फोटो लेने के लिए, या *गैलरी* से पहले से ली गई फोटो चुनें।";
        await sendWhatsAppMessage(phone, msg);
    } else if (session.state === "LANGUAGE_SELECT") {
        await sendInteractiveButtons(phone, "🌱 *GG Krishi*\n\nSelect your language:", [
            { id: "lang_en", title: "English" },
            { id: "lang_hi", title: "हिंदी" },
        ]);
    } else if (session.state === "NAME_CONFIRM") {
        const displayName = session.userName || "Farmer";
        await sendInteractiveButtons(phone, `Is your name *${displayName}*?`, [
            { id: "name_yes", title: "✅ Yes" },
            { id: "name_edit", title: "✏️ Edit" },
        ]);
    } else if (session.state === "AWAITING_NAME_INPUT") {
        const msg = lang === "en"
            ? "📝 Please type your name:"
            : "📝 कृपया अपना नाम लिखें:";
        await sendWhatsAppMessage(phone, msg);
    } else if (session.state === "REWARD") {
        await sendRewardScreen(phone, session, lang);
    } else if (session.state === "REVIEW_ACK") {
        const msg = lang === "en"
            ? "⏳ Your submission is under review.\n\nOur team will verify and notify you once it's approved. Thank you for your patience!"
            : "⏳ आपका सबमिशन समीक्षा में है।\n\nहमारी टीम जाँच करके आपको सूचित करेगी। धन्यवाद!";
        await sendInteractiveButtons(phone, msg, [
            { id: "btn_finish", title: lang === "en" ? "👋 OK" : "👋 ठीक" },
            { id: "btn_reward_help", title: lang === "en" ? "❓ Need Help" : "❓ मदद" },
        ]);
    } else if (session.state === "PROCESSING") {
        const msg = lang === "en"
            ? "⏳ We are still analyzing your submission. Please wait a moment and avoid resending the same photo."
            : "⏳ हम अभी आपका सबमिशन जाँच रहे हैं। कृपया थोड़ा इंतज़ार करें और वही फोटो दोबारा न भेजें।";
        await sendWhatsAppMessage(phone, msg);
    } else if (session.state === "COMPLETED") {
        const msg = lang === "en"
            ? "✅ This verification is already completed.\n\nYou can start a new one any time by sending your Bag ID."
            : "✅ यह सत्यापन पहले ही पूरा हो चुका है।\n\nआप किसी भी समय Bag ID भेजकर नया सत्यापन शुरू कर सकते हैं।";
        await sendWhatsAppMessage(phone, msg);
    }
}

async function sendNoActiveSessionGuidance(phone: string, lang: string, buttonId: string): Promise<void> {
    const isHindi = lang === "hi";

    if (buttonId === "btn_withdrawal") {
        const msg = isHindi
            ? "✅ आपकी निकासी अनुरोध पहले ही दर्ज की जा चुकी है या सत्र समाप्त हो चुका है।\n\nटीम आपसे संपर्क करेगी।"
            : "✅ Your withdrawal request is already logged, or this session has ended.\n\nOur team will contact you.";
        await sendWhatsAppMessage(phone, msg);
        return;
    }

    if (buttonId === "btn_finish") {
        const msg = isHindi
            ? "✅ यह सत्र पहले ही पूरा हो चुका है।\n\nनया सत्यापन शुरू करने के लिए Bag ID भेजें।"
            : "✅ This session is already completed.\n\nSend your Bag ID to start a new verification.";
        await sendWhatsAppMessage(phone, msg);
        return;
    }

    const sessionButtons = new Set(["lang_en", "lang_hi", "name_yes", "name_edit"]);
    if (sessionButtons.has(buttonId)) {
        const msg = isHindi
            ? "ℹ️ यह बटन पुराने सत्र का है जो अब सक्रिय नहीं है।\n\nनया सत्यापन शुरू करने के लिए Bag ID भेजें।"
            : "ℹ️ This button is from an older session that is no longer active.\n\nSend your Bag ID to start a new verification.";
        await sendWhatsAppMessage(phone, msg);
        return;
    }

    const fallback = isHindi
        ? "ℹ️ अभी कोई सक्रिय सत्यापन सत्र नहीं मिला।\n\nकृपया Bag ID भेजकर नया सत्यापन शुरू करें।"
        : "ℹ️ No active verification session was found.\n\nPlease send your Bag ID to start a new verification.";
    await sendWhatsAppMessage(phone, fallback);
}

// ─── Location Request ────────────────────────────────────────────────

async function sendLocationRequest(phone: string, lang: string, userName: string): Promise<void> {
    const msg = lang === "en"
        ? `Hi ${userName}! Let's now verify your GG Biochar in 3 simple steps 😃\n\nStep 1:\nSend your current field location`
        : `नमस्ते ${userName}! आइए अब 3 आसान चरणों में आपके GG बायोचार को सत्यापित करें 😃\n\nचरण 1:\nअपना वर्तमान खेत का स्थान भेजें`;

    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`📱 [MOCK LOCATION MSG] To ${phone}: ${msg}`);
        return;
    }

    await graphApiPost({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
            type: "location_request_message",
            body: { text: msg },
            action: { name: "send_location" },
        },
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────

type SessionData = {
    id: string;
    userId: string;
    bagId: string;
    verificationPolicy: string;
    state: string;
    language: string | null;
    userName: string | null;
    startedAt: Date;
};

async function getOrCreateUser(phone: string, profileName: string | null) {
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
        user = await prisma.user.create({
            data: { phone, name: profileName },
        });
    } else if (profileName && !user.name) {
        user = await prisma.user.update({
            where: { phone },
            data: { name: profileName },
        });
    }
    return user;
}

async function getActiveSession(phone: string): Promise<SessionData | null> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return null;

    const session = await prisma.session.findFirst({
        where: {
            userId: user.id,
            state: { notIn: ["COMPLETED"] },
            timeoutFlag: false,
        },
        orderBy: { startedAt: "desc" },
    });

    if (!session) return null;

    // Check timeout
    if (Date.now() - session.startedAt.getTime() > SESSION_TIMEOUT_MS) {
        await prisma.session.update({ where: { id: session.id }, data: { timeoutFlag: true } });
        // Reset bag if still in_session
        await prisma.bag.updateMany({
            where: { bagId: session.bagId, status: "in_session" },
            data: { status: "unused", assignedUserId: null },
        });
        await logActivity({
            event: "SESSION_TIMEOUT",
            sessionId: session.id,
            bagId: session.bagId,
            phone,
        });
        return null;
    }

    return session as SessionData;
}

async function expireOldSessions(phone: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return;

    const activeSessions = await prisma.session.findMany({
        where: { userId: user.id, state: { notIn: ["COMPLETED"] }, timeoutFlag: false },
    });

    for (const s of activeSessions) {
        await prisma.session.update({ where: { id: s.id }, data: { timeoutFlag: true } });
        await prisma.bag.updateMany({
            where: { bagId: s.bagId, status: "in_session" },
            data: { status: "unused", assignedUserId: null },
        });
    }
}

async function checkDuplicateSubmission(hash: string, currentSubmissionId: string): Promise<string | null> {
    const existing = await prisma.submission.findFirst({
        where: {
            mediaHash: hash,
            id: { not: currentSubmissionId },
        },
    });
    return existing ? existing.id : null;
}

// ─── WhatsApp API Helpers ────────────────────────────────────────────

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`📱 [MOCK] To ${to}: ${body}`);
        return;
    }
    await graphApiPost({ messaging_product: "whatsapp", to, type: "text", text: { body } });
}

export async function sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
): Promise<void> {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`📱 [MOCK BUTTONS] To ${to}: ${bodyText} | Buttons: ${buttons.map(b => b.title).join(", ")}`);
        return;
    }

    await graphApiPost({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: bodyText },
            action: {
                buttons: buttons.map((b) => ({
                    type: "reply",
                    reply: { id: b.id, title: b.title.substring(0, 20) }, // Max 20 chars
                })),
            },
        },
    });
}

async function sendInteractiveList(
    to: string,
    headerText: string,
    bodyText: string,
    buttonLabel: string,
    items: Array<{ id: string; title: string }>
): Promise<void> {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`📱 [MOCK LIST] To ${to}: ${bodyText}`);
        return;
    }

    await graphApiPost({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "list",
            header: { type: "text", text: headerText },
            body: { text: bodyText },
            action: {
                button: buttonLabel,
                sections: [
                    {
                        title: "Options",
                        rows: items.map((item) => ({
                            id: item.id,
                            title: item.title.substring(0, 24),
                        })),
                    },
                ],
            },
        },
    });
}

export async function sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption: string
): Promise<void> {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`📱 [MOCK MEDIA] To ${to}: ${caption}`);
        return;
    }
    await graphApiPost({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
            link: mediaUrl,
            caption
        }
    });
}

function graphApiPost(data: Record<string, unknown>): Promise<void> {
    const payload = JSON.stringify(data);
    const options = {
        hostname: "graph.facebook.com",
        path: `/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => (responseData += chunk));
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 400) {
                    console.error(`WhatsApp API error ${res.statusCode}:`, responseData);
                }
                resolve();
            });
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

async function downloadWhatsAppMedia(mediaId: string, submissionId: string): Promise<Buffer> {
    if (!WHATSAPP_API_TOKEN) {
        console.log(`📥 [MOCK] Would download media ${mediaId}`);
        return Buffer.from("mock image content");
    }

    // Step 1: Get media URL
    const mediaUrl = await new Promise<string>((resolve, reject) => {
        const options = {
            hostname: "graph.facebook.com",
            path: `/v22.0/${mediaId}`,
            method: "GET",
            headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.url);
                } catch {
                    reject(new Error(`Failed to parse media URL: ${data}`));
                }
            });
        });
        req.on("error", reject);
        req.end();
    });

    // Step 2: Download the actual file
    return await new Promise<Buffer>((resolve, reject) => {
        const url = new URL(mediaUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: "GET",
            headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
        };
        const req = https.request(options, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            res.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
        });
        req.on("error", reject);
        req.end();
    });
}

export default router;
