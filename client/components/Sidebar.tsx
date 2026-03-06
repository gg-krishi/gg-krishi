"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package,
    Users,
    CalendarDays,
    FileText,
    ScrollText,
    LeafyGreen,
    HeadphonesIcon,
    X,
    Menu
} from "lucide-react";

const navItems = [
    { href: "/bags", label: "Bags", icon: Package },
    { href: "/users", label: "Users", icon: Users },
    { href: "/sessions", label: "Sessions", icon: CalendarDays },
    { href: "/submissions", label: "Submissions", icon: FileText },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/support", label: "Support", icon: HeadphonesIcon },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname();
    return (
        <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                    <Link key={item.href} href={item.href} onClick={onClose} className="relative group rounded-md outline-none block">
                        {isActive && (
                            <motion.div
                                layoutId="sidebar-active-indicator"
                                className="absolute inset-0 bg-primary/10 rounded-md border border-primary/20"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                            />
                        )}
                        <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 active:scale-[0.98] ${isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                            <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                            <span className="transition-transform duration-200 group-hover:translate-x-0.5">{item.label}</span>
                        </div>
                    </Link>
                );
            })}
        </nav>
    );
}

export default function Sidebar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* ───── Hamburger button (visible only on mobile) ───── */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-30 md:hidden p-2 rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open sidebar"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* ───── Desktop sidebar (always visible on md+) ───── */}
            <aside className="hidden md:flex w-64 min-h-screen bg-card border-r border-border flex-col transition-colors duration-300">
                <div className="h-16 flex items-center px-6 border-b border-border/50 group cursor-pointer transition-colors hover:bg-muted/20">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-md group-hover:shadow-green-500/20 group-hover:scale-105 transition-all duration-300">
                        <LeafyGreen className="text-white h-5 w-5" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors duration-300">
                        GG Krishi
                    </h1>
                </div>
                <div className="px-6 py-2 flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 mt-2">MRV Dashboard</p>
                    <NavLinks />
                </div>
                <div className="mt-auto p-4">
                    <div className="w-full bg-muted/40 rounded-lg p-3 border border-border/50">
                        <p className="text-xs text-muted-foreground text-center">Admin Portal v0.1.0</p>
                    </div>
                </div>
            </aside>

            {/* ───── Mobile drawer ───── */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                            onClick={() => setMobileOpen(false)}
                        />
                        {/* Drawer panel */}
                        <motion.aside
                            key="drawer"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col md:hidden"
                        >
                            {/* Header with logo + close button */}
                            <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                                        <LeafyGreen className="text-white h-5 w-5" />
                                    </div>
                                    <h1 className="text-xl font-bold tracking-tight text-foreground">GG Krishi</h1>
                                </div>
                                <button
                                    onClick={() => setMobileOpen(false)}
                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Close sidebar"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            {/* Nav */}
                            <div className="px-6 py-2 flex-1 overflow-y-auto">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 mt-2">MRV Dashboard</p>
                                <NavLinks onClose={() => setMobileOpen(false)} />
                            </div>
                            <div className="p-4">
                                <div className="w-full bg-muted/40 rounded-lg p-3 border border-border/50">
                                    <p className="text-xs text-muted-foreground text-center">Admin Portal v0.1.0</p>
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
