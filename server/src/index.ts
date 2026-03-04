import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as QRCode from "qrcode";
import prisma, { logActivity } from "./logger";
import whatsappRouter, { sendRewardScreen, sendInteractiveButtons } from "./whatsapp";
import { getFileStreamFromDrive } from "./drive";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ─── WhatsApp Webhook ────────────────────────────────────────────────
app.use("/api/whatsapp/webhook", whatsappRouter);

// ─── Static Files ────────────────────────────────────────────────────
import * as path from "path";
// Serve from 'public' folder (works in both dev and production)
app.use("/assets", express.static(path.join(__dirname, "../public")));

// ─── Bag CRUD ────────────────────────────────────────────────────────

// Create new bag
app.post("/api/bags", async (req, res) => {
    try {
        const { batchId, mode } = req.body || {};
        const count = await prisma.bag.count();
        const num = String(count + 1).padStart(5, "0");
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

        const isDemo = mode === "DEMO";
        const label = isDemo
            ? `GG-DEMO-${num}`
            : `GG-P1-${dateStr}-B${num}`;

        const bag = await prisma.bag.create({
            data: {
                label,
                batchId: batchId || (isDemo ? "BATCH-DEMO" : `BATCH-${dateStr}`),
                status: "unused",
            },
        });

        await logActivity({
            event: "BAG_CREATED",
            bagId: bag.bagId,
            details: { label: bag.label, batchId: bag.batchId, mode: isDemo ? "demo" : "pilot" },
        });

        res.json(bag);
    } catch (err) {
        console.error("Create bag error:", err);
        res.status(500).json({ error: "Failed to create bag" });
    }
});

// List all bags
app.get("/api/bags", async (_req, res) => {
    try {
        const bags = await prisma.bag.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                assignedUser: { select: { phone: true, name: true } },
                _count: { select: { sessions: true, submissions: true } },
            },
        });
        res.json(bags);
    } catch (err) {
        console.error("List bags error:", err);
        res.status(500).json({ error: "Failed to list bags" });
    }
});

// Get single bag
app.get("/api/bags/:id", async (req, res) => {
    try {
        const bag = await prisma.bag.findUnique({
            where: { bagId: req.params.id },
            include: {
                assignedUser: true,
                sessions: { include: { submission: true } },
            },
        });
        if (!bag) {
            res.status(404).json({ error: "Bag not found" });
            return;
        }
        res.json(bag);
    } catch (err) {
        console.error("Get bag error:", err);
        res.status(500).json({ error: "Failed to get bag" });
    }
});

// Reset bag
app.post("/api/bags/:id/reset", async (req, res) => {
    try {
        const bag = await prisma.bag.update({
            where: { bagId: req.params.id },
            data: { status: "unused", assignedUserId: null },
        });
        await logActivity({
            event: "BAG_RESET",
            bagId: bag.bagId,
            details: { label: bag.label },
        });
        res.json(bag);
    } catch (err) {
        console.error("Reset bag error:", err);
        res.status(500).json({ error: "Failed to reset bag" });
    }
});

// Generate QR code for a bag
app.get("/api/bags/:id/qr", async (req, res) => {
    try {
        const bag = await prisma.bag.findUnique({
            where: { bagId: req.params.id },
        });
        if (!bag) {
            res.status(404).json({ error: "Bag not found" });
            return;
        }

        const waNumber = process.env.WHATSAPP_PHONE_NUMBER || "91XXXXXXXXXX";
        const mode = bag.batchId?.includes("DEMO") ? "DEMO" : "PILOT";
        const payload = `GGKRISHI|${bag.label}|${bag.batchId || "DEFAULT"}|${mode}`;
        const qrData = `https://wa.me/${waNumber}?text=${encodeURIComponent(payload)}`;

        const svg = await QRCode.toString(qrData, { type: "svg", margin: 2 });

        res.setHeader("Content-Type", "image/svg+xml");
        res.send(svg);
    } catch (err) {
        console.error("QR generation error:", err);
        res.status(500).json({ error: "Failed to generate QR" });
    }
});

// ─── Users ───────────────────────────────────────────────────────────

