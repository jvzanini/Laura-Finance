import { fetchAdminGoalTemplatesAction } from "@/lib/actions/adminConfig";
import { AdminOptionsCrud } from "@/components/admin/AdminOptionsCrud";

export default async function GoalTemplatesPage() {
    const result = await fetchAdminGoalTemplatesAction();
    const templates = "items" in result ? (result.items ?? []) : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Templates de Objetivos</h1>
                <p className="text-sm text-muted-foreground mt-1">Presets de metas financeiras que aparecem na tela /goals do usuario</p>
            </div>

            <AdminOptionsCrud
                resource="goal-templates"
                items={templates}
                title="Objetivos"
                iconName="Target"
                fields={[
                    { name: "name", label: "Nome", placeholder: "Ex: Viagem", required: true },
                    { name: "emoji", label: "Emoji", placeholder: "✈️" },
                    { name: "color", label: "Cor", placeholder: "#3B82F6" },
                ]}
            />
        </div>
    );
}
