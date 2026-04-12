import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import { Settings } from "lucide-react";

export default async function SystemPage() {
    const result = await fetchAdminConfigAction();
    const configs = "configs" in result ? (result.configs ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sistema</h1>
                    <p className="text-sm text-muted-foreground">Configuracoes gerais, feature flags e manutencao</p>
                </div>
            </div>
            <AdminConfigEditor
                configs={configs}
                filter={["app_name", "registration_enabled", "maintenance_mode", "default_plan", "budget_alert_hour", "score_snapshot_hour"]}
            />
        </div>
    );
}
