"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, CheckCircle2, Calendar, CreditCard, Building2 } from "lucide-react";

type PushHistory = {
    id: string;
    date: string;
    card: string;
    cardColor: string;
    institution: string;
    invoiceValue: number;
    totalFees: number;
    totalOperations: number;
    installments: string;
    status: "concluido" | "parcial";
};

const MOCK_HISTORY: PushHistory[] = [
    {
        id: "1", date: "2026-02-15", card: "Nubank JV", cardColor: "#8B5CF6",
        institution: "InfinitePay", invoiceValue: 800000,
        totalFees: 35200, totalOperations: 4, installments: "1x",
        status: "concluido",
    },
    {
        id: "2", date: "2026-01-20", card: "Inter PJ", cardColor: "#F97316",
        institution: "Ton", invoiceValue: 500000,
        totalFees: 22400, totalOperations: 3, installments: "3x",
        status: "concluido",
    },
    {
        id: "3", date: "2025-12-18", card: "Nubank JV", cardColor: "#8B5CF6",
        institution: "Stone", invoiceValue: 1200000,
        totalFees: 58800, totalOperations: 5, installments: "1x",
        status: "concluido",
    },
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function PushHistoryPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <History className="h-6 w-6 text-primary" />
                    Histórico de Empurradas
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Registro de todas as operações de empurrar fatura realizadas.
                </p>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Empurrado</p>
                        <p className="text-xl font-bold font-mono text-primary">
                            {fmt(MOCK_HISTORY.reduce((s, h) => s + h.invoiceValue, 0))}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total em Taxas</p>
                        <p className="text-xl font-bold font-mono text-red-400">
                            {fmt(MOCK_HISTORY.reduce((s, h) => s + h.totalFees, 0))}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Operações Realizadas</p>
                        <p className="text-xl font-bold font-mono">
                            {MOCK_HISTORY.reduce((s, h) => s + h.totalOperations, 0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* History List */}
            <div className="space-y-3">
                {MOCK_HISTORY.map((h) => (
                    <Card key={h.id} className="border-border/50 bg-card hover:border-border transition-colors">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-4">
                                <div
                                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${h.cardColor}15` }}
                                >
                                    <CreditCard className="h-5 w-5" style={{ color: h.cardColor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-sm font-bold">{h.card}</p>
                                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-medium">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Concluído
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(h.date).toLocaleDateString("pt-BR")}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Building2 className="h-3 w-3" />
                                            {h.institution}
                                        </span>
                                        <span>{h.totalOperations} ops • {h.installments}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-base font-bold font-mono">{fmt(h.invoiceValue)}</p>
                                    <p className="text-xs text-red-400 font-mono">Taxas: {fmt(h.totalFees)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
