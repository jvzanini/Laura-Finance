"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export type ScoreFactors = {
    billsOnTime: number;
    budgetRespect: number;
    savingsRate: number;
    debtLevel: number;
};

const FALLBACK: ScoreFactors = {
    billsOnTime: 85,
    budgetRespect: 72,
    savingsRate: 65,
    debtLevel: 55,
};

/**
 * fetchFinancialScoreAction consulta o Postgres e devolve os 4 fatores
 * usados pelo componente FinancialScore. Em caso de sessão inválida,
 * banco indisponível ou workspace sem dados, devolve valores de fallback
 * para que o dashboard renderize sem quebrar.
 *
 * Fórmulas atuais (documentadas no Epic 9.2 retro-doc):
 *  - billsOnTime (35%): hoje fixo em 85 — faltam colunas paid_at em invoices
 *    para calcular corretamente. Item de backlog.
 *  - budgetRespect (25%): % de categorias do workspace onde a soma das
 *    transações 'expense' do mês corrente é ≤ monthly_limit_cents.
 *  - savingsRate (25%): ((income - expense) / income) do mês corrente,
 *    clamped 0..100. Se income = 0, usa 0.
 *  - debtLevel (15%): 100 menos a razão total_fees_cents de rolagens
 *    dos últimos 90 dias sobre a média mensal de income, clamped 0..100.
 */
export async function fetchFinancialScoreAction(): Promise<ScoreFactors> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return FALLBACK;

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return FALLBACK;
            const workspaceId = userRes.rows[0].workspace_id;

            // --- budgetRespect ---
            const budgetRes = await client.query(
                `SELECT
                    c.id,
                    c.monthly_limit_cents,
                    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::int AS spent_cents
                 FROM categories c
                 LEFT JOIN transactions t
                    ON t.category_id = c.id
                    AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                    AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 WHERE c.workspace_id = $1
                   AND c.monthly_limit_cents > 0
                 GROUP BY c.id, c.monthly_limit_cents`,
                [workspaceId]
            );

            let budgetRespect = FALLBACK.budgetRespect;
            if (budgetRes.rowCount && budgetRes.rowCount > 0) {
                const respected = budgetRes.rows.filter(
                    (r) => Number(r.spent_cents) <= Number(r.monthly_limit_cents)
                ).length;
                budgetRespect = Math.round((respected / budgetRes.rowCount) * 100);
            }

            // --- savingsRate ---
            const cashRes = await client.query(
                `SELECT
                    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int AS income_cents,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int AS expense_cents
                 FROM transactions
                 WHERE workspace_id = $1
                   AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)`,
                [workspaceId]
            );
            const incomeCents = Number(cashRes.rows[0]?.income_cents ?? 0);
            const expenseCents = Number(cashRes.rows[0]?.expense_cents ?? 0);
            let savingsRate = FALLBACK.savingsRate;
            if (incomeCents > 0) {
                const rate = ((incomeCents - expenseCents) / incomeCents) * 100;
                savingsRate = Math.max(0, Math.min(100, Math.round(rate)));
            }

            // --- debtLevel ---
            // Média de income nos últimos 3 meses como denominador (fallback
            // para o income do mês corrente se o histórico for curto).
            const incomeAvgRes = await client.query(
                `SELECT COALESCE(SUM(amount), 0)::int AS total_cents
                 FROM transactions
                 WHERE workspace_id = $1
                   AND type = 'income'
                   AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'`,
                [workspaceId]
            );
            const totalIncome90 = Number(incomeAvgRes.rows[0]?.total_cents ?? 0);
            const monthlyIncomeAvg = totalIncome90 > 0 ? totalIncome90 / 3 : incomeCents;

            const rolloverRes = await client.query(
                `SELECT COALESCE(SUM(total_fees_cents), 0)::int AS fees_cents
                 FROM debt_rollovers
                 WHERE workspace_id = $1
                   AND created_at >= CURRENT_DATE - INTERVAL '90 days'`,
                [workspaceId]
            );
            const feesCents = Number(rolloverRes.rows[0]?.fees_cents ?? 0);

            let debtLevel = FALLBACK.debtLevel;
            if (monthlyIncomeAvg > 0) {
                const ratio = feesCents / monthlyIncomeAvg;
                debtLevel = Math.max(0, Math.min(100, Math.round(100 - ratio * 100)));
            }

            // TODO (backlog): billsOnTime exige uma noção de "paga em dia"
            // que depende de colunas futuras em invoices/cards. Mantemos
            // o fallback explícito até lá para não mascarar o gap.
            const billsOnTime = FALLBACK.billsOnTime;

            return { billsOnTime, budgetRespect, savingsRate, debtLevel };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchFinancialScoreAction error:", err);
        return FALLBACK;
    }
}
