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
    
    // QR Modal State
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState<{ bagId: string; label: string; status: string; mode: string } | null>(null);
    const [qrSvg, setQrSvg] = useState("");

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
            showQr(bag.bagId, bag.label, bag.status, bag.batchId);
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
        } catch (err) {
            console.error("Failed to reset bag:", err);
        }
    };

    const showQr = async (bagId: string, label: string, status: string, batchId: string | null) => {
        const mode = batchId?.includes("DEMO") ? "DEMO" : "PILOT";
        setQrData({ bagId, label, status, mode });
        setQrModalOpen(true);
        setQrSvg(""); // reset while loading

        try {
            const res = await fetch(`${API}/api/bags/${bagId}/qr`);
            const svg = await res.text();
            setQrSvg(svg);
        } catch (err) {
            console.error("Failed to fetch QR:", err);
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
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Biochar Bags</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {bags.length} total &middot; <span className="text-green-500 font-medium">{unusedCount} unused</span> &middot; {usedCount} used
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <LoadingButton 
                        onClick={() => createBag("PILOT")} 
                        isLoading={creatingPilot}
                        disabled={creatingDemo}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Pilot Bag
                    </LoadingButton>
                    <LoadingButton 
                        onClick={() => createBag("DEMO")} 
                        isLoading={creatingDemo}
                        disabled={creatingPilot}
                        variant="secondary"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Demo Bag
                    </LoadingButton>
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
                                <TableHead className="font-medium">Bag Label</TableHead>
                                <TableHead className="font-medium">Batch</TableHead>
                                <TableHead className="font-medium">Status</TableHead>
                                <TableHead className="font-medium">Assigned To</TableHead>
                                <TableHead className="font-medium">Created</TableHead>
                                <TableHead className="text-center font-medium">Actions</TableHead>
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
                                            className="border-border/50 transition-colors hover:bg-muted/30 group"
                                        >
                                            <TableCell className="font-mono text-sm font-medium">{bag.label}</TableCell>
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
                                            <TableCell className="text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => showQr(bag.bagId, bag.label, bag.status, bag.batchId)}
                                                        className="h-8 text-xs font-medium"
                                                    >
                                                        <QrCode className="h-3.5 w-3.5 mr-1" /> QR
                                                    </Button>
                                                    {(bag.status === "used" || bag.status === "flagged") && (
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={() => resetBag(bag.bagId)}
                                                            className="h-8 text-xs font-medium text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                                                        >
                                                            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Reset
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

            <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
                <DialogContent className="sm:max-w-md text-center">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-center">
                            {qrData?.label}
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Scan with phone to open WhatsApp
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex justify-center items-center py-6">
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            {qrSvg ? (
                                <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-48 h-48" />
                            ) : (
                                <div className="w-48 h-48 flex items-center justify-center">
                                    <Skeleton className="w-full h-full rounded-lg" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted p-3 border rounded-lg text-center">
                        Mode: <span className="font-semibold text-foreground">
                            {qrData?.mode === "DEMO" ? "Investor Demo (auto-verify)" : "Pilot MRV (AI verification)"}
                        </span>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
