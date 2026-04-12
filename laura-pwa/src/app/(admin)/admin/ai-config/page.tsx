import { fetchAdminConfigAction, fetchAdminPlansAction } from "@/lib/actions/adminConfig";
import { AiConfigEditor } from "./AiConfigEditor";
import { Brain } from "lucide-react";

export default async function AIConfigPage() {
    const [configResult, plansResult] = await Promise.all([
        fetchAdminConfigAction(),
        fetchAdminPlansAction(),
    ]);

    const configList = "configs" in configResult ? (configResult.configs ?? []) : [];
    const configs: Record<string, any> = {};
    for (const c of configList) {
        configs[c.key] = c.value;
    }

    const rawPlans = "plans" in plansResult ? (plansResult.plans ?? []) : [];
    const plans = rawPlans.map((p: any) => ({
        slug: p.slug,
        name: p.name,
        ai_model_config: typeof p.ai_model_config === "string"
            ? JSON.parse(p.ai_model_config)
            : (p.ai_model_config || {}),
    }));

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
