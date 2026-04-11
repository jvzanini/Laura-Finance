"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { CashFlowPoint } from "@/lib/actions/dashboardMetrics";

export function DashboardChart({ data }: { data: CashFlowPoint[] }) {
    if (data.length === 0) {
        return (
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Evolução Financeira</CardTitle>
                    <CardDescription className="text-xs">
                        Fluxo mensal de gastos vs. entradas
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="h-[280px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
                        <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                            Sem transações neste mês ainda
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            Assim que a Laura processar a primeira mensagem no WhatsApp, o gráfico começa a tomar forma.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Evolução Financeira</CardTitle>
                <CardDescription className="text-xs">
                    Fluxo diário de gastos vs. entradas neste mês
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#262633"
                                strokeOpacity={0.5}
                            />
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#9B9BA8", fontSize: 11 }}
                                dy={8}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#9B9BA8", fontSize: 11 }}
                                dx={-5}
                                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#0F0F17",
                                    borderColor: "#262633",
                                    borderRadius: "12px",
                                    padding: "12px 16px",
                                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                }}
                                itemStyle={{ color: "#FAFAFA", fontSize: "12px" }}
                                labelStyle={{ color: "#9B9BA8", fontSize: "11px", marginBottom: "4px" }}
                                formatter={(value) => [
                                    `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="gastos"
                                stroke="#7C3AED"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#gradGastos)"
                                name="Gastos"
                            />
                            <Area
                                type="monotone"
                                dataKey="entradas"
                                stroke="#10B981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#gradEntradas)"
                                name="Entradas"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
