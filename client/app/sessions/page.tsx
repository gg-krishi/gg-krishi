"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Filter } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Session {
    id: string;
    verificationPolicy: string;
    state: string;
    language: string | null;
    userName: string | null;
    startedAt: string;
    completedAt: string | null;
    timeoutFlag: boolean;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    submission: { verificationStatus: string } | null;
}

const stateConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className?: string }> = {
    COMPLETED: { variant: "outline", className: "text-green-600 border-green-600" },
    REWARD: { variant: "default", className: "bg-blue-600 hover:bg-blue-700 text-white" },
    PROCESSING: { variant: "secondary" },
    AWAITING_PHOTO: { variant: "secondary" },
    AWAITING_GPS: { variant: "secondary" },
    LANGUAGE_SELECT: { variant: "secondary" },
    NAME_CONFIRM: { variant: "secondary" },
    GATE: { variant: "secondary" },
};

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("");

    const fetchSessions = useCallback(async () => {
        try {
            const url = filter ? `${API}/api/sessions?policy=${filter}` : `${API}/api/sessions`;
            const res = await fetch(url);
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Failed to fetch sessions:", err); 
        } finally { 
            setLoading(false); 
        }
    }, [filter]);

    useEffect(() => { 
        fetchSessions(); 
        const i = setInterval(fetchSessions, 5000); 
        return () => clearInterval(i); 
    }, [fetchSessions]);

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { 
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <CalendarDays className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {sessions.length} total sessions
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
                    <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                    {[{ id: "", label: "All" }, { id: "PILOT_MRV", label: "🌾 Pilot" }, { id: "DEMO_AUTO", label: "🎭 Demo" }].map((f) => (
                        <Button 
                            key={f.id} 
                            variant={filter === f.id ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setFilter(f.id)}
                            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                                filter === f.id 
                                    ? f.id === "PILOT_MRV" ? "bg-green-600 hover:bg-green-700" : f.id === "DEMO_AUTO" ? "bg-purple-600 hover:bg-purple-700" : ""
                                    : ""
                            }`}
                        >
                                <span>{f.label}</span>
                        </Button>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Card className="shadow-sm">
                    <CardContent className="p-0 sm:p-6 overflow-x-auto">
                        <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-medium">User</TableHead>
                                <TableHead className="font-medium">Bag</TableHead>
                                <TableHead className="font-medium">Policy</TableHead>
                                <TableHead className="font-medium">State</TableHead>
                                <TableHead className="font-medium">Result</TableHead>
                                <TableHead className="font-medium">Started</TableHead>
                                <TableHead className="text-right font-medium">Flags</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16 ml-auto rounded-md" /></TableCell>
                                    </TableRow>
                                ))
                            ) : sessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No sessions found for the selected filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sessions.map((s) => {
                                    const sc = stateConfig[s.state] || { variant: "secondary" };
                                    return (
                                        <TableRow 
                                            key={s.id} 
                                            className="border-border/50 transition-colors hover:bg-muted/30 group"
                                        >
                                            <TableCell className="font-medium">
                                                {s.user.name || `+${s.user.phone}`}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">
                                                {s.bag.label}
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant="secondary" 
                                                    className={`
                                                        ${s.verificationPolicy === "DEMO_AUTO" 
                                                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20" 
                                                            : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"}
                                                    `}
                                                >
                                                    {s.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={sc.variant} 
                                                    className={sc.className}
                                                >
                                                    {s.state}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">
                                                {s.submission?.verificationStatus ? (
                                                    <span className={
                                                        s.submission.verificationStatus === "APPROVED" ? "text-green-600 dark:text-green-400" :
                                                        s.submission.verificationStatus === "REJECTED" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
                                                    }>
                                                        {s.submission.verificationStatus}
                                                    </span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(s.startedAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {s.timeoutFlag ? (
                                                    <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
                                                        TIMEOUT
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
