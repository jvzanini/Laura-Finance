"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";

const MOCK_DATA = [
    { day: "01/Mar", gastos: 450, entradas: 1500 },
    { day: "05/Mar", gastos: 820, entradas: 0 },
    { day: "10/Mar", gastos: 1250, entradas: 2500 },
    { day: "15/Mar", gastos: 380, entradas: 0 },
    { day: "20/Mar", gastos: 2100, entradas: 3000 },
    { day: "25/Mar", gastos: 670, entradas: 0 },
    { day: "30/Mar", gastos: 1550, entradas: 4500 },
];

export function DashboardChart() {
    const [data, setData] = useState<typeof MOCK_DATA>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setData(MOCK_DATA);
            setLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <Card className="border-border/50 bg-card">
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3 w-64 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[280px] w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Evolução Financeira</CardTitle>
                <CardDescription className="text-xs">
                    Fluxo mensal de gastos vs. entradas
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
                                formatter={(value: any) => [
                                    `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
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
