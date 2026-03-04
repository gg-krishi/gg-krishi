"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users as UsersIcon, UserCheck, Activity, ChevronRight, Clock, ArrowLeft, MapPin, Image as ImageIcon, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface User {
    id: string;
    phone: string;
    name: string | null;
    language: string;
    createdAt: string;
    _count?: { sessions: number; submissions: number };
}

interface SessionDetail {
    id: string;
    state: string;
    verificationPolicy: string;
    startedAt: string;
    completedAt: string | null;
    bag: { label: string };
    submission: { verificationStatus: string } | null;
}

interface SubmissionDetail {
    id: string;
    verificationStatus: string;
    createdAt: string;
    aiConfidence: number | null;
    bag: { label: string };
}

interface UserDetail extends User {
    sessions: SessionDetail[];
    submissions: SubmissionDetail[];
}

// Full session details from API
interface FullSession {
    id: string;
    verificationPolicy: string;
    state: string;
    language: string | null;
    startedAt: string;
    completedAt: string | null;
    timeoutFlag: boolean;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    submission: { verificationStatus: string } | null;
}

// Full submission details from API
interface FullSubmission {
    id: string;
    sessionId: string;
    latitude: number | null;
    longitude: number | null;
    verificationStatus: string;
    verificationPolicy: string;
    reviewFlag: boolean;
    aiConfidence: number | null;
    fraudScore: number | null;
    fraudFlags: string | null;
    aiResponse: string | null;
    createdAt: string;
    mediaUrl: string | null;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    session: { verificationPolicy: string; language: string | null };
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

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Master-detail state for sessions/submissions
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [fullSession, setFullSession] = useState<FullSession | null>(null);
    const [fullSubmission, setFullSubmission] = useState<FullSubmission | null>(null);
    const [itemDetailLoading, setItemDetailLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const fetchUserDetail = async (userId: string) => {
        setDetailLoading(true);
        setSelectedSessionId(null);
        setSelectedSubmissionId(null);
        setFullSession(null);
        setFullSubmission(null);
        try {
            const res = await fetch(`${API}/api/users/${userId}`);
            if (res.ok) {
                setUserDetail(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch user detail:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchSessionDetail = async (sessionId: string) => {
        setItemDetailLoading(true);
        setSelectedSessionId(sessionId);
        setSelectedSubmissionId(null);
        setFullSubmission(null);
        try {
            const res = await fetch(`${API}/api/sessions/${sessionId}`);
            if (res.ok) {
                setFullSession(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch session detail:", err);
        } finally {
            setItemDetailLoading(false);
        }
    };

    const fetchSubmissionDetail = async (submissionId: string) => {
        setItemDetailLoading(true);
        setSelectedSubmissionId(submissionId);
        setSelectedSessionId(null);
        setFullSession(null);
        setImageLoading(true);
        try {
            const res = await fetch(`${API}/api/submissions/${submissionId}`);
            if (res.ok) {
                setFullSubmission(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch submission detail:", err);
        } finally {
            setItemDetailLoading(false);
        }
    };

    const clearItemSelection = () => {
        setSelectedSessionId(null);
        setSelectedSubmissionId(null);
        setFullSession(null);
        setFullSubmission(null);
    };

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/users`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        const i = setInterval(fetchUsers, 5000);
        return () => clearInterval(i);
    }, [fetchUsers]);

    const activeFarmers = users.filter((u) => (u._count?.sessions ?? 0) > 0).length;
    const totalSessions = users.reduce((acc, u) => acc + (u._count?.sessions ?? 0), 0);

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });

    const hasItemSelected = selectedSessionId !== null || selectedSubmissionId !== null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage farmers and their sessions
                    </p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard
                        title="Total Users"
                        subtitle="Registered farmers"
                        value={users.length}
                        icon={UsersIcon}
                        iconColor="text-blue-500"
                        iconBgColor="bg-blue-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Active Users"
                        subtitle="Started at least 1 session"
                        value={activeFarmers}
                        icon={UserCheck}
                        iconColor="text-emerald-500"
                        iconBgColor="bg-emerald-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Total Sessions"
                        subtitle="All-time sessions created"
                        value={totalSessions}
                        icon={Activity}
                        iconColor="text-purple-500"
                        iconBgColor="bg-purple-500/10"
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
                        <Table className="min-w-[600px]">
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-border/30">
                                    <TableHead className="w-[180px] font-medium h-12">Phone</TableHead>
                                    <TableHead className="font-medium h-12">Name</TableHead>
                                    <TableHead className="font-medium h-12">Language</TableHead>
                                    <TableHead className="text-center font-medium h-12">Sessions</TableHead>
                                    <TableHead className="text-center font-medium h-12">Submissions</TableHead>
                                    <TableHead className="text-right font-medium h-12">Joined</TableHead>
                                    <TableHead className="text-center font-medium h-12">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i} className="border-border/50">
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-16 mx-auto rounded-md" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No users yet. Users are auto-created when they message on WhatsApp.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((u) => (
                                        <TableRow
                                            key={u.id}
                                            className="border-border/30 transition-all duration-200 cursor-pointer h-16 group relative"
                                            onClick={() => { setSelectedUser(u); setDetailsModalOpen(true); fetchUserDetail(u.id); }}
                                        >
                                            <TableCell className="font-mono text-sm font-semibold text-foreground">+{u.phone}</TableCell>
                                            <TableCell className="font-medium text-muted-foreground">{u.name || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={u.language === "hi" ? "default" : "secondary"} className="font-semibold text-[10px] uppercase tracking-wider">
                                                    {u.language === "hi" ? "हिंदी" : "English"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-medium text-muted-foreground">
                                                    {u._count?.sessions || 0}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-medium text-muted-foreground">
                                                    {u._count?.submissions || 0}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground text-sm">
                                                {new Date(u.createdAt).toLocaleDateString("en-IN", {
                                                    day: "2-digit", month: "short", year: "numeric"
                                                })}
                                            </TableCell>
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setSelectedUser(u); setDetailsModalOpen(true); fetchUserDetail(u.id); }}
                                                    className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                >
                                                    View Profile
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>

            {/* User Profile Dialog with Master-Detail Layout */}
            <Dialog open={detailsModalOpen} onOpenChange={(open) => {
                setDetailsModalOpen(open);
                if (!open) {
                    setUserDetail(null);
                    clearItemSelection();
                }
            }}>
                <DialogContent className={`p-0 overflow-hidden border-border/50 shadow-2xl transition-all duration-300 ${hasItemSelected ? 'sm:max-w-5xl' : 'sm:max-w-2xl'} max-h-[85vh]`}>
                    <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10 shrink-0">
                        {selectedUser && (
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                    <UsersIcon className="w-7 h-7" />
                                </div>
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl font-bold text-foreground">
                                        {selectedUser.name || "Anonymous Farmer"}
                                    </DialogTitle>
                                    <div className="font-mono text-sm text-muted-foreground font-medium">
                                        +{selectedUser.phone}
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogHeader>

                    <Tabs defaultValue="info" className="w-full flex flex-col flex-1 overflow-hidden" onValueChange={() => clearItemSelection()}>
                        <TabsList className="w-full grid grid-cols-3 px-6 bg-muted/30 shrink-0">
                            <TabsTrigger value="info">User Info</TabsTrigger>
                            <TabsTrigger value="sessions">Sessions ({userDetail?._count?.sessions ?? selectedUser?._count?.sessions ?? 0})</TabsTrigger>
                            <TabsTrigger value="submissions">Submissions ({userDetail?._count?.submissions ?? selectedUser?._count?.submissions ?? 0})</TabsTrigger>
                        </TabsList>

                        {/* User Info Tab */}
                        <TabsContent value="info" className="mt-0 flex-1 overflow-hidden">
                            <ScrollArea className="h-[calc(85vh-180px)]">
                                <div className="p-6">
                                    {selectedUser && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Preferred Language</span>
                                                    <div className="font-medium text-lg text-foreground flex items-center gap-2">
                                                        {selectedUser.language === "hi" ? "हिंदी (Hindi)" : "English"}
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Platform Join Date</span>
                                                    <div className="font-medium text-lg text-foreground">
                                                        {new Date(selectedUser.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <h4 className="text-sm font-semibold text-muted-foreground">Engagement Metrics</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/20">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                                            <Activity className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">{selectedUser._count?.sessions || 0}</div>
                                                            <div className="text-xs font-medium text-muted-foreground uppercase">Sessions Started</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/20">
                                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                                                            <UserCheck className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">{selectedUser._count?.submissions || 0}</div>
                                                            <div className="text-xs font-medium text-muted-foreground uppercase">Submissions</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Sessions Tab with Master-Detail */}
                        <TabsContent value="sessions" className="mt-0 flex-1 overflow-hidden">
                            <div className="flex h-[calc(85vh-180px)]">
                                {/* Sessions List (Master) */}
                                <div className={`${hasItemSelected ? 'w-2/5 border-r border-border/30' : 'w-full'} transition-all duration-300`}>
                                    <ScrollArea className="h-full">
                                        <div className="p-4 space-y-2">
                                            {detailLoading ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                                                ))
                                            ) : userDetail?.sessions && userDetail.sessions.length > 0 ? (
                                                <>
                                                    {userDetail.sessions.map((session) => (
                                                        <div
                                                            key={session.id}
                                                            onClick={() => fetchSessionDetail(session.id)}
                                                            className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedSessionId === session.id
                                                                    ? 'bg-primary/10 border-primary/30'
                                                                    : 'bg-muted/20 border-border/40 hover:bg-muted/30'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        variant={session.state === "COMPLETED" ? "outline" : "secondary"}
                                                                        className={`text-[10px] ${session.state === "COMPLETED" ? "text-green-600 border-green-600" : ""}`}
                                                                    >
                                                                        {session.state}
                                                                    </Badge>
                                                                    <span className="font-mono text-xs text-muted-foreground">{session.bag.label}</span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(session.startedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                </div>
                                                                {session.submission && (
                                                                    <span className={`text-xs font-medium ${session.submission.verificationStatus === "VERIFIED" ? "text-green-600" :
                                                                            session.submission.verificationStatus === "REJECTED" ? "text-red-600" : "text-yellow-600"
                                                                        }`}>
                                                                        {session.submission.verificationStatus}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        className="w-full mt-2"
                                                        size="sm"
                                                        onClick={() => { router.push(`/sessions?userId=${selectedUser?.id}`); setDetailsModalOpen(false); }}
                                                    >
                                                        View All in Sessions Page <ChevronRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                    <p>No sessions yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Session Detail (Detail) */}
                                {selectedSessionId && (
                                    <div className="w-3/5 bg-muted/5">
                                        <ScrollArea className="h-full">
                                            <div className="p-6">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearItemSelection}
                                                    className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                                                >
                                                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
                                                </Button>

                                                {itemDetailLoading ? (
                                                    <div className="space-y-4">
                                                        <Skeleton className="h-8 w-48" />
                                                        <Skeleton className="h-24 w-full rounded-xl" />
                                                        <Skeleton className="h-24 w-full rounded-xl" />
                                                    </div>
                                                ) : fullSession && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-bold text-lg">Session Details</h3>
                                                            <Badge
                                                                variant={stateConfig[fullSession.state]?.variant || "secondary"}
                                                                className={stateConfig[fullSession.state]?.className}
                                                            >
                                                                {fullSession.state}
                                                            </Badge>
                                                        </div>

                                                        <div className="space-y-1 pb-4 border-b border-border/30">
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                                                                    {fullSession.bag.label}
                                                                </Badge>
                                                                <span className="text-sm text-muted-foreground font-medium">
                                                                    Started {formatDate(fullSession.startedAt)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Policy</span>
                                                                <div className="font-medium text-sm text-foreground">
                                                                    {fullSession.verificationPolicy === "DEMO_AUTO" ? "🎭 Demo" : "🌾 Pilot MRV"}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Language</span>
                                                                <div className="font-medium text-sm text-foreground uppercase">
                                                                    {fullSession.language || "Not Selected"}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Flags</span>
                                                                <div>
                                                                    {fullSession.timeoutFlag ? (
                                                                        <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">TIMEOUT</Badge>
                                                                    ) : (
                                                                        <span className="text-sm text-muted-foreground">Normal</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Submission</span>
                                                                <div className="font-medium text-sm">
                                                                    {fullSession.submission?.verificationStatus ? (
                                                                        <span className={
                                                                            fullSession.submission.verificationStatus === "VERIFIED" ? "text-green-600" :
                                                                                fullSession.submission.verificationStatus === "REJECTED" ? "text-red-600" : "text-yellow-600"
                                                                        }>
                                                                            {fullSession.submission.verificationStatus}
                                                                        </span>
                                                                    ) : <span className="text-muted-foreground">None</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Submissions Tab with Master-Detail */}
                        <TabsContent value="submissions" className="mt-0 flex-1 overflow-hidden">
                            <div className="flex h-[calc(85vh-180px)]">
                                {/* Submissions List (Master) */}
                                <div className={`${hasItemSelected ? 'w-2/5 border-r border-border/30' : 'w-full'} transition-all duration-300`}>
                                    <ScrollArea className="h-full">
                                        <div className="p-4 space-y-2">
                                            {detailLoading ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                                                ))
                                            ) : userDetail?.submissions && userDetail.submissions.length > 0 ? (
                                                <>
                                                    {userDetail.submissions.map((sub) => (
                                                        <div
                                                            key={sub.id}
                                                            onClick={() => fetchSubmissionDetail(sub.id)}
                                                            className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedSubmissionId === sub.id
                                                                    ? 'bg-primary/10 border-primary/30'
                                                                    : 'bg-muted/20 border-border/40 hover:bg-muted/30'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        variant={sub.verificationStatus === "VERIFIED" ? "outline" : sub.verificationStatus === "REJECTED" ? "destructive" : "secondary"}
                                                                        className={`text-[10px] ${sub.verificationStatus === "VERIFIED" ? "text-green-600 border-green-600" : ""}`}
                                                                    >
                                                                        {sub.verificationStatus === "PENDING_REVIEW" ? "REVIEW" : sub.verificationStatus}
                                                                    </Badge>
                                                                    <span className="font-mono text-xs text-muted-foreground">{sub.bag.label}</span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(sub.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                </div>
                                                                {sub.aiConfidence !== null && (
                                                                    <span className="text-xs font-medium text-muted-foreground">
                                                                        {(sub.aiConfidence * 100).toFixed(0)}% conf.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        className="w-full mt-2"
                                                        size="sm"
                                                        onClick={() => { router.push(`/submissions?userId=${selectedUser?.id}`); setDetailsModalOpen(false); }}
                                                    >
                                                        View All in Submissions Page <ChevronRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                    <p>No submissions yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Submission Detail (Detail) */}
                                {selectedSubmissionId && (
                                    <div className="w-3/5 bg-muted/5">
                                        <ScrollArea className="h-full">
                                            <div className="p-6">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearItemSelection}
                                                    className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                                                >
                                                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
                                                </Button>

                                                {itemDetailLoading ? (
                                                    <div className="space-y-4">
                                                        <Skeleton className="h-8 w-48" />
                                                        <Skeleton className="h-48 w-full rounded-xl" />
                                                        <Skeleton className="h-24 w-full rounded-xl" />
                                                    </div>
                                                ) : fullSubmission && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-bold text-lg">Submission Details</h3>
                                                            <Badge
                                                                variant={fullSubmission.verificationStatus === "VERIFIED" ? "outline" : fullSubmission.verificationStatus === "REJECTED" ? "destructive" : "secondary"}
                                                                className={fullSubmission.verificationStatus === "VERIFIED" ? "text-green-600 border-green-600" : ""}
                                                            >
                                                                {fullSubmission.verificationStatus}
                                                            </Badge>
                                                        </div>

                                                        <div className="space-y-1 pb-4 border-b border-border/30">
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                                                                    {fullSubmission.bag.label}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground font-medium">
                                                                    {formatDate(fullSubmission.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Image */}
                                                        <div className="relative rounded-xl overflow-hidden bg-muted/20 border border-border/40">
                                                            {fullSubmission.mediaUrl ? (
                                                                <>
                                                                    {imageLoading && (
                                                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                                                            <Skeleton className="w-full h-full" />
                                                                        </div>
                                                                    )}
                                                                    <img
                                                                        src={`${API}/api/submissions/${fullSubmission.id}/image`}
                                                                        alt="Verification"
                                                                        className={`w-full max-h-[200px] object-contain transition-opacity duration-300 ${imageLoading ? "opacity-0" : "opacity-100"}`}
                                                                        onLoad={() => setImageLoading(false)}
                                                                    />
                                                                </>
                                                            ) : (
                                                                <div className="h-32 flex items-center justify-center text-muted-foreground">
                                                                    <ImageIcon className="w-8 h-8 opacity-30" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {fullSubmission.session?.verificationPolicy !== "DEMO_AUTO" && (
                                                                <>
                                                                    <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">AI Confidence</span>
                                                                        <div className="font-bold text-lg text-foreground">
                                                                            {fullSubmission.aiConfidence !== null ? `${(fullSubmission.aiConfidence * 100).toFixed(0)}%` : "—"}
                                                                        </div>
                                                                        {fullSubmission.aiConfidence !== null && (
                                                                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full ${fullSubmission.aiConfidence > 0.7 ? "bg-green-500" : fullSubmission.aiConfidence > 0.4 ? "bg-yellow-500" : "bg-red-500"}`}
                                                                                    style={{ width: `${fullSubmission.aiConfidence * 100}%` }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border border-border/40">
                                                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Fraud Score</span>
                                                                        <div className="font-bold text-lg text-foreground">
                                                                            {fullSubmission.fraudScore !== null ? `${(fullSubmission.fraudScore * 100).toFixed(0)}%` : "—"}
                                                                        </div>
                                                                        {fullSubmission.fraudScore !== null && (
                                                                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full ${fullSubmission.fraudScore < 0.3 ? "bg-green-500" : fullSubmission.fraudScore < 0.7 ? "bg-yellow-500" : "bg-red-500"}`}
                                                                                    style={{ width: `${fullSubmission.fraudScore * 100}%` }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* GPS */}
                                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between">
                                                            <div>
                                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">GPS Location</span>
                                                                <div className="font-medium text-sm text-foreground">
                                                                    {fullSubmission.latitude && fullSubmission.longitude
                                                                        ? `${fullSubmission.latitude.toFixed(6)}, ${fullSubmission.longitude.toFixed(6)}`
                                                                        : "Unknown"}
                                                                </div>
                                                            </div>
                                                            {fullSubmission.latitude && fullSubmission.longitude && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8"
                                                                    onClick={() => window.open(`https://maps.google.com/?q=${fullSubmission.latitude},${fullSubmission.longitude}`, "_blank")}
                                                                >
                                                                    <MapPin className="w-3 h-3 mr-1" /> Map
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* AI Analysis */}
                                                        {fullSubmission.session?.verificationPolicy !== "DEMO_AUTO" && fullSubmission.aiResponse && (() => {
                                                            let aiConfig = null;
                                                            try { aiConfig = JSON.parse(fullSubmission.aiResponse); } catch (e) { }
                                                            if (!aiConfig) return null;

                                                            const checks = [
                                                                { key: "biochar_visible", label: "Biochar Visible" },
                                                                { key: "gg_bag_visible", label: "GG Bag Visible" },
                                                                { key: "soil_visible", label: "Soil Visible" },
                                                                { key: "outdoor_environment", label: "Outdoor Environment" },
                                                                { key: "human_present", label: "Human Present" },
                                                                { key: "screen_capture_detected", label: "Screen Capture", inverse: true }
                                                            ];

                                                            return (
                                                                <div className="space-y-3 pt-3 border-t border-border/30">
                                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                        <FileText className="w-3 h-3" /> AI Analysis
                                                                    </h4>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {checks.map(c => {
                                                                            const pass = c.inverse ? !aiConfig[c.key] : aiConfig[c.key];
                                                                            return (
                                                                                <div key={c.key} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/10 border border-border/20">
                                                                                    {pass ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                                                                                    <span className={pass ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    {aiConfig.flags && aiConfig.flags.length > 0 && (
                                                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                                            <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                                                                                <AlertTriangle className="w-3 h-3" /> Flags
                                                                            </span>
                                                                            <ul className="text-xs text-red-600/90 list-disc list-inside mt-1">
                                                                                {aiConfig.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}
