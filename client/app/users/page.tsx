"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface User {
    id: string;
    phone: string;
    name: string | null;
    language: string;
    createdAt: string;
    _count?: { sessions: number; submissions: number };
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/users`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) { console.error("Failed to fetch users:", err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchUsers(); const i = setInterval(fetchUsers, 5000); return () => clearInterval(i); }, [fetchUsers]);

    return (
        <div>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Users</h1>
                <p style={{ color: "var(--text-secondary)", margin: "6px 0 0", fontSize: 14 }}>{users.length} registered farmers</p>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Phone</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Name</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Language</th>
                            <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600 }}>Sessions</th>
                            <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600 }}>Submissions</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No users yet. Users are auto-created when they message on WhatsApp.</td></tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>+{u.phone}</td>
                                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{u.name || "—"}</td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                                            {u.language === "hi" ? "हिंदी" : "English"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13 }}>{u._count?.sessions || 0}</td>
                                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13 }}>{u._count?.submissions || 0}</td>
                                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                                        {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
