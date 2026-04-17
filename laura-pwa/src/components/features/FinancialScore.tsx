"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, TrendingUp, CreditCard, Clock } from "lucide-react";

type ScoreFactors = {
    billsOnTime: number;     // percentage of bills paid on time
    budgetRespect: number;   // percentage of budget limits respected
    savingsRate: number;     // percentage of income saved
    debtLevel: number;       // inverse of debt ratio
};

type ScoreConfig = {
    weights: { billsOnTime: number; budgetRespect: number; savingsRate: number; debtLevel: number };
    thresholds: { excellent: number; good: number; fair: number };
};

const DEFAULT_CONFIG: ScoreConfig = {
    weights: { billsOnTime: 0.35, budgetRespect: 0.25, savingsRate: 0.25, debtLevel: 0.15 },
    thresholds: { excellent: 80, good: 60, fair: 40 },
};

function calculateScore(factors: ScoreFactors, config: ScoreConfig = DEFAULT_CONFIG): number {
    const w = config.weights;
    return Math.round(
        factors.billsOnTime * w.billsOnTime +
        factors.budgetRespect * w.budgetRespect +
        factors.savingsRate * w.savingsRate +
        factors.debtLevel * w.debtLevel
    );
}

function getScoreConfig(score: number, thresholds = DEFAULT_CONFIG.thresholds) {
    if (score >= thresholds.excellent) return { label: "Excelente", color: "#10B981", gradient: "from-emerald-500 to-emerald-400", emoji: "🏆", desc: "Sua saúde financeira está incrível!" };
    if (score >= thresholds.good) return { label: "Bom", color: "#3B82F6", gradient: "from-blue-500 to-blue-400", emoji: "👍", desc: "Você está no caminho certo!" };
    if (score >= thresholds.fair) return { label: "Regular", color: "#F59E0B", gradient: "from-amber-500 to-amber-400", emoji: "⚡", desc: "Atenção com alguns indicadores." };
    return { label: "Crítico", color: "#EF4444", gradient: "from-red-500 to-red-400", emoji: "⚠️", desc: "Hora de reavaliar seus gastos." };
}

const DEFAULT_FACTORS: ScoreFactors = {
    billsOnTime: 85,
    budgetRespect: 72,
    savingsRate: 65,
    debtLevel: 55,
};

export function FinancialScore({ factors = DEFAULT_FACTORS }: { factors?: ScoreFactors }) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [mounted, setMounted] = useState(false);

    const score = calculateScore(factors);
    const config = getScoreConfig(score);

    useEffect(() => {
        setMounted(true);
        const timer = setTimeout(() => {
            let current = 0;
            const interval = setInterval(() => {
                current += 1;
                if (current >= score) {
                    clearInterval(interval);
                    setAnimatedScore(score);
                } else {
                    setAnimatedScore(current);
                }
            }, 15);
            return () => clearInterval(interval);
        }, 300);
        return () => clearTimeout(timer);
    }, [score]);

    // SVG circle calculations
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

    const factorItems = [
        { icon: Clock, label: "Faturas em dia", value: factors.billsOnTime, color: factors.billsOnTime >= 80 ? "text-emerald-500" : factors.billsOnTime >= 50 ? "text-amber-500" : "text-red-400" },
        { icon: Shield, label: "Tetos respeitados", value: factors.budgetRespect, color: factors.budgetRespect >= 80 ? "text-emerald-500" : factors.budgetRespect >= 50 ? "text-amber-500" : "text-red-400" },
        { icon: TrendingUp, label: "Taxa de economia", value: factors.savingsRate, color: factors.savingsRate >= 80 ? "text-emerald-500" : factors.savingsRate >= 50 ? "text-amber-500" : "text-red-400" },
        { icon: CreditCard, label: "Nível de dívida", value: factors.debtLevel, color: factors.debtLevel >= 80 ? "text-emerald-500" : factors.debtLevel >= 50 ? "text-amber-500" : "text-red-400" },
    ];

    return (
        <Card className="relative overflow-hidden border-border/50 bg-card">
            <CardContent className="p-5">
                <div className="flex items-center gap-5">
                    {/* Score Gauge */}
                    <div className="relative shrink-0" data-testid="score-gauge">
                        <svg width="140" height="140" viewBox="0 0 140 140" className={`transform -rotate-90 ${mounted ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}>
                            {/* Background circle */}
                            <circle
                                cx="70" cy="70" r={radius}
                                stroke="currentColor"
                                className="text-muted/30"
                                strokeWidth="8"
                                fill="none"
                            />
                            {/* Progress circle */}
                            <circle
                                cx="70" cy="70" r={radius}
                                stroke={config.color}
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000 ease-out"
                                style={{ filter: `drop-shadow(0 0 6px ${config.color}40)` }}
                            />
                        </svg>
                        {/* Center content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black font-mono" style={{ color: config.color }} data-testid="score-value">
                                {animatedScore}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                Score
                            </span>
                        </div>
                    </div>

                    {/* Score Details */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{config.emoji}</span>
                            <span className="text-base font-bold" style={{ color: config.color }}>
                                {config.label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{config.desc}</p>

                        {/* Factor bars */}
                        <div className="space-y-2">
                            {factorItems.map((f, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <f.icon className={`h-3 w-3 shrink-0 ${f.color}`} />
                                    <span className="text-[11px] text-muted-foreground flex-1 truncate">{f.label}</span>
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${mounted ? f.value : 0}%`,
                                                backgroundColor: f.value >= 80 ? "#10B981" : f.value >= 50 ? "#F59E0B" : "#EF4444",
                                            }}
                                        />
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold w-8 text-right ${f.color}`}>
                                        {f.value}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
            {/* Gradient accent */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent`} style={{ color: config.color }} />
        </Card>
    );
}
