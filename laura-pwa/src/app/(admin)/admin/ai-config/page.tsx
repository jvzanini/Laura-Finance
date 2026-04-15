import { fetchAdminConfigAction, fetchAdminPlansAction } from "@/lib/actions/adminConfig";
import { AiConfigEditor } from "./AiConfigEditor";
import { Brain } from "lucide-react";
import type { JsonValue } from "@/types/admin";
import { getField, getString, isObject, isString, toJsonValue } from "@/lib/typeGuards";

export default async function AIConfigPage() {
    const [configResult, plansResult] = await Promise.all([
        fetchAdminConfigAction(),
        fetchAdminPlansAction(),
    ]);

    const configList = "configs" in configResult ? (configResult.configs ?? []) : [];
    const configs: Record<string, JsonValue> = {};
    for (const c of configList) {
        configs[c.key] = toJsonValue(c.value);
    }

    const rawPlans: unknown[] = "plans" in plansResult ? (plansResult.plans ?? []) : [];
    const plans = rawPlans.map((p) => {
        const cfgRaw = getField(p, "ai_model_config");
        let aiCfg: Record<string, JsonValue> = {};
        if (isString(cfgRaw)) {
            try {
                const parsed = JSON.parse(cfgRaw);
                if (isObject(parsed)) aiCfg = parsed as Record<string, JsonValue>;
            } catch { /* noop */ }
        } else if (isObject(cfgRaw)) {
            aiCfg = cfgRaw as Record<string, JsonValue>;
        }
        return {
            slug: getString(p, "slug"),
            name: getString(p, "name"),
            ai_model_config: aiCfg,
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Configuracao de IA</h1>
                    <p className="text-sm text-muted-foreground">
                        API keys, modelos padrao e configuracao por plano
                    </p>
                </div>
            </div>
            <AiConfigEditor configs={configs} plans={plans} />
        </div>
    );
}
