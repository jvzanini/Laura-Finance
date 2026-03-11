"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type UpcomingBill = {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    daysUntil: number;
    type: "fatura" | "recorrente" | "boleto";
    cardColor?: string;
};

const MOCK_BILLS: UpcomingBill[] = [
    { id: "1", name: "Nubank Principal", amount: 285000, dueDate: "27/03", daysUntil: 16, type: "fatura", cardColor: "#8B5CF6" },
    { id: "2", name: "Netflix", amount: 5590, dueDate: "15/03", daysUntil: 4, type: "recorrente" },
    { id: "3", name: "Aluguel", amount: 250000, dueDate: "18/03", daysUntil: 7, type: "boleto" },
    { id: "4", name: "Inter PJ", amount: 142500, dueDate: "22/03", daysUntil: 11, type: "fatura", cardColor: "#F97316" },
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getDaysColor(days: number) {
    if (days <= 3) return "text-red-400 bg-red-500/10";
    if (days <= 7) return "text-amber-500 bg-amber-500/10";
    return "text-emerald-500 bg-emerald-500/10";
}

function getTypeIcon(type: string) {
    if (type === "fatura") return <Calendar className="h-3.5 w-3.5" />;
    if (type === "recorrente") return <Clock className="h-3.5 w-3.5" />;
    return <CheckCircle2 className="h-3.5 w-3.5" />;
}

export function UpcomingBills() {
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Próximos Vencimentos
                </CardTitle>
                <CardDescription className="text-xs">
                    Faturas e contas dos próximos 30 dias
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
                {MOCK_BILLS.map((bill) => {
                    const daysColor = getDaysColor(bill.daysUntil);
                    return (
                        <div
                            key={bill.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-background/50 hover:border-border/60 transition-colors"
                        >
                            <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                    backgroundColor: bill.cardColor ? `${bill.cardColor}20` : "var(--accent)",
                                    color: bill.cardColor || "var(--muted-foreground)",
                                }}
                            >
                                {getTypeIcon(bill.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{bill.name}</p>
                                <p className="text-[10px] text-muted-foreground">{bill.dueDate}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-bold font-mono">{fmt(bill.amount)}</p>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${daysColor}`}>
                                    {bill.daysUntil === 0 ? "Hoje" : bill.daysUntil === 1 ? "Amanhã" : `${bill.daysUntil}d`}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
