import { GoalTemplatesEditor } from "@/components/admin/GoalTemplatesEditor";
import { pool } from "@/lib/db";
import { assertSuperAdmin } from "@/lib/actions/admin";

export default async function GoalTemplatesPage() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return <p className="text-red-400 p-4">Sem permissao</p>;

    const result = await pool.query(
        "SELECT id, name, emoji, description, default_target_cents, color, sort_order, active FROM goal_templates ORDER BY sort_order, name"
    );
    const templates = result.rows;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Templates de Objetivos</h1>
                <p className="text-sm text-muted-foreground mt-1">Presets de metas financeiras que aparecem na tela /goals do usuario</p>
            </div>

            <GoalTemplatesEditor templates={templates} />
        </div>
    );
}
