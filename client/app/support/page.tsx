"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    HeadphonesIcon, CheckCircle2, TicketIcon, Clock, Phone,
    AlertCircle, MessageSquare, MapPin, FileText, History,
    ChevronRight, ChevronLeft, Send, User, Calendar, Tag, ArrowLeft, Image as ImageIcon, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Ticket {
    id: string;
    ticketNumber: number;
    phone: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
    source: string | null;
    category: string | null;
    description: string | null;
    priority: string;
    user?: { phone: string; name: string | null; language: string };
    session?: { state: string; bag?: { label: string } };
    submission?: { verificationStatus: string; bag?: { label: string } };
    bag?: { label: string };
    _count?: { notes: number; statusHistory: number };
}

interface TicketDetail extends Ticket {
    user?: {
        id: string;
        phone: string;
        name: string | null;
        language: string;
        createdAt: string;
        _count: { submissions: number; tickets: number };
    };
    session?: {
        id: string;
        state: string;
        verificationPolicy: string;
        startedAt: string;
        bag?: { label: string; batchId: string };
    };
    submission?: {
        id: string;
        verificationStatus: string;
        latitude: number | null;
        longitude: number | null;
        mediaUrl: string | null;
        aiConfidence: number | null;
        fraudScore: number | null;
        createdAt: string;
        bag?: { label: string };
    };
    bag?: { label: string; batchId: string; status: string };
    notes: Array<{ id: string; content: string; createdAt: string; createdBy: string | null }>;
    statusHistory: Array<{ id: string; fromStatus: string | null; toStatus: string; changedAt: string; changedBy: string | null }>;
    userSubmissions: Array<{
        id: string;
        verificationStatus: string;
        createdAt: string;
        bag: { label: string };
        aiConfidence: number | null;
    }>;
    previousTickets: Array<{
        id: string;
        ticketNumber: number;
        status: string;
        category: string | null;
        description: string | null;
        createdAt: string;
        resolvedAt: string | null;
    }>;
}

interface FullSubmission {
    id: string;
    verificationStatus: string;
    latitude: number | null;
    longitude: number | null;
    mediaUrl: string | null;
    aiConfidence: number | null;
    fraudScore: number | null;
    createdAt: string;
    bag: { label: string; batchId: string | null };
    user: { phone: string; name: string | null };
}

