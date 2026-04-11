"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * assertSuperAdmin valida que a sessão pertence a um usuário com
 * is_super_admin = TRUE. Retorna { ok: true } ou { error }. Usado
 * como gate em toda action do painel /admin/*.
 */
export async function assertSuperAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session || !session.userId) return { ok: false, error: "Sem sessão ativa." };

    const res = await pool.query(
        "SELECT is_super_admin FROM users WHERE id = $1 LIMIT 1",
        [session.userId]
    );
    if (res.rowCount === 0) return { ok: false, error: "Usuário não encontrado." };
    if (!res.rows[0].is_super_admin) {
        return { ok: false, error: "Acesso negado: requer privilégios de super admin." };
    }
    return { ok: true };
}

/**
 * isSuperAdminFast retorna apenas boolean, usado no layout server
 * component para decidir se mostra o link /admin no sidebar.
 */
export async function isSuperAdminAction(): Promise<boolean> {
    const gate = await assertSuperAdmin();
    return gate.ok;
}

export type AdminOverview = {
    totalWorkspaces: number;
    totalUsers: number;
    totalCards: number;
    unverifiedUsers: number;

    // Crise feature (debt_rollovers)
    totalRollovers: number;
    rolloversThisMonth: number;
    volumeRolledCents: number;          // sum de invoice_value_cents all-time
    volumeRolledThisMonthCents: number; // deste mês
    totalFeesPaidCents: number;          // all-time
    avgFeePercentage: number;            // média simples

    // Atividade
    transactionsThisMonth: number;
    expensesThisMonthCents: number;
    incomeThisMonthCents: number;
};

/**
 * fetchAdminOverviewAction retorna um conjunto de agregados para o
 * header do /admin. Uma query única com FILTER para performance.
 */
