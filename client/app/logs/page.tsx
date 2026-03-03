"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LogEntry {
    id: string;
    event: string;
    level: string;
    bagId: string | null;
    sessionId: string | null;
    submissionId: string | null;
    phone: string | null;
    details: string | null;
    timestamp: string;
    bag?: { label: string } | null;
}

const levelColors: Record<string, { color: string; bg: string }> = {
    INFO: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    WARN: { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
    ERROR: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState<string>("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchLogs = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (levelFilter) params.set("level", levelFilter);
            params.set("limit", "200");
            const res = await fetch(`${API}/api/logs?${params}`);
            const data = await res.json();
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) { console.error("Failed to fetch logs:", err); }
        finally { setLoading(false); }
    }, [levelFilter]);

    useEffect(() => { fetchLogs(); const i = setInterval(fetchLogs, 5000); return () => clearInterval(i); }, [fetchLogs]);

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const formatTime = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Activity Logs</h1>
                    <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>{logs.length} entries</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {["", "INFO", "WARN", "ERROR"].map((f) => {
                        const lc = levelColors[f] || { color: "var(--text-primary)", bg: "rgba(255,255,255,0.08)" };
                        return (
                            <button key={f} onClick={() => setLevelFilter(f)}
                                style={{
                                    padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                                    background: levelFilter === f ? lc.bg : "transparent",
                                    color: levelFilter === f ? lc.color : "var(--text-muted)"
                                }}>
                                {f === "" ? "All" : f}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No logs yet.</div>
                ) : (
                    logs.map((log) => {
                        const lc = levelColors[log.level] || levelColors.INFO;
                        const isExpanded = expanded.has(log.id);
                        let parsedDetails = null;
                        try { if (log.details) parsedDetails = JSON.parse(log.details); } catch { /* ignore */ }

                        return (
                            <div key={log.id}
                                onClick={() => log.details ? toggleExpand(log.id) : undefined}
                                style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", cursor: log.details ? "pointer" : "default", transition: "background 0.1s" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, color: lc.color, background: lc.bg, minWidth: 40, textAlign: "center" }}>
                                        {log.level}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "var(--font-geist-mono)", color: "var(--text-primary)" }}>{log.event}</span>
                                    {log.bag && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.bag.label}</span>}
                                    {log.phone && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>+{log.phone}</span>}
                                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{formatTime(log.timestamp)}</span>
                                    {log.details && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isExpanded ? "▼" : "▶"}</span>}
                                </div>
                                {isExpanded && parsedDetails && (
                                    <pre style={{ marginTop: 8, padding: 12, background: "var(--bg-primary)", borderRadius: 6, fontSize: 11, overflow: "auto", maxHeight: 200, color: "var(--text-secondary)" }}>
                                        {JSON.stringify(parsedDetails, null, 2)}
                                    </pre>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
