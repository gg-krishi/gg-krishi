"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Session {
    id: string;
    verificationPolicy: string;
    state: string;
    language: string | null;
    userName: string | null;
    startedAt: string;
    completedAt: string | null;
    timeoutFlag: boolean;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    submission: { verificationStatus: string } | null;
}

const stateColors: Record<string, { color: string; bg: string }> = {
    COMPLETED: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    REWARD: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    PROCESSING: { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
    AWAITING_PHOTO: { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    AWAITING_GPS: { color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
    LANGUAGE_SELECT: { color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
    NAME_CONFIRM: { color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
    GATE: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("");

    const fetchSessions = useCallback(async () => {
        try {
            const url = filter ? `${API}/api/sessions?policy=${filter}` : `${API}/api/sessions`;
            const res = await fetch(url);
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) { console.error("Failed to fetch sessions:", err); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchSessions(); const i = setInterval(fetchSessions, 5000); return () => clearInterval(i); }, [fetchSessions]);

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Sessions</h1>
                    <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>{sessions.length} total sessions</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {["", "PILOT_MRV", "DEMO_AUTO"].map((f) => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{
                                padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                                background: filter === f ? "rgba(34,197,94,0.15)" : "transparent",
                                color: filter === f ? "#22c55e" : "var(--text-muted)"
                            }}>
                            {f === "" ? "All" : f === "PILOT_MRV" ? "🌾 Pilot" : "🎭 Demo"}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>User</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Bag</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Policy</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>State</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Result</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Started</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
                        ) : sessions.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No sessions yet.</td></tr>
                        ) : (
                            sessions.map((s) => {
                                const sc = stateColors[s.state] || { color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
                                return (
                                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{s.user.name || s.user.phone}</td>
                                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>{s.bag.label}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{
                                                padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                background: s.verificationPolicy === "DEMO_AUTO" ? "rgba(168,85,247,0.12)" : "rgba(34,197,94,0.12)",
                                                color: s.verificationPolicy === "DEMO_AUTO" ? "#a855f7" : "#22c55e"
                                            }}>
                                                {s.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg }}>{s.state}</span>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: 12 }}>{s.submission?.verificationStatus || "—"}</td>
                                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(s.startedAt)}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {s.timeoutFlag && <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>TIMEOUT</span>}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
