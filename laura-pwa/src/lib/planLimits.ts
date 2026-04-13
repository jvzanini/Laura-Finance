import { pool } from "@/lib/db";

type PlanLimits = {
    max_members: number;
    max_cards: number;
    max_transactions_month: number;
    advanced_reports: boolean;
};

const DEFAULT_LIMITS: PlanLimits = {
    max_members: 3,
    max_cards: 5,
    max_transactions_month: 200,
    advanced_reports: false,
};

export async function getPlanLimits(workspaceId: string): Promise<PlanLimits> {
    try {
        const res = await pool.query(
            `SELECT sp.limits
             FROM workspaces w
             JOIN subscription_plans sp ON sp.slug = COALESCE(w.plan_slug, 'standard')
             WHERE w.id = $1 AND sp.active = true`,
            [workspaceId]
        );
        if (res.rowCount && res.rowCount > 0) {
            const raw = res.rows[0].limits;
            return typeof raw === "string" ? JSON.parse(raw) : raw;
        }
    } catch { /* fallback */ }
    return DEFAULT_LIMITS;
}

const ALLOWED_TABLES = new Set(["cards", "phones", "categories", "members", "financial_goals", "investments"]);

export async function checkLimit(
    workspaceId: string,
    limitKey: "max_members" | "max_cards",
    table: string
): Promise<{ allowed: boolean; current: number; max: number }> {
    if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Tabela não permitida: ${table}`);
    }
    const limits = await getPlanLimits(workspaceId);
    const max = limits[limitKey];

    const countRes = await pool.query(
        `SELECT COUNT(*)::int as count FROM ${table} WHERE workspace_id = $1`,
        [workspaceId]
    );
    const current = countRes.rows[0]?.count || 0;

    return { allowed: current < max, current, max };
}
