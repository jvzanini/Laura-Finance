"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoInvoiceItem = {
    id: string;
    card_id: string;
    card_name: string;
    card_color: string;
    total_cents: number;
    due_date: string;
    paid_at: string | null;
    status: "open" | "paid" | "overdue";
};
type GoInvoicesResponse = { invoices: GoInvoiceItem[] | null };

// Tipagem para consumo pela UI. Diferente de invoices.ts (que lida com
// debt_rollovers — "empurrar fatura"). Este módulo cuida das linhas da
// tabela `invoices` criada na migration 000017.

export type InvoiceRow = {
    id: string;
    cardId: string;
    cardName: string;
    cardColor: string;
    totalCents: number;
    dueDate: string;          // YYYY-MM-DD
    paidAt: string | null;    // ISO string ou null
    status: "open" | "paid" | "overdue";
};

/**
 * fetchInvoicesAction lê as faturas do workspace logado ordenadas por
 * due_date desc. Deriva o status dinamicamente: paid_at preenchido →
 * paid; due_date < hoje → overdue; caso contrário → open. Campos de
 * card (name, color) vêm do JOIN.
 */
export async function fetchInvoicesAction(): Promise<InvoiceRow[]> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return [];

        try {
            const goResponse = await callLauraGo<GoInvoicesResponse>("/api/v1/invoices");
            if (goResponse) {
                return (goResponse.invoices ?? []).map((i): InvoiceRow => ({
                    id: i.id,
                    cardId: i.card_id,
                    cardName: i.card_name,
                    cardColor: i.card_color,
                    totalCents: i.total_cents,
                    dueDate: i.due_date,
                    paidAt: i.paid_at,
                    status: i.status,
                }));
            }
        } catch (err) {
            console.warn("[invoices] laura-go failed, fallback:", err);
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
                `SELECT i.id, i.card_id, i.total_cents, i.due_date, i.paid_at,
                        c.name AS card_name, c.color AS card_color
                 FROM invoices i
                 LEFT JOIN cards c ON c.id = i.card_id
                 WHERE i.workspace_id = $1
                 ORDER BY i.due_date DESC`,
                [workspaceId]
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return res.rows.map((r): InvoiceRow => {
                const dueDate: Date = r.due_date instanceof Date ? r.due_date : new Date(r.due_date);
                let status: InvoiceRow["status"] = "open";
                if (r.paid_at) {
                    status = "paid";
                } else if (dueDate < today) {
                    status = "overdue";
                }
                return {
                    id: r.id,
                    cardId: r.card_id,
                    cardName: r.card_name ?? "Cartão removido",
                    cardColor: r.card_color ?? "#71717A",
                    totalCents: Number(r.total_cents),
                    dueDate: dueDate.toISOString().slice(0, 10),
                    paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
                    status,
                };
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("fetchInvoicesAction error:", err);
        return [];
    }
}

/**
 * markInvoicePaidAction marca uma fatura como paga agora. Atualiza
 * paid_at para CURRENT_TIMESTAMP e status para 'paid'. Usa o
 * workspace_id da sessão como guarda (user não pode marcar fatura
 * alheia). Retorna { success: true } ou { error }.
 */
export async function markInvoicePaidAction(invoiceId: string) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado." };
            const workspaceId = userRes.rows[0].workspace_id;

            const res = await client.query(
                `UPDATE invoices
                 SET paid_at = CURRENT_TIMESTAMP,
                     status = 'paid',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND workspace_id = $2`,
                [invoiceId, workspaceId]
            );
            if (res.rowCount === 0) {
                return { error: "Fatura não encontrada neste workspace." };
            }
        } finally {
            client.release();
        }

        revalidatePath("/invoices");
        return { success: true };
    } catch (err) {
        console.error("markInvoicePaidAction error:", err);
        return { error: "Erro interno ao marcar fatura como paga." };
    }
}

/**
 * createInvoiceAction cria uma fatura manualmente (útil para onboarding
 * inicial de histórico). Em produção, o fluxo natural será o Go criar
 * automaticamente no fechamento do cartão, mas o PWA oferece essa
 * porta como fallback administrativo.
 */
export async function createInvoiceAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const cardId = formData.get("cardId") as string;
        const totalString = formData.get("total") as string;
        const dueDate = formData.get("dueDate") as string;
        const monthRef = formData.get("monthRef") as string;

        if (!cardId || !totalString || !dueDate || !monthRef) {
            return { error: "Cartão, total, vencimento e mês são obrigatórios." };
        }

        const parsedFloat = parseFloat(totalString.replace(",", "."));
        if (isNaN(parsedFloat) || parsedFloat < 0) {
            return { error: "Valor da fatura inválido." };
        }
        const totalCents = Math.round(parsedFloat * 100);

        const client = await pool.connect();
        try {
            const userRes = await client.query(
                "SELECT workspace_id FROM users WHERE id = $1",
                [session.userId]
            );
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado." };
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO invoices (workspace_id, card_id, month_ref, total_cents, due_date)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (workspace_id, card_id, month_ref) DO UPDATE
                 SET total_cents = EXCLUDED.total_cents,
                     due_date = EXCLUDED.due_date,
                     updated_at = CURRENT_TIMESTAMP`,
                [workspaceId, cardId, monthRef, totalCents, dueDate]
            );
        } finally {
            client.release();
        }

        revalidatePath("/invoices");
        return { success: true };
    } catch (err) {
        console.error("createInvoiceAction error:", err);
        return { error: "Erro interno ao criar fatura." };
    }
}
