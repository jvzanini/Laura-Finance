"use client";

import { useEffect, useState } from "react";
import { fetchRecentTransactionsAction } from "@/lib/actions/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadCloud, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHero() {
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState({ current: 0, incomes: 0, expenses: 0 });

    useEffect(() => {
        const load = async () => {
            const res = await fetchRecentTransactionsAction();
            if (res.transactions) {
                // Mock calculation based on recent for MVP
                let inc = 0, exp = 0;
                res.transactions.forEach(t => {
                    if (t.type === "income") inc += t.amount;
                    if (t.type === "expense") exp += t.amount;
                });
                setBalance({ current: inc - exp, incomes: inc, expenses: exp });
            }
            setLoading(false);
        };
        load();
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    };

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="bg-card">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-[100px]" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-6 w-[80px]" />
                            <div className="mt-4"><Skeleton className="h-2 w-full" /></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Fluxo de Caixa (Mensal)</CardTitle>
                    <Wallet className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono">{formatCurrency(balance.current)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Saldo calculado do período ativo</p>
                </CardContent>
            </Card>

            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Entradas</CardTitle>
                    <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono text-emerald-400">+{formatCurrency(balance.incomes)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Ganhos identificados no período</p>
                </CardContent>
            </Card>

            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Despesas Recentes</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono text-white">-{formatCurrency(balance.expenses)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Consumo rotineiro trackeado</p>
                </CardContent>
            </Card>

            <Card className="bg-card border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary">Baixar Arquivo Padrão</CardTitle>
                    <DownloadCloud className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <button className="text-lg font-bold text-primary hover:underline mt-1">
                        Exportar DRE .CSV
                    </button>
                    <p className="text-xs text-muted-foreground mt-1">Padrão contábil (Prosumer)</p>
                </CardContent>
            </Card>
        </div>
    );
}
