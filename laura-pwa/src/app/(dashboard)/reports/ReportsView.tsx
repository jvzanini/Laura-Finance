"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Download,
    Filter,
    TrendingUp,
    TrendingDown,
    Users,
    CreditCard,
    Tag,
    Plane,
    PieChart,
    Calendar,
    ArrowLeftRight,
} from "lucide-react";
import type {
    DRESummary,
    ReportsFilterData,
    CategoryReportRow,
    SubcategoryReportRow,
    CardReportRow,
    PaymentMethodReportRow,
    TravelReportRow,
    ComparativeReport,
    TrendPoint,
    MemberReportRow,
    ReportFilters,
} from "@/lib/actions/reports";

type ReportTab =
    | "dre"
    | "categorias"
    | "subcategorias"
    | "membro"
    | "cartao"
    | "metodo"
    | "viagem"
    | "comparativo"
    | "tendencia";

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

type ReportsData = {
    dre: DRESummary;
    filterData: ReportsFilterData;
    categories: CategoryReportRow[];
    subcategories: SubcategoryReportRow[];
    cards: CardReportRow[];
    methods: PaymentMethodReportRow[];
    travel: TravelReportRow[];
    comparative: ComparativeReport;
    trend: TrendPoint[];
    members: MemberReportRow[];
    filters: ReportFilters;
};

export function ReportsView(props: ReportsData) {
    const { dre, filterData, categories, subcategories, cards, methods, travel, comparative, trend, members, filters } = props;
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<ReportTab>("dre");
    const [selectedMonth, setSelectedMonth] = useState<string>(filters.month ?? dre.month);
    const [selectedMember, setSelectedMember] = useState<string>(filters.memberId ?? "");
    const [selectedCategory, setSelectedCategory] = useState<string>(filters.categoryId ?? "");
    const [selectedType, setSelectedType] = useState<string>(filters.type ?? "");

    const applyFilters = (next: Partial<{ month: string; member: string; category: string; type: string }>) => {
        const params = new URLSearchParams();
        const month = next.month !== undefined ? next.month : selectedMonth;
        const member = next.member !== undefined ? next.member : selectedMember;
        const category = next.category !== undefined ? next.category : selectedCategory;
        const type = next.type !== undefined ? next.type : selectedType;
        if (month) params.set("month", month);
        if (member) params.set("member", member);
        if (category) params.set("category", category);
        if (type) params.set("type", type);
        const qs = params.toString();
        startTransition(() => {
            router.push(qs ? `/reports?${qs}` : "/reports");
        });
    };

    const onMonthChange = (v: string) => {
        setSelectedMonth(v);
        applyFilters({ month: v });
    };
    const onMemberChange = (v: string) => {
        setSelectedMember(v);
        applyFilters({ member: v });
    };
    const onCategoryChange = (v: string) => {
        setSelectedCategory(v);
        applyFilters({ category: v });
    };
    const onTypeChange = (v: string) => {
        setSelectedType(v);
        applyFilters({ type: v });
    };

    const tabs: { id: ReportTab; label: string; icon: React.ElementType; wip: boolean }[] = [
        { id: "dre", label: "DRE", icon: BarChart3, wip: false },
        { id: "categorias", label: "Categorias", icon: Tag, wip: false },
        { id: "subcategorias", label: "Subcategorias", icon: PieChart, wip: false },
        { id: "membro", label: "Por Membro", icon: Users, wip: false },
        { id: "cartao", label: "Por Cartão", icon: CreditCard, wip: false },
        { id: "metodo", label: "Método Pgto", icon: ArrowLeftRight, wip: false },
        { id: "viagem", label: "Modo Viagem", icon: Plane, wip: false },
        { id: "comparativo", label: "Comparativo", icon: TrendingUp, wip: false },
        { id: "tendencia", label: "Tendência", icon: Calendar, wip: false },
    ];

    const handleCSVExport = () => {
        let csv = "";
        let filename = "report.csv";
        if (activeTab === "dre") {
            csv = "Categoria,Tipo,Valor\n" + dre.lines
                .filter((l) => l.indent === 1)
                .map((l) => `"${l.label}","item",${(l.valueCents / 100).toFixed(2)}`)
                .join("\n");
            filename = `dre-${dre.month}.csv`;
        } else if (activeTab === "categorias") {
            csv = "Categoria,Valor,Percentual\n" + categories
                .map((c) => `"${c.name}",${(c.spentCents / 100).toFixed(2)},${c.percentOfTotal.toFixed(1)}`)
                .join("\n");
            filename = "categorias.csv";
        } else if (activeTab === "cartao") {
            csv = "Cartão,Transações,Valor\n" + cards
                .map((c) => `"${c.name}",${c.transactionCount},${(c.totalSpentCents / 100).toFixed(2)}`)
                .join("\n");
            filename = "cartoes.csv";
        } else {
            return;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" />
                        Relatórios
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Análises financeiras detalhadas para tomada de decisão.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleCSVExport}
                        disabled={!["dre", "categorias", "cartao"].includes(activeTab)}
                    >
                        <Download className="h-4 w-4" />
                        CSV
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/50 min-w-max">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                data-testid={`tab-report-${t.id}`}
                                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                    activeTab === t.id
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {t.label}
                                {t.wip && (
                                    <span className="ml-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-500">
                                        WIP
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters — server-side via URL searchParams */}
            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <input
                    type="month"
                    value={selectedMonth.length >= 7 ? selectedMonth.slice(0, 7) : selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    disabled={isPending}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                />
                <select
                    value={selectedMember}
                    onChange={(e) => onMemberChange(e.target.value)}
                    disabled={isPending}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                >
                    <option value="">Todos Membros</option>
                    {filterData.members.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.name}
                        </option>
                    ))}
                </select>
                <select
                    value={selectedCategory}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    disabled={isPending}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                >
                    <option value="">Todas Categorias</option>
                    {filterData.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                        </option>
                    ))}
                </select>
                <select
                    value={selectedType}
                    onChange={(e) => onTypeChange(e.target.value)}
                    disabled={isPending}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                >
                    <option value="">Todos Tipos</option>
                    <option value="income">Entradas</option>
                    <option value="expense">Saídas</option>
                </select>
                {isPending && (
                    <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                        Carregando…
                    </span>
                )}
            </div>

            {/* Content: DRE */}
            <div data-testid={`report-${activeTab}-content`}>
                {activeTab === "dre" && <DRETab dre={dre} />}
                {activeTab === "categorias" && <CategoriesTab data={categories} />}
                {activeTab === "subcategorias" && <SubcategoriesTab data={subcategories} />}
                {activeTab === "cartao" && <CardTab data={cards} />}
                {activeTab === "metodo" && <PaymentMethodTab data={methods} />}
                {activeTab === "viagem" && <TravelTab data={travel} />}
                {activeTab === "comparativo" && <ComparativeTab data={comparative} />}
                {activeTab === "tendencia" && <TrendTab data={trend} />}
                {activeTab === "membro" && <MemberTab data={members} />}
            </div>
        </div>
    );
}

