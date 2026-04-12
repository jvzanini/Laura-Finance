import { fetchAdminGoalTemplatesAction } from "@/lib/actions/adminConfig";
import { Target } from "lucide-react";

export default async function GoalTemplatesPage() {
    const result = await fetchAdminGoalTemplatesAction();
    const templates = "items" in result ? (result.items ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Templates de Objetivos</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {templates.length} template{templates.length !== 1 ? "s" : ""} cadastrado{templates.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {templates.map((t: any) => {
                    const targetFormatted = t.default_target_cents
                        ? (t.default_target_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : null;

                    return (
                        <div key={t.id || t.name} className="rounded-xl border border-border/50 bg-card p-5 flex flex-col items-center gap-3">
                            <span className="text-4xl">{t.emoji || "🎯"}</span>
                            <p className="font-semibold text-center">{t.name}</p>
                            <div className="flex items-center gap-2">
                                {t.color && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                                        <span className="text-[10px] font-mono text-muted-foreground">{t.color}</span>
                                    </div>
                                )}
                            </div>
                            {targetFormatted && (
                                <p className="text-xs text-muted-foreground">Meta padrao: <span className="font-semibold text-foreground">{targetFormatted}</span></p>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${t.active !== false ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                {t.active !== false ? "Ativo" : "Inativo"}
                            </span>
                        </div>
                    );
                })}
            </div>

            {templates.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                    <p className="text-muted-foreground">Nenhum template de objetivo cadastrado</p>
                </div>
            )}
        </div>
    );
}
