import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type LogEvent =
    // Bag lifecycle
    | "BAG_CREATED"
    | "BAG_CLAIMED"
    | "BAG_CLAIM_REJECTED"
    | "BAG_NOT_FOUND"
    | "BAG_RESET"
    // Session lifecycle
    | "SESSION_STARTED"
    | "SESSION_COMPLETED"
    | "SESSION_TIMEOUT"
    // Flow events
    | "LANGUAGE_SELECTED"
    | "NAME_CONFIRMED"
    | "GPS_RECEIVED"
    | "WRONG_MESSAGE_TYPE"
    | "IMAGE_RECEIVED"
    | "IMAGE_DUPLICATE"
    // Verification
    | "AI_ANALYSIS_COMPLETE"
    | "AI_ANALYSIS_FAILED"
    | "FRAUD_SCORE_CALCULATED"
    | "VERIFICATION_APPROVED"
    | "VERIFICATION_REJECTED"
    | "VERIFICATION_PENDING"
    | "DEMO_VERIFICATION"
    // Admin actions
    | "SUBMISSION_APPROVED"
    | "SUBMISSION_REJECTED"
    // User interactions
    | "HELP_REQUESTED"
    | "EXPLORE_MORE"
    | "WITHDRAWAL_REQUESTED";

export type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogParams {
    event: LogEvent;
    level?: LogLevel;
    bagId?: string;
    sessionId?: string;
    submissionId?: string;
    phone?: string;
    details?: Record<string, unknown>;
}

export async function logActivity(params: LogParams): Promise<void> {
    const { event, level, bagId, sessionId, submissionId, phone, details } = params;

    // Determine level from event if not provided
    const resolvedLevel =
        level ??
        (event.includes("REJECTED") || event.includes("DUPLICATE") || event.includes("NOT_FOUND") || event.includes("WRONG")
            ? "WARN"
            : event.includes("FAILED") || event.includes("TIMEOUT")
                ? "ERROR"
                : "INFO");

    try {
        await prisma.activityLog.create({
            data: {
                event,
                level: resolvedLevel,
                bagId: bagId ?? null,
                sessionId: sessionId ?? null,
                submissionId: submissionId ?? null,
                phone: phone ?? null,
                details: details ? JSON.stringify(details) : null,
            },
        });

        // Also log to console for development
        const emoji = resolvedLevel === "ERROR" ? "🔴" : resolvedLevel === "WARN" ? "🟡" : "🟢";
        console.log(`${emoji} [${resolvedLevel}] ${event}`, details ? JSON.stringify(details) : "");
    } catch (err) {
        console.error("Failed to write activity log:", err);
    }
}

export default prisma;
