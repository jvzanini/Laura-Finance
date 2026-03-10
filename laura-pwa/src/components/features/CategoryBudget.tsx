"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { addCategoryAction } from "@/lib/actions/categories";

export function CategoryBudget() {
    const [name, setName] = useState("");
    const [limit, setLimit] = useState("");
    const [color, setColor] = useState("#10B981");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Mock internal state just for preview visually in the UI logic without server reload sync complexity yet
    const [mockCategories, setMockCategories] = useState([
        { name: "Supermercado", limit: 2000, color: "#10B981" },
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
            setMockCategories([...mockCategories, { name, limit: parseFloat(limit), color }]);
            setName("");
            setLimit("");
        }
    };

    return (
        <Card className="col-span-3 bg-card h-fit">
            <CardHeader>
                <CardTitle>Categorias e Orçamentos</CardTitle>
                <CardDescription>Estipule limites fixos para os &quot;Nudges&quot; de 80%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Categories List Visuals */}
                <div className="space-y-4">
                    {mockCategories.map((c, i) => (
                        <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                    <span className="font-medium text-white">{c.name}</span>
                                </div>
                                <span className="text-muted-foreground">R$ 0 / R$ {c.limit}</span>
                            </div>
                            <Progress value={0} className="h-2" />
                        </div>
                    ))}
                </div>

                {/* Add Form */}
                <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-border">
                    <p className="text-sm font-semibold">Nova Caçamba</p>
                    {errorMsg && <p className="text-destructive text-sm">{errorMsg}</p>}
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <Label>Nome (ex: Lazer)</Label>
                            <Input required value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Teto Fixo R$</Label>
                            <Input required placeholder="2000.00" type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Input type="color" className="w-10 h-10 p-1 cursor-pointer" value={color} onChange={(e) => setColor(e.target.value)} />
                            <Button disabled={loading} type="submit" className="flex-1">
                                {loading ? "Gravando Teto..." : "Adicionar Categoria Fixa"}
                            </Button>
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
