"use client";

import { useEffect, useState } from "react";
import { fetchRecentTransactionsAction, Transaction } from "@/lib/actions/transactions";
import { ArrowDownRight, ArrowUpRight, Clock, AlertTriangle } from "lucide-react";

export function RecentTransactionsFeed() {
    const [transactions, setTransactions] = useState<Transaction[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const res = await fetchRecentTransactionsAction();
            if (res.transactions) {
                setTransactions(res.transactions);
            }
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="w-full h-48 bg-muted/20 animate-pulse rounded-box mt-6" />
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <div className="w-full mt-6 bg-card border border-border p-8 rounded-xl text-center flex flex-col items-center">
                <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Nenhum Lançamento Encontrado</h3>
                <p className="text-sm text-muted-foreground max-w-sm">Mande a sua primeira mensagem de gasto via WhatsApp para exibir aqui sua primeira transação automática AI.</p>
            </div>
        );
    }

    return (
        <div className="w-full mt-6 bg-card border border-border rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-border bg-muted/10 font-bold flex justify-between items-center">
                Lançamentos Recentes
                <span className="text-xs font-normal text-muted-foreground">Últimas {transactions.length}</span>
            </div>

            <div className="divide-y divide-border">
                {transactions.map(tx => (
                    <div key={tx.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-muted/10 transition-colors gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className={`p-3 rounded-full flex-shrink-0 ${tx.type === "expense" ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"
                                }`}>
                                {tx.type === "expense" ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                            </div>

                            <div>
                                <h4 className="font-semibold text-white capitalize">{tx.description}</h4>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mt-1">
                                    <span>{new Date(tx.date).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })} às {new Date(tx.date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>•</span>
                                    <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">{tx.categoryName}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                            {(tx.needsReview || tx.confidenceScore < 0.8) && (
                                <div className="text-amber-500 flex items-center gap-1 text-xs font-bold animate-pulse bg-amber-500/10 px-2 py-1 rounded-md" title="Média Confiança IA">
                                    <AlertTriangle size={14} /> AI Review
                                </div>
                            )}

                            <span className={`font-mono font-bold whitespace-nowrap text-lg ${tx.type === "expense" ? "text-white" : "text-emerald-400"
                                }`}>
                                {tx.type === "expense" ? "-" : "+"}
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tx.amount)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
