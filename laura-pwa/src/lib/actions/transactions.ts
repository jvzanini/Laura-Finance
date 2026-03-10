"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export type Transaction = {
    id: string;
    amount: number;
    description: string;
    type: "expense" | "income";
    date: string;
    confidenceScore: number;
    needsReview: boolean;
    categoryName?: string;
};

export async function fetchRecentTransactionsAction(): Promise<{ error?: string, transactions?: Transaction[] }> {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sessão inválida" };
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado" };

            const workspaceId = userRes.rows[0].workspace_id;

            const txRes = await client.query(`
                SELECT 
                    t.id, t.amount, t.description, t.type, t.transaction_date, 
                    t.confidence_score, t.needs_review,
                    c.name as category_name
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.workspace_id = $1
                ORDER BY t.transaction_date DESC
                LIMIT 10
            `, [workspaceId]);

            const transactions = txRes.rows.map(r => ({
                id: r.id,
                amount: parseFloat(r.amount),
                description: r.description,
                type: r.type,
                date: r.transaction_date.toISOString(),
                confidenceScore: r.confidence_score ? parseFloat(r.confidence_score) : 1.0,
                needsReview: r.needs_review,
                categoryName: r.category_name || "Geral"
            }));

            return { transactions };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Fetch transactions error:", err);
        return { error: "Erro ao buscar transações recentes." };
    }
}
