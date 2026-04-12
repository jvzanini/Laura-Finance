import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { BarChart3, Clock, Target, TrendingUp, Shield } from "lucide-react";

export default async function ScoringPage() {
    const result = await fetchAdminConfigAction();
    const configs = "configs" in result ? (result.configs ?? []) : [];

    const getConfig = (key: string, fallback: any = null) => {
        const found = configs.find((c: any) => c.key === key);
        return found ? (typeof found.value === "string" ? JSON.parse(found.value) : found.value) : fallback;
    };

    const weights = getConfig("score_weights", { billsOnTime: 0.35, budgetRespect: 0.25, savingsRate: 0.25, debtLevel: 0.15 });
    const thresholds = getConfig("score_thresholds", { excellent: 80, good: 60, fair: 40 });
    const lookback = getConfig("score_lookback_days", 90);
    const confidence = getConfig("nlp_confidence_threshold", 0.85);

    const factors = [
        { key: "billsOnTime", label: "Faturas em Dia", icon: Clock, color: "text-emerald-400", description: "% de faturas pagas antes do vencimento" },
        { key: "budgetRespect", label: "Respeito ao Orcamento", icon: Target, color: "text-blue-400", description: "% de categorias dentro do teto" },
        { key: "savingsRate", label: "Taxa de Poupanca", icon: TrendingUp, color: "text-amber-400", description: "% da receita nao gasta" },
        { key: "debtLevel", label: "Nivel de Divida", icon: Shield, color: "text-red-400", description: "Inverso do % comprometido com dividas" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Score Financeiro</h1>
                <p className="text-sm text-muted-foreground mt-1">Configuracao dos pesos, thresholds e parametros do calculo</p>
            </div>

            {/* Weights */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Pesos dos Fatores</h2>
                    <span className="ml-auto text-xs text-muted-foreground">Total: {Math.round(Object.values(weights as Record<string, number>).reduce((a: number, b: number) => a + b, 0) * 100)}%</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {factors.map((f) => {
                        const weight = (weights as Record<string, number>)[f.key] || 0;
                        const pct = Math.round(weight * 100);
                        return (
                            <div key={f.key} className="rounded-lg border border-border/30 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <f.icon className={`h-4 w-4 ${f.color}`} />
                                    <span className="text-sm font-medium">{f.label}</span>
                                    <span className="ml-auto font-mono text-lg font-bold">{pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full rounded-full bg-primary`} style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{f.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Thresholds + Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-card p-5">
                    <h3 className="font-semibold mb-4">Classificacao do Score</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                            <span className="text-sm font-medium text-emerald-400">Excelente</span>
                            <span className="font-mono text-sm">&gt;= {thresholds.excellent}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                            <span className="text-sm font-medium text-blue-400">Bom</span>
                            <span className="font-mono text-sm">&gt;= {thresholds.good}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                            <span className="text-sm font-medium text-amber-400">Regular</span>
                            <span className="font-mono text-sm">&gt;= {thresholds.fair}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                            <span className="text-sm font-medium text-red-400">Critico</span>
                            <span className="font-mono text-sm">&lt; {thresholds.fair}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-5">
                    <h3 className="font-semibold mb-4">Parametros</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                            <div>
                                <p className="text-sm font-medium">Lookback Period</p>
                                <p className="text-[10px] text-muted-foreground">Janela de analise para calculo</p>
                            </div>
                            <span className="font-mono text-lg font-bold text-primary">{lookback} dias</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                            <div>
                                <p className="text-sm font-medium">Confianca NLP</p>
                                <p className="text-[10px] text-muted-foreground">Minimo para auto-classificar transacao</p>
                            </div>
                            <span className="font-mono text-lg font-bold text-primary">{Math.round(confidence * 100)}%</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4">Editavel via system_config no banco. Endpoint: PUT /api/v1/admin/config/:key</p>
                </div>
            </div>
        </div>
    );
}
