"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    TrendingUp, Plus, X, BarChart3, PieChart, Wallet,
    ArrowUpRight, ArrowDownRight, Building2, Loader2
} from "lucide-react";
import { fetchInvestmentsAction, addInvestmentAction } from "@/lib/actions/investments";
import { fetchBrokerOptionsAction, fetchInvestmentTypeOptionsAction } from "@/lib/actions/options";

type Investment = {
    id: string;
    broker: string;
    brokerEmoji: string;
    market: string;
    totalInvested: number;
    currentValue: number;
    monthlyContribution: number;
    returnPct: number;
};



const FALLBACK_BROKERS = [
    { label: "🏦 Ágora", value: "Ágora" },
    { label: "🏦 BTG", value: "BTG" },
    { label: "🏦 Clear", value: "Clear" },
    { label: "🏦 Inter", value: "Inter" },
    { label: "🏦 Nu Invest", value: "Nu Invest" },
    { label: "🏦 Rico", value: "Rico" },
    { label: "🏦 XP", value: "XP" },
    { label: "💎 Binance", value: "Binance" },
    { label: "📈 IC Markets", value: "IC Markets" },
    { label: "📊 IQ Option", value: "IQ Option" },
];

const FALLBACK_TYPES = [
    { label: "Investimentos", value: "Investimentos" },
    { label: "Cripto", value: "Cripto" },
    { label: "Poupança", value: "Poupança" },
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function InvestmentsPage() {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const [broker, setBroker] = useState("");
    const [market, setMarket] = useState("Investimentos");
    const [inputInvested, setInputInvested] = useState("");
    const [inputCurrent, setInputCurrent] = useState("");
    const [inputMonthly, setInputMonthly] = useState("");
    const [brokerOptions, setBrokerOptions] = useState(FALLBACK_BROKERS);
    const [typeOptions, setTypeOptions] = useState(FALLBACK_TYPES);

    useEffect(() => {
        loadInvestments();
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const [brokers, types] = await Promise.all([
                fetchBrokerOptionsAction(),
                fetchInvestmentTypeOptionsAction(),
            ]);
            if (brokers.length > 0) setBrokerOptions(brokers.map((b: { name: string; emoji?: string | null }) => ({ label: `${b.emoji || '🏦'} ${b.name}`, value: b.name })));
            if (types.length > 0) setTypeOptions(types.map((t: { name: string }) => ({ label: t.name, value: t.name })));
        } catch { /* keep fallbacks */ }
    };

    const loadInvestments = async () => {
        setLoading(true);
        const res = await fetchInvestmentsAction();
        if (res.investments) {
            type InvestmentApi = {
                id: string;
                broker: string;
                emoji?: string | null;
                type: string;
                investedAmount: number;
                currentAmount: number;
                monthlyContribution: number;
            };
            setInvestments(res.investments.map((i: InvestmentApi) => ({
                id: i.id,
                broker: i.broker,
                brokerEmoji: i.emoji || "🏦",
                market: i.type,
                totalInvested: i.investedAmount,
                currentValue: i.currentAmount,
                monthlyContribution: i.monthlyContribution,
                returnPct: i.investedAmount > 0 ? ((i.currentAmount - i.investedAmount) / i.investedAmount) * 100 : 0
            })));
        }
        setLoading(false);
    };

    const handleSubmit = async () => {
        if (!broker || !inputInvested || !inputCurrent) return;
        setSubmitting(true);
        
        const form = new FormData();
        form.append("name", broker);
        form.append("broker", broker);
        form.append("type", market);
        form.append("invested_amount", inputInvested);
        form.append("current_amount", inputCurrent);
        if (inputMonthly) form.append("monthly_contribution", inputMonthly);
        
        const res = await addInvestmentAction(form);
        setSubmitting(false);
        if (res?.success) {
            await loadInvestments();
            setShowForm(false);
            setBroker("");
            setInputInvested("");
            setInputCurrent("");
            setInputMonthly("");
        } else {
            alert(res?.error || "Erro ao adicionar investimento");
        }
    };

    const totalInvested = investments.reduce((s, i) => s + i.totalInvested, 0);
    const totalCurrent = investments.reduce((s, i) => s + i.currentValue, 0);
    const totalMonthly = investments.reduce((s, i) => s + i.monthlyContribution, 0);
    const totalReturn = totalCurrent - totalInvested;
    const totalReturnPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Investimentos
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Acompanhe seu patrimônio investido e rendimentos.
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2" data-testid="btn-new-investment">
                    {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showForm ? "Cancelar" : "Novo Investimento"}
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/50 bg-card relative overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Patrimônio Total</span>
                            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                                <Wallet className="h-4 w-4 text-primary" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono">{fmt(totalCurrent)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Valor atualizado</p>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
                </Card>

                <Card className="border-border/50 bg-card relative overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Investido</span>
                            <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                                <BarChart3 className="h-4 w-4 text-blue-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono">{fmt(totalInvested)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Capital aplicado</p>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                </Card>

                <Card className="border-border/50 bg-card relative overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Rendimento</span>
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                {totalReturn >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                            </div>
                        </div>
                        <p className={`text-2xl font-bold font-mono ${totalReturn >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                            {totalReturn >= 0 ? "+" : ""}{fmt(totalReturn)}
                        </p>
                        <p className={`text-xs font-medium mt-0.5 ${totalReturn >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                            {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(1)}%
                        </p>
                    </CardContent>
                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${totalReturn >= 0 ? "via-emerald-500" : "via-red-500"} to-transparent`} />
                </Card>

                <Card className="border-border/50 bg-card relative overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Aporte Mensal</span>
                            <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                                <PieChart className="h-4 w-4 text-amber-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono">{fmt(totalMonthly)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Investimento recorrente</p>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                </Card>
            </div>

            {/* Add Investment Form */}
            {showForm && (
                <Card className="border-primary/20 bg-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Novo Investimento</CardTitle>
                        <CardDescription className="text-xs">Registre uma nova posição em corretora.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Corretora</Label>
                                <Select value={broker} onValueChange={(val) => setBroker(val || "")}>
                                    <SelectTrigger className="h-9 bg-background" data-testid="select-investment-broker"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {brokerOptions.map((b) => (
                                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Total Investido (R$)</Label>
                                <Input type="number" placeholder="10000.00" value={inputInvested} onChange={(e) => setInputInvested(e.target.value)} className="h-9 bg-background" data-testid="input-investment-invested" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Valor Atual (R$)</Label>
                                <Input type="number" placeholder="10500.00" value={inputCurrent} onChange={(e) => setInputCurrent(e.target.value)} className="h-9 bg-background" data-testid="input-investment-current" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Aporte Mensal (R$)</Label>
                                <Input type="number" placeholder="500.00" value={inputMonthly} onChange={(e) => setInputMonthly(e.target.value)} className="h-9 bg-background" />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={submitting}>Cancelar</Button>
                            <Button size="sm" onClick={handleSubmit} disabled={submitting} data-testid="btn-save-investment">
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <>
                    {/* Investments List */}
                    <div className="space-y-3">
                        {investments.length === 0 && !showForm && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
                                Nenhum investimento cadastrado.
                            </div>
                        )}
                        {investments.map((inv) => {
                            const returnVal = inv.currentValue - inv.totalInvested;
                            const isPositive = returnVal >= 0;
                            return (
                                <Card key={inv.id} className="border-border/50 bg-card hover:border-border transition-colors">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                                                {inv.brokerEmoji}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-sm font-bold">{inv.broker}</p>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground font-medium">
                                                        {inv.market}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Aporte: {fmt(inv.monthlyContribution)}/mês
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-base font-bold font-mono">{fmt(inv.currentValue)}</p>
                                                <div className="flex items-center gap-1 justify-end">
                                                    {isPositive ? (
                                                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                                    ) : (
                                                        <ArrowDownRight className="h-3 w-3 text-red-400" />
                                                    )}
                                                    <span className={`text-xs font-mono font-medium ${isPositive ? "text-emerald-500" : "text-red-400"}`}>
                                                        {isPositive ? "+" : ""}{fmt(returnVal)} ({inv.returnPct.toFixed(1)}%)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
