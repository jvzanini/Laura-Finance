"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart3, Download, Filter, TrendingUp, TrendingDown,
    Users, CreditCard, Tag, Plane, PieChart, Calendar, ArrowLeftRight
} from "lucide-react";

type ReportTab = "dre" | "categorias" | "subcategorias" | "membro" | "cartao" | "metodo" | "viagem" | "comparativo" | "tendencia";

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>("dre");

    const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
        { id: "dre", label: "DRE", icon: BarChart3 },
        { id: "categorias", label: "Categorias", icon: Tag },
        { id: "subcategorias", label: "Subcategorias", icon: PieChart },
        { id: "membro", label: "Por Membro", icon: Users },
        { id: "cartao", label: "Por Cartão", icon: CreditCard },
        { id: "metodo", label: "Método Pgto", icon: ArrowLeftRight },
        { id: "viagem", label: "Modo Viagem", icon: Plane },
        { id: "comparativo", label: "Comparativo", icon: TrendingUp },
        { id: "tendencia", label: "Tendência", icon: Calendar },
    ];

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
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        CSV
                    </Button>
                    <Button size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        PDF
                    </Button>
                </div>
            </div>

            {/* Tabs - scrollable */}
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
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <input type="month" defaultValue="2026-03" className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground" />
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Membros</option>
                    <option>João Vitor</option>
                    <option>Maria Laura</option>
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todas Categorias</option>
                    <option>👤 Pessoal</option>
                    <option>🏠 Moradia</option>
                    <option>🍽 Alimentação</option>
                    <option>🚗 Transporte</option>
                    <option>🎮 Lazer</option>
                    <option>💰 Finanças</option>
                    <option>💼 Trabalho</option>
                    <option>✈️ Viagem</option>
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Tipos</option>
                    <option value="income">Entradas</option>
                    <option value="expense">Saídas</option>
                    <option value="saque">Saque de Crédito</option>
                </select>
            </div>

            {/* Content - DRE */}
            {activeTab === "dre" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">DRE Simplificada — Março 2026</CardTitle>
                        <CardDescription className="text-xs">Demonstrativo de Resultado do Exercício</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {[
                                { label: "(+) Receitas Brutas", value: "R$ 12.500,00", color: "text-emerald-400", bold: true },
                                { label: "  Salário", value: "R$ 8.500,00", color: "text-muted-foreground", bold: false },
                                { label: "  Freelance", value: "R$ 4.000,00", color: "text-muted-foreground", bold: false },
                                { label: "(-) Despesas Fixas", value: "R$ 4.200,00", color: "text-red-400", bold: true },
                                { label: "  Aluguel", value: "R$ 2.500,00", color: "text-muted-foreground", bold: false },
                                { label: "  Condomínio", value: "R$ 800,00", color: "text-muted-foreground", bold: false },
                                { label: "  Internet/Telefone", value: "R$ 350,00", color: "text-muted-foreground", bold: false },
                                { label: "  Seguro Auto", value: "R$ 550,00", color: "text-muted-foreground", bold: false },
                                { label: "(-) Despesas Variáveis", value: "R$ 3.850,00", color: "text-amber-500", bold: true },
                                { label: "  Alimentação", value: "R$ 1.800,00", color: "text-muted-foreground", bold: false },
                                { label: "  Transporte", value: "R$ 620,00", color: "text-muted-foreground", bold: false },
                                { label: "  Lazer", value: "R$ 430,00", color: "text-muted-foreground", bold: false },
                                { label: "  Outros", value: "R$ 1.000,00", color: "text-muted-foreground", bold: false },
                                { label: "(-) Investimentos", value: "R$ 1.700,00", color: "text-blue-400", bold: true },
                                { label: "  Nu Invest", value: "R$ 500,00", color: "text-muted-foreground", bold: false },
                                { label: "  BTG", value: "R$ 1.000,00", color: "text-muted-foreground", bold: false },
                                { label: "  Binance", value: "R$ 200,00", color: "text-muted-foreground", bold: false },
                            ].map((row, i) => (
                                <div key={i} className={`flex justify-between items-center py-2.5 px-3 rounded-lg ${row.bold ? "bg-background/50 border border-border/30" : "hover:bg-accent/30"}`}>
                                    <span className={`text-sm ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</span>
                                    <span className={`text-sm font-mono font-medium ${row.color}`}>{row.value}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center py-3 px-3 rounded-lg bg-primary/10 border border-primary/20 mt-2">
                                <span className="text-sm font-bold text-primary">(=) Resultado Líquido</span>
                                <span className="text-lg font-mono font-bold text-primary">R$ 2.750,00</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Content - Categorias */}
            {activeTab === "categorias" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por Categoria — Março 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "🍽 Alimentação", spent: 1800, total: 8050, pct: 22.4, color: "#10B981" },
                            { name: "🏠 Moradia", spent: 3650, total: 8050, pct: 45.3, color: "#3B82F6" },
                            { name: "🚗 Transporte", spent: 620, total: 8050, pct: 7.7, color: "#F59E0B" },
                            { name: "🎮 Lazer", spent: 430, total: 8050, pct: 5.3, color: "#EC4899" },
                            { name: "👤 Pessoal", spent: 550, total: 8050, pct: 6.8, color: "#8B5CF6" },
                            { name: "💰 Finanças", spent: 1000, total: 8050, pct: 12.4, color: "#EF4444" },
                        ].map((c, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                    <span className="font-mono text-muted-foreground">
                                        R$ {c.spent.toLocaleString("pt-BR")} ({c.pct}%)
                                    </span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Content - Subcategorias */}
            {activeTab === "subcategorias" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Detalhamento por Subcategoria — Março 2026</CardTitle>
                        <CardDescription className="text-xs">Visão granular dentro de cada categoria</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {[
                            {
                                category: "🍽 Alimentação", color: "#10B981", subs: [
                                    { name: "🛒 Supermercado", spent: 980, pct: 54 },
                                    { name: "🍕 Restaurantes", spent: 420, pct: 23 },
                                    { name: "📦 Delivery", spent: 280, pct: 16 },
                                    { name: "☕ Lanches e Cafés", spent: 120, pct: 7 },
                                ]
                            },
                            {
                                category: "🏠 Moradia", color: "#3B82F6", subs: [
                                    { name: "🏢 Aluguel", spent: 2500, pct: 68 },
                                    { name: "🏘 Condomínio", spent: 800, pct: 22 },
                                    { name: "💡 Contas de Consumo", spent: 350, pct: 10 },
                                ]
                            },
                            {
                                category: "🚗 Transporte", color: "#F59E0B", subs: [
                                    { name: "⛽ Combustível", spent: 320, pct: 52 },
                                    { name: "📱 App de Transporte", spent: 180, pct: 29 },
                                    { name: "🅿️ Estacionamento", spent: 120, pct: 19 },
                                ]
                            },
                        ].map((group, gi) => (
                            <div key={gi} className="space-y-2">
                                <p className="text-sm font-bold flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                                    {group.category}
                                </p>
                                {group.subs.map((sub, si) => (
                                    <div key={si} className="flex items-center gap-3 pl-5">
                                        <span className="text-xs text-muted-foreground w-32 truncate">{sub.name}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${sub.pct}%`, backgroundColor: group.color, opacity: 0.7 }} />
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground w-24 text-right">
                                            R$ {sub.spent.toLocaleString("pt-BR")} ({sub.pct}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Content - Por Membro */}
            {activeTab === "membro" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por Membro — Março 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "João Vitor", spent: 5200, pct: 64.6, color: "#8B5CF6", avatar: "JV" },
                            { name: "Maria Laura", spent: 2850, pct: 35.4, color: "#EC4899", avatar: "ML" },
                        ].map((m, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border/30 bg-background/50">
                                <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: m.color }}>
                                    {m.avatar}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{m.name}</p>
                                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1.5">
                                        <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold font-mono">R$ {m.spent.toLocaleString("pt-BR")}</p>
                                    <p className="text-xs text-muted-foreground">{m.pct}%</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Content - Por Cartão */}
            {activeTab === "cartao" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por Cartão — Março 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[
                            { name: "💜 Nubank JV", spent: 3500, limit: 8000, color: "#8B5CF6" },
                            { name: "🧡 Inter PJ", spent: 1800, limit: 5000, color: "#F97316" },
                            { name: "🖤 C6 ML", spent: 950, limit: 3000, color: "#1F2937" },
                            { name: "💜 Nubank ML", spent: 650, limit: 4000, color: "#A855F7" },
                        ].map((c, i) => {
                            const pct = (c.spent / c.limit) * 100;
                            return (
                                <div key={i} className="p-3 rounded-lg border border-border/30 bg-background/50 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">{c.name}</span>
                                        <span className="text-xs font-mono" style={{ color: pct > 80 ? "#EF4444" : pct > 60 ? "#F59E0B" : "#10B981" }}>
                                            {pct.toFixed(0)}% do limite
                                        </span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c.color }} />
                                    </div>
                                    <div className="flex justify-between text-[11px] text-muted-foreground">
                                        <span className="font-mono">R$ {c.spent.toLocaleString("pt-BR")} gasto</span>
                                        <span className="font-mono">Limite: R$ {c.limit.toLocaleString("pt-BR")}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Content - Método de Pagamento */}
            {activeTab === "metodo" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por Método de Pagamento — Março 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "💳 Crédito", spent: 4200, pct: 52.2, color: "#8B5CF6" },
                            { name: "💠 Pix", spent: 2100, pct: 26.1, color: "#3B82F6" },
                            { name: "💳 Débito", spent: 950, pct: 11.8, color: "#10B981" },
                            { name: "💵 Espécie", spent: 500, pct: 6.2, color: "#F59E0B" },
                            { name: "🧾 Boleto", spent: 300, pct: 3.7, color: "#EF4444" },
                        ].map((m, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{m.name}</span>
                                    <span className="font-mono text-muted-foreground">
                                        R$ {m.spent.toLocaleString("pt-BR")} ({m.pct}%)
                                    </span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Content - Modo Viagem */}
            {activeTab === "viagem" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Plane className="h-4 w-4 text-sky-400" />
                            Relatório Modo Viagem
                        </CardTitle>
                        <CardDescription className="text-xs">Gastos realizados durante viagens ativas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8">
                            <div className="h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                                <Plane className="h-8 w-8 text-sky-400" />
                            </div>
                            <h3 className="text-base font-semibold mb-1">Nenhuma viagem registrada</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Ative o Modo Viagem na barra lateral para começar a rastrear gastos de viagem separadamente.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Content - Comparativo */}
            {activeTab === "comparativo" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Comparativo Mensal</CardTitle>
                        <CardDescription className="text-xs">Evolução dos gastos nos últimos meses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { month: "Mar/2026", income: 12500, expense: 8050, balance: 4450 },
                                { month: "Fev/2026", income: 11800, expense: 9200, balance: 2600 },
                                { month: "Jan/2026", income: 12500, expense: 7800, balance: 4700 },
                                { month: "Dez/2025", income: 15000, expense: 12300, balance: 2700 },
                                { month: "Nov/2025", income: 11800, expense: 8600, balance: 3200 },
                            ].map((m, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border/30 bg-background/50">
                                    <span className="text-sm font-medium w-24">{m.month}</span>
                                    <div className="flex-1 flex gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                                            <span className="text-xs font-mono text-emerald-500">
                                                R$ {m.income.toLocaleString("pt-BR")}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <TrendingDown className="h-3 w-3 text-red-400" />
                                            <span className="text-xs font-mono text-red-400">
                                                R$ {m.expense.toLocaleString("pt-BR")}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold font-mono ${m.balance >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                        {m.balance >= 0 ? "+" : ""}R$ {m.balance.toLocaleString("pt-BR")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Content - Tendência */}
            {activeTab === "tendencia" && (
                <Card className="border-border/50 bg-card">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <Calendar className="h-7 w-7 text-primary" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Tendência em Análise</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            A análise de tendências requer no mínimo 3 meses de dados. Continue registrando via WhatsApp!
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
