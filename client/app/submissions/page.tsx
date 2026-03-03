"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Check, X, Image as ImageIcon, MapPin } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Submission {
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
    createdAt: string;
    mediaUrl: string | null;
    user: { phone: string; name: string | null };
    bag: { label: string; batchId: string | null };
    session: { verificationPolicy: string; language: string | null };
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className?: string }> = {
    VERIFIED: { variant: "outline", className: "text-green-600 border-green-600" },
    PENDING: { variant: "secondary" },
    PENDING_REVIEW: { variant: "secondary", className: "text-orange-600" },
    REJECTED: { variant: "destructive" },
};

export default function SubmissionsPage() {
    const [subs, setSubs] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("");
    
    // Image Modal State
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

    // Action loading states
    const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'reject' | null>>({});

    const fetchSubs = useCallback(async () => {
        try {
            const url = filter ? `${API}/api/submissions?status=${filter}` : `${API}/api/submissions`;
            const res = await fetch(url);
            const data = await res.json();
            setSubs(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error("Failed to fetch submissions:", err); 
        } finally { 
            setLoading(false); 
        }
    }, [filter]);

    useEffect(() => { 
        fetchSubs(); 
        const i = setInterval(fetchSubs, 5000); 
        return () => clearInterval(i); 
    }, [fetchSubs]);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setActionLoading(prev => ({ ...prev, [id]: action }));
        try {
            await fetch(`${API}/api/submissions/${id}/${action}`, { method: "POST" });
            await fetchSubs();
        } catch (err) {
            console.error(`Failed to ${action} submission:`, err);
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: null }));
        }
    };

    const exportCSV = () => {
        window.open(`${API}/api/submissions/export`, "_blank");
    };

    const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { 
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
    });

    const openImage = (id: string) => {
        setSelectedImageId(id);
        setImageModalOpen(true);
    };

    const verifiedCount = subs.filter((s) => s.verificationStatus === "VERIFIED").length;
    const pendingReviewCount = subs.filter((s) => s.verificationStatus === "PENDING_REVIEW").length;

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
                        <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {subs.length} total &middot; <span className="text-green-500 font-medium">{verifiedCount} verified</span> &middot; <span className="text-orange-500 font-medium">{pendingReviewCount} pending review</span>
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                        {[{ id: "", label: "All" }, { id: "VERIFIED", label: "Verified" }, { id: "PENDING_REVIEW", label: "Review" }, { id: "REJECTED", label: "Rejected" }].map((f) => (
                            <Button 
                                key={f.id} 
                                variant={filter === f.id ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setFilter(f.id)}
                                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                                    filter === f.id 
                                        ? f.id === "VERIFIED" ? "bg-green-600 hover:bg-green-700" : f.id === "REJECTED" ? "bg-red-600 hover:bg-red-700" : f.id === "PENDING_REVIEW" ? "bg-orange-500 hover:bg-orange-600" : ""
                                        : ""
                                }`}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                    
                    <Button onClick={exportCSV} variant="outline" className="h-10 border-blue-500/30 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
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
                                <TableHead className="font-medium">Bag</TableHead>
                                <TableHead className="font-medium">User</TableHead>
                                <TableHead className="font-medium">Status</TableHead>
                                <TableHead className="font-medium">AI Conf.</TableHead>
                                <TableHead className="font-medium">GPS</TableHead>
                                <TableHead className="font-medium">Date</TableHead>
                                <TableHead className="text-center font-medium">Photo</TableHead>
                                <TableHead className="text-center font-medium">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-2 w-16 mb-2" /><Skeleton className="h-3 w-8" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-16 mx-auto rounded-md" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-32 mx-auto rounded-md" /></TableCell>
                                    </TableRow>
                                ))
                            ) : subs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        No submissions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                subs.map((s) => {
                                    const sc = statusConfig[s.verificationStatus] || { variant: "secondary" };
                                    return (
                                        <TableRow 
                                            key={s.id} 
                                            className="border-border/50 transition-colors hover:bg-muted/30 group"
                                        >
                                            <TableCell className="font-mono text-sm text-muted-foreground font-medium">
                                                {s.bag.label}
                                                {s.verificationPolicy === "DEMO_AUTO" && (
                                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 text-purple-600 text-[10px]" title="Demo Bag">D</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {s.user.name || `+${s.user.phone}`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={sc.variant} 
                                                    className={sc.className}
                                                >
                                                    {s.verificationStatus === "PENDING_REVIEW" ? "REVIEW" : s.verificationStatus}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {s.aiConfidence !== null ? (
                                                    <div className="flex flex-col gap-1.5 w-full max-w-[80px]">
                                                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${s.aiConfidence > 0.7 ? "bg-green-500" : s.aiConfidence > 0.4 ? "bg-yellow-500" : "bg-red-500"}`} 
                                                                style={{ width: `${s.aiConfidence * 100}%` }} 
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-medium text-muted-foreground">
                                                            {(s.aiConfidence * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {s.latitude && s.longitude ? (
                                                    <Button 
                                                        variant="link" 
                                                        size="sm" 
                                                        className="h-auto p-0 text-blue-600 dark:text-blue-400 font-medium" 
                                                        onClick={() => window.open(`https://maps.google.com/?q=${s.latitude},${s.longitude}`, "_blank")}
                                                    >
                                                        <MapPin className="h-3.5 w-3.5 mr-1" /> Map
                                                    </Button>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(s.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {s.mediaUrl ? (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => openImage(s.id)}
                                                        className="h-8 text-xs font-medium border-purple-500/30 text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                                                    >
                                                        <ImageIcon className="h-3.5 w-3.5 mr-1" /> View
                                                    </Button>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {s.verificationStatus === "PENDING_REVIEW" ? (
                                                    <div className="flex gap-2 justify-center">
                                                        <LoadingButton 
                                                            variant="secondary" 
                                                            size="sm"
                                                            isLoading={actionLoading[s.id] === 'approve'}
                                                            disabled={actionLoading[s.id] !== undefined && actionLoading[s.id] !== null}
                                                            onClick={() => handleAction(s.id, 'approve')}
                                                            className="h-8 text-xs font-medium text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 bg-green-500/10 hover:bg-green-500/20"
                                                        >
                                                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                                        </LoadingButton>
                                                        <LoadingButton 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            isLoading={actionLoading[s.id] === 'reject'}
                                                            disabled={actionLoading[s.id] !== undefined && actionLoading[s.id] !== null}
                                                            onClick={() => handleAction(s.id, 'reject')}
                                                            className="h-8 text-xs font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 bg-red-500/10 hover:bg-red-500/20"
                                                        >
                                                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                                                        </LoadingButton>
                                                    </div>
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

            {/* Image Modal */}
            <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-4 border-border/50 shadow-lg">
                    <DialogHeader className="mb-2">
                        <DialogTitle>Submission Photo</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden rounded-md border flex items-center justify-center bg-black/5 relative min-h-[400px]">
                        {selectedImageId ? (
                            <img 
                                src={`${API}/api/submissions/${selectedImageId}/image`} 
                                alt="Submission verification photo" 
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <Skeleton className="w-full h-full" />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
