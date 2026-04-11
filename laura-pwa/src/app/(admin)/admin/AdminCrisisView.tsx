"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    AlertTriangle,
    Building2,
    Users,
    CreditCard,
    TrendingUp,
    Wallet,
    Coins,
    Receipt,
    Zap,
} from "lucide-react";
import type {
    AdminOverview,
    TopWorkspaceByRollover,
    ProcessorUsage,
    RolloverTrendPoint,
} from "@/lib/actions/admin";

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtInt(n: number) {
    return new Intl.NumberFormat("pt-BR").format(n);
}

type Props = {
    overview: AdminOverview | null;
    topWorkspaces: TopWorkspaceByRollover[];
    processors: ProcessorUsage[];
    trend: RolloverTrendPoint[];
};

export function AdminCrisisView({ overview, topWorkspaces, processors, trend }: Props) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    Painel de Crises & Métricas do SaaS
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Agregados cross-workspace da feature Empurrar Fatura + pulso operacional do produto.
                </p>
            </div>

            {overview && (
                <>
                    {/* Plataforma */}
                    <div>
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Plataforma
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard icon={Building2} label="Workspaces" value={fmtInt(overview.totalWorkspaces)} color="text-primary" />
                            <MetricCard icon={Users} label="Usuários" value={fmtInt(overview.totalUsers)} color="text-emerald-500" />
                            <MetricCard icon={CreditCard} label="Cartões cadastrados" value={fmtInt(overview.totalCards)} color="text-sky-400" />
                            <MetricCard icon={Zap} label="Pendentes de verificação" value={fmtInt(overview.unverifiedUsers)} color="text-amber-500" />
                        </div>
                    </div>

                    {/* Crise / Rolagem */}
                    <div>
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Empurrar Fatura (Epic 5)
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard icon={Receipt} label="Rolagens all-time" value={fmtInt(overview.totalRollovers)} color="text-primary" />
                            <MetricCard icon={Receipt} label="Rolagens este mês" value={fmtInt(overview.rolloversThisMonth)} color="text-emerald-500" />
                            <MetricCard icon={Wallet} label="Volume rolado all-time" value={fmt(overview.volumeRolledCents)} color="text-sky-400" />
                            <MetricCard icon={Wallet} label="Volume rolado este mês" value={fmt(overview.volumeRolledThisMonthCents)} color="text-sky-400" />
                            <MetricCard icon={Coins} label="Total em taxas pagas" value={fmt(overview.totalFeesPaidCents)} color="text-red-400" />
                            <MetricCard icon={TrendingUp} label="Taxa média efetiva" value={`${overview.avgFeePercentage.toFixed(2)}%`} color="text-amber-500" />
                            <MetricCard icon={Receipt} label="Transações este mês" value={fmtInt(overview.transactionsThisMonth)} color="text-primary" />
                            <MetricCard icon={Wallet} label="Despesas rastreadas (mês)" value={fmt(overview.expensesThisMonthCents)} color="text-red-400" />
                        </div>
                    </div>
                </>
            )}

            {/* Tendência */}
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tendência de Rolagens (6 meses)</CardTitle>
                    <CardDescription className="text-xs">
                        Quantidade de rolagens e volume total empurrado por mês
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {trend.length === 0 ? (
                        <EmptyStrip label="Sem rolagens nos últimos 6 meses" />
                    ) : (
                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={trend.map((p) => ({
                                        month: p.month,
                                        Rolagens: p.rolloverCount,
                                        "Volume (R$)": p.volumeCents / 100,
                                    }))}
                                    margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#262633" vertical={false} />
                                    <XAxis dataKey="month" stroke="#9B9BA8" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#9B9BA8" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#9B9BA8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#0F0F17",
                                            borderColor: "#262633",
                                            borderRadius: "0.75rem",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar yAxisId="left" dataKey="Rolagens" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="Volume (R$)" fill="#10B981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Top workspaces */}
                <Card className="border-border/50 bg-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Top Workspaces por Volume Rolado</CardTitle>
                        <CardDescription className="text-xs">
                            Workspaces que mais usaram Empurrar Fatura all-time
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topWorkspaces.length === 0 ? (
                            <EmptyStrip label="Sem rolagens registradas" />
                        ) : (
                            <div className="space-y-2">
                                {topWorkspaces.map((w, idx) => (
                                    <div
                                        key={w.workspaceId}
                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-background/50"
                                    >
                                        <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{w.workspaceName}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {w.rolloverCount} rolagens • fees {fmt(w.feesCents)}
                                            </p>
                                        </div>
                                        <span className="text-xs font-mono font-bold shrink-0">
                                            {fmt(w.volumeCents)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Processadores */}
                <Card className="border-border/50 bg-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Uso por Adquirente</CardTitle>
                        <CardDescription className="text-xs">
                            Maquininhas mais escolhidas + taxa média efetiva
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {processors.length === 0 ? (
                            <EmptyStrip label="Sem uso de maquininhas ainda" />
                        ) : (
                            <div className="space-y-2">
                                {processors.map((p) => (
                                    <div
                                        key={p.institution}
                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-background/50"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                                            <CreditCard className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{p.institution}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {p.rolloverCount} uses • fee média {p.avgFeePercentage.toFixed(2)}%
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-mono font-bold">{fmt(p.volumeCents)}</p>
                                            <p className="text-[10px] font-mono text-red-400">{fmt(p.feesCents)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Card className="border-border/50 bg-card">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-bold font-mono">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyStrip({ label }: { label: string }) {
    return (
        <div className="h-[120px] flex items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}
