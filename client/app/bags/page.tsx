"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Bag {
    bagId: string;
    label: string;
    batchId: string | null;
    status: string;
    createdAt: string;
    assignedUser?: { phone: string; name: string | null } | null;
    _count?: { sessions: number; submissions: number };
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    unused: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "🟢 Unused" },
    in_session: { color: "#eab308", bg: "rgba(234,179,8,0.12)", label: "⏳ In Session" },
    used: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", label: "✅ Used" },
    flagged: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "🚩 Flagged" },
};

export default function BagsPage() {
    const [bags, setBags] = useState<Bag[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [qrModal, setQrModal] = useState<{ bagId: string; label: string; status: string; mode: string } | null>(null);
    const [qrSvg, setQrSvg] = useState("");

    const fetchBags = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/bags`);
            const data = await res.json();
            setBags(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch bags:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBags();
        const interval = setInterval(fetchBags, 5000);
        return () => clearInterval(interval);
    }, [fetchBags]);

    const createBag = async (mode: string = "PILOT") => {
        setCreating(true);
        try {
            const res = await fetch(`${API}/api/bags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
            const bag = await res.json();
            await fetchBags();
            showQr(bag.bagId, bag.label, bag.status, bag.batchId);
        } catch (err) {
            console.error("Failed to create bag:", err);
        } finally {
            setCreating(false);
        }
    };

    const resetBag = async (bagId: string) => {
        try {
            await fetch(`${API}/api/bags/${bagId}/reset`, { method: "POST" });
            await fetchBags();
        } catch (err) {
            console.error("Failed to reset bag:", err);
        }
    };

    const showQr = async (bagId: string, label: string, status: string, batchId: string | null) => {
        const mode = batchId?.includes("DEMO") ? "DEMO" : "PILOT";
        setQrModal({ bagId, label, status, mode });
        try {
            const res = await fetch(`${API}/api/bags/${bagId}/qr`);
            const svg = await res.text();
            setQrSvg(svg);
        } catch (err) {
            console.error("Failed to fetch QR:", err);
        }
    };

    const closeQr = () => { setQrModal(null); setQrSvg(""); };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Biochar Bags</h1>
                    <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>
                        {bags.length} total · {bags.filter((b) => b.status === "unused").length} unused · {bags.filter((b) => b.status === "used").length} used
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => createBag("PILOT")} disabled={creating}
                        style={{ padding: "10px 16px", background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: creating ? "wait" : "pointer", opacity: creating ? 0.7 : 1 }}>
                        + Pilot Bag
                    </button>
                    <button onClick={() => createBag("DEMO")} disabled={creating}
                        style={{ padding: "10px 16px", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: creating ? "wait" : "pointer", opacity: creating ? 0.7 : 1 }}>
                        + Demo Bag
                    </button>
                </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Bag Label</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Batch</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Status</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Assigned To</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Created</th>
                            <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
                        ) : bags.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No bags yet.</td></tr>
                        ) : (
                            bags.map((bag) => {
                                const sc = statusConfig[bag.status] || statusConfig.unused;
                                return (
                                    <tr key={bag.bagId} style={{ borderBottom: "1px solid var(--border)" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 13, fontWeight: 500 }}>{bag.label}</td>
                                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>{bag.batchId || "—"}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                                            {bag.assignedUser ? (bag.assignedUser.name || bag.assignedUser.phone) : "—"}
                                        </td>
                                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(bag.createdAt)}</td>
                                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                                <button onClick={() => showQr(bag.bagId, bag.label, bag.status, bag.batchId)}
                                                    style={{ padding: "5px 10px", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                                                    QR
                                                </button>
                                                {(bag.status === "used" || bag.status === "flagged") && (
                                                    <button onClick={() => resetBag(bag.bagId)}
                                                        style={{ padding: "5px 10px", background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                                        Reset
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* QR Modal */}
            {qrModal && (
                <div onClick={closeQr} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 400, textAlign: "center", position: "relative" }}>
                        <button onClick={closeQr} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600 }}>{qrModal.label}</h3>
                        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>Scan with phone to open WhatsApp</p>

                        <div style={{ background: "#fff", borderRadius: 12, padding: 20, display: "inline-block" }}>
                            {qrSvg ? (
                                <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ width: 200, height: 200 }} />
                            ) : (
                                <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>Loading...</div>
                            )}
                        </div>
                        <p style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
                            Mode: <strong>{qrModal.mode === "DEMO" ? "Investor Demo (auto-verify)" : "Pilot MRV (AI verification)"}</strong>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
