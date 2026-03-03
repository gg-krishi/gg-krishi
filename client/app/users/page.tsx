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
import { Skeleton } from "@/components/ui/skeleton";
import { Users as UsersIcon } from "lucide-react";

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

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-4"
            >
                <div className="p-3 bg-primary/10 rounded-full">
                    <UsersIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {users.length} registered farmers
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Card className="shadow-sm">
                    <CardContent className="p-0 sm:p-6 overflow-x-auto">
                        <Table className="min-w-[600px]">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px] font-medium">Phone</TableHead>
                                <TableHead className="font-medium">Name</TableHead>
                                <TableHead className="font-medium">Language</TableHead>
                                <TableHead className="text-center font-medium">Sessions</TableHead>
                                <TableHead className="text-center font-medium">Submissions</TableHead>
                                <TableHead className="text-right font-medium">Joined</TableHead>
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
                                    </TableRow>
                                ))
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No users yet. Users are auto-created when they message on WhatsApp.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((u, i) => (
                                    <TableRow 
                                        key={u.id}
                                        className="border-border/50 transition-colors hover:bg-muted/30 group"
                                    >
                                        <TableCell className="font-mono text-sm">+{u.phone}</TableCell>
                                        <TableCell className="font-medium">{u.name || "—"}</TableCell>
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
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