app.get("/api/users", async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { sessions: true, submissions: true } },
            },
        });
        res.json(users);
    } catch (err) {
        console.error("Users error:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Get single user with sessions and submissions
app.get("/api/users/:id", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                sessions: {
                    orderBy: { startedAt: "desc" },
                    select: {
                        id: true,
                        state: true,
                        verificationPolicy: true,
                        startedAt: true,
                        completedAt: true,
                        bag: { select: { label: true } },
                        submission: { select: { verificationStatus: true } },
                    },
                },
                submissions: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        verificationStatus: true,
                        createdAt: true,
                        aiConfidence: true,
                        bag: { select: { label: true } },
                    },
                },
                _count: { select: { sessions: true, submissions: true } },
            },
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json(user);
    } catch (err) {
        console.error("Get user error:", err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// ─── Sessions ────────────────────────────────────────────────────────

app.get("/api/sessions", async (req, res) => {
    try {
        const { policy, state, userId } = req.query;
        const where: Record<string, unknown> = {};
        if (policy) where.verificationPolicy = policy;
        if (state) where.state = state;
        if (userId) where.userId = userId;

        const sessions = await prisma.session.findMany({
            where,
            orderBy: { startedAt: "desc" },
            include: {
                user: { select: { phone: true, name: true } },
                bag: { select: { label: true, batchId: true } },
                submission: { select: { verificationStatus: true } },
            },
        });
        res.json(sessions);
    } catch (err) {
        console.error("Sessions error:", err);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// Get single session
app.get("/api/sessions/:id", async (req, res) => {
    try {
        const session = await prisma.session.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { phone: true, name: true } },
                bag: { select: { label: true, batchId: true } },
                submission: { select: { verificationStatus: true } },
            },
        });
        if (!session) {
            res.status(404).json({ error: "Session not found" });
            return;
        }
        res.json(session);
    } catch (err) {
        console.error("Get session error:", err);
        res.status(500).json({ error: "Failed to fetch session" });
    }
});

// ─── Submissions (replaces /api/history) ─────────────────────────────

app.get("/api/submissions", async (req, res) => {
    try {
        const { status, policy, userId } = req.query;
        const where: Record<string, unknown> = {};
        if (status) where.verificationStatus = status;
        if (policy) where.verificationPolicy = policy;
        if (userId) where.userId = userId;

        const submissions = await prisma.submission.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { phone: true, name: true } },
                bag: { select: { label: true, batchId: true } },
                session: { select: { verificationPolicy: true, language: true } },
            },
        });
        res.json(submissions);
    } catch (err) {
        console.error("Submissions error:", err);
        res.status(500).json({ error: "Failed to fetch submissions" });
    }
});

// Get single submission
app.get("/api/submissions/:id", async (req, res) => {
    try {
        const submission = await prisma.submission.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { phone: true, name: true } },
                bag: { select: { label: true, batchId: true } },
                session: { select: { verificationPolicy: true, language: true } },
            },
        });
        if (!submission) {
            res.status(404).json({ error: "Submission not found" });
            return;
        }
        res.json(submission);
    } catch (err) {
        console.error("Get submission error:", err);
        res.status(500).json({ error: "Failed to fetch submission" });
    }
});

// Approve submission
app.post("/api/submissions/:id/approve", async (req, res) => {
    try {
        const current = await prisma.submission.findUnique({ where: { id: req.params.id } });
        if (!current) {
            res.status(404).json({ error: "Submission not found" });
            return;
        }
        if (current.verificationStatus === "VERIFIED") {
            res.json(current);
            return;
        }

        const submission = await prisma.submission.update({
            where: { id: req.params.id },
            data: { verificationStatus: "VERIFIED", reviewFlag: false },
            include: { user: true, session: true },
        });
        await logActivity({
            event: "SUBMISSION_APPROVED",
            submissionId: submission.id,
            bagId: submission.bagId,
            details: { manual: true },
        });

        // Send WhatsApp success message
        if (submission.user?.phone && submission.session) {
            try {
                await sendRewardScreen(submission.user.phone, submission.session, submission.user.language || "en");
            } catch (waErr) {
                console.error("Failed to send WA approval message:", waErr);
            }
        }

        res.json(submission);
    } catch (err) {
        console.error("Approve error:", err);
        res.status(500).json({ error: "Failed to approve submission" });
    }
});

// Reject submission
app.post("/api/submissions/:id/reject", async (req, res) => {
    try {
        const current = await prisma.submission.findUnique({ where: { id: req.params.id } });
        if (!current) {
            res.status(404).json({ error: "Submission not found" });
            return;
        }
        if (current.verificationStatus === "REJECTED") {
            res.json(current);
            return;
        }

        const submission = await prisma.submission.update({
            where: { id: req.params.id },
            data: { verificationStatus: "REJECTED", reviewFlag: false },
            include: { user: true },
        });
        // Also flag the bag
        await prisma.bag.update({
            where: { bagId: submission.bagId },
            data: { status: "flagged" },
        });
        await logActivity({
            event: "SUBMISSION_REJECTED",
            submissionId: submission.id,
            bagId: submission.bagId,
            details: { manual: true },
        });

        // Send WhatsApp rejection message
        if (submission.user?.phone) {
            try {
                const lang = submission.user.language || "en";
                const msg = lang === "en"
                    ? "❌ Your photo submission has been rejected upon manual review.\n\nPlease contact customer support for further assistance."
                    : "❌ मैन्युअल समीक्षा के बाद आपकी फ़ोटो अस्वीकार कर दी गई है।\n\nकृपया सहायता के लिए ग्राहक सेवा से संपर्क करें।";

                await sendInteractiveButtons(submission.user.phone, msg, [
                    { id: "btn_need_help", title: lang === "en" ? "❓ Contact Support" : "❓ ग्राहक सेवा" }
                ]);
            } catch (waErr) {
                console.error("Failed to send WA rejection message:", waErr);
            }
        }

        res.json(submission);
    } catch (err) {
        console.error("Reject error:", err);
        res.status(500).json({ error: "Failed to reject submission" });
    }
});

