"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { callLauraGo } from "@/lib/apiClient";

export type Transaction = {
    id: string;
    amount: number;
    description: string;
    type: "expense" | "income";
    date: string;
    confidenceScore: number;
    needsReview: boolean;
    categoryName?: string;
    tags?: string[];
};

type GoTransactionItem = {
    id: string;
    amount: number;
    type: string;
    description: string;
    transaction_date: string;
    category_id: string | null;
    category_name: string | null;
    card_id: string | null;
    card_name: string | null;
    needs_review: boolean;
    confidence_score: number | null;
    tags: string[] | null;
};

type GoTransactionsResponse = {
    transactions: GoTransactionItem[] | null;
    total_count: number;
};

export async function fetchRecentTransactionsAction(): Promise<{ error?: string, transactions?: Transaction[] }> {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sessão inválida" };
        }

        // Tenta API Go primeiro (limite 10 para o widget "últimas")
        try {
            const goResponse = await callLauraGo<GoTransactionsResponse>("/api/v1/transactions?limit=10");
            if (goResponse) {
                const transactions: Transaction[] = (goResponse.transactions ?? []).map((t) => ({
                    id: t.id,
                    amount: t.amount / 100,  // Go retorna cents, PWA type espera reais
                    description: t.description,
                    type: t.type === "income" ? "income" : "expense",
                    date: t.transaction_date,
                    confidenceScore: t.confidence_score ?? 1.0,
                    needsReview: t.needs_review,
                    categoryName: t.category_name ?? "Geral",
                    tags: t.tags ?? [],
                }));
                return { transactions };
            }
        } catch (err) {
            console.warn("[transactions] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado" };

            const workspaceId = userRes.rows[0].workspace_id;

            const txRes = await client.query(`
                SELECT 
                    t.id, t.amount, t.description, t.type, t.transaction_date, 
                    t.confidence_score, t.needs_review, t.tags,
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
                categoryName: r.category_name || "Geral",
                tags: r.tags || []
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

export async function deleteTransactionAction(transactionId: string): Promise<{ success?: boolean, error?: string }> {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Não autorizado" };
        }

        try {
            const goResp = await callLauraGo<{ success: boolean }>(`/api/v1/transactions/${transactionId}`, {
                method: "DELETE",
            });
            if (goResp) return { success: true };
        } catch (err) {
            console.warn("[transactions:delete] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace inválido" };

            const workspaceId = userRes.rows[0].workspace_id;

            const delRes = await client.query("DELETE FROM transactions WHERE id = $1 AND workspace_id = $2 RETURNING id", [transactionId, workspaceId]);

            if (delRes.rowCount === 0) {
                return { error: "Transação não encontrada ou sem permissão para excluí-la." };
            }

            return { success: true };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Delete transaction error:", err);
        return { error: "Erro ao excluir transação." };
    }
}

export async function updateTransactionCategoryAction(transactionId: string, categoryId: string): Promise<{ success?: boolean, error?: string }> {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Não autorizado" };
        }

        try {
            const goResp = await callLauraGo<{ success: boolean }>(`/api/v1/transactions/${transactionId}/category`, {
                method: "PUT",
                body: { category_id: categoryId },
            });
            if (goResp) return { success: true };
        } catch (err) {
            console.warn("[transactions:updateCategory] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace inválido" };

            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                "UPDATE transactions SET category_id = $1, needs_review = false WHERE id = $2 AND workspace_id = $3",
                [categoryId, transactionId, workspaceId]
            );

            if (res.rowCount === 0) {
                return { error: "Transação não encontrada ou sem permissão." };
            }

            return { success: true };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Update transaction category error:", err);
        return { error: "Erro ao atualizar a categoria." };
    }
}
