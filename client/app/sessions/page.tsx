"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Filter, CheckCircle, RefreshCw, X, User } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    const searchParams = useSearchParams();
    const router = useRouter();
    const userIdFilter = searchParams.get("userId");

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filter, setFilter] = useState<string>("");
    const [filterUserPhone, setFilterUserPhone] = useState<string | null>(null);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    const clearUserFilter = () => {
        router.push("/sessions");
    };

    const fetchSessions = useCallback(async (showLoading = false) => {
        if (showLoading) setIsFiltering(true);
        try {
            const params = new URLSearchParams();
            if (filter) params.append("policy", filter);
            if (userIdFilter) params.append("userId", userIdFilter);
            const url = `${API}/api/sessions${params.toString() ? `?${params}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
            // Set the user phone for display if filtering by user
            if (userIdFilter && Array.isArray(data) && data.length > 0) {
                setFilterUserPhone(data[0].user?.phone || null);
            } else if (!userIdFilter) {
                setFilterUserPhone(null);
            }
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setLoading(false);
            setIsFiltering(false);
        }
    }, [filter, userIdFilter]);

    useEffect(() => { 
        fetchSessions(true); 
    }, [filter, fetchSessions]);

    useEffect(() => {
        const i = setInterval(() => fetchSessions(false), 5000); 
        return () => clearInterval(i); 
    }, [fetchSessions]);

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { 
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
    });

    const completedSessions = sessions.filter(s => s.state === "COMPLETED").length;
    const activeSessions = sessions.length - completedSessions;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Monitor active verifications and user progress
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {userIdFilter && (
                        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-500/30">
                            <User className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                Filtering by user: {filterUserPhone ? `+${filterUserPhone}` : "..."}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearUserFilter}
                                className="h-5 w-5 p-0 hover:bg-blue-500/20 rounded-full"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
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
                                        ? f.id === "PILOT_MRV" ? "bg-green-600 hover:bg-green-700 shadow-sm" : f.id === "DEMO_AUTO" ? "bg-purple-600 hover:bg-purple-700 shadow-sm" : "shadow-sm"
                                        : ""
                                }`}
                            >
                                <span>{f.label}</span>
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard
                        title="Total Sessions"
                        subtitle="All-time initiated sessions"
                        value={sessions.length}
                        icon={CalendarDays}
                        iconColor="text-blue-500"
                        iconBgColor="bg-blue-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Completed"
                        subtitle="Successfully finished"
                        value={completedSessions}
                        icon={CheckCircle}
                        iconColor="text-green-500"
                        iconBgColor="bg-green-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Active / Pending"
                        subtitle="Currently in progress"
                        value={activeSessions}
                        icon={RefreshCw}
                        iconColor="text-amber-500"
                        iconBgColor="bg-amber-500/10"
                        isLoading={loading}
                    />
                </PremiumStatCardGrid>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Card className="shadow-sm border-border/40 overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="min-w-[800px]">
                        <TableHeader className="bg-muted/10">
                            <TableRow className="hover:bg-transparent border-border/30">
                                <TableHead className="font-medium h-12">User</TableHead>
                                <TableHead className="font-medium h-12">Bag</TableHead>
                                <TableHead className="font-medium h-12">Policy</TableHead>
                                <TableHead className="font-medium h-12">State</TableHead>
                                <TableHead className="font-medium h-12">Result</TableHead>
                                <TableHead className="font-medium h-12">Started</TableHead>
                                <TableHead className="text-right font-medium h-12">Flags</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading || isFiltering ? (
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
                                            className="border-border/30 transition-all duration-200 cursor-pointer h-16 group relative"
                                            onClick={() => { setSelectedSession(s); setDetailsModalOpen(true); }}
                                        >
                                            <TableCell className="font-semibold text-foreground">
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
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/50 shadow-2xl">
                    <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10">
                        <DialogTitle className="text-xl font-bold flex items-center justify-between pr-8">
                            <span>Session Details</span>
                            {selectedSession && (
                                <Badge variant={stateConfig[selectedSession.state]?.variant} className={`text-sm py-1 ${stateConfig[selectedSession.state]?.className}`}>
                                    {selectedSession.state}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedSession && (
                        <div className="p-6 space-y-6 bg-background">
                            <div className="space-y-1 pb-4 border-b border-border/30">
                                <h3 className="font-bold text-2xl tracking-tight text-foreground">
                                    {selectedSession.user.name || `+${selectedSession.user.phone}`}
                                </h3>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                                        {selectedSession.bag.label}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground font-medium">
                                        Started {formatDate(selectedSession.startedAt)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verification Policy</span>
                                    <div className="font-medium text-lg text-foreground flex items-center gap-2">
                                        {selectedSession.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot MRV"}
                                    </div>
                                </div>
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Language</span>
                                    <div className="font-medium text-lg text-foreground uppercase">
                                        {selectedSession.language || "Not Selected"}
                                    </div>
                                </div>
                                
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">System Flags</span>
                                    <div>
                                        {selectedSession.timeoutFlag ? (
                                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">TIMEOUT</Badge>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">Normal Execution</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Submission Status</span>
                                    <div className="font-medium text-lg">
                                        {selectedSession.submission?.verificationStatus ? (
                                             <span className={
                                                selectedSession.submission.verificationStatus === "APPROVED" || selectedSession.submission.verificationStatus === "VERIFIED" ? "text-green-600 dark:text-green-400" :
                                                selectedSession.submission.verificationStatus === "REJECTED" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
                                            }>
                                                {selectedSession.submission.verificationStatus}
                                            </span>
                                        ) : <span className="text-muted-foreground text-sm">No Submission</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
