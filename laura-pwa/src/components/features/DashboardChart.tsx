"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardChart() {
    const [data, setData] = useState<{ day: string, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // MOCK DATA for the Recharts implementation (UI only first)
        setTimeout(() => {
            setData([
                { day: "01/Mar", amount: 1500 },
                { day: "05/Mar", amount: 1200 },
                { day: "10/Mar", amount: 2500 },
                { day: "15/Mar", amount: 1800 },
                { day: "20/Mar", amount: 3000 },
                { day: "25/Mar", amount: 1100 },
                { day: "30/Mar", amount: 4500 },
            ]);
            setLoading(false);
        }, 800);
    }, []);

    if (loading) {
        return (
            <Card className="col-span-4 bg-card">
                <CardHeader>
                    <CardTitle>Histórico Recente</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-4 bg-card shadow-lg border-border">
            <CardHeader>
                <CardTitle>Evolução Financeira (Mês Atual)</CardTitle>
                <CardDescription>Fluxo histórico de consumos base</CardDescription>
            </CardHeader>
            <CardContent className="pl-2 pr-6">
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262633" />
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9B9BA8', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9B9BA8', fontSize: 12 }}
                                dx={-10}
                                tickFormatter={(tick) => `R$ ${tick}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0F0F17', borderColor: '#262633', borderRadius: '8px' }}
                                itemStyle={{ color: '#FAFAFA' }}
                                formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Gasto Total']}
                            />
                            <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="#7C3AED"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorAmount)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
