"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, ArrowRight, Calculator, CheckCircle2, AlertTriangle } from "lucide-react";

type Invoice = {
    id: string;
    cardName: string;
    cardColor: string;
    totalCents: number;
    dueDate: string;
    status: "aberta" | "paga" | "atrasada";
};

const MOCK_INVOICES: Invoice[] = [
    { id: "1", cardName: "Nubank Principal", cardColor: "#8B5CF6", totalCents: 285000, dueDate: "2026-03-27", status: "aberta" },
    { id: "2", cardName: "Inter PJ", cardColor: "#F97316", totalCents: 142500, dueDate: "2026-03-22", status: "paga" },
    { id: "3", cardName: "C6 Bank Black", cardColor: "#1F2937", totalCents: 89000, dueDate: "2026-03-12", status: "atrasada" },
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getStatusBadge(s: string) {
    if (s === "paga") return { color: "bg-emerald-500/15 text-emerald-500", icon: <CheckCircle2 className="h-3 w-3" />, label: "Paga" };
    if (s === "atrasada") return { color: "bg-red-500/15 text-red-400", icon: <AlertTriangle className="h-3 w-3" />, label: "Atrasada" };
    return { color: "bg-amber-500/15 text-amber-500", icon: <Receipt className="h-3 w-3" />, label: "Aberta" };
}

export default function InvoicesPage() {
    const [showSimulator, setShowSimulator] = useState(false);
    const [simValue, setSimValue] = useState("");
    const [simMonths, setSimMonths] = useState("3");
    const [simRate, setSimRate] = useState("2.49");

    const simTotal = simValue && simMonths && simRate
        ? (parseFloat(simValue) * Math.pow(1 + parseFloat(simRate) / 100, parseInt(simMonths))).toFixed(2)
        : null;

    const simMonthly = simTotal && simMonths
        ? (parseFloat(simTotal) / parseInt(simMonths)).toFixed(2)
        : null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Faturas</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Acompanhe faturas dos seus cartões e simule rolagem de dívida.
                    </p>
                </div>
                <Button onClick={() => setShowSimulator(!showSimulator)} variant="outline" size="sm" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Simulador de Empurrar
                </Button>
            </div>

            {/* Debt Rollover Simulator */}
            {showSimulator && (
                <Card className="border-primary/20 bg-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-primary" />
                            Simulador — Empurrar Fatura
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Calcule o custo real de parcelar uma fatura com juros compostos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-3 mb-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Valor da Fatura (R$)</Label>
                                <Input type="number" value={simValue} onChange={(e) => setSimValue(e.target.value)} placeholder="2850.00" className="h-9 bg-background" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Parcelas (meses)</Label>
                                <Input type="number" value={simMonths} onChange={(e) => setSimMonths(e.target.value)} className="h-9 bg-background" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Taxa Mensal (%)</Label>
                                <Input type="number" step="0.01" value={simRate} onChange={(e) => setSimRate(e.target.value)} className="h-9 bg-background" />
                            </div>
                        </div>

                        {simTotal && simMonthly && (
                            <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border/50">
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Total com juros</p>
                                    <p className="text-lg font-bold font-mono text-destructive">R$ {simTotal}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Parcela mensal</p>
                                    <p className="text-lg font-bold font-mono text-amber-500">R$ {simMonthly}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Custo do empurrão</p>
                                    <p className="text-lg font-bold font-mono text-red-400">
                                        +R$ {(parseFloat(simTotal) - parseFloat(simValue || "0")).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Invoices List */}
            <div className="space-y-3">
                {MOCK_INVOICES.map((inv) => {
                    const badge = getStatusBadge(inv.status);
                    return (
                        <Card key={inv.id} className="border-border/50 bg-card hover:border-border transition-colors">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: inv.cardColor + "30" }}>
                                        <Receipt className="h-5 w-5" style={{ color: inv.cardColor }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold">{inv.cardName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Vencimento: {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>
                                        {badge.icon}
                                        {badge.label}
                                    </span>
                                    <p className="text-base font-bold font-mono whitespace-nowrap">{fmt(inv.totalCents)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
