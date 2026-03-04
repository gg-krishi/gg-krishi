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
  LeafyGreen,
  HeadphonesIcon
} from "lucide-react";

// Using Lucide icons for a cohesive premium look, overriding the old emojis
const navItems = [
    { href: "/bags", label: "Bags", icon: Package },
    { href: "/users", label: "Users", icon: Users },
    { href: "/sessions", label: "Sessions", icon: CalendarDays },
    { href: "/submissions", label: "Submissions", icon: FileText },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/support", label: "Support", icon: HeadphonesIcon },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col transition-colors duration-300">
            {/* Logo Section */}
            <div className="h-16 flex items-center px-6 border-b border-border/50 group cursor-pointer transition-colors hover:bg-muted/20">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-md group-hover:shadow-green-500/20 group-hover:scale-105 transition-all duration-300">
                    <LeafyGreen className="text-white h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors duration-300">
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
                            <Link key={item.href} href={item.href} className="relative group rounded-md outline-none block">
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
            </div>
            
            <div className="mt-auto p-4 flex">
                <div className="w-full bg-muted/40 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground text-center">Admin Portal v0.1.0</p>
                </div>
            </div>
        </aside>
    );
}
