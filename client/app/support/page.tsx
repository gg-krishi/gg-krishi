"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    HeadphonesIcon, CheckCircle2, TicketIcon, Clock, Phone,
    AlertCircle, MessageSquare, MapPin, FileText, History,
    ChevronRight, Send, User, Calendar, Tag, ArrowLeft, Image as ImageIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    general: { label: "General", color: "bg-gray-100 text-gray-700" },
    technical_problem: { label: "Technical", color: "bg-orange-100 text-orange-700" },
    payment_issue: { label: "Payment", color: "bg-purple-100 text-purple-700" },
    verification_query: { label: "Verification", color: "bg-blue-100 text-blue-700" },
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
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Detail modal state
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [addingNote, setAddingNote] = useState(false);

    // Master-detail for submissions/tickets
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
                setAllTickets(prev => prev.map(t =>
                    t.id === ticketId ? { ...t, status: "IN_PROGRESS" } : t
                ));
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
            if (res.ok) {
                setFullSubmission(await res.json());
            }
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
            if (res.ok) {
                setFullPrevTicket(await res.json());
            }
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
                setAllTickets((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, status: "RESOLVED" } : t))
                );
                if (ticketDetail?.id === id) {
                    setTicketDetail(prev => prev ? { ...prev, status: "RESOLVED" } : prev);
                }
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

    const formatTime = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
    });

    const openCount = allTickets.filter(t => t.status !== "RESOLVED").length;
    const resolvedCount = allTickets.filter(t => t.status === "RESOLVED").length;
    const filteredTickets = filter === "ALL" ? allTickets : allTickets.filter(t => filter === "OPEN" ? t.status !== "RESOLVED" : t.status === "RESOLVED");
    const hasItemSelected = selectedSubmissionId !== null || selectedPrevTicketId !== null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Customer Support</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage help requests and farmer tickets</p>
                </div>
                <div className="flex items-center gap-2 bg-background/50 p-1.5 rounded-xl border border-border/50 shadow-sm backdrop-blur-md">
                    {[{ id: "ALL", label: "All Tickets" }, { id: "OPEN", label: "Open" }, { id: "RESOLVED", label: "Resolved" }].map((f) => (
                        <Button
                            key={f.id}
                            variant={filter === f.id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFilter(f.id)}
                            className={cn("h-8 rounded-lg px-4 text-xs font-semibold transition-all",
                                filter === f.id ? "bg-foreground text-background hover:bg-foreground/90 shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            )}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard title="Total Tickets" subtitle="All time requests" value={allTickets.length} icon={TicketIcon} iconColor="text-blue-500" iconBgColor="bg-blue-500/10" isLoading={loading} />
                    <PremiumStatCard title="Active Cases" subtitle="Needs attention" value={openCount} icon={Clock} iconColor="text-yellow-500" iconBgColor="bg-yellow-500/10" isLoading={loading} />
                    <PremiumStatCard title="Resolved" subtitle="Successfully closed" value={resolvedCount} icon={CheckCircle2} iconColor="text-green-500" iconBgColor="bg-green-500/10" isLoading={loading} />
                </PremiumStatCardGrid>
            </motion.div>

            {/* Tickets List */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card className="shadow-sm overflow-hidden border-border/40">
                    <div className="divide-y divide-border/30">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div><Skeleton className="h-5 w-32 mb-1" /><Skeleton className="h-4 w-24" /></div>
                                    </div>
                                    <Skeleton className="h-8 w-24 rounded-lg" />
                                </div>
                            ))
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-16 text-center text-muted-foreground">
                                <HeadphonesIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No tickets found</h3>
                                <p className="text-sm mt-1">Incoming support requests will appear here.</p>
                            </div>
                        ) : (
                            filteredTickets.map((ticket) => {
                                const isResolved = ticket.status === "RESOLVED";
                                const isInProgress = ticket.status === "IN_PROGRESS";
                                const tkId = `GG-TKT-${String(ticket.ticketNumber).padStart(3, "0")}`;
                                const cat = categoryLabels[ticket.category || "general"] || categoryLabels.general;

                                return (
                                    <div key={ticket.id} onClick={() => openTicketDetail(ticket.id)} className={cn("flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 transition-colors cursor-pointer group", isResolved ? "bg-muted/20" : "bg-card hover:bg-muted/10")}>
                                        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1 mb-4 sm:mb-0">
                                            <div className="relative">
                                                <div className={cn("p-3 rounded-full shrink-0 flex items-center justify-center", isResolved ? "bg-green-500/10 text-green-600" : isInProgress ? "bg-blue-500/10 text-blue-600" : "bg-yellow-500/10 text-yellow-600")}>
                                                    {isResolved ? <CheckCircle2 className="h-5 w-5" /> : isInProgress ? <Clock className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                                </div>
                                                <div className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card", priorityColors[ticket.priority] || priorityColors.MEDIUM)} />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{ticket.user?.name || "Farmer"}</h4>
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tkId}</Badge>
                                                    <Badge className={cn("text-[10px] px-1.5 py-0 border-0", cat.color)}>{cat.label}</Badge>
                                                </div>
                                                {ticket.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>}
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1 font-medium"><Phone className="h-3 w-3" />+{ticket.phone}</div>
                                                    <span>•</span>
                                                    <span>{formatTime(ticket.createdAt)}</span>
                                                    {(ticket._count?.notes ?? 0) > 0 && (<><span>•</span><div className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket._count?.notes}</div></>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 sm:ml-4 shrink-0 justify-end w-full sm:w-auto">
                                            {!isResolved ? (
                                                <>
                                                    <a href={`tel:+${ticket.phone}`} onClick={(e) => e.stopPropagation()}><Button variant="outline" size="sm" className="h-9 gap-2"><Phone className="h-4 w-4" /><span className="hidden sm:inline">Call</span></Button></a>
                                                    <Button onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id); }} disabled={resolvingId === ticket.id} size="sm" className="h-9 gap-2 bg-green-600 hover:bg-green-700 text-white">
                                                        {resolvingId === ticket.id ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Resolve
                                                    </Button>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold">Resolved</Badge>
                                            )}
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* Ticket Detail Modal */}
            <Dialog open={!!selectedTicketId} onOpenChange={(open) => !open && closeDetail()}>
                <DialogContent className={cn("p-0 overflow-hidden border-border/50 shadow-2xl transition-all duration-300 max-h-[90vh]", hasItemSelected ? "sm:max-w-6xl" : "sm:max-w-3xl")}>
                    {detailLoading || !ticketDetail ? (
                        <>
                            <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10 shrink-0">
                                <DialogTitle>Loading ticket...</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 flex items-center justify-center p-12">
                                <Clock className="h-10 w-10 animate-spin text-muted-foreground" />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Header */}
                            <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <TicketIcon className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <DialogTitle className="text-xl font-bold">GG-TKT-{String(ticketDetail.ticketNumber).padStart(3, "0")}</DialogTitle>
                                            <Badge className={cn("text-xs px-2.5 py-0.5", ticketDetail.status === "RESOLVED" ? "bg-green-100 text-green-700" : ticketDetail.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700")}>
                                                {ticketDetail.status.replace("_", " ")}
                                            </Badge>
                                            <Badge className={cn("text-xs px-2.5 py-0.5 border-0", categoryLabels[ticketDetail.category || "general"]?.color)}>
                                                {categoryLabels[ticketDetail.category || "general"]?.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="font-medium">{ticketDetail.user?.name || "Farmer"}</span>
                                            <span>•</span>
                                            <span>+{ticketDetail.user?.phone}</span>
                                            <span>•</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("w-2 h-2 rounded-full", priorityColors[ticketDetail.priority])} />
                                                <span>{ticketDetail.priority}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DialogHeader>

                            <Tabs defaultValue="details" className="flex flex-col flex-1 overflow-hidden" onValueChange={() => clearItemSelection()}>
                                <TabsList className="w-full grid grid-cols-4 px-6 pt-4 bg-transparent shrink-0">
                                    <TabsTrigger value="details" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Details</TabsTrigger>
                                    <TabsTrigger value="submissions" className="gap-1.5"><History className="h-3.5 w-3.5" />Submissions ({ticketDetail.userSubmissions?.length || 0})</TabsTrigger>
                                    <TabsTrigger value="tickets" className="gap-1.5"><TicketIcon className="h-3.5 w-3.5" />Past Tickets ({ticketDetail.previousTickets?.length || 0})</TabsTrigger>
                                    <TabsTrigger value="notes" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Notes ({ticketDetail.notes?.length || 0})</TabsTrigger>
                                </TabsList>

                                {/* Details Tab */}
                                <TabsContent value="details" className="mt-0 flex-1 overflow-hidden">
                                    <ScrollArea className="h-[calc(90vh-220px)]">
                                        <div className="p-6">
                                            {/* Main Info Card */}
                                            <Card className="border-border/50 shadow-sm overflow-hidden">
                                                {/* Farmer Header */}
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 border-b">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center border">
                                                            <User className="h-7 w-7 text-blue-600" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-xl font-bold">{ticketDetail.user?.name || "Unknown Farmer"}</h3>
                                                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                                <a href={`tel:+${ticketDetail.user?.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline font-medium">
                                                                    <Phone className="h-3.5 w-3.5" />+{ticketDetail.user?.phone}
                                                                </a>
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                                                    {ticketDetail.user?.language === "hi" ? "Hindi" : "English"}
                                                                </span>
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                                                    {ticketDetail.user?._count?.submissions || 0} submissions
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Ticket Details Grid */}
                                                <div className="p-5">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                                        <div className="text-center p-4 rounded-xl bg-muted/40">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Raised From</p>
                                                            <p className="font-semibold text-sm">{sourceLabels[ticketDetail.source || ""] || "Unknown"}</p>
                                                        </div>
                                                        <div className="text-center p-4 rounded-xl bg-muted/40">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                                                            <Badge className={cn("mt-1", categoryLabels[ticketDetail.category || "general"]?.color)}>
                                                                {categoryLabels[ticketDetail.category || "general"]?.label}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-center p-4 rounded-xl bg-muted/40">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                                                            <div className="flex items-center justify-center gap-2 mt-1">
                                                                <div className={cn("w-3 h-3 rounded-full", priorityColors[ticketDetail.priority])} />
                                                                <span className="font-semibold text-sm">{ticketDetail.priority}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-center p-4 rounded-xl bg-muted/40">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                                                            <p className="font-semibold text-sm">{formatTime(ticketDetail.createdAt)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Description */}
                                                    {ticketDetail.description && (
                                                        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 mb-5">
                                                            <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                                                <AlertCircle className="h-3.5 w-3.5" /> Issue Description
                                                            </p>
                                                            <p className="text-sm text-amber-900 dark:text-amber-100">{ticketDetail.description}</p>
                                                        </div>
                                                    )}

                                                    {/* Related Session & Submission */}
                                                    {(ticketDetail.session || ticketDetail.submission) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                                                            {ticketDetail.session && (
                                                                <div className="p-4 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
                                                                    <p className="text-xs text-green-700 dark:text-green-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                                                                        <Calendar className="h-3.5 w-3.5" /> Related Session
                                                                    </p>
                                                                    <div className="flex items-center justify-between">
                                                                        <Badge variant="outline" className="font-mono bg-white dark:bg-gray-800">{ticketDetail.session.bag?.label}</Badge>
                                                                        <Badge variant="secondary">{ticketDetail.session.state}</Badge>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-2">{ticketDetail.session.verificationPolicy}</p>
                                                                </div>
                                                            )}
                                                            {ticketDetail.submission && (
                                                                <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
                                                                    <p className="text-xs text-orange-700 dark:text-orange-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                                                                        <FileText className="h-3.5 w-3.5" /> Related Submission
                                                                    </p>
                                                                    <div className="flex items-center justify-between">
                                                                        <Badge variant="outline" className="font-mono bg-white dark:bg-gray-800">{ticketDetail.submission.bag?.label}</Badge>
                                                                        <Badge className={cn(
                                                                            ticketDetail.submission.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" :
                                                                            ticketDetail.submission.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                                                                            "bg-yellow-100 text-yellow-700"
                                                                        )}>
                                                                            {ticketDetail.submission.verificationStatus}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                                        {ticketDetail.submission.aiConfidence && <span>AI: {(ticketDetail.submission.aiConfidence * 100).toFixed(0)}%</span>}
                                                                        {ticketDetail.submission.latitude && (
                                                                            <a href={`https://maps.google.com/?q=${ticketDetail.submission.latitude},${ticketDetail.submission.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                                                <MapPin className="h-3 w-3" />View Map
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Status Timeline */}
                                                    {ticketDetail.statusHistory?.length > 0 && (
                                                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4 flex items-center gap-1.5">
                                                                <History className="h-3.5 w-3.5" /> Status Timeline
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {ticketDetail.statusHistory.slice().reverse().map((change, idx, arr) => (
                                                                    <div key={change.id} className="flex items-center gap-2">
                                                                        <div className={cn(
                                                                            "px-3 py-1.5 rounded-full text-xs font-medium border",
                                                                            idx === arr.length - 1
                                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                                : "bg-muted border-border"
                                                                        )}>
                                                                            {change.toStatus.replace("_", " ")}
                                                                        </div>
                                                                        {idx < arr.length - 1 && (
                                                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-3">
                                                                Last updated: {formatTime(ticketDetail.statusHistory[0]?.changedAt)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Footer */}
                                                <div className="px-5 py-4 bg-muted/20 border-t flex items-center gap-3">
                                                    <a href={`tel:+${ticketDetail.phone}`}>
                                                        <Button variant="outline" className="gap-2">
                                                            <Phone className="h-4 w-4" />Call Farmer
                                                        </Button>
                                                    </a>
                                                    {ticketDetail.status !== "RESOLVED" && (
                                                        <Button onClick={() => handleResolve(ticketDetail.id)} disabled={resolvingId === ticketDetail.id} className="gap-2 bg-green-600 hover:bg-green-700">
                                                            {resolvingId === ticketDetail.id ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                            Mark as Resolved
                                                        </Button>
                                                    )}
                                                </div>
                                            </Card>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                {/* Submissions Tab with Master-Detail */}
                                <TabsContent value="submissions" className="mt-0 flex-1 overflow-hidden">
                                    <div className="flex h-[calc(90vh-220px)]">
                                        <div className={cn("transition-all duration-300", hasItemSelected ? "w-2/5 border-r border-border/30" : "w-full")}>
                                            <ScrollArea className="h-full">
                                                <div className="p-4 space-y-2">
                                                    {ticketDetail.userSubmissions?.length === 0 ? (
                                                        <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No submissions from this farmer</p></div>
                                                    ) : (
                                                        ticketDetail.userSubmissions?.map((sub) => (
                                                            <div key={sub.id} onClick={() => fetchSubmissionDetail(sub.id)} className={cn("p-4 rounded-xl border transition-all cursor-pointer", selectedSubmissionId === sub.id ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/40 hover:bg-muted/30")}>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge className={cn("text-[10px]", sub.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : sub.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                                                                            {sub.verificationStatus}
                                                                        </Badge>
                                                                        <span className="font-mono text-xs text-muted-foreground">{sub.bag.label}</span>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                                                    <span>{formatDate(sub.createdAt)}</span>
                                                                    {sub.aiConfidence && <span>AI: {(sub.aiConfidence * 100).toFixed(0)}%</span>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        {selectedSubmissionId && (
                                            <div className="w-3/5 bg-muted/5">
                                                <ScrollArea className="h-full">
                                                    <div className="p-6">
                                                        <Button variant="ghost" size="sm" onClick={clearItemSelection} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                                                        {itemDetailLoading ? (
                                                            <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full rounded-xl" /></div>
                                                        ) : fullSubmission && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="font-bold text-lg">Submission Details</h3>
                                                                    <Badge className={cn(fullSubmission.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : fullSubmission.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                                                                        {fullSubmission.verificationStatus}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-3 pb-4 border-b">
                                                                    <Badge variant="outline" className="font-mono">{fullSubmission.bag.label}</Badge>
                                                                    <span className="text-sm text-muted-foreground">{formatTime(fullSubmission.createdAt)}</span>
                                                                </div>
                                                                {fullSubmission.mediaUrl && (
                                                                    <div className="rounded-xl overflow-hidden bg-muted/20 border">
                                                                        <img src={`${API}/api/submissions/${fullSubmission.id}/image`} alt="Submission" className="w-full max-h-[250px] object-contain" />
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-3 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-1">AI Confidence</p>
                                                                        <p className="font-bold text-lg">{fullSubmission.aiConfidence ? `${(fullSubmission.aiConfidence * 100).toFixed(0)}%` : "—"}</p>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-1">Fraud Score</p>
                                                                        <p className="font-bold text-lg">{fullSubmission.fraudScore ? `${(fullSubmission.fraudScore * 100).toFixed(0)}%` : "—"}</p>
                                                                    </div>
                                                                </div>
                                                                {fullSubmission.latitude && (
                                                                    <div className="p-3 rounded-xl bg-muted/20 border flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground uppercase mb-1">Location</p>
                                                                            <p className="text-sm font-mono">{fullSubmission.latitude.toFixed(6)}, {fullSubmission.longitude?.toFixed(6)}</p>
                                                                        </div>
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

                                {/* Past Tickets Tab with Master-Detail */}
                                <TabsContent value="tickets" className="mt-0 flex-1 overflow-hidden">
                                    <div className="flex h-[calc(90vh-220px)]">
                                        <div className={cn("transition-all duration-300", hasItemSelected ? "w-2/5 border-r border-border/30" : "w-full")}>
                                            <ScrollArea className="h-full">
                                                <div className="p-4 space-y-2">
                                                    {ticketDetail.previousTickets?.length === 0 ? (
                                                        <div className="text-center py-12 text-muted-foreground"><TicketIcon className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No previous tickets</p></div>
                                                    ) : (
                                                        ticketDetail.previousTickets?.map((t) => (
                                                            <div key={t.id} onClick={() => fetchPrevTicketDetail(t.id)} className={cn("p-4 rounded-xl border transition-all cursor-pointer", selectedPrevTicketId === t.id ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/40 hover:bg-muted/30")}>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline">GG-TKT-{String(t.ticketNumber).padStart(3, "0")}</Badge>
                                                                        <Badge className={cn("text-[10px] border-0", categoryLabels[t.category || "general"]?.color)}>{categoryLabels[t.category || "general"]?.label}</Badge>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                                                    <span>{formatDate(t.createdAt)}</span>
                                                                    <Badge className={cn("text-[10px]", t.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{t.status}</Badge>
                                                                </div>
                                                                {t.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{t.description}</p>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        {selectedPrevTicketId && (
                                            <div className="w-3/5 bg-muted/5">
                                                <ScrollArea className="h-full">
                                                    <div className="p-6">
                                                        <Button variant="ghost" size="sm" onClick={clearItemSelection} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                                                        {itemDetailLoading ? (
                                                            <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24 w-full rounded-xl" /></div>
                                                        ) : fullPrevTicket && (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="font-bold text-lg">GG-TKT-{String(fullPrevTicket.ticketNumber).padStart(3, "0")}</h3>
                                                                    <Badge className={cn(fullPrevTicket.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{fullPrevTicket.status}</Badge>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-3 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-1">Category</p>
                                                                        <p className="font-medium">{categoryLabels[fullPrevTicket.category || "general"]?.label}</p>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-1">Priority</p>
                                                                        <div className="flex items-center gap-2"><div className={cn("w-2 h-2 rounded-full", priorityColors[fullPrevTicket.priority])} /><span className="font-medium">{fullPrevTicket.priority}</span></div>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-1">Created</p>
                                                                        <p className="font-medium">{formatTime(fullPrevTicket.createdAt)}</p>
                                                                    </div>
                                                                    {fullPrevTicket.resolvedAt && (
                                                                        <div className="p-3 rounded-xl bg-muted/20 border">
                                                                            <p className="text-xs text-muted-foreground uppercase mb-1">Resolved</p>
                                                                            <p className="font-medium">{formatTime(fullPrevTicket.resolvedAt)}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {fullPrevTicket.description && (
                                                                    <div className="p-4 rounded-xl bg-muted/20 border">
                                                                        <p className="text-xs text-muted-foreground uppercase mb-2">Description</p>
                                                                        <p className="text-sm">{fullPrevTicket.description}</p>
                                                                    </div>
                                                                )}
                                                                {fullPrevTicket.notes?.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs text-muted-foreground uppercase">Notes ({fullPrevTicket.notes.length})</p>
                                                                        {fullPrevTicket.notes.map((note) => (
                                                                            <div key={note.id} className="p-3 rounded-lg bg-muted/10 border text-sm">
                                                                                <p>{note.content}</p>
                                                                                <p className="text-xs text-muted-foreground mt-1">{formatTime(note.createdAt)}</p>
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
                                <TabsContent value="notes" className="mt-0 flex-1 overflow-hidden">
                                    <ScrollArea className="h-[calc(90vh-220px)]">
                                        <div className="p-6 space-y-4">
                                            {/* Add Note */}
                                            <div className="flex gap-3">
                                                <Textarea placeholder="Add an internal note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[100px] resize-none" />
                                                <Button onClick={handleAddNote} disabled={!newNote.trim() || addingNote} className="shrink-0 h-auto">
                                                    {addingNote ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            {/* Notes List */}
                                            {ticketDetail.notes?.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No notes yet</p></div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {ticketDetail.notes?.map((note) => (
                                                        <Card key={note.id} className="p-4">
                                                            <p className="text-sm">{note.content}</p>
                                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                                <span>{note.createdBy || "Agent"}</span><span>•</span><span>{formatTime(note.createdAt)}</span>
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
