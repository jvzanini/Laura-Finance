import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { ScoreEditor } from "@/components/admin/ScoreEditor";

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Score Financeiro</h1>
                <p className="text-sm text-muted-foreground mt-1">Configuracao dos pesos, thresholds e parametros do calculo</p>
            </div>

            <ScoreEditor
                initialWeights={weights}
                initialThresholds={thresholds}
                initialLookback={typeof lookback === "number" ? lookback : 90}
            />
        </div>
    );
}
