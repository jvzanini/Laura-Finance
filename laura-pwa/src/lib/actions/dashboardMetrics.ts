"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

// Actions que alimentam os cards/gráficos do /dashboard com dados reais.
// Ficam agrupadas aqui para não inflar actions mais específicas com
// queries puramente de dashboard.

export type CashFlowPoint = {
    day: string;       // "DD/MM"
    gastos: number;    // reais
    entradas: number;  // reais
};

/**
 * fetchMonthlyCashFlowAction retorna séries diárias do mês corrente
 * agregando transactions por data + tipo. Usado pelo DashboardChart.
 * Preenche dias sem movimento com 0 pra manter a linha contínua.
 */
export async function fetchMonthlyCashFlowAction(): Promise<CashFlowPoint[]> {
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
                    DATE(transaction_date) AS day,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int AS expense_cents,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int AS income_cents
                 FROM transactions
                 WHERE workspace_id = $1
                   AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                   AND EXTRACT(YEAR  FROM transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 GROUP BY DATE(transaction_date)
                 ORDER BY DATE(transaction_date) ASC`,
                [workspaceId]
            );

            const map = new Map<string, { gastos: number; entradas: number }>();
            for (const row of res.rows) {
                const d: Date = row.day instanceof Date ? row.day : new Date(row.day);
                const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                map.set(key, {
                    gastos: Number(row.expense_cents) / 100,
                    entradas: Number(row.income_cents) / 100,
                });
            }

            // Monta série contínua: 1 ponto por dia do mês (ou até hoje se mês atual).
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = now.getDate();
            const lastDay = Math.min(today, daysInMonth);

            const out: CashFlowPoint[] = [];
            for (let d = 1; d <= lastDay; d++) {
                const key = `${String(d).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
                const entry = map.get(key) || { gastos: 0, entradas: 0 };
                out.push({ day: key, gastos: entry.gastos, entradas: entry.entradas });
            }
            return out;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchMonthlyCashFlowAction error:", err);
        return [];
    }
}

export type UpcomingBill = {
    id: string;
    name: string;              // "Nubank Principal" (nome do cartão)
    amountCents: number;
    dueDate: string;           // YYYY-MM-DD
    dueLabel: string;          // "27/03"
    daysUntil: number;
    type: "fatura" | "recorrente" | "boleto";
    cardColor?: string;
};

/**
 * fetchUpcomingBillsAction retorna até 8 faturas dos próximos 30 dias
 * do workspace logado, ordenadas por due_date ascendente. Calcula
 * daysUntil como diferença em dias a partir de hoje. Ignora faturas
 * já pagas (paid_at IS NOT NULL).
 */
export async function fetchUpcomingBillsAction(): Promise<UpcomingBill[]> {
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
                `SELECT i.id, i.total_cents, i.due_date, c.name AS card_name, c.color AS card_color
                 FROM invoices i
                 LEFT JOIN cards c ON c.id = i.card_id
                 WHERE i.workspace_id = $1
                   AND i.paid_at IS NULL
                   AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                 ORDER BY i.due_date ASC
                 LIMIT 8`,
                [workspaceId]
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return res.rows.map((r): UpcomingBill => {
                const dueDate: Date = r.due_date instanceof Date ? r.due_date : new Date(r.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    id: r.id,
                    name: r.card_name ?? "Cartão removido",
                    amountCents: Number(r.total_cents),
                    dueDate: dueDate.toISOString().slice(0, 10),
                    dueLabel: dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                    daysUntil,
                    type: "fatura",
                    cardColor: r.card_color ?? undefined,
                };
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchUpcomingBillsAction error:", err);
        return [];
    }
}

export type CategoryBudgetRow = {
    id: string;
    name: string;
    limit: number;  // reais
    spent: number;  // reais
    color: string;
    emoji: string | null;
};

/**
 * fetchCategoryBudgetsAction retorna as categorias com `monthly_limit_cents > 0`
 * do workspace logado, incluindo o `spent` calculado no mês corrente a
 * partir de transactions. Alimenta o CategoryBudget no dashboard sem
 * depender do estado local hardcoded.
 */
export async function fetchCategoryBudgetsAction(): Promise<CategoryBudgetRow[]> {
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
                    c.id,
                    c.name,
                    c.monthly_limit_cents,
                    c.color,
                    c.emoji,
                    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::int AS spent_cents
                 FROM categories c
                 LEFT JOIN transactions t
                    ON t.category_id = c.id
                    AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                    AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
                 WHERE c.workspace_id = $1
                   AND c.monthly_limit_cents > 0
                 GROUP BY c.id, c.name, c.monthly_limit_cents, c.color, c.emoji
                 ORDER BY (COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::numeric / NULLIF(c.monthly_limit_cents, 0)) DESC NULLS LAST
                 LIMIT 6`,
                [workspaceId]
            );

            return res.rows.map((r): CategoryBudgetRow => ({
                id: r.id,
                name: r.name,
                limit: Number(r.monthly_limit_cents) / 100,
                spent: Number(r.spent_cents) / 100,
                color: r.color ?? "#71717A",
                emoji: r.emoji ?? null,
            }));
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchCategoryBudgetsAction error:", err);
        return [];
    }
}
