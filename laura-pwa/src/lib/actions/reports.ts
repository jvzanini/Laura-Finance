"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export type DRELine = {
    label: string;
    indent: number;       // 0 = section header, 1 = line item
    valueCents: number;
    sign: "positive" | "negative" | "neutral";
    bold: boolean;
};

export type DRESummary = {
    month: string;        // YYYY-MM
    lines: DRELine[];
    totalIncomeCents: number;
    totalExpenseCents: number;
    totalInvestmentCents: number;
    netResultCents: number;
};

/**
 * fetchDREAction retorna um DRE simplificado do mês corrente agregando:
 * - Receitas (type = 'income') agrupadas por categoria
 * - Despesas (type = 'expense') agrupadas por categoria
 * - Aportes mensais de investments (monthly_contribution_cents)
 * - Resultado líquido (receitas - despesas - investimentos)
 *
 * Retorna um shape DRESummary pronto para render em lista hierárquica.
 * Quando não há dados, devolve um summary vazio (com lines == []).
 */
export async function fetchDREAction(): Promise<DRESummary> {
    const emptySummary: DRESummary = {
        month: new Date().toISOString().slice(0, 7),
        lines: [],
        totalIncomeCents: 0,
        totalExpenseCents: 0,
        totalInvestmentCents: 0,
        netResultCents: 0,
    };

    try {
        const session = await getSession();
        if (!session || !session.userId) return emptySummary;

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return emptySummary;
            const workspaceId = userRes.rows[0].workspace_id;

            // Receitas agrupadas por categoria (ou "Sem categoria")
            const incomeRes = await client.query(
                `SELECT COALESCE(c.name, 'Sem categoria') AS cat_name,
                        COALESCE(SUM(t.amount), 0)::int AS total_cents
                 FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.workspace_id = $1
                   AND t.type = 'income'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY c.name
                 HAVING COALESCE(SUM(t.amount), 0) > 0
                 ORDER BY total_cents DESC`,
                [workspaceId]
            );

            // Despesas agrupadas por categoria
            const expenseRes = await client.query(
                `SELECT COALESCE(c.name, 'Sem categoria') AS cat_name,
                        COALESCE(SUM(t.amount), 0)::int AS total_cents
                 FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY c.name
                 HAVING COALESCE(SUM(t.amount), 0) > 0
                 ORDER BY total_cents DESC`,
                [workspaceId]
            );

            // Aportes mensais em investimentos (contribuição fixa, não mensal de transactions)
            const investRes = await client.query(
                `SELECT COALESCE(SUM(monthly_contribution_cents), 0)::int AS total_cents
                 FROM investments
                 WHERE workspace_id = $1`,
                [workspaceId]
            );

            const totalIncomeCents = incomeRes.rows.reduce(
                (s, r) => s + Number(r.total_cents),
                0
            );
            const totalExpenseCents = expenseRes.rows.reduce(
                (s, r) => s + Number(r.total_cents),
                0
            );
            const totalInvestmentCents = Number(investRes.rows[0]?.total_cents ?? 0);
            const netResultCents = totalIncomeCents - totalExpenseCents - totalInvestmentCents;

            const lines: DRELine[] = [];

            // Bloco de receitas
            lines.push({
                label: "(+) Receitas Brutas",
                indent: 0,
                valueCents: totalIncomeCents,
                sign: "positive",
                bold: true,
            });
            for (const r of incomeRes.rows) {
                lines.push({
                    label: r.cat_name,
                    indent: 1,
                    valueCents: Number(r.total_cents),
                    sign: "neutral",
                    bold: false,
                });
            }

            // Bloco de despesas
            lines.push({
                label: "(-) Despesas",
                indent: 0,
                valueCents: totalExpenseCents,
                sign: "negative",
                bold: true,
            });
            for (const r of expenseRes.rows) {
                lines.push({
                    label: r.cat_name,
                    indent: 1,
                    valueCents: Number(r.total_cents),
                    sign: "neutral",
                    bold: false,
                });
            }

            // Bloco de investimentos
            if (totalInvestmentCents > 0) {
                lines.push({
                    label: "(-) Aporte em Investimentos",
                    indent: 0,
                    valueCents: totalInvestmentCents,
                    sign: "negative",
                    bold: true,
                });
            }

            // Resultado líquido
            lines.push({
                label: "(=) Resultado Líquido",
                indent: 0,
                valueCents: netResultCents,
                sign: netResultCents >= 0 ? "positive" : "negative",
                bold: true,
            });

            return {
                month: emptySummary.month,
                lines,
                totalIncomeCents,
                totalExpenseCents,
                totalInvestmentCents,
                netResultCents,
            };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchDREAction error:", err);
        return emptySummary;
    }
}

export type ReportsFilterData = {
    members: { id: string; name: string }[];
    categories: { id: string; name: string; emoji: string | null }[];
};

/**
 * fetchReportsFilterDataAction retorna os dados necessários para os
 * dropdowns de filtro da página de relatórios (membros + categorias
 * do workspace logado). Vazio por default em caso de erro.
 */
export async function fetchReportsFilterDataAction(): Promise<ReportsFilterData> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { members: [], categories: [] };

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return { members: [], categories: [] };
            const workspaceId = userRes.rows[0].workspace_id;

            const membersRes = await client.query(
                "SELECT id, name FROM users WHERE workspace_id = $1 ORDER BY name ASC",
                [workspaceId]
            );
            const catsRes = await client.query(
                "SELECT id, name, emoji FROM categories WHERE workspace_id = $1 ORDER BY name ASC",
                [workspaceId]
            );

            return {
                members: membersRes.rows.map((r) => ({ id: r.id, name: r.name })),
                categories: catsRes.rows.map((r) => ({
                    id: r.id,
                    name: r.name,
                    emoji: r.emoji ?? null,
                })),
            };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchReportsFilterDataAction error:", err);
        return { members: [], categories: [] };
    }
}
