import * as crypto from "crypto";
import * as fs from "fs";
import prisma from "./logger";
import type { AIVerificationResult } from "./ai";

interface FraudResult {
    score: number;
    flags: string[];
    decision: "VERIFIED" | "REJECTED" | "PENDING";
}

/**
 * Compute SHA-256 hash of an image file
 */
export function computeImageHash(imagePath: string): string {
    const buffer = fs.readFileSync(imagePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Check if this image hash already exists in the database
 */
export async function checkDuplicateImage(hash: string, currentBagId: string): Promise<string | null> {
    const existing = await prisma.verification.findFirst({
        where: {
            imageSha256: hash,
            bagId: { not: currentBagId },
        },
    });
    return existing ? existing.id : null;
}

/**
 * Run fraud scoring pipeline on a verification
 */
export function calculateFraudScore(
    aiResult: AIVerificationResult,
    isDuplicateImage: boolean
): FraudResult {
    const flags: string[] = [];
    let score = 0;

    // Check 1: Duplicate image (instant reject)
    if (isDuplicateImage) {
        return {
            score: 1.0,
            flags: ["IMAGE_DUPLICATE_HASH"],
            decision: "REJECTED",
        };
    }

    // Check 2: AI confidence
    if (aiResult.confidence < 0.70) {
        score += 0.30;
        flags.push("LOW_AI_CONFIDENCE");
    }

    // Check 3: Screen capture detected
    if (aiResult.screen_capture_detected) {
        score += 0.50;
        flags.push("SCREEN_CAPTURE_DETECTED");
    }

    // Check 4: No biochar visible
    if (!aiResult.biochar_visible) {
        score += 0.25;
        flags.push("NO_BIOCHAR_VISIBLE");
    }

    // Check 5: No soil visible
    if (!aiResult.soil_visible) {
        score += 0.15;
        flags.push("NO_SOIL_VISIBLE");
    }

    // Check 6: Not outdoor
    if (!aiResult.outdoor_environment) {
        score += 0.20;
        flags.push("NOT_OUTDOOR");
    }

    // Cap score at 1.0
    score = Math.min(score, 1.0);

    // Decision
    let decision: FraudResult["decision"];
    if (score > 0.50) {
        decision = "REJECTED";
    } else if (score < 0.20) {
        decision = "VERIFIED";
    } else {
        decision = "PENDING";
    }

    return { score, flags, decision };
}
