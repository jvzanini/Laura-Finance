"use client";

import { useEffect, useState } from "react";
import { fetchRecentTransactionsAction } from "@/lib/actions/transactions";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type MetricData = {
    balance: number;
    incomes: number;
    expenses: number;
    txCount: number;
};

function MetricCard({
    label,
    value,
    icon: Icon,
    trend,
    color,
    glowClass,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    trend?: string;
    color: string;
    glowClass?: string;
}) {
    return (
        <Card className={`relative overflow-hidden border-border/50 bg-card hover:border-border transition-all duration-300 ${glowClass || ""}`}>
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {label}
                    </span>
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${color}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
                    {trend && (
                        <p className="text-xs text-muted-foreground">{trend}</p>
                    )}
                </div>
            </CardContent>
            {/* Subtle gradient accent at bottom */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${color.includes("primary") ? "bg-gradient-to-r from-transparent via-primary to-transparent" : color.includes("emerald") ? "bg-gradient-to-r from-transparent via-emerald-500 to-transparent" : color.includes("red") ? "bg-gradient-to-r from-transparent via-red-500 to-transparent" : "bg-gradient-to-r from-transparent via-amber-500 to-transparent"}`} />
        </Card>
    );
}

export function DashboardHero() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MetricData>({ balance: 0, incomes: 0, expenses: 0, txCount: 0 });

    useEffect(() => {
        const load = async () => {
            const res = await fetchRecentTransactionsAction();
            if (res.transactions) {
                let inc = 0, exp = 0;
                res.transactions.forEach((t) => {
                    if (t.type === "income") inc += t.amount;
                    if (t.type === "expense") exp += t.amount;
                });
                setData({
                    balance: inc - exp,
                    incomes: inc,
                    expenses: exp,
                    txCount: res.transactions.length,
                });
            }
            setLoading(false);
        };
        load();
    }, []);

    const fmt = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-border/50 bg-card">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                            <Skeleton className="h-7 w-28" />
                            <Skeleton className="h-3 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
                label="Saldo do Mês"
                value={fmt(data.balance)}
                icon={Wallet}
                trend="Calculado com base no período ativo"
                color="bg-primary/15 text-primary"
                glowClass={data.balance > 0 ? "glow-success" : ""}
            />
            <MetricCard
                label="Entradas"
                value={`+${fmt(data.incomes)}`}
                icon={TrendingUp}
                trend="Ganhos identificados via IA"
                color="bg-emerald-500/15 text-emerald-500"
                glowClass="glow-success"
            />
            <MetricCard
                label="Saídas"
                value={`-${fmt(data.expenses)}`}
                icon={TrendingDown}
                trend="Consumo rastreado automaticamente"
                color="bg-red-500/15 text-red-400"
            />
            <MetricCard
                label="Transações"
                value={String(data.txCount)}
                icon={Target}
                trend="Registros do período recente"
                color="bg-amber-500/15 text-amber-500"
            />
        </div>
    );
}
