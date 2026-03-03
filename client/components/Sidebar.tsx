"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/bags", label: "Bags", icon: "🏷" },
    { href: "/users", label: "Users", icon: "👥" },
    { href: "/sessions", label: "Sessions", icon: "📋" },
    { href: "/submissions", label: "Submissions", icon: "📄" },
    { href: "/logs", label: "Logs", icon: "📜" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            style={{
                width: 220,
                minHeight: "100vh",
                background: "var(--bg-card)",
                borderRight: "1px solid var(--border)",
                padding: "24px 0",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Logo */}
            <div style={{ padding: "0 20px", marginBottom: 32 }}>
                <h1
                    style={{
                        fontSize: 22,
                        fontWeight: 800,
                        margin: 0,
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    🌱 GG Krishi
                </h1>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    MRV Dashboard
                </p>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1 }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 20px",
                                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                                textDecoration: "none",
                                fontSize: 14,
                                fontWeight: isActive ? 600 : 400,
                                background: isActive ? "var(--bg-card-hover)" : "transparent",
                                borderLeft: isActive ? "3px solid #22c55e" : "3px solid transparent",
                                transition: "all 0.15s ease",
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
