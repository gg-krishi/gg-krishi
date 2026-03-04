"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, Plus, QrCode, RefreshCcw } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { PremiumStatCard, PremiumStatCardGrid } from "@/components/ui/premium-stat-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Bag {
    bagId: string;
    label: string;
    batchId: string | null;
    status: string;
    createdAt: string;
    assignedUser?: { phone: string; name: string | null } | null;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, className?: string }> = {
    unused: { variant: "secondary", label: "Unused" },
    in_session: { variant: "default", label: "In Session" },
    used: { variant: "outline", label: "Used", className: "text-green-600 border-green-600" },
    flagged: { variant: "destructive", label: "Flagged" },
};

export default function BagsPage() {
    const [bags, setBags] = useState<Bag[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingPilot, setCreatingPilot] = useState(false);
    const [creatingDemo, setCreatingDemo] = useState(false);
    
    // Details & QR Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedBag, setSelectedBag] = useState<Bag | null>(null);
    const [qrSvg, setQrSvg] = useState("");
    const [qrLoading, setQrLoading] = useState(false);

    const fetchBags = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/bags`);
            const data = await res.json();
            setBags(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch bags:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBags();
        const interval = setInterval(fetchBags, 5000);
        return () => clearInterval(interval);
    }, [fetchBags]);

    const createBag = async (mode: string = "PILOT") => {
        if (mode === "PILOT") setCreatingPilot(true);
        else setCreatingDemo(true);
        
        try {
            const res = await fetch(`${API}/api/bags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
            const bag = await res.json();
            await fetchBags();
            openDetails({ ...bag, createdAt: bag.createdAt || new Date().toISOString(), assignedUser: bag.assignedUser || null });
        } catch (err) {
            console.error("Failed to create bag:", err);
        } finally {
            if (mode === "PILOT") setCreatingPilot(false);
            else setCreatingDemo(false);
        }
    };

    const resetBag = async (bagId: string) => {
        try {
            await fetch(`${API}/api/bags/${bagId}/reset`, { method: "POST" });
            await fetchBags();
            setDetailsModalOpen(false);
        } catch (err) {
            console.error("Failed to reset bag:", err);
        }
    };

    const openDetails = async (bag: Bag) => {
        setSelectedBag(bag);
        setDetailsModalOpen(true);
        setQrSvg(""); 
        setQrLoading(true);

        try {
            const res = await fetch(`${API}/api/bags/${bag.bagId}/qr`);
            const svg = await res.text();
            setQrSvg(svg);
        } catch (err) {
            console.error("Failed to fetch QR:", err);
        } finally {
            setQrLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    const unusedCount = bags.filter((b) => b.status === "unused").length;
    const usedCount = bags.filter((b) => b.status === "used").length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Biochar Bags</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage inventory and assignments
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <LoadingButton 
                        onClick={() => createBag("PILOT")} 
                        isLoading={creatingPilot}
                        disabled={creatingDemo}
                        className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Pilot Bag
                    </LoadingButton>
                    <LoadingButton 
                        onClick={() => createBag("DEMO")} 
                        isLoading={creatingDemo}
                        disabled={creatingPilot}
                        variant="secondary"
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Demo Bag
                    </LoadingButton>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <PremiumStatCardGrid columns={3}>
                    <PremiumStatCard
                        title="Total Bags"
                        subtitle="All registered bags"
                        value={bags.length}
                        icon={Package}
                        iconColor="text-blue-500"
                        iconBgColor="bg-blue-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Unused Bags"
                        subtitle="Available for sessions"
                        value={unusedCount}
                        icon={Package}
                        iconColor="text-green-500"
                        iconBgColor="bg-green-500/10"
                        isLoading={loading}
                    />
                    <PremiumStatCard
                        title="Used/Flagged"
                        subtitle="Requires reset or review"
                        value={usedCount + bags.filter(b => b.status === "flagged").length}
                        icon={Package}
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
                                <TableHead className="font-medium h-12">Bag Label</TableHead>
                                <TableHead className="font-medium h-12">Batch</TableHead>
                                <TableHead className="font-medium h-12">Status</TableHead>
                                <TableHead className="font-medium h-12">Assigned To</TableHead>
                                <TableHead className="font-medium h-12">Created</TableHead>
                                <TableHead className="text-center font-medium h-12">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-16 mx-auto rounded-md" /></TableCell>
                                    </TableRow>
                                ))
                            ) : bags.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No bags yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                bags.map((bag) => {
                                    const sc = statusConfig[bag.status] || statusConfig.unused;
                                    return (
                                        <TableRow 
                                            key={bag.bagId} 
                                            className="border-border/30 transition-all duration-200 cursor-pointer h-16 group relative"
                                            onClick={() => openDetails(bag)}
                                        >
                                            <TableCell className="font-mono text-sm font-semibold text-foreground">{bag.label}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{bag.batchId || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={sc.variant} className={sc.className}>
                                                    {sc.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {bag.assignedUser ? (bag.assignedUser.name || `+${bag.assignedUser.phone}`) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(bag.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-2 justify-center">
                                                    {(bag.status === "used" || bag.status === "flagged") ? (
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={(e) => { e.stopPropagation(); resetBag(bag.bagId); }}
                                                            className="h-8 text-xs font-medium text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-sm"
                                                        >
                                                            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Reset Bag
                                                        </Button>
                                                    ) : (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => openDetails(bag)}
                                                            className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                        >
                                                            View QR & Details
                                                        </Button>
                                                    )}
                                                </div>
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

            {/* Comprehensive Bag Details Modal */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="sm:max-w-3xl p-0 overflow-hidden border-border/50 shadow-2xl xl:max-w-4xl">
                    <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10">
                        <DialogTitle className="text-xl font-bold flex items-center justify-between pr-8">
                            <span>Bag Details</span>
                            {selectedBag && (
                                <Badge variant={statusConfig[selectedBag.status]?.variant} className={`text-sm py-1 ${statusConfig[selectedBag.status]?.className}`}>
                                    {statusConfig[selectedBag.status]?.label}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedBag && (
                        <div className="flex flex-col md:flex-row flex-1 bg-background">
                            {/* QR Section */}
                            <div className="md:w-[45%] p-6 bg-muted/5 border-r border-border/30 flex flex-col items-center justify-center relative min-h-[300px]">
                                <h4 className="text-sm font-semibold text-muted-foreground mb-4">Scan with WhatsApp</h4>
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50 w-64 h-64 flex items-center justify-center">
                                    {qrLoading ? (
                                        <Skeleton className="w-full h-full rounded-xl" />
                                    ) : qrSvg ? (
                                        <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-full h-full" />
                                    ) : (
                                        <div className="text-muted-foreground flex flex-col items-center">
                                            <QrCode className="w-8 h-8 mb-2 opacity-50" />
                                            <span className="text-sm">QR Unavailable</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 text-xs font-mono text-muted-foreground bg-muted p-2 rounded border border-border/50">
                                    ID: {selectedBag.bagId.split('-')[0]}...
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="md:w-[55%] p-6 overflow-y-auto space-y-6">
                                <div className="space-y-1 pb-4 border-b border-border/30">
                                    <h3 className="font-bold text-3xl font-mono tracking-tight text-foreground">
                                        {selectedBag.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        Registered {formatDate(selectedBag.createdAt)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verification Mode</span>
                                        <div className="font-medium text-lg text-foreground flex items-center gap-2">
                                            {selectedBag.batchId?.includes("DEMO") ? "🎭 Demo Auto-Verify" : "🌾 Pilot MRV"}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Batch ID</span>
                                        <div className="font-mono text-sm text-foreground break-all mt-1">
                                            {selectedBag.batchId || "Not assigned"}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm col-span-2">
                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Assignment Information</span>
                                        <div className="font-medium text-lg text-foreground">
                                            {selectedBag.assignedUser ? (
                                                <div className="flex items-center gap-2">
                                                    <span>{selectedBag.assignedUser.name || `+${selectedBag.assignedUser.phone}`}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm font-normal">Unassigned bag</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {(selectedBag.status === "used" || selectedBag.status === "flagged") && (
                                    <div className="pt-6 mt-4 border-t border-border/30 flex">
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => resetBag(selectedBag.bagId)}
                                            className="w-full h-12 text-sm font-semibold text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-md"
                                        >
                                            <RefreshCcw className="w-5 h-5 mr-2" /> Reset Bag for Reuse
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
