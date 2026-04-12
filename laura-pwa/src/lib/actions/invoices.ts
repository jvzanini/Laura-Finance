"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoDebtRolloverItem = {
    id: string;
    date: string;
    card: string;
    card_color: string;
    institution: string;
    invoice_value_cents: number;
    total_fees_cents: number;
    total_operations: number;
    installments: string;
    status: string;
};
type GoDebtRolloversResponse = { rollovers: GoDebtRolloverItem[] | null };

export async function addDebtRolloverAction(data: {
    cardId: string;
    institution: string;
    invoiceValueCents: number;
    totalFeesCents: number;
    totalOperations: number;
    installments: string;
    feePercentage: number;
    operationsJson: string; // stringified JSON
}) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        try {
            const goResp = await callLauraGo<{ id: string; success: boolean }>("/api/v1/debt-rollovers", {
                method: "POST",
                body: {
                    card_id: data.cardId,
                    institution: data.institution,
                    invoice_value_cents: data.invoiceValueCents,
                    total_fees_cents: data.totalFeesCents,
                    total_operations: data.totalOperations,
                    installments: data.installments,
                    fee_percentage: data.feePercentage,
                    operations_json: data.operationsJson,
                },
            });
            if (goResp) {
                revalidatePath("/invoices/history");
                return { success: true };
            }
        } catch (err) {
            console.warn("[debt-rollovers:add] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO debt_rollovers (
                    workspace_id, card_id, institution, invoice_value_cents,
                    total_fees_cents, total_operations, installments, fee_percentage, operations_json
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    workspaceId, data.cardId, data.institution, data.invoiceValueCents,
                    data.totalFeesCents, data.totalOperations, data.installments,
                    data.feePercentage, data.operationsJson
                ]
            );
        } finally {
            client.release();
        }

        revalidatePath("/invoices/history");
        return { success: true };
    } catch (err) {
        console.error("Save rollover error:", err);
        return { error: "Erro interno ao salvar simulação de empurrar fatura." };
    }
}

export async function fetchDebtRolloversAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        try {
            const goResponse = await callLauraGo<GoDebtRolloversResponse>("/api/v1/debt-rollovers");
            if (goResponse) {
                const rollovers = (goResponse.rollovers ?? []).map((r) => ({
                    id: r.id,
                    date: r.date,
                    card: r.card,
                    cardColor: r.card_color,
                    institution: r.institution,
                    invoiceValue: r.invoice_value_cents,
                    totalFees: r.total_fees_cents,
                    totalOperations: r.total_operations,
                    installments: r.installments,
                    status: r.status,
                }));
                return { rollovers };
            }
        } catch (err) {
            console.warn("[debt-rollovers] laura-go failed, fallback:", err);
        }

        const res = await pool.query(
            `SELECT dr.id, dr.created_at as date, c.name as card_name, c.color as card_color, 
                    dr.institution, dr.invoice_value_cents, dr.total_fees_cents, 
                    dr.total_operations, dr.installments, dr.status
             FROM debt_rollovers dr
             JOIN users u ON u.workspace_id = dr.workspace_id
             LEFT JOIN cards c ON c.id = dr.card_id
             WHERE u.id = $1
             ORDER BY dr.created_at DESC`,
            [session.userId]
        );
        
        const rollovers = res.rows.map(r => ({
            id: r.id,
            date: r.date,
            card: r.card_name || "Cartão Excluído",
            cardColor: r.card_color || "#808080",
            institution: r.institution,
            invoiceValue: r.invoice_value_cents,
            totalFees: r.total_fees_cents,
            totalOperations: r.total_operations,
            installments: r.installments,
            status: r.status
        }));
        
        return { rollovers };
    } catch (err) {
        console.error("Fetch rollovers error:", err);
        return { error: "Erro ao buscar histórico de empurradas." };
    }
}
