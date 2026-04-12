import { fetchAdminPlansAction } from "@/lib/actions/adminConfig";
import { CreditCard, Check, X, Sparkles } from "lucide-react";

export default async function PlansPage() {
    const result = await fetchAdminPlansAction();
    const plans = "plans" in result ? (result.plans ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Planos de Assinatura</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie planos Standard e VIP, capabilities e limites</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {plans.map((plan: any) => {
                    const capabilities = typeof plan.capabilities === "string" ? JSON.parse(plan.capabilities) : (plan.capabilities || {});
                    const limits = typeof plan.limits === "string" ? JSON.parse(plan.limits) : (plan.limits || {});
                    const aiConfig = typeof plan.ai_model_config === "string" ? JSON.parse(plan.ai_model_config) : (plan.ai_model_config || {});
                    const features: string[] = typeof plan.features_description === "string" ? JSON.parse(plan.features_description) : (plan.features_description || []);
                    const isVip = plan.slug === "vip";
                    const priceFormatted = plan.price_cents != null
                        ? (plan.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "Gratis";

                    return (
                        <div key={plan.id || plan.slug} className={`rounded-xl border bg-card p-6 flex flex-col gap-5 ${isVip ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-border/50"}`}>
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isVip ? "bg-amber-500/15" : "bg-primary/10"}`}>
                                        {isVip ? <Sparkles className="h-5 w-5 text-amber-400" /> : <CreditCard className="h-5 w-5 text-primary" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{plan.name}</p>
                                        <p className="font-mono text-xs text-muted-foreground">{plan.slug}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-2xl font-bold ${isVip ? "text-amber-400" : "text-foreground"}`}>{priceFormatted}</p>
                                    <p className="text-[10px] text-muted-foreground">/mes</p>
                                </div>
                            </div>

                            {/* Status */}
                            <span className={`self-start text-[10px] px-2 py-0.5 rounded font-medium ${plan.active !== false ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                {plan.active !== false ? "Ativo" : "Inativo"}
                            </span>

                            {/* Capabilities */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Capabilities</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {["text", "audio", "image", "document"].map((cap) => (
                                        <div key={cap} className="flex items-center gap-2 text-sm">
                                            {capabilities[cap] ? (
                                                <Check className="h-4 w-4 text-emerald-400" />
                                            ) : (
                                                <X className="h-4 w-4 text-zinc-600" />
                                            )}
                                            <span className={capabilities[cap] ? "text-foreground" : "text-zinc-600"}>{cap}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Limits */}
                            {Object.keys(limits).length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Limites</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {Object.entries(limits).map(([key, val]) => (
                                            <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                                                <span className="text-muted-foreground text-xs">{key.replace(/_/g, " ")}</span>
                                                <span className="font-mono font-semibold text-xs">{val === -1 || val === null ? "Ilimitado" : String(val)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AI Model */}
                            {Object.keys(aiConfig).length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Modelo IA</p>
                                    <div className="rounded-lg border border-border/30 bg-background/50 p-3 space-y-1">
                                        {Object.entries(aiConfig).map(([key, val]) => (
                                            <div key={key} className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                                                <span className="font-mono font-medium">{String(val)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Features */}
                            {features.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Features</p>
                                    <ul className="space-y-1">
                                        {features.map((f: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {plans.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                    <p className="text-muted-foreground">Nenhum plano cadastrado</p>
                </div>
            )}
        </div>
    );
}
