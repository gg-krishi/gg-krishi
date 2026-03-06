"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, Plus, QrCode, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const PAGE_SIZE = 20;

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
    const [page, setPage] = useState(1);

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

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
        });

    const formatDateTime = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });

    const unusedCount = bags.filter((b) => b.status === "unused").length;
    const usedCount = bags.filter((b) => b.status === "used").length;

    // ── Pagination ──────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(bags.length / PAGE_SIZE));
    const pagedBags = bags.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Build page numbers to show (always show first, last, current ±1)
    const getPageNums = () => {
        const nums = new Set([1, totalPages, page, page - 1, page + 1].filter(n => n >= 1 && n <= totalPages));
        return Array.from(nums).sort((a, b) => a - b);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Sticky Header */}
            <div className="sticky top-16 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/90 backdrop-blur-md border-b border-border/30 mb-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Biochar Bags</h1>
                        <p className="text-muted-foreground text-xs hidden sm:block">Manage inventory and assignments</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <LoadingButton
                            onClick={() => createBag("PILOT")}
                            isLoading={creatingPilot}
                            disabled={creatingDemo}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-9 text-sm px-3"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Pilot Bag
                        </LoadingButton>
                        <LoadingButton
                            onClick={() => createBag("DEMO")}
                            isLoading={creatingDemo}
                            disabled={creatingPilot}
                            variant="secondary"
                            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm h-9 text-sm px-3"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Demo Bag
                        </LoadingButton>
                    </div>
                </div>
            </div>

            {/* Stat cards — horizontal scroll on mobile, 3-col grid on desktop */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {/* Mobile: horizontal scroll */}
                <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
                    {[
                        { title: "Total", subtitle: "All bags", value: bags.length, iconColor: "text-blue-500", iconBgColor: "bg-blue-500/10" },
                        { title: "Unused", subtitle: "Available", value: unusedCount, iconColor: "text-green-500", iconBgColor: "bg-green-500/10" },
                        { title: "Flagged", subtitle: "Needs review", value: usedCount + bags.filter(b => b.status === "flagged").length, iconColor: "text-orange-500", iconBgColor: "bg-orange-500/10" },
                    ].map((s) => (
                        <div key={s.title} className="flex-shrink-0 w-[72vw] snap-start">
                            <PremiumStatCard title={s.title} subtitle={s.subtitle} value={loading ? "—" : s.value} icon={Package} iconColor={s.iconColor} iconBgColor={s.iconBgColor} isLoading={loading} />
                        </div>
                    ))}
                </div>
                {/* Desktop: 3-col grid */}
                <div className="hidden md:block">
                    <PremiumStatCardGrid columns={3}>
                        <PremiumStatCard title="Total Bags" subtitle="All registered bags" value={bags.length} icon={Package} iconColor="text-blue-500" iconBgColor="bg-blue-500/10" isLoading={loading} />
                        <PremiumStatCard title="Unused Bags" subtitle="Available for sessions" value={unusedCount} icon={Package} iconColor="text-green-500" iconBgColor="bg-green-500/10" isLoading={loading} />
                        <PremiumStatCard title="Used/Flagged" subtitle="Requires reset or review" value={usedCount + bags.filter(b => b.status === "flagged").length} icon={Package} iconColor="text-orange-500" iconBgColor="bg-orange-500/10" isLoading={loading} />
                    </PremiumStatCardGrid>
                </div>
            </motion.div>

            {/* ── Mobile card grid (hidden on md+) ── */}
            <motion.div className="md:hidden space-y-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="border-border/40">
                            <CardContent className="p-4 space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                    <Skeleton className="h-8 w-24 rounded-md" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : pagedBags.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No bags yet.</p>
                ) : (
                    pagedBags.map((bag) => {
                        const sc = statusConfig[bag.status] || statusConfig.unused;
                        const isDemo = bag.batchId?.includes("DEMO");
                        return (
                            <Card
                                key={bag.bagId}
                                className="border-border/40 cursor-pointer active:scale-[0.99] transition-transform"
                                onClick={() => openDetails(bag)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-mono font-semibold text-sm text-foreground truncate">{bag.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(bag.createdAt)}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            <Badge variant={sc.variant} className={`text-xs ${sc.className || ""}`}>{sc.label}</Badge>
                                            {isDemo && <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded">DEMO</span>}
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {bag.assignedUser ? (bag.assignedUser.name || `+${bag.assignedUser.phone}`) : "Unassigned"}
                                        </p>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            {(bag.status === "used" || bag.status === "flagged") ? (
                                                <Button variant="secondary" size="sm" onClick={() => resetBag(bag.bagId)}
                                                    className="h-7 text-xs text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20">
                                                    <RefreshCcw className="h-3 w-3 mr-1" />Reset
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => openDetails(bag)}
                                                    className="h-7 text-xs">
                                                    <QrCode className="h-3 w-3 mr-1" />View QR
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </motion.div>

            {/* ── Desktop table (hidden on mobile) ── */}
            <motion.div className="hidden md:block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card className="shadow-sm border-border/40 overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="min-w-[700px]">
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
                                ) : pagedBags.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No bags yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    pagedBags.map((bag) => {
                                        const sc = statusConfig[bag.status] || statusConfig.unused;
                                        return (
                                            <TableRow key={bag.bagId} className="border-border/30 transition-all duration-200 cursor-pointer h-16" onClick={() => openDetails(bag)}>
                                                <TableCell className="font-mono text-sm font-semibold text-foreground">{bag.label}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{bag.batchId || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {bag.assignedUser ? (bag.assignedUser.name || `+${bag.assignedUser.phone}`) : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{formatDateTime(bag.createdAt)}</TableCell>
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex gap-2 justify-center">
                                                        {(bag.status === "used" || bag.status === "flagged") ? (
                                                            <Button variant="secondary" size="sm"
                                                                onClick={(e) => { e.stopPropagation(); resetBag(bag.bagId); }}
                                                                className="h-8 text-xs text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-sm">
                                                                <RefreshCcw className="h-3.5 w-3.5 mr-1" />Reset Bag
                                                            </Button>
                                                        ) : (
                                                            <Button variant="ghost" size="sm" onClick={() => openDetails(bag)}
                                                                className="h-8 text-xs text-muted-foreground hover:text-foreground">
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

            {/* ── Pagination ─────────────────────────────────────── */}
            {!loading && bags.length > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                    <Button
                        variant="outline" size="icon"
                        className="h-8 w-8"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNums().map((num, idx, arr) => (
                        <>
                            {idx > 0 && arr[idx - 1] !== num - 1 && (
                                <span key={`dots-${num}`} className="text-muted-foreground text-sm px-1">…</span>
                            )}
                            <Button
                                key={num}
                                variant={page === num ? "default" : "outline"}
                                size="icon"
                                className="h-8 w-8 text-sm font-medium"
                                onClick={() => setPage(num)}
                            >
                                {num}
                            </Button>
                        </>
                    ))}

                    <Button
                        variant="outline" size="icon"
                        className="h-8 w-8"
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Page info */}
            {!loading && bags.length > PAGE_SIZE && (
                <p className="text-center text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, bags.length)} of {bags.length} bags
                </p>
            )}

            {/* ── Bag Details Modal (unchanged from before) ── */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl p-0 overflow-hidden border-border/50 shadow-2xl xl:max-w-4xl max-h-[90dvh] flex flex-col">
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
                        <div className="flex flex-col md:flex-row bg-background flex-1 overflow-y-auto">
                            {/* QR Section */}
                            <div className="md:w-[45%] p-4 md:p-6 bg-muted/5 border-b md:border-b-0 md:border-r border-border/30 flex flex-col items-center justify-center">
                                <h4 className="text-sm font-semibold text-muted-foreground mb-4">Scan with WhatsApp</h4>
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50 w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
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
                            <div className="md:w-[55%] p-6 space-y-6">
                                <div className="space-y-1 pb-4 border-b border-border/30">
                                    <h3 className="font-bold text-2xl sm:text-3xl font-mono tracking-tight text-foreground break-all">
                                        {selectedBag.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        Registered {formatDateTime(selectedBag.createdAt)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 p-4 rounded-xl bg-muted/20 border border-border/40 shadow-sm">
                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verification Mode</span>
                                        <div className="font-medium text-base text-foreground">
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
                                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Assignment</span>
                                        <div className="font-medium text-base text-foreground">
                                            {selectedBag.assignedUser ? (
                                                <span>{selectedBag.assignedUser.name || `+${selectedBag.assignedUser.phone}`}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm font-normal">Unassigned bag</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {(selectedBag.status === "used" || selectedBag.status === "flagged") && (
                                    <div className="pt-4 border-t border-border/30">
                                        <Button
                                            variant="secondary"
                                            onClick={() => resetBag(selectedBag.bagId)}
                                            className="w-full h-12 text-sm font-semibold text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-md"
                                        >
                                            <RefreshCcw className="w-5 h-5 mr-2" />Reset Bag for Reuse
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