export async function fetchAdminOverviewAction(): Promise<AdminOverview | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: gate.error };

    try {
        const client = await pool.connect();
        try {
            const res = await client.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM workspaces) AS total_workspaces,
                    (SELECT COUNT(*)::int FROM users) AS total_users,
                    (SELECT COUNT(*)::int FROM cards) AS total_cards,
                    (SELECT COUNT(*)::int FROM users WHERE email_verified = FALSE) AS unverified_users,

                    (SELECT COUNT(*)::int FROM debt_rollovers) AS total_rollovers,
                    (SELECT COUNT(*)::int FROM debt_rollovers
                     WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS rollovers_this_month,
                    (SELECT COALESCE(SUM(invoice_value_cents), 0)::bigint FROM debt_rollovers) AS volume_rolled_cents,
                    (SELECT COALESCE(SUM(invoice_value_cents), 0)::bigint FROM debt_rollovers
                     WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS volume_rolled_this_month_cents,
                    (SELECT COALESCE(SUM(total_fees_cents), 0)::bigint FROM debt_rollovers) AS total_fees_paid_cents,
                    (SELECT COALESCE(AVG(fee_percentage), 0)::numeric(5,2) FROM debt_rollovers) AS avg_fee_percentage,

                    (SELECT COUNT(*)::int FROM transactions
                     WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)) AS transactions_this_month,
                    (SELECT COALESCE(SUM(amount), 0)::bigint FROM transactions
                     WHERE type = 'expense' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)) AS expenses_this_month_cents,
                    (SELECT COALESCE(SUM(amount), 0)::bigint FROM transactions
                     WHERE type = 'income' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)) AS income_this_month_cents
                `
            );
            const r = res.rows[0];
            return {
                totalWorkspaces: Number(r.total_workspaces),
                totalUsers: Number(r.total_users),
                totalCards: Number(r.total_cards),
                unverifiedUsers: Number(r.unverified_users),
                totalRollovers: Number(r.total_rollovers),
                rolloversThisMonth: Number(r.rollovers_this_month),
                volumeRolledCents: Number(r.volume_rolled_cents),
                volumeRolledThisMonthCents: Number(r.volume_rolled_this_month_cents),
                totalFeesPaidCents: Number(r.total_fees_paid_cents),
                avgFeePercentage: Number(r.avg_fee_percentage),
                transactionsThisMonth: Number(r.transactions_this_month),
                expensesThisMonthCents: Number(r.expenses_this_month_cents),
                incomeThisMonthCents: Number(r.income_this_month_cents),
            };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchAdminOverviewAction error:", err);
        return { error: "Erro ao agregar métricas." };
    }
}

export type TopWorkspaceByRollover = {
    workspaceId: string;
    workspaceName: string;
    rolloverCount: number;
    volumeCents: number;
    feesCents: number;
};

export async function fetchTopWorkspacesByRolloverAction(limit = 10): Promise<TopWorkspaceByRollover[] | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: gate.error };

    try {
        const res = await pool.query(
            `SELECT dr.workspace_id,
                    COALESCE(w.name, '(deletado)') AS workspace_name,
                    COUNT(*)::int AS rollover_count,
                    COALESCE(SUM(dr.invoice_value_cents), 0)::bigint AS volume_cents,
                    COALESCE(SUM(dr.total_fees_cents), 0)::bigint AS fees_cents
             FROM debt_rollovers dr
             LEFT JOIN workspaces w ON w.id = dr.workspace_id
             GROUP BY dr.workspace_id, w.name
             ORDER BY volume_cents DESC
             LIMIT $1`,
            [limit]
        );
        return res.rows.map((r) => ({
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
            rolloverCount: Number(r.rollover_count),
            volumeCents: Number(r.volume_cents),
            feesCents: Number(r.fees_cents),
        }));
    } catch (err) {
        console.error("fetchTopWorkspacesByRolloverAction error:", err);
        return { error: "Erro ao agregar top workspaces." };
    }
}

export type ProcessorUsage = {
    institution: string;
    rolloverCount: number;
    volumeCents: number;
    feesCents: number;
    avgFeePercentage: number;
};

export async function fetchProcessorUsageAction(): Promise<ProcessorUsage[] | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: gate.error };

    try {
        const res = await pool.query(
            `SELECT institution,
                    COUNT(*)::int AS rollover_count,
                    COALESCE(SUM(invoice_value_cents), 0)::bigint AS volume_cents,
                    COALESCE(SUM(total_fees_cents), 0)::bigint AS fees_cents,
                    COALESCE(AVG(fee_percentage), 0)::numeric(5,2) AS avg_fee_percentage
             FROM debt_rollovers
             GROUP BY institution
             ORDER BY rollover_count DESC`
        );
        return res.rows.map((r) => ({
            institution: r.institution,
            rolloverCount: Number(r.rollover_count),
            volumeCents: Number(r.volume_cents),
            feesCents: Number(r.fees_cents),
            avgFeePercentage: Number(r.avg_fee_percentage),
        }));
    } catch (err) {
        console.error("fetchProcessorUsageAction error:", err);
        return { error: "Erro ao agregar uso de maquininhas." };
    }
}

export type RolloverTrendPoint = {
    month: string;         // "Jan/26"
    rolloverCount: number;
    volumeCents: number;
};

export async function fetchRolloverTrendAction(): Promise<RolloverTrendPoint[] | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: gate.error };

    try {
        const res = await pool.query(
            `SELECT DATE_TRUNC('month', created_at) AS month_ref,
                    COUNT(*)::int AS rollover_count,
                    COALESCE(SUM(invoice_value_cents), 0)::bigint AS volume_cents
             FROM debt_rollovers
             WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
             GROUP BY DATE_TRUNC('month', created_at)
             ORDER BY month_ref ASC`
        );
        return res.rows.map((r) => {
            const d: Date = r.month_ref instanceof Date ? r.month_ref : new Date(r.month_ref);
            return {
                month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
                rolloverCount: Number(r.rollover_count),
                volumeCents: Number(r.volume_cents),
            };
        });
    } catch (err) {
        console.error("fetchRolloverTrendAction error:", err);
        return { error: "Erro ao agregar tendência de rolagens." };
    }
}
