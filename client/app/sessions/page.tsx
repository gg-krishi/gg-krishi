"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Filter, CheckCircle, RefreshCw, X, User, ChevronLeft, ChevronRight } from "lucide-react";
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
const PAGE_SIZE = 20;

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

function SessionsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const userIdFilter = searchParams.get("userId");

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filter, setFilter] = useState<string>("");
    const [filterUserPhone, setFilterUserPhone] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    const clearUserFilter = () => { router.push("/sessions"); };

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

    useEffect(() => { fetchSessions(true); setPage(1); }, [filter, fetchSessions]);
    useEffect(() => { const i = setInterval(() => fetchSessions(false), 5000); return () => clearInterval(i); }, [fetchSessions]);

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });

    const completedSessions = sessions.filter(s => s.state === "COMPLETED").length;
    const activeSessions = sessions.length - completedSessions;

    // Pagination
    const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
    const pagedSessions = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const getPageNums = () => {
        const nums = new Set([1, totalPages, page, page - 1, page + 1].filter(n => n >= 1 && n <= totalPages));
        return Array.from(nums).sort((a, b) => a - b);
    };

    const openDetails = (s: Session) => { setSelectedSession(s); setDetailsModalOpen(true); };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Sticky Header */}
            <div className="sticky top-16 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/90 backdrop-blur-md border-b border-border/30 mb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sessions</h1>
                        <p className="text-muted-foreground text-xs hidden sm:block">Monitor active verifications and user progress</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {userIdFilter && (
                            <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-500/30">
                                <User className="h-4 w-4" />
                                <span className="text-xs font-medium">{filterUserPhone ? `+${filterUserPhone}` : "..."}</span>
                                <Button variant="ghost" size="sm" onClick={clearUserFilter} className="h-5 w-5 p-0 hover:bg-blue-500/20 rounded-full">
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                            <Filter className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
                            {[{ id: "", label: "All" }, { id: "PILOT_MRV", label: "🌾 Pilot" }, { id: "DEMO_AUTO", label: "🎭 Demo" }].map((f) => (
                                <Button
                                    key={f.id}
                                    variant={filter === f.id ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => { setFilter(f.id); setPage(1); }}
                                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${filter === f.id
                                        ? f.id === "PILOT_MRV" ? "bg-green-600 hover:bg-green-700 shadow-sm text-white"
                                            : f.id === "DEMO_AUTO" ? "bg-purple-600 hover:bg-purple-700 shadow-sm text-white"
                                                : "shadow-sm" : ""}`}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {/* Mobile: horizontal scroll */}
                <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
                    {[
                        { title: "Total", subtitle: "All sessions", value: sessions.length, icon: CalendarDays, iconColor: "text-blue-500" },
                        { title: "Completed", subtitle: "Finished", value: completedSessions, icon: CheckCircle, iconColor: "text-green-500" },
                        { title: "Active", subtitle: "In progress", value: activeSessions, icon: RefreshCw, iconColor: "text-amber-500" },
                    ].map((s) => (
                        <div key={s.title} className="flex-shrink-0 w-[72vw] snap-start">
                            <PremiumStatCard title={s.title} subtitle={s.subtitle} value={loading ? "—" : s.value} icon={s.icon} iconColor={s.iconColor} isLoading={loading} />
                        </div>
                    ))}
                </div>
                {/* Desktop: 3-col grid */}
                <div className="hidden md:block">
                    <PremiumStatCardGrid columns={3}>
                        <PremiumStatCard title="Total Sessions" subtitle="All-time initiated sessions" value={sessions.length} icon={CalendarDays} iconColor="text-blue-500" iconBgColor="bg-blue-500/10" isLoading={loading} />
                        <PremiumStatCard title="Completed" subtitle="Successfully finished" value={completedSessions} icon={CheckCircle} iconColor="text-green-500" iconBgColor="bg-green-500/10" isLoading={loading} />
                        <PremiumStatCard title="Active / Pending" subtitle="Currently in progress" value={activeSessions} icon={RefreshCw} iconColor="text-amber-500" iconBgColor="bg-amber-500/10" isLoading={loading} />
                    </PremiumStatCardGrid>
                </div>
            </motion.div>

            {/* Mobile Cards */}
            <motion.div className="md:hidden space-y-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                {loading || isFiltering ? Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="border-border/40"><CardContent className="p-4 space-y-2">
                        <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" />
                        <div className="flex justify-between"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /></div>
                    </CardContent></Card>
                )) : pagedSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No sessions found.</p>
                ) : pagedSessions.map((s) => {
                    const sc = stateConfig[s.state] || { variant: "secondary" as const };
                    return (
                        <Card key={s.id} className="border-border/40 cursor-pointer active:scale-[0.99] transition-transform" onClick={() => openDetails(s)}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm text-foreground truncate">{s.user.name || `+${s.user.phone}`}</p>
                                        <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">{s.bag.label}</p>
                                    </div>
                                    <Badge variant={sc.variant} className={`text-xs flex-shrink-0 ${sc.className || ""}`}>{s.state}</Badge>
                                </div>
                                <div className="mt-2.5 flex items-center justify-between">
                                    <Badge variant="secondary" className={`text-[10px] ${s.verificationPolicy === "DEMO_AUTO" ? "bg-purple-500/10 text-purple-600" : "bg-green-500/10 text-green-600"}`}>
                                        {s.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{formatDate(s.startedAt)}</span>
                                </div>
                                {s.submission?.verificationStatus && (
                                    <div className="mt-2 text-xs font-medium">
                                        Result: <span className={s.submission.verificationStatus === "VERIFIED" ? "text-green-600" : s.submission.verificationStatus === "REJECTED" ? "text-red-600" : "text-yellow-600"}>
                                            {s.submission.verificationStatus}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </motion.div>

            {/* Desktop Table */}
            <motion.div className="hidden md:block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card className="shadow-sm border-border/40 overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="min-w-[700px]">
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
                                {loading || isFiltering ? Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                                    </TableRow>
                                )) : pagedSessions.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No sessions found.</TableCell></TableRow>
                                ) : pagedSessions.map((s) => {
                                    const sc = stateConfig[s.state] || { variant: "secondary" as const };
                                    return (
                                        <TableRow key={s.id} className="border-border/30 transition-all duration-200 cursor-pointer h-16" onClick={() => openDetails(s)}>
                                            <TableCell className="font-semibold text-foreground">{s.user.name || `+${s.user.phone}`}</TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">{s.bag.label}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`${s.verificationPolicy === "DEMO_AUTO" ? "bg-purple-500/10 text-purple-600" : "bg-green-500/10 text-green-600"}`}>
                                                    {s.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell><Badge variant={sc.variant} className={sc.className}>{s.state}</Badge></TableCell>
                                            <TableCell className="text-sm font-medium">
                                                {s.submission?.verificationStatus ? (
                                                    <span className={s.submission.verificationStatus === "APPROVED" ? "text-green-600" : s.submission.verificationStatus === "REJECTED" ? "text-red-600" : "text-yellow-600"}>
                                                        {s.submission.verificationStatus}
                                                    </span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{formatDate(s.startedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                {s.timeoutFlag ? <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">TIMEOUT</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Pagination */}
            {!loading && sessions.length > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNums().map((num, idx, arr) => (<>
                        {idx > 0 && arr[idx - 1] !== num - 1 && <span key={`d-${num}`} className="text-muted-foreground text-sm px-1">…</span>}
                        <Button key={num} variant={page === num ? "default" : "outline"} size="icon" className="h-8 w-8 text-sm font-medium" onClick={() => setPage(num)}>{num}</Button>
                    </>))}
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
            {!loading && sessions.length > PAGE_SIZE && (
                <p className="text-center text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sessions.length)} of {sessions.length} sessions
                </p>
            )}

            {/* Details Modal */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl p-0 overflow-hidden border-border/50 shadow-2xl">
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
                        <div className="p-6 space-y-6 bg-background max-h-[75vh] overflow-y-auto">
                            <div className="space-y-1 pb-4 border-b border-border/30">
                                <h3 className="font-bold text-2xl tracking-tight text-foreground">{selectedSession.user.name || `+${selectedSession.user.phone}`}</h3>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs bg-muted/30">{selectedSession.bag.label}</Badge>
                                    <span className="text-sm text-muted-foreground font-medium">Started {formatDate(selectedSession.startedAt)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verification Policy</span>
                                    <div className="font-medium text-lg text-foreground">{selectedSession.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot MRV"}</div>
                                </div>
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Language</span>
                                    <div className="font-medium text-lg text-foreground uppercase">{selectedSession.language || "Not Selected"}</div>
                                </div>
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">System Flags</span>
                                    <div>
                                        {selectedSession.timeoutFlag
                                            ? <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">TIMEOUT</Badge>
                                            : <span className="text-sm text-muted-foreground">Normal Execution</span>}
                                    </div>
                                </div>
                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Submission Status</span>
                                    <div className="font-medium text-lg">
                                        {selectedSession.submission?.verificationStatus ? (
                                            <span className={selectedSession.submission.verificationStatus === "APPROVED" || selectedSession.submission.verificationStatus === "VERIFIED" ? "text-green-600" : selectedSession.submission.verificationStatus === "REJECTED" ? "text-red-600" : "text-yellow-600"}>
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

export default function SessionsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><Skeleton className="h-8 w-32" /></div>}>
            <SessionsContent />
        </Suspense>
    );
}
