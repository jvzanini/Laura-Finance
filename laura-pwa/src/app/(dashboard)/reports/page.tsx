"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Download, Filter } from "lucide-react";

type Tab = "dre" | "categorias" | "tendencia";

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<Tab>("dre");

    const tabs: { id: Tab; label: string }[] = [
        { id: "dre", label: "DRE Simplificada" },
        { id: "categorias", label: "Por Categoria" },
        { id: "tendencia", label: "Tendência" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Análises financeiras detalhadas para tomada de decisão.
                    </p>
                </div>
                <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/50">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${activeTab === t.id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <input type="month" defaultValue="2026-03" className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground" />
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Membros</option>
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="pf">Pessoa Física</option>
                    <option value="pj">Pessoa Jurídica</option>
                </select>
            </div>

            {/* Content */}
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
                            ].map((row, i) => (
                                <div key={i} className={`flex justify-between items-center py-2.5 px-3 rounded-lg ${row.bold ? "bg-background/50 border border-border/30" : "hover:bg-accent/30"}`}>
                                    <span className={`text-sm ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</span>
                                    <span className={`text-sm font-mono font-medium ${row.color}`}>{row.value}</span>
                                </div>
                            ))}
                            {/* Total */}
                            <div className="flex justify-between items-center py-3 px-3 rounded-lg bg-primary/10 border border-primary/20 mt-2">
                                <span className="text-sm font-bold text-primary">(=) Resultado Líquido</span>
                                <span className="text-lg font-mono font-bold text-primary">R$ 4.450,00</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === "categorias" && (
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Gastos por Categoria — Março 2026</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "Alimentação", spent: 1800, pct: 35, color: "#10B981" },
                            { name: "Aluguel", spent: 2500, pct: 48, color: "#3B82F6" },
                            { name: "Transporte", spent: 620, pct: 12, color: "#F59E0B" },
                            { name: "Lazer", spent: 430, pct: 8, color: "#8B5CF6" },
                        ].map((c, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                    <span className="font-mono text-muted-foreground">R$ {c.spent.toLocaleString("pt-BR")} ({c.pct}%)</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {activeTab === "tendencia" && (
                <Card className="border-border/50 bg-card">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <BarChart3 className="h-7 w-7 text-primary" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Tendência em Construção</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            A análise de tendências requer no mínimo 3 meses de dados históricos. Continue registrando via WhatsApp!
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
