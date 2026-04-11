"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { callLauraGo } from "@/lib/apiClient";

type GoScoreSnapshot = {
    date: string;
    score: number;
    bills_on_time: number;
    budget_respect: number;
    savings_rate: number;
    debt_level: number;
};
type GoScoreHistoryResponse = { history: GoScoreSnapshot[] | null };

export type ScoreSnapshot = {
    date: string; // YYYY-MM-DD
    score: number;
    billsOnTime: number;
    budgetRespect: number;
    savingsRate: number;
    debtLevel: number;
};

/**
 * fetchScoreHistoryAction retorna os últimos N snapshots diários do Score
 * Financeiro para o workspace logado, gravados pelo cron do laura-go
 * (runDailyScoreSnapshot). Usado para alimentar gráficos de evolução no
 * dashboard. Se a tabela estiver vazia, devolve array vazio sem erro.
 */
export async function fetchScoreHistoryAction(limit = 30): Promise<ScoreSnapshot[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        try {
            const goResponse = await callLauraGo<GoScoreHistoryResponse>(
                `/api/v1/score/history?limit=${limit}`
            );
            if (goResponse) {
                return (goResponse.history ?? []).map((s) => ({
                    date: s.date,
                    score: s.score,
                    billsOnTime: s.bills_on_time,
                    budgetRespect: s.budget_respect,
                    savingsRate: s.savings_rate,
                    debtLevel: s.debt_level,
                }));
            }
        } catch (err) {
            console.warn("[score-history] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT snapshot_date, score, bills_on_time, budget_respect, savings_rate, debt_level
                 FROM financial_score_snapshots
                 WHERE workspace_id = $1
                 ORDER BY snapshot_date DESC
                 LIMIT $2`,
                [workspaceId, limit]
            );

            return res.rows
                .map((r) => ({
                    date: r.snapshot_date.toISOString().slice(0, 10),
                    score: Number(r.score),
                    billsOnTime: Number(r.bills_on_time),
                    budgetRespect: Number(r.budget_respect),
                    savingsRate: Number(r.savings_rate),
                    debtLevel: Number(r.debt_level),
                }))
                .reverse(); // ascending for chart consumption
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchScoreHistoryAction error:", err);
        return [];
    }
}
