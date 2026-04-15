import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { ScoreEditor } from "@/components/admin/ScoreEditor";
import type { JsonValue } from "@/types/admin";
import { getNumber } from "@/lib/typeGuards";

type Weights = { billsOnTime: number; budgetRespect: number; savingsRate: number; debtLevel: number };
type Thresholds = { excellent: number; good: number; fair: number };

export default async function ScoringPage() {
    const result = await fetchAdminConfigAction();
    const configs = "configs" in result ? (result.configs ?? []) : [];

    const getConfig = (key: string, fallback: JsonValue = null): JsonValue => {
        const found = configs.find((c: { key: string; value: JsonValue }) => c.key === key);
        if (!found) return fallback;
        if (typeof found.value === "string") {
            try { return JSON.parse(found.value) as JsonValue; } catch { return fallback; }
        }
        return found.value;
    };

    const weightsRaw = getConfig("score_weights", { billsOnTime: 0.35, budgetRespect: 0.25, savingsRate: 0.25, debtLevel: 0.15 });
    const thresholdsRaw = getConfig("score_thresholds", { excellent: 80, good: 60, fair: 40 });
    const lookback = getConfig("score_lookback_days", 90);

    const weights: Weights = {
        billsOnTime: getNumber(weightsRaw, "billsOnTime", 0.35),
        budgetRespect: getNumber(weightsRaw, "budgetRespect", 0.25),
        savingsRate: getNumber(weightsRaw, "savingsRate", 0.25),
        debtLevel: getNumber(weightsRaw, "debtLevel", 0.15),
    };
    const thresholds: Thresholds = {
        excellent: getNumber(thresholdsRaw, "excellent", 80),
        good: getNumber(thresholdsRaw, "good", 60),
        fair: getNumber(thresholdsRaw, "fair", 40),
    };
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
