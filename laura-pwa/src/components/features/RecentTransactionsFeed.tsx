"use client";

import { useEffect, useState } from "react";
import {
    fetchRecentTransactionsAction,
    deleteTransactionAction,
    updateTransactionCategoryAction,
    Transaction,
} from "@/lib/actions/transactions";
import { fetchCategorySummariesAction } from "@/lib/actions/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ArrowDownRight,
    ArrowUpRight,
    Clock,
    AlertTriangle,
    Trash2,
    MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentTransactionsFeed() {
    const [transactions, setTransactions] = useState<Transaction[] | null>(null);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [res, catRes] = await Promise.all([
                fetchRecentTransactionsAction(),
                fetchCategorySummariesAction(),
            ]);
            if (res.transactions) setTransactions(res.transactions);
            if (catRes.categories) setCategories(catRes.categories);
            setLoading(false);
        };
        load();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta transação?")) return;
        setTransactions((prev) => (prev ? prev.filter((t) => t.id !== id) : null));
        const res = await deleteTransactionAction(id);
        if (res.error) {
            alert(res.error);
            const reloadRes = await fetchRecentTransactionsAction();
            if (reloadRes.transactions) setTransactions(reloadRes.transactions);
        }
    };

    const handleCategoryChange = async (txId: string, categoryId: string, categoryName: string) => {
        setTransactions((prev) =>
            prev
                ? prev.map((t) =>
                    t.id === txId
                        ? { ...t, categoryName, needsReview: false, confidenceScore: 1.0 }
                        : t
                )
                : null
        );
        const res = await updateTransactionCategoryAction(txId, categoryId);
        if (res.error) {
            alert(res.error);
            const reloadRes = await fetchRecentTransactionsAction();
            if (reloadRes.transactions) setTransactions(reloadRes.transactions);
        }
    };

    const fmt = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    if (loading) {
        return (
            <Card className="border-border/50 bg-card">
                <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-5 w-20" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <Card className="border-border/50 bg-card border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <MessageCircle className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">Nenhuma transação ainda</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Mande seu primeiro gasto para a Laura no WhatsApp e ele aparecerá aqui automaticamente.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Últimas Transações</CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">
                        {transactions.length} registros
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                    {transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/50 transition-colors group"
                        >
                            {/* Icon */}
                            <div
                                className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 ${tx.type === "expense"
                                        ? "bg-red-500/10 text-red-400"
                                        : "bg-emerald-500/10 text-emerald-400"
                                    }`}
                            >
                                {tx.type === "expense" ? (
                                    <ArrowDownRight className="h-4 w-4" />
                                ) : (
                                    <ArrowUpRight className="h-4 w-4" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate capitalize">{tx.description}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] text-muted-foreground">
                                        {new Date(tx.date).toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "short",
                                        })}
                                    </span>
                                    <span className="text-muted-foreground/40">·</span>
                                    {/* Category selector */}
                                    <div className="relative inline-block">
                                        <select
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            value=""
                                            onChange={(e) => {
                                                const sel = categories.find((c) => c.id === e.target.value);
                                                if (sel) handleCategoryChange(tx.id, sel.id, sel.name);
                                            }}
                                        >
                                            <option value="" disabled>Trocar</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-primary/20 transition-colors">
                                            {tx.categoryName}
                                            <span className="ml-0.5 opacity-60 text-[9px]">▼</span>
                                        </span>
                                    </div>
                                    {/* Review badge */}
                                    {(tx.needsReview || tx.confidenceScore < 0.8) && (
                                        <span className="flex items-center gap-0.5 text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            IA
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Amount */}
                            <span
                                className={`text-sm font-mono font-bold whitespace-nowrap ${tx.type === "expense" ? "text-foreground" : "text-emerald-400"
                                    }`}
                            >
                                {tx.type === "expense" ? "-" : "+"}
                                {fmt(tx.amount)}
                            </span>

                            {/* Delete */}
                            <button
                                onClick={() => handleDelete(tx.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                title="Excluir"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
