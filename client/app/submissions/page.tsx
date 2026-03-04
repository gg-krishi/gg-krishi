"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, Download, Check, X, Image as ImageIcon, MapPin, CheckCircle, AlertTriangle, XCircle, User } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
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
    aiResponse: string | null;
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
    const searchParams = useSearchParams();
    const router = useRouter();
    const userIdFilter = searchParams.get("userId");

    const [subs, setSubs] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filter, setFilter] = useState<string>("");
    const [filterUserPhone, setFilterUserPhone] = useState<string | null>(null);

    // Details Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
    const [imageLoading, setImageLoading] = useState(true);

    // Action loading states
    const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'reject' | null>>({});

    const clearUserFilter = () => {
        router.push("/submissions");
    };

    const fetchSubs = useCallback(async (showLoading = false) => {
        if (showLoading) setIsFiltering(true);
        try {
            const params = new URLSearchParams();
            if (filter) params.append("status", filter);
            if (userIdFilter) params.append("userId", userIdFilter);
            const url = `${API}/api/submissions${params.toString() ? `?${params}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            setSubs(Array.isArray(data) ? data : []);
            // Set the user phone for display if filtering by user
            if (userIdFilter && Array.isArray(data) && data.length > 0) {
                setFilterUserPhone(data[0].user?.phone || null);
            } else if (!userIdFilter) {
                setFilterUserPhone(null);
            }
        } catch (err) {
            console.error("Failed to fetch submissions:", err);
        } finally {
            setLoading(false);
            setIsFiltering(false);
        }
    }, [filter, userIdFilter]);

    useEffect(() => { 
        fetchSubs(true); 
    }, [filter, fetchSubs]);

    useEffect(() => {
        const i = setInterval(() => fetchSubs(false), 5000); 
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

    const openDetails = (sub: Submission) => {
        setSelectedSub(sub);
        setImageLoading(true); // reset image loading on new open
        setDetailsModalOpen(true);
    };

    const verifiedCount = subs.filter((s) => s.verificationStatus === "VERIFIED").length;
    const pendingReviewCount = subs.filter((s) => s.verificationStatus === "PENDING_REVIEW").length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Review AI verifications and flag cases
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
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
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                        {[{ id: "", label: "All" }, { id: "VERIFIED", label: "Verified" }, { id: "PENDING_REVIEW", label: "Review" }, { id: "REJECTED", label: "Rejected" }].map((f) => (
                            <Button
                                key={f.id}
                                variant={filter === f.id ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setFilter(f.id)}
                                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                                    filter === f.id
                                        ? f.id === "VERIFIED" ? "bg-green-600 hover:bg-green-700 shadow-sm" : f.id === "REJECTED" ? "bg-red-600 hover:bg-red-700 shadow-sm" : f.id === "PENDING_REVIEW" ? "bg-orange-500 hover:bg-orange-600 shadow-sm" : "shadow-sm"
                                        : ""
                                }`}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>

                    <Button onClick={exportCSV} variant="outline" className="h-10 border-blue-500/30 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 transition-colors shadow-sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard
                        title="Total Submissions"
                        subtitle="All-time verifications"
                        value={subs.length}
                        icon={FileText}
                        iconColor="text-blue-500"
                        iconBgColor="bg-blue-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Verified"
                        subtitle="Approved successfully"
                        value={verifiedCount}
                        icon={CheckCircle}
                        iconColor="text-green-500"
                        iconBgColor="bg-green-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Pending Review"
                        subtitle="Requires manual action"
                        value={pendingReviewCount}
                        icon={AlertTriangle}
                        iconColor="text-orange-500"
                        iconBgColor="bg-orange-500/10"
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
                                <TableHead className="font-medium h-12">Bag</TableHead>
                                <TableHead className="font-medium h-12">User</TableHead>
                                <TableHead className="font-medium h-12">Status</TableHead>
                                <TableHead className="font-medium h-12">AI Conf.</TableHead>
                                <TableHead className="font-medium h-12">GPS</TableHead>
                                <TableHead className="font-medium h-12">Date</TableHead>
                                <TableHead className="text-center font-medium h-12">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading || isFiltering ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-2 w-16 mb-2" /><Skeleton className="h-3 w-8" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
                                            className="border-border/30 transition-all duration-200 cursor-pointer h-16 group relative"
                                            onClick={() => openDetails(s)}
                                        >
                                            <TableCell className="font-mono text-sm text-foreground font-medium">
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
                                            <TableCell onClick={(e) => e.stopPropagation()}>
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
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                {s.verificationStatus === "PENDING_REVIEW" ? (
                                                    <div className="flex gap-2 justify-center">
                                                        <LoadingButton 
                                                            variant="secondary" 
                                                            size="sm"
                                                            isLoading={actionLoading[s.id] === 'approve'}
                                                            disabled={actionLoading[s.id] !== undefined && actionLoading[s.id] !== null}
                                                            onClick={(e) => { e.stopPropagation(); handleAction(s.id, 'approve'); }}
                                                            className="h-8 text-xs font-medium text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 bg-green-500/10 hover:bg-green-500/20 shadow-sm"
                                                        >
                                                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                                        </LoadingButton>
                                                        <LoadingButton 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            isLoading={actionLoading[s.id] === 'reject'}
                                                            disabled={actionLoading[s.id] !== undefined && actionLoading[s.id] !== null}
                                                            onClick={(e) => { e.stopPropagation(); handleAction(s.id, 'reject'); }}
                                                            className="h-8 text-xs font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 shadow-sm"
                                                        >
                                                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                                                        </LoadingButton>
                                                    </div>
                                                ) : (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => openDetails(s)}
                                                        className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                    >
                                                        View Details
                                                    </Button>
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

            {/* Comprehensive Submission Details Modal */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl xl:max-w-5xl">
                    <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10">
                        <DialogTitle className="text-xl font-bold flex items-center justify-between pr-8">
                            <span>Submission Details</span>
                            <div className="flex items-center gap-2">
                                {selectedSub?.verificationPolicy === "DEMO_AUTO" && (
                                    <Badge variant="outline" className="border-purple-500/50 text-purple-600 bg-purple-500/10 px-2 py-1">
                                        DEMO
                                    </Badge>
                                )}
                                {selectedSub && (
                                    <Badge variant={statusConfig[selectedSub.verificationStatus]?.variant} className={`text-sm py-1 ${statusConfig[selectedSub.verificationStatus]?.className}`}>
                                        {selectedSub.verificationStatus}
                                    </Badge>
                                )}
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex flex-col md:flex-row flex-1 overflow-auto bg-background">
                        {/* Image Section */}
                        <div className="md:w-1/2 p-6 bg-muted/5 border-r border-border/30 flex flex-col items-center justify-center relative min-h-[350px]">
                            {selectedSub?.mediaUrl ? (
                                <>
                                    {imageLoading && (
                                        <div className="absolute inset-x-6 inset-y-6 flex items-center justify-center z-10">
                                            <Skeleton className="w-full h-full rounded-2xl" />
                                        </div>
                                    )}
                                    <div className="relative w-full h-full flex justify-center items-center">
                                        <img 
                                            src={`${API}/api/submissions/${selectedSub.id}/image`} 
                                            alt="Verification" 
                                            className={`w-full h-full max-h-[60vh] object-contain rounded-xl transition-opacity duration-500 shadow-md ${imageLoading ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
                                            onLoad={() => setImageLoading(false)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="text-muted-foreground flex flex-col items-center justify-center h-full opacity-50">
                                    <ImageIcon className="w-16 h-16 mb-4" />
                                    <p className="font-medium">No Image Attached</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Details Data Section */}
                        <div className="md:w-1/2 p-6 overflow-y-auto space-y-6">
                            {selectedSub && (
                                <>
                                    <div className="space-y-2 pb-4 border-b border-border/30">
                                        <h3 className="font-bold text-2xl tracking-tight text-foreground">
                                            {selectedSub.user.name || `+${selectedSub.user.phone}`}
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                                                {selectedSub.bag.label}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {formatDate(selectedSub.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        {selectedSub.verificationPolicy !== "DEMO_AUTO" && (
                                            <>
                                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">AI Confidence</span>
                                                    <div className="font-bold text-2xl text-foreground">
                                                        {selectedSub.aiConfidence !== null ? `${(selectedSub.aiConfidence * 100).toFixed(0)}%` : "—"}
                                                    </div>
                                                    {selectedSub.aiConfidence !== null && (
                                                         <div className="w-full h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                                                             <div 
                                                                 className={`h-full rounded-full ${selectedSub.aiConfidence > 0.7 ? "bg-green-500" : selectedSub.aiConfidence > 0.4 ? "bg-yellow-500" : "bg-red-500"}`} 
                                                                 style={{ width: `${selectedSub.aiConfidence * 100}%` }} 
                                                             />
                                                         </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Fraud Score</span>
                                                    <div className="font-bold text-2xl text-foreground">
                                                        {selectedSub.fraudScore !== null ? `${(selectedSub.fraudScore * 100).toFixed(0)}%` : "—"}
                                                    </div>
                                                    {selectedSub.fraudScore !== null && (
                                                         <div className="w-full h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                                                             <div 
                                                                 className={`h-full rounded-full ${selectedSub.fraudScore < 0.3 ? "bg-green-500" : selectedSub.fraudScore < 0.7 ? "bg-yellow-500" : "bg-red-500"}`} 
                                                                 style={{ width: `${selectedSub.fraudScore * 100}%` }} 
                                                             />
                                                         </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        
                                        <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm col-span-2 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">GPS Coordinate Match</span>
                                                <div className="font-medium text-sm text-foreground">
                                                    {selectedSub.latitude && selectedSub.longitude ? `${selectedSub.latitude.toFixed(6)}, ${selectedSub.longitude.toFixed(6)}` : "Unknown Location"}
                                                </div>
                                            </div>
                                            {selectedSub.latitude && selectedSub.longitude && (
                                                <Button variant="outline" size="sm" className="h-9 shadow-sm" onClick={() => window.open(`https://maps.google.com/?q=${selectedSub.latitude},${selectedSub.longitude}`, "_blank")}>
                                                    <MapPin className="w-4 h-4 mr-2 text-blue-500" /> View Map
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Detailed AI Analysis Section */}
                                    {selectedSub.verificationPolicy !== "DEMO_AUTO" && (() => {
                                        let aiConfig = null;
                                        if (selectedSub.aiResponse) {
                                            try { aiConfig = JSON.parse(selectedSub.aiResponse); } catch(e){}
                                        }
                                        
                                        if (!aiConfig) return null;

                                        const checks = [
                                            { key: "biochar_visible", label: "Biochar Visible" },
                                            { key: "gg_bag_visible", label: "GG Bag Visible" },
                                            { key: "soil_visible", label: "Soil Visible" },
                                            { key: "outdoor_environment", label: "Outdoor Environment" },
                                            { key: "human_present", label: "Human Present" },
                                            { key: "screen_capture_detected", label: "Screen Capture Detected", inverse: true }
                                        ];

                                        return (
                                            <div className="space-y-4 pt-4 mt-2 border-t border-border/30">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                    <FileText className="w-4 h-4" /> AI Image Analysis Details
                                                </h4>
                                                
                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                                    {checks.map(c => {
                                                        const pass = c.inverse ? !aiConfig[c.key] : aiConfig[c.key];
                                                        return (
                                                            <div key={c.key} className="flex items-center gap-2.5 text-sm p-2.5 rounded-lg bg-muted/10 border border-border/20 shadow-sm">
                                                                {pass ? <CheckCircle className="w-4 h-4 text-green-500 shadow-sm" /> : <XCircle className="w-4 h-4 text-red-500 shadow-sm" />}
                                                                <span className={pass ? "text-foreground font-medium" : "text-muted-foreground"}>{c.label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {(aiConfig.flags && aiConfig.flags.length > 0) ? (
                                                    <div className="mt-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                                                        <span className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                                            <AlertTriangle className="w-4 h-4" /> Flags Detected
                                                        </span>
                                                        <ul className="text-sm text-red-600/90 dark:text-red-400/90 list-disc list-inside space-y-1 ml-1">
                                                            {aiConfig.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                                        </ul>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })()}

                                    {selectedSub.verificationStatus === "PENDING_REVIEW" && (
                                        <div className="pt-6 mt-4 border-t border-border/30 flex gap-4">
                                            <LoadingButton 
                                                className="flex-1 bg-green-600 hover:bg-green-700 shadow-md h-12 text-sm font-semibold" 
                                                isLoading={actionLoading[selectedSub.id] === 'approve'}
                                                disabled={actionLoading[selectedSub.id] !== undefined && actionLoading[selectedSub.id] !== null}
                                                onClick={() => { handleAction(selectedSub.id, 'approve'); setDetailsModalOpen(false); }}
                                            >
                                                <Check className="w-5 h-5 mr-2" /> Approve Instantly
                                            </LoadingButton>
                                            <LoadingButton 
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-md h-12 text-sm font-semibold" 
                                                variant="destructive"
                                                isLoading={actionLoading[selectedSub.id] === 'reject'}
                                                disabled={actionLoading[selectedSub.id] !== undefined && actionLoading[selectedSub.id] !== null}
                                                onClick={() => { handleAction(selectedSub.id, 'reject'); setDetailsModalOpen(false); }}
                                            >
                                                <X className="w-5 h-5 mr-2" /> Reject Submission
                                            </LoadingButton>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
