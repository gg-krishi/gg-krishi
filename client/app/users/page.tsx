"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users as UsersIcon, UserCheck, Activity } from "lucide-react";
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

interface User {
    id: string;
    phone: string;
    name: string | null;
    language: string;
    createdAt: string;
    _count?: { sessions: number; submissions: number };
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
                                users.map((u, i) => (
                                    <TableRow 
                                        key={u.id}
                                        className="border-border/30 transition-all duration-200 cursor-pointer h-16 group relative"
                                        onClick={() => { setSelectedUser(u); setDetailsModalOpen(true); }}
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
                                                onClick={() => { setSelectedUser(u); setDetailsModalOpen(true); }}
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

            {/* Comprehensive User Profile Dialog */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/50 shadow-2xl">
                    <DialogHeader className="px-6 py-5 border-b border-border/30 bg-muted/10">
                        <DialogTitle className="text-xl font-bold flex items-center justify-between pr-8">
                            <span>Farmer Profile</span>
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedUser && (
                        <div className="p-6 space-y-6 bg-background">
                            <div className="flex items-center gap-4 pb-6 border-b border-border/30">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                    <UsersIcon className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-bold text-2xl tracking-tight text-foreground">
                                        {selectedUser.name || "Anonymous Farmer"}
                                    </h3>
                                    <div className="font-mono text-muted-foreground font-medium">
                                        +{selectedUser.phone}
                                    </div>
                                </div>
                            </div>
                            
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
                </DialogContent>
            </Dialog>
        </div>
    );
}
