"use client";

import { Card, CardContent } from "@/components/ui/card";
import { History, CheckCircle2, Calendar, CreditCard, Building2, Sparkles } from "lucide-react";

export type PushHistoryRow = {
    id: string;
    date: string;
    card: string;
    cardColor: string;
    institution: string;
    invoiceValue: number;
    totalFees: number;
    totalOperations: number;
    installments: string;
    status: string;
};

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function PushHistoryView({ rollovers }: { rollovers: PushHistoryRow[] }) {
    const totalInvoices = rollovers.reduce((s, h) => s + h.invoiceValue, 0);
    const totalFees = rollovers.reduce((s, h) => s + h.totalFees, 0);
    const totalOps = rollovers.reduce((s, h) => s + h.totalOperations, 0);

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
                        <p className="text-xl font-bold font-mono text-primary">{fmt(totalInvoices)}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total em Taxas</p>
                        <p className="text-xl font-bold font-mono text-red-400">{fmt(totalFees)}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Operações Realizadas</p>
                        <p className="text-xl font-bold font-mono">{totalOps}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Empty state */}
            {rollovers.length === 0 && (
                <Card className="border-dashed border-2 border-primary/30 bg-card">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Sparkles className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <p className="text-base font-bold">Nenhuma empurrada registrada ainda</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Quando você usar o simulador em <strong>/invoices/push</strong> ou confirmar uma rolagem via WhatsApp, o histórico aparece aqui.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* History List */}
            <div className="space-y-3">
                {rollovers.map((h) => (
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
                                            {h.status}
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
                                        <span>
                                            {h.totalOperations} ops • {h.installments}
                                        </span>
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
