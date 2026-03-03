"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Package, 
  Users, 
  CalendarDays, 
  FileText, 
  ScrollText, 
  LeafyGreen 
} from "lucide-react";

// Using Lucide icons for a cohesive premium look, overriding the old emojis
const navItems = [
    { href: "/bags", label: "Bags", icon: Package },
    { href: "/users", label: "Users", icon: Users },
    { href: "/sessions", label: "Sessions", icon: CalendarDays },
    { href: "/submissions", label: "Submissions", icon: FileText },
    { href: "/logs", label: "Logs", icon: ScrollText },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col transition-colors duration-300">
            {/* Logo Section */}
            <div className="h-16 flex items-center px-6 border-b border-border/50">
                <LeafyGreen className="text-primary h-6 w-6 mr-3" />
                <div>
                    <h1 className="text-lg font-bold bg-gradient-to-br from-primary to-green-400 bg-clip-text text-transparent">
                        GG Krishi
                    </h1>
                </div>
            </div>

            <div className="px-6 py-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 mt-2">
                    MRV Dashboard
                </p>
                
                {/* Navigation Links */}
                <nav className="flex flex-col gap-1.5 border-r-0">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const Icon = item.icon;

                        return (
                            <Link key={item.href} href={item.href} className="relative group rounded-md outline-none">
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active-indicator"
                                        className="absolute inset-0 bg-primary/10 rounded-md border border-primary/20"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                                <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-200 ${isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                                    <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground transition-colors"}`} />
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>
            
            <div className="mt-auto p-4 flex">
                <div className="w-full bg-muted/40 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground text-center">Admin Portal v0.1.0</p>
                </div>
            </div>
        </aside>
    );
}
