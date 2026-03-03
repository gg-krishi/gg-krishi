"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        } catch (err) { 
            console.error("Failed to fetch logs:", err); 
        } finally { 
            setLoading(false); 
        }
    }, [levelFilter]);

    useEffect(() => { 
        fetchLogs(); 
        const i = setInterval(fetchLogs, 5000); 
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

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-4 border-b"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {logs.length} events recorded
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
                    {[{ id: "", label: "All" }, { id: "INFO", label: "Info" }, { id: "WARN", label: "Warnings" }, { id: "ERROR", label: "Errors" }].map((f) => (
                        <Button 
                            key={f.id} 
                            variant={levelFilter === f.id ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setLevelFilter(f.id)}
                            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                                levelFilter === f.id 
                                    ? f.id === "INFO" ? "bg-green-600 hover:bg-green-700" : f.id === "WARN" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : f.id === "ERROR" ? "bg-red-600 hover:bg-red-700" : ""
                                    : ""
                            }`}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="space-y-3"
            >
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="p-4 border-border/50">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-5 w-48" />
                                <div className="ml-auto flex gap-4">
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        </Card>
                    ))
                ) : logs.length === 0 ? (
                    <Card className="p-12 text-center border-border/50 border-dashed">
                        <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No logs found</h3>
                        <p className="text-sm text-muted-foreground mt-1">System activity will appear here automatically.</p>
                    </Card>
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
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
                            >
                                <Card 
                                    className={`
                                        border-border/50 overflow-hidden transition-all duration-200 
                                        ${hasDetails ? "cursor-pointer hover:border-primary/30 hover:shadow-sm" : ""}
                                        ${isExpanded ? "ring-1 ring-primary/20 bg-muted/20" : "bg-card hover:bg-muted/10"}
                                    `}
                                    onClick={(e) => hasDetails ? toggleExpand(log.id, e) : undefined}
                                >
                                    <div className="flex items-center gap-3 p-3 sm:p-4">
                                        <div className="flex shrink-0 items-center justify-center">
                                            <Icon className={`h-5 w-5 ${lc.className || "text-muted-foreground"}`} />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                <h4 className="font-semibold text-sm truncate">{log.event}</h4>
                                                
                                                <div className="flex items-center gap-2 text-xs">
                                                    {log.bag && (
                                                        <Badge variant="outline" className="font-mono bg-background text-[10px] px-1.5 h-5">
                                                            {log.bag.label}
                                                        </Badge>
                                                    )}
                                                    {log.phone && (
                                                        <span className="text-muted-foreground font-medium">+{log.phone}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="text-xs text-muted-foreground hidden sm:block">
                                                {formatTime(log.timestamp)}
                                            </span>
                                            
                                            {hasDetails ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className={`h-8 w-8 rounded-full transition-transform duration-200 ${isExpanded ? "bg-muted rotate-180" : ""}`}
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
                                                className="border-t border-border/50"
                                            >
                                                <div className="p-4 bg-muted/30">
                                                    <div className="text-xs text-muted-foreground mb-2 sm:hidden">
                                                        {formatTime(log.timestamp)}
                                                    </div>
                                                    <ScrollArea className="max-h-[300px] w-full rounded-md border bg-background/50 p-4">
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
                                </Card>
                            </motion.div>
                        );
                    })
                )}
            </motion.div>
        </div>
    );
}
