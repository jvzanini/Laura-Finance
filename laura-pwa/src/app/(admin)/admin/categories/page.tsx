import { fetchAdminCategoryTemplatesAction } from "@/lib/actions/adminConfig";
import { Tag } from "lucide-react";

export default async function CategoriesPage() {
    const result = await fetchAdminCategoryTemplatesAction();
    const templates = "templates" in result ? (result.templates ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Templates de Categorias</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {templates.length} categoria{templates.length !== 1 ? "s" : ""} padrao para novos workspaces
                    </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Tag className="h-5 w-5 text-primary" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((cat: any) => {
                    const subcategories: any[] = typeof cat.subcategories === "string" ? JSON.parse(cat.subcategories) : (cat.subcategories || []);

                    return (
                        <div key={cat.id || cat.name} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">{cat.emoji || "📁"}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{cat.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {cat.color && (
                                                <div className="flex items-center gap-1">
                                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                                    <span className="text-[10px] font-mono text-muted-foreground">{cat.color}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${cat.active !== false ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                            {cat.active !== false ? "Ativo" : "Inativo"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{subcategories.length} sub</span>
                                    </div>
                                </div>
                            </div>

                            {subcategories.length > 0 && (
                                <div className="border-t border-border/30 bg-muted/20 px-5 py-3">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subcategorias</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {subcategories.map((sub: any, i: number) => {
                                            const subName = typeof sub === "string" ? sub : sub.name;
                                            const subEmoji = typeof sub === "object" ? sub.emoji : null;
                                            return (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-background/80 border border-border/30 text-muted-foreground">
                                                    {subEmoji && <span>{subEmoji}</span>}
                                                    {subName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {templates.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                    <p className="text-muted-foreground">Nenhum template de categoria cadastrado</p>
                </div>
            )}
        </div>
    );
}