function DRETab({ dre }: { dre: DRESummary }) {
    const hasData = dre.lines.length > 0;
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">
                    DRE Simplificada — {new Date(dre.month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </CardTitle>
                <CardDescription className="text-xs">
                    Demonstrativo de Resultado do Exercício calculado sobre transactions e investments reais.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!hasData && <EmptyState icon={BarChart3} message="Sem transações neste mês" />}
                {hasData && (
                    <div className="space-y-1">
                        {dre.lines.map((line, idx) => {
                            const color =
                                line.sign === "positive"
                                    ? "text-emerald-400"
                                    : line.sign === "negative"
                                        ? "text-red-400"
                                        : "text-muted-foreground";
                            const weight = line.bold ? "font-bold" : "font-normal";
                            const paddingLeft = line.indent === 1 ? "pl-6" : "";
                            const borderTop = line.bold && idx > 0 ? "border-t border-border/40 pt-2 mt-2" : "";
                            return (
                                <div key={idx} className={`flex justify-between ${paddingLeft} ${borderTop}`}>
                                    <span className={`text-sm ${weight} ${line.bold ? "" : "text-muted-foreground"}`}>
                                        {line.label}
                                    </span>
                                    <span className={`text-sm font-mono ${color} ${weight}`}>
                                        {fmt(line.valueCents)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CategoriesTab({ data }: { data: CategoryReportRow[] }) {
    const total = data.reduce((s, d) => s + d.spentCents, 0);
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Despesas por Categoria</CardTitle>
                <CardDescription className="text-xs">
                    Total: {fmt(total)} • {data.length} categorias com movimento este mês
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState icon={Tag} message="Sem despesas categorizadas neste mês" />
                ) : (
                    <div className="space-y-3">
                        {data.map((c) => (
                            <div key={c.categoryId ?? c.name} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                        {c.emoji && <span>{c.emoji}</span>}
                                        {c.name}
                                    </span>
                                    <span className="text-sm font-mono font-bold">{fmt(c.spentCents)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${c.percentOfTotal}%`,
                                                backgroundColor: c.color,
                                            }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground w-12 text-right">
                                        {c.percentOfTotal.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SubcategoriesTab({ data }: { data: SubcategoryReportRow[] }) {
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Top 20 Subcategorias do Mês</CardTitle>
                <CardDescription className="text-xs">
                    Drill-down da árvore de categorias (Epic 8.1). Top 20 por valor gasto.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState icon={PieChart} message="Sem despesas em subcategorias neste mês" />
                ) : (
                    <div className="space-y-2">
                        {data.map((s) => (
                            <div
                                key={s.subcategoryId ?? s.name}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-background/50"
                            >
                                {s.emoji && <span className="text-base">{s.emoji}</span>}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{s.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{s.categoryName}</p>
                                </div>
                                <span className="text-sm font-mono font-bold shrink-0">{fmt(s.spentCents)}</span>
                                <span className="text-[11px] font-mono text-muted-foreground w-12 text-right">
                                    {s.percentOfTotal.toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CardTab({ data }: { data: CardReportRow[] }) {
    const total = data.reduce((s, d) => s + d.totalSpentCents, 0);
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Gastos por Cartão / Método</CardTitle>
                <CardDescription className="text-xs">
                    Total: {fmt(total)} • {data.length} origens de pagamento este mês
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState icon={CreditCard} message="Sem despesas neste mês" />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {data.map((c) => (
                            <div
                                key={c.cardId ?? c.name}
                                className="p-4 rounded-xl border border-border/30 bg-background/50"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div
                                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${c.color}20` }}
                                    >
                                        <CreditCard className="h-5 w-5" style={{ color: c.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{c.name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {c.transactionCount} transação{c.transactionCount !== 1 ? "ões" : ""}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-xl font-bold font-mono">{fmt(c.totalSpentCents)}</span>
                                    <span className="text-[11px] font-mono text-muted-foreground">
                                        {c.percentOfTotal.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PaymentMethodTab({ data }: { data: PaymentMethodReportRow[] }) {
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Despesas por Método de Pagamento</CardTitle>
                <CardDescription className="text-xs">
                    Inferido pela presença de card_id: com cartão = Crédito, sem cartão = Dinheiro/PIX.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState icon={ArrowLeftRight} message="Sem despesas neste mês" />
                ) : (
                    <div className="space-y-3">
                        {data.map((m) => (
                            <div
                                key={m.method}
                                className="p-4 rounded-xl border border-border/30 bg-background/50 flex items-center gap-4"
                            >
                                <div
                                    className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${
                                        m.method === "crédito" ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-500"
                                    }`}
                                >
                                    {m.method === "crédito" ? (
                                        <CreditCard className="h-5 w-5" />
                                    ) : (
                                        <ArrowLeftRight className="h-5 w-5" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{m.label}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {m.transactionCount} transações
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold font-mono">{fmt(m.totalSpentCents)}</p>
                                    <p className="text-[11px] font-mono text-muted-foreground">
                                        {m.percentOfTotal.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TravelTab({ data }: { data: TravelReportRow[] }) {
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Modo Viagem — Despesas com tag viagem*</CardTitle>
                <CardDescription className="text-xs">
                    Qualquer transação com tag contendo "viagem" (ex: "viagem-sp", "viagem-ferias").
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState
                        icon={Plane}
                        message="Nenhuma tag viagem encontrada"
                        hint="Adicione a tag 'viagem' ou 'viagem-{destino}' nas transações para aparecer aqui."
                    />
                ) : (
                    <div className="space-y-3">
                        {data.map((t) => (
                            <div
                                key={t.tag}
                                className="p-4 rounded-xl border border-border/30 bg-background/50 flex items-center gap-4"
                            >
                                <div className="h-11 w-11 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                                    <Plane className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{t.tag}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {t.transactionCount} transações
                                    </p>
                                </div>
                                <p className="text-lg font-bold font-mono">{fmt(t.totalSpentCents)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ComparativeTab({ data }: { data: ComparativeReport }) {
    const trending = data.deltaPercent > 0;
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Comparativo Mensal</CardTitle>
                <CardDescription className="text-xs">
                    {data.currentMonthLabel} vs {data.previousMonthLabel}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-xl border border-border/30 bg-background/50 space-y-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                            {data.currentMonthLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Receitas</p>
                        <p className="text-base font-mono font-bold text-emerald-500">
                            {fmt(data.currentIncome)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Despesas</p>
                        <p className="text-base font-mono font-bold text-red-400">
                            {fmt(data.currentExpense)}
                        </p>
                        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                            Resultado Líquido
                        </p>
                        <p className={`text-xl font-mono font-bold ${data.currentNet >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                            {fmt(data.currentNet)}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl border border-border/30 bg-background/50 space-y-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                            {data.previousMonthLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Receitas</p>
                        <p className="text-base font-mono font-bold text-emerald-500">
                            {fmt(data.previousIncome)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Despesas</p>
                        <p className="text-base font-mono font-bold text-red-400">
                            {fmt(data.previousExpense)}
                        </p>
                        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                            Resultado Líquido
                        </p>
                        <p className={`text-xl font-mono font-bold ${data.previousNet >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                            {fmt(data.previousNet)}
                        </p>
                    </div>
                </div>
                {data.previousNet !== 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/30 flex items-center gap-3">
                        {trending ? (
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-red-400" />
                        )}
                        <div>
                            <p className="text-sm font-medium">
                                Variação do resultado:{" "}
                                <span className={trending ? "text-emerald-500" : "text-red-400"}>
                                    {data.deltaPercent > 0 ? "+" : ""}
                                    {data.deltaPercent.toFixed(1)}%
                                </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Comparado ao mesmo indicador do mês anterior.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TrendTab({ data }: { data: TrendPoint[] }) {
    const chartData = data.map((d) => ({
        month: d.month,
        Receitas: d.incomeCents / 100,
        Despesas: d.expenseCents / 100,
        Resultado: d.netCents / 100,
    }));

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Tendência (6 meses)</CardTitle>
                <CardDescription className="text-xs">
                    Série mensal de receitas, despesas e resultado líquido.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState icon={Calendar} message="Sem histórico suficiente" />
                ) : (
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262633" vertical={false} />
                                <XAxis dataKey="month" stroke="#9B9BA8" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#9B9BA8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#0F0F17",
                                        borderColor: "#262633",
                                        borderRadius: "0.75rem",
                                        fontSize: "12px",
                                    }}
                                    formatter={(value) => [
                                        `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                                    ]}
                                />
                                <Legend wrapperStyle={{ fontSize: "11px" }} />
                                <Line type="monotone" dataKey="Receitas" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="Resultado" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MemberTab({ data }: { data: MemberReportRow[] }) {
    const total = data.reduce((s, d) => s + d.totalSpentCents, 0);
    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Despesas por Membro do Workspace</CardTitle>
                <CardDescription className="text-xs">
                    Total: {fmt(total)} • agrega pelo autor do lançamento (PWA direto ou WhatsApp)
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        message="Sem autores identificados este mês"
                        hint="Transações lançadas via WhatsApp ganham autor automaticamente quando o phone_number está cadastrado em Membros."
                    />
                ) : (
                    <div className="space-y-3">
                        {data.map((m) => (
                            <div
                                key={m.authorKey}
                                className="p-4 rounded-xl border border-border/30 bg-background/50 flex items-center gap-4"
                            >
                                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                    {m.authorName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{m.authorName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {m.authorType === "user"
                                            ? "PWA · user direto"
                                            : m.authorType === "phone"
                                                ? "WhatsApp · membro cadastrado"
                                                : "Desconhecido (legado ou phone não cadastrado)"}
                                        {" · "}
                                        {m.transactionCount} transação{m.transactionCount !== 1 ? "ões" : ""}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-lg font-bold font-mono">{fmt(m.totalSpentCents)}</p>
                                    <p className="text-[11px] font-mono text-muted-foreground">
                                        {m.percentOfTotal.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyState({
    icon: Icon,
    message,
    hint,
}: {
    icon: React.ElementType;
    message: string;
    hint?: string;
}) {
    return (
        <div className="h-[200px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
            <Icon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground font-medium">{message}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
        </div>
    );
}