// Stream image
app.get("/api/submissions/:id/image", async (req, res) => {
    try {
        const submission = await prisma.submission.findUnique({
            where: { id: req.params.id },
            select: { mediaUrl: true }
        });

        if (!submission || !submission.mediaUrl) {
            res.status(404).json({ error: "Image not found" });
            return;
        }

        // If mediaUrl is a local path (legacy submissions before drive integration)
        if (submission.mediaUrl.endsWith(".jpg") || submission.mediaUrl.endsWith(".png") || submission.mediaUrl.includes("/")) {
            const fs = await import("fs");
            if (fs.existsSync(submission.mediaUrl)) {
                res.setHeader("Content-Type", "image/jpeg");
                fs.createReadStream(submission.mediaUrl).pipe(res);
                return;
            } else {
                res.status(404).json({ error: "Legacy local image not found" });
                return;
            }
        }

        // Fetch from Google Drive
        const stream = await getFileStreamFromDrive(submission.mediaUrl);
        res.setHeader("Content-Type", "image/jpeg");
        stream.pipe(res);

    } catch (err) {
        console.error("Error streaming image:", err);
        res.status(500).json({ error: "Failed to fetch image" });
    }
});

// CSV export
app.get("/api/submissions/export", async (_req, res) => {
    try {
        const submissions = await prisma.submission.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { phone: true, name: true } },
                bag: { select: { label: true, batchId: true } },
            },
        });

        const headers = [
            "ID", "Bag Label", "Batch ID", "User Phone", "User Name",
            "Latitude", "Longitude", "Status", "Policy",
            "AI Confidence", "Fraud Score", "Review Flag", "Created At"
        ];

        const rows = submissions.map((s) => [
            s.id,
            s.bag.label,
            s.bag.batchId || "",
            s.user.phone,
            s.user.name || "",
            s.latitude?.toString() || "",
            s.longitude?.toString() || "",
            s.verificationStatus,
            s.verificationPolicy,
            s.aiConfidence?.toFixed(2) || "",
            s.fraudScore?.toFixed(2) || "",
            s.reviewFlag ? "YES" : "NO",
            s.createdAt.toISOString(),
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=gg-krishi-submissions.csv");
        res.send(csv);
    } catch (err) {
        console.error("CSV export error:", err);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});

// ─── Help Requests ───────────────────────────────────────────────────

app.get("/api/help-requests", async (_req, res) => {
    try {
        const helpLogs = await prisma.activityLog.findMany({
            where: { event: { in: ["HELP_REQUESTED", "WITHDRAWAL_REQUESTED"] } },
            orderBy: { timestamp: "desc" },
            take: 100,
        });
        res.json(helpLogs);
    } catch (err) {
        console.error("Help requests error:", err);
        res.status(500).json({ error: "Failed to fetch help requests" });
    }
});

// ─── Tickets ─────────────────────────────────────────────────────────

// List all tickets with context
app.get("/api/tickets", async (_req, res) => {
    try {
        const tickets = await prisma.ticket.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { phone: true, name: true, language: true } },
                session: {
                    select: {
                        state: true,
                        verificationPolicy: true,
                        bag: { select: { label: true } }
                    }
                },
                submission: {
                    select: {
                        verificationStatus: true,
                        bag: { select: { label: true } }
                    }
                },
                bag: { select: { label: true } },
                _count: { select: { notes: true, statusHistory: true } }
            },
        });
        res.json(tickets);
    } catch (err) {
        console.error("Tickets error:", err);
        res.status(500).json({ error: "Failed to fetch tickets" });
    }
});

