"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Submission {
    id: string;
    sessionId: string;
    latitude: number | null;
    longitude: number | null;
    verificationStatus: string;
    verificationPolicy: string;
    reviewFlag: boolean;
    aiConfidence: number | null;
    fraudScore: number | null;
    fraudFlags: string | null;
    createdAt: string;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    session: { verificationPolicy: string; language: string | null };
}

const statusConfig: Record<string, { color: string; bg: string }> = {
    VERIFIED: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    PENDING: { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
    PENDING_REVIEW: { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    REJECTED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function SubmissionsPage() {
    const [subs, setSubs] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("");

    const fetchSubs = useCallback(async () => {
        try {
            const url = filter ? `${API}/api/submissions?status=${filter}` : `${API}/api/submissions`;
            const res = await fetch(url);
            const data = await res.json();
            setSubs(Array.isArray(data) ? data : []);
        } catch (err) { console.error("Failed to fetch submissions:", err); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchSubs(); const i = setInterval(fetchSubs, 5000); return () => clearInterval(i); }, [fetchSubs]);

    const approve = async (id: string) => {
        await fetch(`${API}/api/submissions/${id}/approve`, { method: "POST" });
        await fetchSubs();
    };

    const reject = async (id: string) => {
        await fetch(`${API}/api/submissions/${id}/reject`, { method: "POST" });
        await fetchSubs();
    };

    const exportCSV = () => {
        window.open(`${API}/api/submissions/export`, "_blank");
    };

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Submissions</h1>
                    <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>
                        {subs.length} total · {subs.filter((s) => s.verificationStatus === "VERIFIED").length} verified · {subs.filter((s) => s.verificationStatus === "PENDING_REVIEW").length} pending review
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {["", "VERIFIED", "PENDING_REVIEW", "REJECTED"].map((f) => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{
                                padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                                background: filter === f ? "rgba(34,197,94,0.15)" : "transparent",
                                color: filter === f ? "#22c55e" : "var(--text-muted)"
                            }}>
                            {f === "" ? "All" : f.replace("_", " ")}
                        </button>
                    ))}
                    <button onClick={exportCSV}
                        style={{ padding: "8px 14px", background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Bag</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>User</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Policy</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Status</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>AI Conf.</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>GPS</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Date</th>
                            <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
                        ) : subs.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No submissions yet.</td></tr>
                        ) : (
                            subs.map((s) => {
                                const sc = statusConfig[s.verificationStatus] || statusConfig.PENDING;
                                return (
                                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>{s.bag.label}</td>
                                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{s.user.name || s.user.phone}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{
                                                padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                background: s.verificationPolicy === "DEMO_AUTO" ? "rgba(168,85,247,0.12)" : "rgba(34,197,94,0.12)",
                                                color: s.verificationPolicy === "DEMO_AUTO" ? "#a855f7" : "#22c55e"
                                            }}>
                                                {s.verificationPolicy === "DEMO_AUTO" ? "Demo" : "Pilot"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg }}>{s.verificationStatus}</span>
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            {s.aiConfidence !== null ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                                                        <div style={{ width: `${s.aiConfidence * 100}%`, height: "100%", borderRadius: 3, background: s.aiConfidence > 0.7 ? "#22c55e" : s.aiConfidence > 0.4 ? "#eab308" : "#ef4444" }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(s.aiConfidence * 100).toFixed(0)}%</span>
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: 12 }}>
                                            {s.latitude && s.longitude ? (
                                                <a href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer"
                                                    style={{ color: "#3b82f6", textDecoration: "none" }}>📍 Map</a>
                                            ) : "—"}
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(s.createdAt)}</td>
                                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                            {s.verificationStatus === "PENDING_REVIEW" ? (
                                                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                                    <button onClick={() => approve(s.id)}
                                                        style={{ padding: "4px 10px", background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                                        ✅ Approve
                                                    </button>
                                                    <button onClick={() => reject(s.id)}
                                                        style={{ padding: "4px 10px", background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                                        ❌ Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                                            )}
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
