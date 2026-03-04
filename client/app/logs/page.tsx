"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
import { cn } from "@/lib/utils";

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

const levelConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any, className?: string }> = {
    INFO: { variant: "outline", icon: Info, className: "text-green-600 border-green-600" },
    WARN: { variant: "secondary", icon: AlertTriangle, className: "text-yellow-600" },
    ERROR: { variant: "destructive", icon: AlertCircle },
};

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [levelFilter, setLevelFilter] = useState<string>("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchLogs = useCallback(async (showLoading = false) => {
        if (showLoading) setIsFiltering(true);
        try {
            // Always fetch 200 to populate KPIs correctly
            const res = await fetch(`${API}/api/logs?limit=200`);
            const data = await res.json();
            const arr = Array.isArray(data) ? data : [];
            setAllLogs(arr);
            
            // Apply filter natively
            if (levelFilter) {
                setLogs(arr.filter(l => l.level === levelFilter));
            } else {
                setLogs(arr);
            }
        } catch (err) { 
            console.error("Failed to fetch logs:", err); 
        } finally { 
            setLoading(false); 
            setIsFiltering(false);
        }
    }, [levelFilter]);

    useEffect(() => { 
        fetchLogs(true); 
    }, [levelFilter, fetchLogs]);

    useEffect(() => {
        const i = setInterval(() => fetchLogs(false), 5000); 
        return () => clearInterval(i); 
    }, [fetchLogs]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const formatTime = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    const errorCount = allLogs.filter((l) => l.level === "ERROR").length;
    const warnCount = allLogs.filter((l) => l.level === "WARN").length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Monitor real-time system activity and events
                    </p>
                </div>
                
                <div className="flex items-center gap-2 bg-background/50 p-1.5 rounded-xl border border-border/50 shadow-sm backdrop-blur-md">
                    {[{ id: "", label: "All" }, { id: "INFO", label: "Info" }, { id: "WARN", label: "Warnings" }, { id: "ERROR", label: "Errors" }].map((f) => (
                        <Button 
                            key={f.id} 
                            variant={levelFilter === f.id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setLevelFilter(f.id)}
                            className={`h-8 rounded-lg px-4 text-xs font-semibold transition-all ${
                                levelFilter === f.id 
                                    ? "bg-foreground text-background hover:bg-foreground/90 shadow-md" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            }`}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard
                        title="Total Events"
                        subtitle="Across all levels"
                        value={allLogs.length}
                        icon={Activity}
                        iconColor="text-blue-500"
                        iconBgColor="bg-blue-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Warnings"
                        subtitle="Minor issues & notices"
                        value={warnCount}
                        icon={AlertTriangle}
                        iconColor="text-yellow-500"
                        iconBgColor="bg-yellow-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Errors"
                        subtitle="Critical system failures"
                        value={errorCount}
                        icon={AlertCircle}
                        iconColor="text-red-500"
                        iconBgColor="bg-red-500/10"
                        isLoading={loading}
                    />
                </PremiumStatCardGrid>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Card className="shadow-sm overflow-hidden border-border/40">
                    <div className="divide-y divide-border/30">
                        {loading || isFiltering ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="p-4 flex items-center gap-4">
                                    <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                                    <Skeleton className="h-5 w-48" />
                                    <div className="ml-auto flex gap-4">
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            ))
                        ) : logs.length === 0 ? (
                            <div className="p-16 text-center text-muted-foreground">
                                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No logs found</h3>
                                <p className="text-sm mt-1">System activity will appear here automatically.</p>
                            </div>
                        ) : (
                            logs.map((log, index) => {
                                const lc = levelConfig[log.level] || levelConfig.INFO;
                                const Icon = lc.icon;
                                const isExpanded = expanded.has(log.id);
                                const hasDetails = !!log.details;
                                
                                let parsedDetails = null;
                                if (hasDetails) {
                                    try { parsedDetails = JSON.parse(log.details!); } catch { parsedDetails = log.details; }
                                }

                                return (
                                    <div
                                        key={log.id}
                                        className={cn(
                                            "transition-colors duration-200",
                                            hasDetails && "cursor-pointer hover:bg-muted/50",
                                            isExpanded ? "bg-muted/10" : "bg-card"
                                        )}
                                        onClick={(e) => hasDetails ? toggleExpand(log.id, e) : undefined}
                                    >
                                        <div className="flex items-center justify-between p-4 sm:px-6">
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className={`p-2 rounded-xl shrink-0 ${log.level === 'ERROR' ? 'bg-red-500/10' : log.level === 'WARN' ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                                                    <Icon className={`h-4 w-4 ${log.level === 'ERROR' ? "text-red-500" : log.level === 'WARN' ? "text-yellow-600" : "text-green-600 dark:text-green-500"}`} />
                                                </div>
                                                
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                                    <h4 className="font-semibold text-sm truncate text-foreground">{log.event}</h4>
                                                    
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {log.bag && (
                                                            <Badge variant="outline" className="font-mono bg-background shadow-xs text-[10px] px-1.5 h-5">
                                                                {log.bag.label}
                                                            </Badge>
                                                        )}
                                                        {log.phone && (
                                                            <span className="text-muted-foreground font-medium">+{log.phone}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 shrink-0 pl-4">
                                                <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                                                    {formatTime(log.timestamp)}
                                                </span>
                                                
                                                {hasDetails ? (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon-sm" 
                                                        className={`rounded-full transition-transform duration-200 ${isExpanded ? "bg-muted rotate-180" : ""}`}
                                                        onClick={(e) => toggleExpand(log.id, e)}
                                                    >
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                ) : (
                                                    <div className="w-8" />
                                                )}
                                            </div>
                                        </div>
                                        
                                        <AnimatePresence>
                                            {isExpanded && parsedDetails && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-border/30 overflow-hidden"
                                                >
                                                    <div className="p-4 sm:px-6 bg-muted/20">
                                                        <div className="text-xs text-muted-foreground mb-3 sm:hidden font-medium">
                                                            {formatTime(log.timestamp)}
                                                        </div>
                                                        <ScrollArea className="max-h-[350px] w-full rounded-xl border border-border/50 bg-background/50 p-4 shadow-inner">
                                                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap word-break">
                                                                {typeof parsedDetails === "string" 
                                                                    ? parsedDetails 
                                                                    : JSON.stringify(parsedDetails, null, 2)}
                                                            </pre>
                                                        </ScrollArea>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