// Get single ticket with full details
app.get("/api/tickets/:id", async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                user: {
                    select: {
                        id: true,
                        phone: true,
                        name: true,
                        language: true,
                        createdAt: true,
                        _count: { select: { submissions: true, tickets: true } }
                    }
                },
                session: {
                    select: {
                        id: true,
                        state: true,
                        verificationPolicy: true,
                        startedAt: true,
                        bag: { select: { label: true, batchId: true } }
                    }
                },
                submission: {
                    select: {
                        id: true,
                        verificationStatus: true,
                        latitude: true,
                        longitude: true,
                        mediaUrl: true,
                        aiConfidence: true,
                        fraudScore: true,
                        createdAt: true,
                        bag: { select: { label: true } }
                    }
                },
                bag: { select: { label: true, batchId: true, status: true } },
                notes: { orderBy: { createdAt: "desc" } },
                statusHistory: { orderBy: { changedAt: "desc" } }
            }
        });

        if (!ticket) {
            res.status(404).json({ error: "Ticket not found" });
            return;
        }

        // Fetch user's submission history (last 10)
        const userSubmissions = ticket.userId ? await prisma.submission.findMany({
            where: { userId: ticket.userId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                verificationStatus: true,
                createdAt: true,
                bag: { select: { label: true } },
                aiConfidence: true
            }
        }) : [];

        // Fetch user's previous tickets (last 5, excluding current)
        const previousTickets = ticket.userId ? await prisma.ticket.findMany({
            where: {
                userId: ticket.userId,
                id: { not: ticket.id }
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                ticketNumber: true,
                status: true,
                category: true,
                description: true,
                createdAt: true,
                resolvedAt: true
            }
        }) : [];

        res.json({
            ...ticket,
            userSubmissions,
            previousTickets
        });
    } catch (err) {
        console.error("Get ticket error:", err);
        res.status(500).json({ error: "Failed to fetch ticket" });
    }
});

// Update ticket status
app.post("/api/tickets/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) {
            res.status(400).json({ error: "Invalid status" });
            return;
        }

        const current = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!current) {
            res.status(404).json({ error: "Ticket not found" });
            return;
        }

        const updateData: { status: string; resolvedAt?: Date } = { status };
        if (status === "RESOLVED") {
            updateData.resolvedAt = new Date();
        }

        const [ticket] = await prisma.$transaction([
            prisma.ticket.update({
                where: { id: req.params.id },
                data: updateData,
            }),
            prisma.ticketStatusChange.create({
                data: {
                    ticketId: req.params.id,
                    fromStatus: current.status,
                    toStatus: status,
                    changedBy: "agent"
                }
            })
        ]);

        res.json(ticket);
    } catch (err) {
        console.error("Update ticket status error:", err);
        res.status(500).json({ error: "Failed to update ticket status" });
    }
});

// Add note to ticket
app.post("/api/tickets/:id/notes", async (req, res) => {
    try {
        const { content, createdBy } = req.body;

        if (!content || content.trim().length === 0) {
            res.status(400).json({ error: "Note content is required" });
            return;
        }

        const note = await prisma.ticketNote.create({
            data: {
                ticketId: req.params.id,
                content: content.trim(),
                createdBy: createdBy || "agent"
            }
        });

        res.json(note);
    } catch (err) {
        console.error("Add note error:", err);
        res.status(500).json({ error: "Failed to add note" });
    }
});

// Resolve ticket (enhanced with status history)
app.post("/api/tickets/:id/resolve", async (req, res) => {
    try {
        const current = await prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!current) {
            res.status(404).json({ error: "Ticket not found" });
            return;
        }

        const [ticket] = await prisma.$transaction([
            prisma.ticket.update({
                where: { id: req.params.id },
                data: {
                    status: "RESOLVED",
                    resolvedAt: new Date()
                },
            }),
            prisma.ticketStatusChange.create({
                data: {
                    ticketId: req.params.id,
                    fromStatus: current.status,
                    toStatus: "RESOLVED",
                    changedBy: "agent"
                }
            })
        ]);

        res.json(ticket);
    } catch (err) {
        console.error("Resolve ticket error:", err);
        res.status(500).json({ error: "Failed to resolve ticket" });
    }
});

// ─── Activity Logs ───────────────────────────────────────────────────

app.get("/api/logs", async (req, res) => {
    try {
        const { event, level, bagId, limit } = req.query;

        const where: Record<string, unknown> = {};
        if (event) where.event = event;
        if (level) where.level = level;
        if (bagId) where.bagId = bagId;

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: Number(limit) || 100,
            include: {
                bag: { select: { label: true } },
            },
        });
        res.json(logs);
    } catch (err) {
        console.error("Logs error:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// ─── Start Server ────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🚀 GG Krishi Server running on http://localhost:${PORT}`);
    console.log(`📡 WhatsApp webhook: http://localhost:${PORT}/api/whatsapp/webhook`);
    console.log(`📊 Bags API: http://localhost:${PORT}/api/bags`);
    console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
    console.log(`📋 Sessions API: http://localhost:${PORT}/api/sessions`);
    console.log(`📄 Submissions API: http://localhost:${PORT}/api/submissions`);
    console.log(`🎫 Tickets API: http://localhost:${PORT}/api/tickets`);
    console.log(`📜 Logs API: http://localhost:${PORT}/api/logs\n`);
});
