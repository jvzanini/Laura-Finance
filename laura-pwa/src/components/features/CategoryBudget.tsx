"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { addCategoryAction } from "@/lib/actions/categories";
import { Plus, PiggyBank } from "lucide-react";
import type { CategoryBudgetRow } from "@/lib/actions/dashboardMetrics";

function getBarColor(pct: number): string {
    if (pct < 60) return "#10B981";
    if (pct < 80) return "#F59E0B";
    return "#EF4444";
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

export function CategoryBudget({ categories }: { categories: CategoryBudgetRow[] }) {
    const [name, setName] = useState("");
    const [limit, setLimit] = useState("");
    const [color, setColor] = useState("#10B981");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        const fd = new FormData();
        fd.append("name", name);
        fd.append("limit", limit);
        fd.append("color", color);

        startTransition(async () => {
            const res = await addCategoryAction(fd);
            if ("error" in res && res.error) {
                setErrorMsg(res.error);
                return;
            }
            setName("");
            setLimit("");
            setShowForm(false);
            window.location.reload();
        });
    };

    return (
        <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Orçamentos por Categoria</CardTitle>
                        <CardDescription className="text-xs">
                            Alerta automático ao atingir 80% do teto
                        </CardDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowForm(!showForm)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {categories.length === 0 && !showForm && (
                    <div className="h-[160px] flex flex-col items-center justify-center text-center border border-dashed border-border/30 rounded-lg">
                        <PiggyBank className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                            Nenhum orçamento ativo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            Clique no + acima para definir um teto mensal. Depois, cada transação em uma categoria com teto aparece aqui em tempo real.
                        </p>
                    </div>
                )}

                {categories.map((c) => {
                    const pct = c.limit > 0 ? Math.min((c.spent / c.limit) * 100, 100) : 0;
                    const barColor = getBarColor(pct);
                    const isAlert = pct >= 80;
                    return (
                        <div
                            key={c.id}
                            className={`p-3 rounded-lg border border-border/30 bg-background/50 space-y-2 ${isAlert ? "border-red-500/30" : ""}`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: c.color }}
                                    />
                                    <span className="text-sm font-medium">
                                        {c.emoji && <span className="mr-1">{c.emoji}</span>}
                                        {c.name}
                                    </span>
                                </div>
                                <span className="text-xs font-mono font-bold" style={{ color: barColor }}>
                                    {pct.toFixed(0)}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{fmt(c.spent)} gasto</span>
                                <span>Teto: {fmt(c.limit)}</span>
                            </div>
                        </div>
                    );
                })}

                {showForm && (
                    <form
                        onSubmit={handleSave}
                        className="space-y-3 pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Nova Categoria
                        </p>
                        {errorMsg && <p className="text-destructive text-xs">{errorMsg}</p>}
                        <div className="space-y-1">
                            <Label className="text-xs">Nome</Label>
                            <Input
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ex: Lazer"
                                className="h-8 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Teto Mensal (R$)</Label>
                            <Input
                                required
                                placeholder="2000"
                                type="number"
                                step="0.01"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="h-8 text-sm bg-background"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="color"
                                className="w-8 h-8 p-0.5 cursor-pointer rounded"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                            />
                            <Button disabled={isPending} type="submit" size="sm" className="flex-1 h-8 text-xs">
                                {isPending ? "Salvando..." : "Adicionar"}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
