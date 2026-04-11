import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import { fetchUpcomingBillsAction, type UpcomingBill } from "@/lib/actions/dashboardMetrics";

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

export async function UpcomingBills() {
    const bills = await fetchUpcomingBillsAction();

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Próximos Vencimentos
                </CardTitle>
                <CardDescription className="text-xs">
                    Faturas em aberto nos próximos 30 dias
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
                {bills.length === 0 ? (
                    <div className="h-[160px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
                        <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">Nenhum vencimento à vista</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            Quando uma fatura for registrada, ela aparece aqui automaticamente.
                        </p>
                    </div>
                ) : (
                    bills.map((bill: UpcomingBill) => {
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
                                    <p className="text-[10px] text-muted-foreground">{bill.dueLabel}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-bold font-mono">{fmt(bill.amountCents)}</p>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${daysColor}`}>
                                        {bill.daysUntil <= 0
                                            ? "Hoje"
                                            : bill.daysUntil === 1
                                                ? "Amanhã"
                                                : `${bill.daysUntil}d`}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
