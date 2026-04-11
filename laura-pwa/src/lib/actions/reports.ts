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

export type CategoryReportRow = {
    categoryId: string | null;
    name: string;
    emoji: string | null;
    color: string;
    spentCents: number;
    percentOfTotal: number;
};

/**
 * fetchCategoryReportAction agrega expenses do mês corrente por
 * category_id, devolvendo lista ordenada descendente com % do total.
 * Inclui linha "Sem categoria" quando há transactions sem categoria.
 */
export async function fetchCategoryReportAction(): Promise<CategoryReportRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    t.category_id AS cat_id,
                    COALESCE(c.name, 'Sem categoria') AS name,
                    c.emoji AS emoji,
                    COALESCE(c.color, '#71717A') AS color,
                    COALESCE(SUM(t.amount), 0)::int AS spent_cents
                 FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY t.category_id, c.name, c.emoji, c.color
                 HAVING COALESCE(SUM(t.amount), 0) > 0
                 ORDER BY spent_cents DESC`,
                [workspaceId]
            );

            const total = res.rows.reduce((s, r) => s + Number(r.spent_cents), 0);
            return res.rows.map((r): CategoryReportRow => ({
                categoryId: r.cat_id,
                name: r.name,
                emoji: r.emoji ?? null,
                color: r.color,
                spentCents: Number(r.spent_cents),
                percentOfTotal: total > 0 ? (Number(r.spent_cents) / total) * 100 : 0,
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchCategoryReportAction error:", err);
        return [];
    }
}

export type SubcategoryReportRow = {
    subcategoryId: string | null;
    name: string;
    emoji: string | null;
    categoryName: string;
    spentCents: number;
    percentOfTotal: number;
};

export async function fetchSubcategoryReportAction(): Promise<SubcategoryReportRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    t.subcategory_id AS sub_id,
                    COALESCE(sc.name, 'Sem subcategoria') AS sub_name,
                    sc.emoji AS sub_emoji,
                    COALESCE(c.name, '—') AS cat_name,
                    COALESCE(SUM(t.amount), 0)::int AS spent_cents
                 FROM transactions t
                 LEFT JOIN subcategories sc ON sc.id = t.subcategory_id
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY t.subcategory_id, sc.name, sc.emoji, c.name
                 HAVING COALESCE(SUM(t.amount), 0) > 0
                 ORDER BY spent_cents DESC
                 LIMIT 20`,
                [workspaceId]
            );

            const total = res.rows.reduce((s, r) => s + Number(r.spent_cents), 0);
            return res.rows.map((r): SubcategoryReportRow => ({
                subcategoryId: r.sub_id,
                name: r.sub_name,
                emoji: r.sub_emoji ?? null,
                categoryName: r.cat_name,
                spentCents: Number(r.spent_cents),
                percentOfTotal: total > 0 ? (Number(r.spent_cents) / total) * 100 : 0,
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchSubcategoryReportAction error:", err);
        return [];
    }
}

export type CardReportRow = {
    cardId: string | null;
    name: string;
    color: string;
    transactionCount: number;
    totalSpentCents: number;
    percentOfTotal: number;
};

export async function fetchCardReportAction(): Promise<CardReportRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    t.card_id AS card_id,
                    COALESCE(c.name, 'Sem cartão (dinheiro/pix)') AS name,
                    COALESCE(c.color, '#71717A') AS color,
                    COUNT(*)::int AS tx_count,
                    COALESCE(SUM(t.amount), 0)::int AS spent_cents
                 FROM transactions t
                 LEFT JOIN cards c ON c.id = t.card_id
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY t.card_id, c.name, c.color
                 HAVING COALESCE(SUM(t.amount), 0) > 0
                 ORDER BY spent_cents DESC`,
                [workspaceId]
            );

            const total = res.rows.reduce((s, r) => s + Number(r.spent_cents), 0);
            return res.rows.map((r): CardReportRow => ({
                cardId: r.card_id,
                name: r.name,
                color: r.color,
                transactionCount: Number(r.tx_count),
                totalSpentCents: Number(r.spent_cents),
                percentOfTotal: total > 0 ? (Number(r.spent_cents) / total) * 100 : 0,
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchCardReportAction error:", err);
        return [];
    }
}

export type PaymentMethodReportRow = {
    method: "crédito" | "dinheiro_pix";
    label: string;
    transactionCount: number;
    totalSpentCents: number;
    percentOfTotal: number;
};

/**
 * fetchPaymentMethodReportAction infere o método de pagamento a partir
 * da presença ou ausência de card_id na transação: card_id preenchido
 * = "crédito" (fatura vem depois), card_id NULL = "dinheiro/pix"
 * (saída imediata). Abordagem simples até existir uma coluna
 * transactions.payment_method explícita.
 */
export async function fetchPaymentMethodReportAction(): Promise<PaymentMethodReportRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    CASE WHEN t.card_id IS NULL THEN 'dinheiro_pix' ELSE 'crédito' END AS method,
                    COUNT(*)::int AS tx_count,
                    COALESCE(SUM(t.amount), 0)::int AS spent_cents
                 FROM transactions t
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY method
                 ORDER BY spent_cents DESC`,
                [workspaceId]
            );

            const total = res.rows.reduce((s, r) => s + Number(r.spent_cents), 0);
            return res.rows.map((r): PaymentMethodReportRow => ({
                method: r.method as "crédito" | "dinheiro_pix",
                label: r.method === "crédito" ? "Crédito (cartão)" : "Dinheiro / PIX",
                transactionCount: Number(r.tx_count),
                totalSpentCents: Number(r.spent_cents),
                percentOfTotal: total > 0 ? (Number(r.spent_cents) / total) * 100 : 0,
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchPaymentMethodReportAction error:", err);
        return [];
    }
}

export type TravelReportRow = {
    tag: string;
    transactionCount: number;
    totalSpentCents: number;
};

/**
 * fetchTravelReportAction usa a array `tags` das transactions para
 * filtrar por tags com substring "viagem" (case-insensitive). Cada
 * tag encontrada vira uma linha agregada. Convenção:
 * tags = ['viagem-sp', 'restaurante'] → contam em 'viagem-sp'.
 */
export async function fetchTravelReportAction(): Promise<TravelReportRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT tag, COUNT(*)::int AS tx_count, COALESCE(SUM(t.amount), 0)::int AS spent_cents
                 FROM transactions t, LATERAL UNNEST(t.tags) AS tag
                 WHERE t.workspace_id = $1
                   AND t.type = 'expense'
                   AND tag ILIKE '%viagem%'
                 GROUP BY tag
                 ORDER BY spent_cents DESC`,
                [workspaceId]
            );

            return res.rows.map((r): TravelReportRow => ({
                tag: r.tag,
                transactionCount: Number(r.tx_count),
                totalSpentCents: Number(r.spent_cents),
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchTravelReportAction error:", err);
        return [];
    }
}

export type ComparativeReport = {
    currentMonthLabel: string;
    previousMonthLabel: string;
    currentIncome: number;
    previousIncome: number;
    currentExpense: number;
    previousExpense: number;
    currentNet: number;
    previousNet: number;
    deltaPercent: number; // net change as % of previous net
};

/**
 * fetchComparativeReportAction retorna os totais deste mês vs mês
 * anterior (income, expense, net). Útil para a aba "Comparativo".
 */
export async function fetchComparativeReportAction(): Promise<ComparativeReport> {
    const empty: ComparativeReport = {
        currentMonthLabel: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        previousMonthLabel: new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        currentIncome: 0,
        previousIncome: 0,
        currentExpense: 0,
        previousExpense: 0,
        currentNet: 0,
        previousNet: 0,
        deltaPercent: 0,
    };

    try {
        const session = await getSession();
        if (!session || !session.userId) return empty;

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return empty;
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    COALESCE(SUM(amount) FILTER (
                        WHERE type = 'income'
                          AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                          AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                    ), 0)::int AS curr_income,
                    COALESCE(SUM(amount) FILTER (
                        WHERE type = 'expense'
                          AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                          AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                    ), 0)::int AS curr_expense,
                    COALESCE(SUM(amount) FILTER (
                        WHERE type = 'income'
                          AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
                          AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE - INTERVAL '1 month')
                    ), 0)::int AS prev_income,
                    COALESCE(SUM(amount) FILTER (
                        WHERE type = 'expense'
                          AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
                          AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE - INTERVAL '1 month')
                    ), 0)::int AS prev_expense
                 FROM transactions
                 WHERE workspace_id = $1`,
                [workspaceId]
            );
            const r = res.rows[0];
            const currentIncome = Number(r.curr_income);
            const currentExpense = Number(r.curr_expense);
            const previousIncome = Number(r.prev_income);
            const previousExpense = Number(r.prev_expense);
            const currentNet = currentIncome - currentExpense;
            const previousNet = previousIncome - previousExpense;
            const deltaPercent = previousNet !== 0 ? ((currentNet - previousNet) / Math.abs(previousNet)) * 100 : 0;

            return {
                ...empty,
                currentIncome,
                currentExpense,
                previousIncome,
                previousExpense,
                currentNet,
                previousNet,
                deltaPercent,
            };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchComparativeReportAction error:", err);
        return empty;
    }
}

export type TrendPoint = {
    month: string;            // "Jan/26"
    incomeCents: number;
    expenseCents: number;
    netCents: number;
};

/**
 * fetchTrendReportAction agrega os últimos 6 meses de transactions por
 * (type, date_trunc month) para alimentar um line chart de tendência.
 */
export async function fetchTrendReportAction(): Promise<TrendPoint[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return [];
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `SELECT
                    DATE_TRUNC('month', transaction_date) AS month_ref,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int AS income_cents,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int AS expense_cents
                 FROM transactions
                 WHERE workspace_id = $1
                   AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
                 GROUP BY DATE_TRUNC('month', transaction_date)
                 ORDER BY month_ref ASC`,
                [workspaceId]
            );

            return res.rows.map((r): TrendPoint => {
                const d: Date = r.month_ref instanceof Date ? r.month_ref : new Date(r.month_ref);
                return {
                    month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(" de ", "/").replace(".", ""),
                    incomeCents: Number(r.income_cents),
                    expenseCents: Number(r.expense_cents),
                    netCents: Number(r.income_cents) - Number(r.expense_cents),
                };
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchTrendReportAction error:", err);
        return [];
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
