"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { callLauraGo } from "@/lib/apiClient";

type GoScoreFactors = {
    bills_on_time: number;
    budget_respect: number;
    savings_rate: number;
    debt_level: number;
    score: number;
};

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
 *  - billsOnTime (35%): % de invoices com paid_at <= due_date nos últimos
 *    90 dias (considerando só as que já venceram ou foram pagas). Se o
 *    workspace ainda não tem invoices registradas, usa fallback.
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

        try {
            const goResponse = await callLauraGo<GoScoreFactors>("/api/v1/score/current");
            if (goResponse) {
                return {
                    billsOnTime: goResponse.bills_on_time,
                    budgetRespect: goResponse.budget_respect,
                    savingsRate: goResponse.savings_rate,
                    debtLevel: goResponse.debt_level,
                };
            }
        } catch (err) {
            console.warn("[score-current] laura-go failed, fallback:", err);
        }

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

            // --- billsOnTime ---
            // Consulta as invoices dos últimos 90 dias que já venceram ou
            // foram pagas. Considera "em dia" toda invoice cujo paid_at
            // existe E é ≤ due_date + 1 dia (tolerância de fuso).
            const invoiceRes = await client.query(
                `SELECT
                    COUNT(*) FILTER (
                        WHERE paid_at IS NOT NULL
                          AND paid_at::date <= due_date + INTERVAL '1 day'
                    )::int AS on_time_count,
                    COUNT(*) FILTER (
                        WHERE paid_at IS NOT NULL
                           OR due_date < CURRENT_DATE
                    )::int AS settled_count
                 FROM invoices
                 WHERE workspace_id = $1
                   AND due_date >= CURRENT_DATE - INTERVAL '90 days'`,
                [workspaceId]
            );
            const onTimeCount = Number(invoiceRes.rows[0]?.on_time_count ?? 0);
            const settledCount = Number(invoiceRes.rows[0]?.settled_count ?? 0);
            let billsOnTime = FALLBACK.billsOnTime;
            if (settledCount > 0) {
                billsOnTime = Math.round((onTimeCount / settledCount) * 100);
            }

            return { billsOnTime, budgetRespect, savingsRate, debtLevel };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchFinancialScoreAction error:", err);
        return FALLBACK;
    }
}
