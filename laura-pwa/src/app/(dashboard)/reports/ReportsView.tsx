"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Download,
    Filter,
    TrendingUp,
    Users,
    CreditCard,
    Tag,
    Plane,
    PieChart,
    Calendar,
    ArrowLeftRight,
    Construction,
} from "lucide-react";
import type { DRESummary } from "@/lib/actions/reports";
import type { ReportsFilterData } from "@/lib/actions/reports";

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

export function ReportsView({ dre, filterData }: { dre: DRESummary; filterData: ReportsFilterData }) {
    const [activeTab, setActiveTab] = useState<ReportTab>("dre");
    const [selectedMonth, setSelectedMonth] = useState<string>(dre.month);
    const [selectedMember, setSelectedMember] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedType, setSelectedType] = useState<string>("");

    const tabs: { id: ReportTab; label: string; icon: React.ElementType; ready: boolean }[] = [
        { id: "dre", label: "DRE", icon: BarChart3, ready: true },
        { id: "categorias", label: "Categorias", icon: Tag, ready: false },
        { id: "subcategorias", label: "Subcategorias", icon: PieChart, ready: false },
        { id: "membro", label: "Por Membro", icon: Users, ready: false },
        { id: "cartao", label: "Por Cartão", icon: CreditCard, ready: false },
        { id: "metodo", label: "Método Pgto", icon: ArrowLeftRight, ready: false },
        { id: "viagem", label: "Modo Viagem", icon: Plane, ready: false },
        { id: "comparativo", label: "Comparativo", icon: TrendingUp, ready: false },
        { id: "tendencia", label: "Tendência", icon: Calendar, ready: false },
    ];

    const hasAnyData = dre.lines.length > 0;

    const handleCSVExport = () => {
        if (!hasAnyData) return;
        const header = "Categoria,Tipo,Valor\n";
        const rows = dre.lines
            .filter((l) => l.indent === 1)
            .map((l) => `"${l.label}","item",${(l.valueCents / 100).toFixed(2)}`)
            .join("\n");
        const csv = header + rows;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dre-${dre.month}.csv`;
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
                        disabled={!hasAnyData || activeTab !== "dre"}
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
                                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                    activeTab === t.id
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {t.label}
                                {!t.ready && (
                                    <span className="ml-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-500">
                                        WIP
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                />
                <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
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
                    onChange={(e) => setSelectedCategory(e.target.value)}
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
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                >
                    <option value="">Todos Tipos</option>
                    <option value="income">Entradas</option>
                    <option value="expense">Saídas</option>
                </select>
                <p className="text-[11px] text-muted-foreground ml-auto">
                    Filtros interativos: disponíveis na próxima iteração (aba DRE mostra o mês corrente).
                </p>
            </div>

            {/* Content — DRE */}
            {activeTab === "dre" && (
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
                        {!hasAnyData && (
                            <div className="h-[200px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
                                <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground font-medium">
                                    Sem transações neste mês
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                    Assim que a Laura processar mensagens no WhatsApp ou você criar transações manualmente, o DRE ganha forma.
                                </p>
                            </div>
                        )}

                        {hasAnyData && (
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
                                        <div
                                            key={idx}
                                            className={`flex justify-between ${paddingLeft} ${borderTop}`}
                                        >
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
            )}

            {/* Other tabs — WIP */}
            {activeTab !== "dre" && (
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-10 text-center space-y-4">
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <Construction className="h-7 w-7 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-base font-bold">
                                Em construção: {tabs.find((t) => t.id === activeTab)?.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
                                Esta aba está listada na Story 9.3 do BMAD como parte da expansão dos Relatórios
                                multidimensionais. A aba <strong>DRE</strong> já consome dados reais; as demais
                                serão implementadas nas próximas rodadas consumindo{" "}
                                <code className="bg-muted px-1 rounded">transactions</code>,{" "}
                                <code className="bg-muted px-1 rounded">categories</code>,{" "}
                                <code className="bg-muted px-1 rounded">cards</code> e{" "}
                                <code className="bg-muted px-1 rounded">users</code>.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setActiveTab("dre")}>
                            Voltar ao DRE
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
