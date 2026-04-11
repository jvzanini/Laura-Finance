"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ScoreSnapshot } from "@/lib/actions/scoreHistory";

type Props = {
    history: ScoreSnapshot[];
};

export function ScoreEvolutionChart({ history }: Props) {
    if (history.length === 0) {
        return (
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Evolução do Score Financeiro
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Acompanhe a evolução da sua saúde financeira dia a dia.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
                        <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                            Sem histórico ainda
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            O cron diário vai gravar um snapshot às 3h. Depois de alguns dias, o gráfico ganha forma.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : latest;
    const delta = latest.score - previous.score;

    const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    const trendColor = delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-400" : "text-muted-foreground";

    // Recharts data: use short date labels
    const chartData = history.map((h) => ({
        date: new Date(h.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        score: h.score,
    }));

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Evolução do Score Financeiro
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Últimos {history.length} snapshot{history.length !== 1 ? "s" : ""} diário{history.length !== 1 ? "s" : ""}.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hoje</p>
                            <p className="text-xl font-bold font-mono">{latest.score}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                            <TrendIcon className="h-3 w-3" />
                            {delta > 0 ? "+" : ""}
                            {delta}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.5} />
                                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#71717A"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#71717A"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                ticks={[0, 40, 60, 80, 100]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#18181B",
                                    border: "1px solid #27272A",
                                    borderRadius: "0.5rem",
                                    fontSize: "12px",
                                }}
                                labelStyle={{ color: "#FAFAFA" }}
                            />
                            {/* Faixas de referência: limiares Excelente/Bom/Regular */}
                            <ReferenceLine y={80} stroke="#10B981" strokeDasharray="2 4" strokeOpacity={0.4} />
                            <ReferenceLine y={60} stroke="#3B82F6" strokeDasharray="2 4" strokeOpacity={0.4} />
                            <ReferenceLine y={40} stroke="#F59E0B" strokeDasharray="2 4" strokeOpacity={0.4} />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#7C3AED"
                                strokeWidth={2}
                                fill="url(#scoreGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
