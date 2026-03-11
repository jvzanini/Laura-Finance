"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowDownUp, Calculator, CreditCard, Building2,
    CheckCircle2, AlertTriangle, ArrowRight, DollarSign,
} from "lucide-react";

type Operation = {
    index: number;
    pagamento: { valorFatura: number; valorPago: number; saldo: number };
    saque: { valor: number; parcelamento: string; taxa: number; valorTaxa: number; valorSacado: number };
};

const CARDS_OPTIONS = [
    { value: "nubank-jv", label: "💜 Nubank JV", bank: "Nubank" },
    { value: "inter-pj", label: "🧡 Inter PJ", bank: "Banco Inter" },
    { value: "c6-ml", label: "🖤 C6 ML", bank: "C6 Bank" },
    { value: "nubank-ml", label: "💜 Nubank ML", bank: "Nubank" },
];

const INSTITUTIONS = [
    { value: "infinitepay", label: "🤍 InfinitePay" },
    { value: "ton", label: "💚 Ton" },
    { value: "stone", label: "💚 Stone" },
    { value: "mercadopago", label: "🩵 Mercado Pago" },
    { value: "cielo", label: "🩵 Cielo" },
    { value: "pagbank", label: "💚 PagBank" },
];

// Simulated fee table
const FEES: Record<string, Record<string, number>> = {
    infinitepay: { "1x": 3.5, "2x": 4.5, "3x": 5.37, "4x": 6.0, "5x": 6.5, "6x": 7.0, "10x": 9.0, "12x": 10.5 },
    ton: { "1x": 3.19, "2x": 4.69, "3x": 5.69, "4x": 6.39, "5x": 6.79, "6x": 7.19, "10x": 9.29, "12x": 10.79 },
    stone: { "1x": 3.29, "2x": 4.59, "3x": 5.59, "4x": 6.29, "5x": 6.79, "6x": 7.09, "10x": 9.19, "12x": 10.59 },
    mercadopago: { "1x": 3.49, "2x": 5.09, "3x": 5.99, "4x": 6.79, "5x": 7.19, "6x": 7.49, "10x": 9.69, "12x": 11.19 },
    cielo: { "1x": 3.89, "2x": 5.49, "3x": 6.39, "4x": 7.09, "5x": 7.49, "6x": 7.89, "10x": 9.99, "12x": 11.69 },
    pagbank: { "1x": 3.39, "2x": 4.89, "3x": 5.79, "4x": 6.49, "5x": 6.99, "6x": 7.29, "10x": 9.49, "12x": 10.99 },
};

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function PushInvoicePage() {
    const [card, setCard] = useState("");
    const [institution, setInstitution] = useState("");
    const [invoiceValue, setInvoiceValue] = useState("");
    const [initialPayment, setInitialPayment] = useState("");
    const [installments, setInstallments] = useState("1x");
    const [operations, setOperations] = useState<Operation[]>([]);
    const [showPlan, setShowPlan] = useState(false);

    const getFee = (inst: string, parcela: string): number => {
        return FEES[inst]?.[parcela] || 3.5;
    };

    const simulate = () => {
        if (!invoiceValue || !initialPayment || !institution) return;

        const invoiceCents = Math.round(parseFloat(invoiceValue) * 100);
        const initialCents = Math.round(parseFloat(initialPayment) * 100);
        const fee = getFee(institution, installments);

        const ops: Operation[] = [];
        let remainingInvoice = invoiceCents;
        let nextPayment = Math.min(initialCents, remainingInvoice);

        let safety = 0;
        while (remainingInvoice > 0 && safety < 50) {
            safety++;
            const valorPago = Math.min(nextPayment, remainingInvoice);
            const saldo = remainingInvoice - valorPago;
            const valorSaque = valorPago;
            const valorTaxa = Math.ceil(valorSaque * (fee / 100));
            const valorSacado = valorSaque - valorTaxa;

            ops.push({
                index: ops.length + 1,
                pagamento: { valorFatura: remainingInvoice, valorPago: valorPago, saldo },
                saque: { valor: valorSaque, parcelamento: installments, taxa: fee, valorTaxa, valorSacado },
            });

            remainingInvoice = saldo;
            if (remainingInvoice <= 0) break;
            nextPayment = Math.min(valorSacado, remainingInvoice);
            if (nextPayment <= 100) {
                // Final operation: pay remaining
                ops.push({
                    index: ops.length + 1,
                    pagamento: { valorFatura: remainingInvoice, valorPago: remainingInvoice, saldo: 0 },
                    saque: {
                        valor: remainingInvoice,
                        parcelamento: installments,
                        taxa: fee,
                        valorTaxa: Math.ceil(remainingInvoice * (fee / 100)),
                        valorSacado: remainingInvoice - Math.ceil(remainingInvoice * (fee / 100)),
                    },
                });
                remainingInvoice = 0;
            }
        }

        setOperations(ops);
        setShowPlan(true);
    };

    const totalPaid = operations.reduce((s, o) => s + o.pagamento.valorPago, 0);
    const totalFees = operations.reduce((s, o) => s + o.saque.valorTaxa, 0);
    const totalCashed = operations.reduce((s, o) => s + o.saque.valorSacado, 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <ArrowDownUp className="h-6 w-6 text-primary" />
                    Empurrar Fatura
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Simule a operação de empurrar fatura e veja o planejamento completo.
                </p>
            </div>

            {/* Input Form */}
            <Card className="border-primary/20 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        Configurar Simulação
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Preencha os dados para gerar o planejamento de operações.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Cartão da Fatura</Label>
                            <Select value={card} onValueChange={setCard}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {CARDS_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Valor da Fatura (R$)</Label>
                            <Input
                                type="number" step="0.01"
                                value={invoiceValue}
                                onChange={(e) => setInvoiceValue(e.target.value)}
                                placeholder="10000.00"
                                className="h-9 bg-background"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Pagamento Inicial (R$)</Label>
                            <Input
                                type="number" step="0.01"
                                value={initialPayment}
                                onChange={(e) => setInitialPayment(e.target.value)}
                                placeholder="5000.00"
                                className="h-9 bg-background"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Instituição (Maquininha)</Label>
                            <Select value={institution} onValueChange={setInstitution}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {INSTITUTIONS.map((i) => (
                                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Parcelamento</Label>
                            <Select value={installments} onValueChange={setInstallments}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["1x", "2x", "3x", "4x", "5x", "6x", "10x", "12x"].map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button onClick={simulate} className="gap-2">
                        <Calculator className="h-4 w-4" />
                        Simular Empurrar
                    </Button>
                </CardContent>
            </Card>

            {/* Plan Results */}
            {showPlan && operations.length > 0 && (
                <>
                    {/* Summary */}
                    <div className="grid gap-4 sm:grid-cols-4">
                        <Card className="border-border/50 bg-card">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valor Fatura</p>
                                <p className="text-lg font-bold font-mono">{fmt(Math.round(parseFloat(invoiceValue) * 100))}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Sacado</p>
                                <p className="text-lg font-bold font-mono text-emerald-500">{fmt(totalCashed)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Taxas</p>
                                <p className="text-lg font-bold font-mono text-red-400">{fmt(totalFees)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Operações</p>
                                <p className="text-lg font-bold font-mono text-primary">{operations.length}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Operations Timeline */}
                    <Card className="border-border/50 bg-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Planejamento de Operações</CardTitle>
                            <CardDescription className="text-xs">Cada operação detalha pagamento + saque</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {operations.map((op) => (
                                <div key={op.index} className="p-4 rounded-xl border border-border/30 bg-background/50 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                                            {op.index}
                                        </span>
                                        <span className="text-sm font-semibold">Operação {op.index}/{operations.length}</span>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {/* Payment */}
                                        <div className="p-3 rounded-lg bg-card border border-border/20">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                                                💳 Pagamento da Fatura
                                            </p>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Fatura:</span>
                                                    <span className="font-mono">{fmt(op.pagamento.valorFatura)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Pago:</span>
                                                    <span className="font-mono font-bold text-emerald-500">-{fmt(op.pagamento.valorPago)}</span>
                                                </div>
                                                <div className="flex justify-between pt-1 border-t border-border/20">
                                                    <span className="text-muted-foreground font-medium">Saldo:</span>
                                                    <span className={`font-mono font-bold ${op.pagamento.saldo === 0 ? "text-emerald-500" : "text-amber-500"}`}>
                                                        {fmt(op.pagamento.saldo)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Withdrawal */}
                                        <div className="p-3 rounded-lg bg-card border border-border/20">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                                                💰 Saque de Crédito
                                            </p>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Valor na maquininha:</span>
                                                    <span className="font-mono">{fmt(op.saque.valor)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Taxa ({op.saque.taxa}%):</span>
                                                    <span className="font-mono text-red-400">-{fmt(op.saque.valorTaxa)}</span>
                                                </div>
                                                <div className="flex justify-between pt-1 border-t border-border/20">
                                                    <span className="text-muted-foreground font-medium">Recebe via Pix:</span>
                                                    <span className="font-mono font-bold text-emerald-500">{fmt(op.saque.valorSacado)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Action */}
                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setShowPlan(false)}>
                            Ajustar Valores
                        </Button>
                        <Button className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Aprovar e Lançar
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