const categoryLabels: Record<string, { label: string; color: string }> = {
    general: { label: "General", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    technical_problem: { label: "Technical", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    payment_issue: { label: "Payment", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    verification_query: { label: "Verification", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const priorityColors: Record<string, string> = {
    LOW: "bg-gray-400",
    MEDIUM: "bg-yellow-400",
    HIGH: "bg-red-500",
};

const sourceLabels: Record<string, string> = {
    gate_screen: "Welcome Screen",
    LANGUAGE_SELECT: "Language Selection",
    NAME_CONFIRM: "Name Confirmation",
    AWAITING_NAME_INPUT: "Name Input",
    AWAITING_GPS: "Location Step",
    AWAITING_PHOTO: "Photo Upload",
    PROCESSING: "Processing",
    REWARD: "Reward Screen",
    REVIEW_ACK: "Review Pending",
    COMPLETED: "After Completion",
};

export default function SupportPage() {
    const [allTickets, setAllTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [addingNote, setAddingNote] = useState(false);

    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [selectedPrevTicketId, setSelectedPrevTicketId] = useState<string | null>(null);
    const [fullSubmission, setFullSubmission] = useState<FullSubmission | null>(null);
    const [fullPrevTicket, setFullPrevTicket] = useState<TicketDetail | null>(null);
    const [itemDetailLoading, setItemDetailLoading] = useState(false);

    const fetchTickets = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/tickets`);
            const data = await res.json();
            setAllTickets(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch tickets:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
        const interval = setInterval(fetchTickets, 10000);
        return () => clearInterval(interval);
    }, [fetchTickets]);

    const openTicketDetail = async (ticketId: string) => {
        setSelectedTicketId(ticketId);
        setDetailLoading(true);
        setNewNote("");
        clearItemSelection();
        try {
            const res = await fetch(`${API}/api/tickets/${ticketId}`);
            const data = await res.json();
            setTicketDetail(data);
            if (data.status === "OPEN") {
                await fetch(`${API}/api/tickets/${ticketId}/status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "IN_PROGRESS" })
                });
                setTicketDetail(prev => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
                setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "IN_PROGRESS" } : t));
            }
        } catch (err) {
            console.error("Failed to fetch ticket detail:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchSubmissionDetail = async (submissionId: string) => {
        setItemDetailLoading(true);
        setSelectedSubmissionId(submissionId);
        setSelectedPrevTicketId(null);
        setFullPrevTicket(null);
        try {
            const res = await fetch(`${API}/api/submissions/${submissionId}`);
            if (res.ok) setFullSubmission(await res.json());
        } catch (err) {
            console.error("Failed to fetch submission:", err);
        } finally {
            setItemDetailLoading(false);
        }
    };

    const fetchPrevTicketDetail = async (ticketId: string) => {
        setItemDetailLoading(true);
        setSelectedPrevTicketId(ticketId);
        setSelectedSubmissionId(null);
        setFullSubmission(null);
        try {
            const res = await fetch(`${API}/api/tickets/${ticketId}`);
            if (res.ok) setFullPrevTicket(await res.json());
        } catch (err) {
            console.error("Failed to fetch ticket:", err);
        } finally {
            setItemDetailLoading(false);
        }
    };

    const clearItemSelection = () => {
        setSelectedSubmissionId(null);
        setSelectedPrevTicketId(null);
        setFullSubmission(null);
        setFullPrevTicket(null);
    };

    const closeDetail = () => {
        setSelectedTicketId(null);
        setTicketDetail(null);
        clearItemSelection();
    };

    const handleResolve = async (id: string) => {
        setResolvingId(id);
        try {
            const res = await fetch(`${API}/api/tickets/${id}/resolve`, { method: "POST" });
            if (res.ok) {
                setAllTickets(prev => prev.map(t => t.id === id ? { ...t, status: "RESOLVED" } : t));
                if (ticketDetail?.id === id) setTicketDetail(prev => prev ? { ...prev, status: "RESOLVED" } : prev);
            }
        } catch (err) {
            console.error("Resolve error:", err);
        } finally {
            setResolvingId(null);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !ticketDetail) return;
        setAddingNote(true);
        try {
            const res = await fetch(`${API}/api/tickets/${ticketDetail.id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newNote.trim() })
            });
            if (res.ok) {
                const note = await res.json();
                setTicketDetail(prev => prev ? { ...prev, notes: [note, ...prev.notes] } : prev);
                setNewNote("");
            }
        } catch (err) {
            console.error("Add note error:", err);
        } finally {
            setAddingNote(false);
        }
    };

    const formatTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const openCount = allTickets.filter(t => t.status !== "RESOLVED").length;
    const resolvedCount = allTickets.filter(t => t.status === "RESOLVED").length;
    const filteredTickets = filter === "ALL" ? allTickets : allTickets.filter(t => filter === "OPEN" ? t.status !== "RESOLVED" : t.status === "RESOLVED");
    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
    const pagedTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasItemSelected = selectedSubmissionId !== null || selectedPrevTicketId !== null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Sticky Header */}
            <div className="sticky top-16 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/90 backdrop-blur-md border-b border-border/30 mb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Customer Support</h1>
                        <p className="text-muted-foreground text-xs hidden sm:block">Manage help requests and farmer tickets</p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                        {[{ id: "ALL", label: "All" }, { id: "OPEN", label: "Open" }, { id: "RESOLVED", label: "Resolved" }].map((f) => (
                            <Button
                                key={f.id}
                                variant={filter === f.id ? "default" : "ghost"}
                                size="sm"
                                onClick={() => { setFilter(f.id); setPage(1); }}
                                className="h-7 rounded-md px-3 text-xs font-medium"
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {/* Mobile: horizontal scroll */}
                <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
                    {[
                        { title: "Total", subtitle: "All tickets", value: allTickets.length, icon: TicketIcon, iconColor: "text-blue-500" },
                        { title: "Active", subtitle: "Needs attention", value: openCount, icon: Clock, iconColor: "text-yellow-500" },
                        { title: "Resolved", subtitle: "Closed", value: resolvedCount, icon: CheckCircle2, iconColor: "text-green-500" },
                    ].map((s) => (
                        <div key={s.title} className="flex-shrink-0 w-[72vw] snap-start">
                            <PremiumStatCard title={s.title} subtitle={s.subtitle} value={loading ? "—" : s.value} icon={s.icon} iconColor={s.iconColor} isLoading={loading} />
                        </div>
                    ))}
                </div>
                {/* Desktop: 3-col grid */}
                <div className="hidden md:block">
                    <PremiumStatCardGrid columns={3}>
                        <PremiumStatCard title="Total Tickets" subtitle="All time requests" value={allTickets.length} icon={TicketIcon} iconColor="text-blue-500" iconBgColor="bg-blue-500/10" isLoading={loading} />
                        <PremiumStatCard title="Active Cases" subtitle="Needs attention" value={openCount} icon={Clock} iconColor="text-yellow-500" iconBgColor="bg-yellow-500/10" isLoading={loading} />
                        <PremiumStatCard title="Resolved" subtitle="Successfully closed" value={resolvedCount} icon={CheckCircle2} iconColor="text-green-500" iconBgColor="bg-green-500/10" isLoading={loading} />
                    </PremiumStatCardGrid>
                </div>
            </motion.div>

            {/* Ticket List */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card className="shadow-sm overflow-hidden border-border/40">
                    <div className="divide-y divide-border/30">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div>
                                    <Skeleton className="h-8 w-24 rounded-lg flex-shrink-0" />
                                </div>
                            ))
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-16 text-center text-muted-foreground">
                                <HeadphonesIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No tickets found</h3>
                                <p className="text-sm mt-1">Incoming support requests will appear here.</p>
                            </div>
                        ) : (
                            pagedTickets.map((ticket) => {
                                const isResolved = ticket.status === "RESOLVED";
                                const isInProgress = ticket.status === "IN_PROGRESS";
                                const tkId = `GG-TKT-${String(ticket.ticketNumber).padStart(3, "0")}`;
                                const cat = categoryLabels[ticket.category || "general"] || categoryLabels.general;

                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => openTicketDetail(ticket.id)}
                                        className={cn("p-4 sm:px-6 transition-colors cursor-pointer", isResolved ? "bg-muted/10" : "bg-card hover:bg-muted/10")}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Status icon */}
                                            <div className="relative flex-shrink-0">
                                                <div className={cn("p-2.5 rounded-full flex items-center justify-center", isResolved ? "bg-green-500/10 text-green-600" : isInProgress ? "bg-blue-500/10 text-blue-600" : "bg-yellow-500/10 text-yellow-600")}>
                                                    {isResolved ? <CheckCircle2 className="h-4 w-4" /> : isInProgress ? <Clock className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                </div>
                                                <div className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", priorityColors[ticket.priority] || priorityColors.MEDIUM)} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm text-foreground">{ticket.user?.name || "Farmer"}</span>
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{tkId}</Badge>
                                                            <Badge className={cn("text-[10px] px-1.5 py-0 border-0", cat.color)}>{cat.label}</Badge>
                                                        </div>
                                                        {ticket.description && (
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                                            <div className="flex items-center gap-1"><Phone className="h-3 w-3" />+{ticket.phone}</div>
                                                            <span>·</span>
                                                            <span>{formatTime(ticket.createdAt)}</span>
                                                            {(ticket._count?.notes ?? 0) > 0 && (
                                                                <><span>·</span><div className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket._count?.notes}</div></>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                                </div>

                                                {/* Action buttons */}
                                                {!isResolved ? (
                                                    <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                                                        <a href={`tel:+${ticket.phone}`} onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                                                <Phone className="h-3.5 w-3.5" />Call
                                                            </Button>
                                                        </a>
                                                        <Button
                                                            onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id); }}
                                                            disabled={resolvingId === ticket.id}
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                        >
                                                            {resolvingId === ticket.id ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                            Resolve
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="mt-2 text-green-600 border-green-500/30 bg-green-500/10 text-xs">✓ Resolved</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-xs text-muted-foreground">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline" size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                            .reduce<(number | string)[]>((acc, n, idx, arr) => {
                                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                                acc.push(n);
                                return acc;
                            }, [])
                            .map((n, i) =>
                                typeof n === "string" ? (
                                    <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                                ) : (
                                    <Button
                                        key={n}
                                        variant={page === n ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 w-8 p-0 text-xs"
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </Button>
                                )
                            )
                        }
                        <Button
                            variant="outline" size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <ChevronRight className="h-8 w-8" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Ticket Detail Modal */}
            <Dialog open={!!selectedTicketId} onOpenChange={(open) => !open && closeDetail()}>
                <DialogContent className="w-[calc(100%-1rem)] sm:max-w-3xl p-0 overflow-hidden border-border/50 shadow-2xl max-h-[92vh] flex flex-col">
                    {detailLoading || !ticketDetail ? (
                        <>
                            <DialogHeader className="px-5 py-4 border-b border-border/30 bg-muted/10 shrink-0">
                                <DialogTitle>Loading ticket...</DialogTitle>
                            </DialogHeader>
                            <div className="flex items-center justify-center p-12">
                                <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Modal Header */}
                            <div className="px-5 py-4 border-b border-border/30 bg-muted/10 shrink-0">
                                <div className="flex items-start justify-between gap-3 pr-8">
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-lg">GG-TKT-{String(ticketDetail.ticketNumber).padStart(3, "0")}</span>
                                            <Badge className={cn("text-xs px-2 py-0.5", ticketDetail.status === "RESOLVED" ? "bg-green-100 text-green-700" : ticketDetail.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700")}>
                                                {ticketDetail.status.replace("_", " ")}
                                            </Badge>
                                            <Badge className={cn("text-xs px-2 py-0.5 border-0", categoryLabels[ticketDetail.category || "general"]?.color)}>
                                                {categoryLabels[ticketDetail.category || "general"]?.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                            <span className="font-medium text-foreground">{ticketDetail.user?.name || "Farmer"}</span>
                                            <span>·</span>
                                            <a href={`tel:+${ticketDetail.user?.phone}`} className="text-blue-500 hover:underline">+{ticketDetail.user?.phone}</a>
                                            <span>·</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("w-2 h-2 rounded-full", priorityColors[ticketDetail.priority])} />
                                                <span className="text-xs">{ticketDetail.priority}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <Tabs defaultValue="details" className="flex flex-col flex-1 overflow-hidden min-h-0" onValueChange={() => clearItemSelection()}>
                                <TabsList className="w-full grid grid-cols-4 px-4 pt-3 pb-0 bg-transparent shrink-0 h-auto gap-1">
                                    <TabsTrigger value="details" className="text-xs gap-1 py-2"><FileText className="h-3.5 w-3.5 hidden sm:block" />Details</TabsTrigger>
                                    <TabsTrigger value="submissions" className="text-xs gap-1 py-2"><History className="h-3.5 w-3.5 hidden sm:block" />Subs ({ticketDetail.userSubmissions?.length || 0})</TabsTrigger>
                                    <TabsTrigger value="tickets" className="text-xs gap-1 py-2"><TicketIcon className="h-3.5 w-3.5 hidden sm:block" />Prev ({ticketDetail.previousTickets?.length || 0})</TabsTrigger>
                                    <TabsTrigger value="notes" className="text-xs gap-1 py-2"><MessageSquare className="h-3.5 w-3.5 hidden sm:block" />Notes ({ticketDetail.notes?.length || 0})</TabsTrigger>
                                </TabsList>

                                {/* Details Tab */}
                                <TabsContent value="details" className="mt-0 flex-1 overflow-hidden min-h-0">
                                    <ScrollArea className="h-full max-h-[calc(92vh-180px)]">
                                        <div className="p-4 space-y-4">
                                            {/* Farmer card */}
                                            <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                                        <User className="h-6 w-6 text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-base">{ticketDetail.user?.name || "Unknown Farmer"}</p>
                                                        <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground flex-wrap">
                                                            <a href={`tel:+${ticketDetail.user?.phone}`} className="text-blue-500 hover:underline flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />+{ticketDetail.user?.phone}
                                                            </a>
                                                            <span>·</span>
                                                            <span>{ticketDetail.user?.language === "hi" ? "Hindi" : "English"}</span>
                                                            <span>·</span>
                                                            <span>{ticketDetail.user?._count?.submissions || 0} submissions</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ticket info grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { label: "Raised From", value: sourceLabels[ticketDetail.source || ""] || "Unknown" },
                                                    { label: "Category", value: categoryLabels[ticketDetail.category || "general"]?.label },
                                                    { label: "Priority", value: ticketDetail.priority },
                                                    { label: "Created", value: formatTime(ticketDetail.createdAt) },
                                                ].map((item) => (
                                                    <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/40 text-center">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                                                        <p className="font-semibold text-sm">{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Description */}
                                            {ticketDetail.description && (
                                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                                        <AlertCircle className="h-3.5 w-3.5" />Issue Description
                                                    </p>
                                                    <p className="text-sm">{ticketDetail.description}</p>
                                                </div>
                                            )}

                                            {/* Related session / submission */}
                                            {(ticketDetail.session || ticketDetail.submission) && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {ticketDetail.session && (
                                                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Calendar className="h-3.5 w-3.5" />Session</p>
                                                            <div className="flex items-center justify-between">
                                                                <Badge variant="outline" className="font-mono text-xs">{ticketDetail.session.bag?.label}</Badge>
                                                                <Badge variant="secondary" className="text-xs">{ticketDetail.session.state}</Badge>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {ticketDetail.submission && (
                                                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                                            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1.5 mb-3"><FileText className="h-3.5 w-3.5" />Submission</p>
                                                            <div className="flex items-center justify-between">
                                                                <Badge variant="outline" className="font-mono text-xs">{ticketDetail.submission.bag?.label}</Badge>
                                                                <Badge className={cn("text-xs", ticketDetail.submission.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : ticketDetail.submission.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                                                                    {ticketDetail.submission.verificationStatus}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Status timeline */}
                                            {ticketDetail.statusHistory?.length > 0 && (
                                                <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3"><History className="h-3.5 w-3.5" />Timeline</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ticketDetail.statusHistory.slice().reverse().map((change, idx, arr) => (
                                                            <div key={change.id} className="flex items-center gap-2">
                                                                <div className={cn("px-3 py-1 rounded-full text-xs font-medium border", idx === arr.length - 1 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border")}>
                                                                    {change.toStatus.replace("_", " ")}
                                                                </div>
                                                                {idx < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-3 pt-2">
                                                <a href={`tel:+${ticketDetail.phone}`} className="flex-1">
                                                    <Button variant="outline" className="w-full gap-2 h-11"><Phone className="h-4 w-4" />Call Farmer</Button>
                                                </a>
                                                {ticketDetail.status !== "RESOLVED" && (
                                                    <Button onClick={() => handleResolve(ticketDetail.id)} disabled={resolvingId === ticketDetail.id} className="flex-1 gap-2 h-11 bg-green-600 hover:bg-green-700">
                                                        {resolvingId === ticketDetail.id ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                        Mark Resolved
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                {/* Submissions Tab */}
                                <TabsContent value="submissions" className="mt-0 flex-1 overflow-hidden min-h-0">
                                    <div className={cn("flex h-full max-h-[calc(92vh-180px)]", hasItemSelected ? "gap-0" : "")}>
                                        {/* List */}
                                        <div className={cn("transition-all duration-300 flex-shrink-0", hasItemSelected ? "hidden sm:block sm:w-2/5 border-r border-border/30" : "w-full")}>
                                            <ScrollArea className="h-full">
                                                <div className="p-4 space-y-2">
                                                    {ticketDetail.userSubmissions?.length === 0 ? (
                                                        <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No submissions</p></div>
                                                    ) : ticketDetail.userSubmissions?.map((sub) => (
                                                        <div key={sub.id} onClick={() => fetchSubmissionDetail(sub.id)} className={cn("p-3 rounded-xl border transition-all cursor-pointer", selectedSubmissionId === sub.id ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/40 hover:bg-muted/30")}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={cn("text-[10px]", sub.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : sub.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                                                                        {sub.verificationStatus}
                                                                    </Badge>
                                                                    <span className="font-mono text-xs text-muted-foreground">{sub.bag.label}</span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                                                                <span>{formatDate(sub.createdAt)}</span>
                                                                {sub.aiConfidence && <span>AI: {(sub.aiConfidence * 100).toFixed(0)}%</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        {/* Detail pane */}
                                        {selectedSubmissionId && (
                                            <div className="flex-1 bg-muted/5 min-w-0">
                                                <ScrollArea className="h-full">
                                                    <div className="p-4">
                                                        <Button variant="ghost" size="sm" onClick={clearItemSelection} className="mb-3 -ml-1 text-muted-foreground hover:text-foreground">
                                                            <ArrowLeft className="w-4 h-4 mr-1" />Back
                                                        </Button>
                                                        {itemDetailLoading ? (
                                                            <div className="space-y-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-48 w-full rounded-xl" /></div>
                                                        ) : fullSubmission && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="font-bold text-base">Submission Details</h3>
                                                                    <Badge className={cn(fullSubmission.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : fullSubmission.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                                                                        {fullSubmission.verificationStatus}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2 pb-3 border-b">
                                                                    <Badge variant="outline" className="font-mono text-xs">{fullSubmission.bag.label}</Badge>
                                                                    <span className="text-xs text-muted-foreground">{formatTime(fullSubmission.createdAt)}</span>
                                                                </div>
                                                                {fullSubmission.mediaUrl && (
                                                                    <div className="rounded-xl overflow-hidden bg-muted/20 border">
                                                                        <img src={`${API}/api/submissions/${fullSubmission.id}/image`} alt="Submission" className="w-full max-h-[200px] object-contain" />
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">AI Confidence</p><p className="font-bold text-lg">{fullSubmission.aiConfidence ? `${(fullSubmission.aiConfidence * 100).toFixed(0)}%` : "—"}</p></div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">Fraud Score</p><p className="font-bold text-lg">{fullSubmission.fraudScore ? `${(fullSubmission.fraudScore * 100).toFixed(0)}%` : "—"}</p></div>
                                                                </div>
                                                                {fullSubmission.latitude && (
                                                                    <div className="p-3 rounded-xl bg-muted/20 border flex items-center justify-between">
                                                                        <div><p className="text-[10px] text-muted-foreground uppercase mb-1">Location</p><p className="text-xs font-mono">{fullSubmission.latitude.toFixed(5)}, {fullSubmission.longitude?.toFixed(5)}</p></div>
                                                                        <Button variant="outline" size="sm" onClick={() => window.open(`https://maps.google.com/?q=${fullSubmission.latitude},${fullSubmission.longitude}`, "_blank")}><MapPin className="w-3 h-3 mr-1" />Map</Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Past Tickets Tab */}
                                <TabsContent value="tickets" className="mt-0 flex-1 overflow-hidden min-h-0">
                                    <div className={cn("flex h-full max-h-[calc(92vh-180px)]")}>
                                        <div className={cn("transition-all duration-300 flex-shrink-0", hasItemSelected ? "hidden sm:block sm:w-2/5 border-r border-border/30" : "w-full")}>
                                            <ScrollArea className="h-full">
                                                <div className="p-4 space-y-2">
                                                    {ticketDetail.previousTickets?.length === 0 ? (
                                                        <div className="text-center py-12 text-muted-foreground"><TicketIcon className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No previous tickets</p></div>
                                                    ) : ticketDetail.previousTickets?.map((t) => (
                                                        <div key={t.id} onClick={() => fetchPrevTicketDetail(t.id)} className={cn("p-3 rounded-xl border transition-all cursor-pointer", selectedPrevTicketId === t.id ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/40 hover:bg-muted/30")}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs font-mono">GG-TKT-{String(t.ticketNumber).padStart(3, "0")}</Badge>
                                                                    <Badge className={cn("text-[10px] border-0", categoryLabels[t.category || "general"]?.color)}>{categoryLabels[t.category || "general"]?.label}</Badge>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                                                                <span>{formatDate(t.createdAt)}</span>
                                                                <Badge className={cn("text-[10px]", t.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{t.status}</Badge>
                                                            </div>
                                                            {t.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{t.description}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        {selectedPrevTicketId && (
                                            <div className="flex-1 bg-muted/5 min-w-0">
                                                <ScrollArea className="h-full">
                                                    <div className="p-4">
                                                        <Button variant="ghost" size="sm" onClick={clearItemSelection} className="mb-3 -ml-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                                                        {itemDetailLoading ? (
                                                            <div className="space-y-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-24 w-full rounded-xl" /></div>
                                                        ) : fullPrevTicket && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="font-bold text-base">GG-TKT-{String(fullPrevTicket.ticketNumber).padStart(3, "0")}</h3>
                                                                    <Badge className={cn(fullPrevTicket.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{fullPrevTicket.status}</Badge>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">Category</p><p className="font-medium text-sm">{categoryLabels[fullPrevTicket.category || "general"]?.label}</p></div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">Priority</p><div className="flex items-center gap-2"><div className={cn("w-2 h-2 rounded-full", priorityColors[fullPrevTicket.priority])} /><span className="font-medium text-sm">{fullPrevTicket.priority}</span></div></div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">Created</p><p className="font-medium text-sm">{formatTime(fullPrevTicket.createdAt)}</p></div>
                                                                    {fullPrevTicket.resolvedAt && <div className="p-3 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-1">Resolved</p><p className="font-medium text-sm">{formatTime(fullPrevTicket.resolvedAt)}</p></div>}
                                                                </div>
                                                                {fullPrevTicket.description && (
                                                                    <div className="p-4 rounded-xl bg-muted/20 border"><p className="text-[10px] text-muted-foreground uppercase mb-2">Description</p><p className="text-sm">{fullPrevTicket.description}</p></div>
                                                                )}
                                                                {fullPrevTicket.notes?.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs text-muted-foreground uppercase">Notes ({fullPrevTicket.notes.length})</p>
                                                                        {fullPrevTicket.notes.map((note) => (
                                                                            <div key={note.id} className="p-3 rounded-lg bg-muted/10 border text-sm">
                                                                                <p>{note.content}</p>
                                                                                <p className="text-xs text-muted-foreground mt-1">{note.createdBy || "Agent"} · {formatTime(note.createdAt)}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Notes Tab */}
                                <TabsContent value="notes" className="mt-0 flex-1 overflow-hidden min-h-0">
                                    <ScrollArea className="h-full max-h-[calc(92vh-180px)]">
                                        <div className="p-4 space-y-4">
                                            <div className="flex gap-2">
                                                <Textarea placeholder="Add an internal note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[80px] resize-none text-sm" />
                                                <Button onClick={handleAddNote} disabled={!newNote.trim() || addingNote} className="shrink-0 h-auto px-3">
                                                    {addingNote ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            {ticketDetail.notes?.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No notes yet</p></div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {ticketDetail.notes?.map((note) => (
                                                        <Card key={note.id} className="p-4">
                                                            <p className="text-sm">{note.content}</p>
                                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                                <span>{note.createdBy || "Agent"}</span><span>·</span><span>{formatTime(note.createdAt)}</span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
