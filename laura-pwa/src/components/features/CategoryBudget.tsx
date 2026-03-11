"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { addCategoryAction } from "@/lib/actions/categories";
import { Plus } from "lucide-react";

type CategoryItem = {
    name: string;
    limit: number;
    spent: number;
    color: string;
};

function getProgressColor(pct: number): string {
    if (pct < 60) return "text-emerald-500";
    if (pct < 80) return "text-amber-500";
    return "text-red-500";
}

function getBarBg(pct: number): string {
    if (pct < 60) return "[&>div]:bg-emerald-500";
    if (pct < 80) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-red-500";
}

export function CategoryBudget() {
    const [name, setName] = useState("");
    const [limit, setLimit] = useState("");
    const [color, setColor] = useState("#10B981");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [categories, setCategories] = useState<CategoryItem[]>([
        { name: "Alimentação", limit: 2000, spent: 850, color: "#10B981" },
        { name: "Transporte", limit: 800, spent: 620, color: "#3B82F6" },
        { name: "Lazer", limit: 500, spent: 430, color: "#F59E0B" },
    ]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        const fd = new FormData();
        fd.append("name", name);
        fd.append("limit", limit);
        fd.append("color", color);

        const res = await addCategoryAction(fd);
        setLoading(false);

        if (res.error) {
            setErrorMsg(res.error);
        } else {
            setCategories([...categories, { name, limit: parseFloat(limit), spent: 0, color }]);
            setName("");
            setLimit("");
            setShowForm(false);
        }
    };

    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

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
            <CardContent className="space-y-4">
                {categories.map((c, i) => {
                    const pct = Math.min((c.spent / c.limit) * 100, 100);
                    const isAlert = pct >= 80;
                    return (
                        <div key={i} className={`space-y-2 p-3 rounded-lg border border-border/30 bg-background/50 ${isAlert ? "animate-pulse border-amber-500/30" : ""}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: c.color }}
                                    />
                                    <span className="text-sm font-medium">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-mono font-bold ${getProgressColor(pct)}`}>
                                        {pct.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <Progress value={pct} className={`h-1.5 bg-muted ${getBarBg(pct)}`} />
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{fmt(c.spent)} gasto</span>
                                <span>Teto: {fmt(c.limit)}</span>
                            </div>
                        </div>
                    );
                })}

                {/* Add Form */}
                {showForm && (
                    <form onSubmit={handleSave} className="space-y-3 pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Categoria</p>
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
                            <Button disabled={loading} type="submit" size="sm" className="flex-1 h-8 text-xs">
                                {loading ? "Salvando..." : "Adicionar"}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
