"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Plane, Car, Home, Smartphone, PiggyBank, GraduationCap, Heart, Trophy, X } from "lucide-react";

type Goal = {
    id: string;
    name: string;
    icon: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    description: string;
    color: string;
};

const PRESET_GOALS = [
    { name: "Viagem", icon: "✈️", color: "#3B82F6" },
    { name: "Carro", icon: "🚗", color: "#10B981" },
    { name: "Casa Própria", icon: "🏠", color: "#F59E0B" },
    { name: "iPhone / Eletrônicos", icon: "📱", color: "#8B5CF6" },
    { name: "Fundo de Emergência", icon: "🐷", color: "#EF4444" },
    { name: "Educação", icon: "🎓", color: "#06B6D4" },
    { name: "Casamento", icon: "💍", color: "#EC4899" },
    { name: "Investimento Inicial", icon: "🏆", color: "#F97316" },
];

const MOCK_GOALS: Goal[] = [
    {
        id: "1", name: "Viagem para Europa", icon: "✈️",
        targetAmount: 2500000, currentAmount: 1820000,
        deadline: "2026-12-15", description: "Viagem de 15 dias pela Europa com a Maria Laura",
        color: "#3B82F6",
    },
    {
        id: "2", name: "Fundo de Emergência", icon: "🐷",
        targetAmount: 5000000, currentAmount: 3250000,
        deadline: "2027-06-01", description: "Reserva de 6 meses de gastos essenciais",
        color: "#EF4444",
    },
    {
        id: "3", name: "MacBook Pro", icon: "📱",
        targetAmount: 1800000, currentAmount: 450000,
        deadline: "2026-08-01", description: "MacBook Pro M4 para produtividade",
        color: "#8B5CF6",
    },
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function GoalCard({ goal }: { goal: Goal }) {
    const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
    const remaining = goal.targetAmount - goal.currentAmount;
    const deadlineDate = new Date(goal.deadline);
    const now = new Date();
    const monthsLeft = Math.max(
        (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth()),
        1
    );
    const monthlyNeeded = remaining > 0 ? remaining / monthsLeft : 0;

    return (
        <Card className="border-border/50 bg-card hover:border-border transition-all duration-300 group overflow-hidden">
            <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                    <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg"
                        style={{ backgroundColor: `${goal.color}15`, boxShadow: `0 4px 16px ${goal.color}15` }}
                    >
                        {goal.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold truncate">{goal.name}</h3>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{goal.description}</p>
                    </div>
                    <span
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ color: goal.color, backgroundColor: `${goal.color}15` }}
                    >
                        {pct.toFixed(0)}%
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden mb-3">
                    <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${goal.color}, ${goal.color}CC)`,
                            boxShadow: `0 0 8px ${goal.color}40`,
                        }}
                    />
                </div>

                {/* Values */}
                <div className="flex justify-between text-[11px] text-muted-foreground mb-3">
                    <span className="font-mono">{fmt(goal.currentAmount)} acumulado</span>
                    <span className="font-mono">{fmt(goal.targetAmount)} meta</span>
                </div>

                {/* Monthly guide */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/80 border border-border/30">
                    <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground">Guardar por mês</p>
                        <p className="text-sm font-bold font-mono" style={{ color: goal.color }}>
                            {fmt(monthlyNeeded)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Prazo</p>
                        <p className="text-xs font-medium">
                            {deadlineDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function GoalsPage() {
    const [goals] = useState(MOCK_GOALS);
    const [showForm, setShowForm] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [goalName, setGoalName] = useState("");
    const [goalTarget, setGoalTarget] = useState("");
    const [goalDeadline, setGoalDeadline] = useState("");
    const [goalDesc, setGoalDesc] = useState("");

    const handlePresetSelect = (preset: typeof PRESET_GOALS[0]) => {
        setSelectedPreset(preset.name);
        setGoalName(preset.name);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Target className="h-6 w-6 text-primary" />
                        Objetivos Financeiros
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Defina metas e acompanhe seu progresso rumo à conquista.
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
                    {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showForm ? "Cancelar" : "Novo Objetivo"}
                </Button>
            </div>

            {/* Create Goal Form */}
            {showForm && (
                <Card className="border-primary/20 bg-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Criar Novo Objetivo</CardTitle>
                        <CardDescription className="text-xs">
                            Escolha um template ou personalize do zero.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Preset Templates */}
                        <div>
                            <Label className="text-xs mb-2 block">Templates Rápidos</Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_GOALS.map((p) => (
                                    <button
                                        key={p.name}
                                        onClick={() => handlePresetSelect(p)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                            selectedPreset === p.name
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border/50 bg-background hover:border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <span>{p.icon}</span>
                                        <span>{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Nome do Objetivo</Label>
                                <Input
                                    value={goalName}
                                    onChange={(e) => setGoalName(e.target.value)}
                                    placeholder="Ex: Viagem para Gramado"
                                    className="h-9 bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Valor da Meta (R$)</Label>
                                <Input
                                    type="number"
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    placeholder="15000.00"
                                    className="h-9 bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Prazo</Label>
                                <Input
                                    type="date"
                                    value={goalDeadline}
                                    onChange={(e) => setGoalDeadline(e.target.value)}
                                    className="h-9 bg-background"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Descrição (opcional)</Label>
                                <Input
                                    value={goalDesc}
                                    onChange={(e) => setGoalDesc(e.target.value)}
                                    placeholder="Breve descrição..."
                                    className="h-9 bg-background"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                                Cancelar
                            </Button>
                            <Button size="sm">Criar Objetivo</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Acumulado</p>
                        <p className="text-xl font-bold font-mono text-emerald-500">
                            {fmt(goals.reduce((s, g) => s + g.currentAmount, 0))}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Meta Total</p>
                        <p className="text-xl font-bold font-mono text-primary">
                            {fmt(goals.reduce((s, g) => s + g.targetAmount, 0))}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Objetivos Ativos</p>
                        <p className="text-xl font-bold font-mono">{goals.length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Goals Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {goals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                ))}
            </div>
        </div>
    );
}
