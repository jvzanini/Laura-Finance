"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag, ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import { seedCategoriesAction } from "@/lib/actions/categories";
import { DEFAULT_SEED_CATEGORIES } from "./default-seed";

export type Subcategory = {
    id: string;
    name: string;
    emoji: string;
    description: string;
};

export type Category = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description: string;
    monthlyLimit: number;
    subcategories: Subcategory[];
};

export function CategoriesView({ categories }: { categories: Category[] }) {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [isSeeding, startTransition] = useTransition();
    const [seedError, setSeedError] = useState<string | null>(null);

    const toggleCategory = (id: string) => {
        setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSeed = () => {
        setSeedError(null);
        startTransition(async () => {
            const res = await seedCategoriesAction(DEFAULT_SEED_CATEGORIES);
            if ("error" in res && res.error) {
                setSeedError(res.error);
            } else {
                // Revalidation dispara re-render com as categorias reais
                window.location.reload();
            }
        });
    };

    const isEmpty = categories.length === 0;
    const totalSub = categories.reduce((s, c) => s + c.subcategories.length, 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Tag className="h-6 w-6 text-primary" />
                        Categorias & Subcategorias
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Organize seus gastos por categorias para relatórios detalhados.
                    </p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Categorias</p>
                        <p className="text-2xl font-bold font-mono text-primary">{categories.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Subcategorias</p>
                        <p className="text-2xl font-bold font-mono">{totalSub}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Cobertura</p>
                        <p className="text-2xl font-bold font-mono text-emerald-500">
                            {isEmpty ? "—" : "100%"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Empty state */}
            {isEmpty && (
                <Card className="border-dashed border-2 border-primary/30 bg-card">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Sparkles className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <p className="text-base font-bold">Workspace ainda sem categorias</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Popule seu workspace com as 8 categorias padrão e 36 subcategorias
                                para começar a rastrear gastos organizados imediatamente.
                            </p>
                        </div>
                        {seedError && (
                            <p className="text-xs text-destructive">{seedError}</p>
                        )}
                        <Button onClick={handleSeed} disabled={isSeeding}>
                            {isSeeding ? "Populando..." : "Popular categorias padrão"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Categories List */}
            {!isEmpty && (
                <div className="space-y-3">
                    {categories.map((cat) => {
                        const isExpanded = expandedCategories[cat.id] || false;
                        return (
                            <Card key={cat.id} className="border-border/50 bg-card overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(cat.id)}
                                    className="w-full p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors text-left"
                                >
                                    <div
                                        className="h-11 w-11 rounded-xl flex items-center justify-center text-lg shrink-0"
                                        style={{ backgroundColor: `${cat.color}15` }}
                                    >
                                        {cat.emoji}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold">{cat.name}</p>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground font-medium">
                                                {cat.subcategories.length} sub
                                            </span>
                                            {cat.monthlyLimit > 0 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                                    R$ {cat.monthlyLimit.toFixed(0)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                                    </div>
                                    <div
                                        className="h-3 w-3 rounded-full shrink-0"
                                        style={{ backgroundColor: cat.color }}
                                    />
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                </button>

                                {isExpanded && cat.subcategories.length > 0 && (
                                    <div className="border-t border-border/30 bg-background/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {cat.subcategories.map((sub) => (
                                            <div
                                                key={sub.id}
                                                className="flex items-center gap-3 px-6 py-3 hover:bg-accent/20 transition-colors border-b border-border/10 last:border-b-0"
                                            >
                                                <span className="text-base shrink-0">{sub.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium">{sub.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{sub.description}</p>
                                                </div>
                                                <div
                                                    className="h-2 w-2 rounded-full shrink-0 opacity-40"
                                                    style={{ backgroundColor: cat.color }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
