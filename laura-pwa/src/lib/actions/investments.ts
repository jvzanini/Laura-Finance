"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addInvestmentAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        const broker = formData.get("broker") as string;
        const type = formData.get("type") as string;
        const investedString = formData.get("invested_amount") as string;
        const currentString = formData.get("current_amount") as string;
        const monthlyString = formData.get("monthly_contribution") as string;

        if (!name || !broker || !investedString) {
            return { error: "Nome, corretora e valor investido são obrigatórios." };
        }

        const investedCents = Math.round(parseFloat(investedString.replace(",", ".")) * 100);
        const currentCents = currentString ? Math.round(parseFloat(currentString.replace(",", ".")) * 100) : investedCents;
        const monthlyCents = monthlyString ? Math.round(parseFloat(monthlyString.replace(",", ".")) * 100) : 0;

        if (isNaN(investedCents)) return { error: "Valores inválidos." };

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO investments (workspace_id, name, broker, type, invested_cents, current_cents, monthly_contribution_cents)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [workspaceId, name, broker, type || "Investimentos", investedCents, currentCents, monthlyCents]
            );
        } finally {
            client.release();
        }

        revalidatePath("/investments");
        return { success: true };
    } catch (err) {
        console.error("Save investment error:", err);
        return { error: "Erro interno ao salvar investimento." };
    }
}

export async function fetchInvestmentsAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const res = await pool.query(
            `SELECT i.id, i.name, i.broker, i.type, i.invested_cents, i.current_cents, i.monthly_contribution_cents, i.emoji
             FROM investments i
             JOIN users u ON u.workspace_id = i.workspace_id
             WHERE u.id = $1
             ORDER BY i.current_cents DESC`,
            [session.userId]
        );
        
        const investments = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            broker: r.broker,
            type: r.type,
            investedAmount: r.invested_cents / 100,
            currentAmount: r.current_cents / 100,
            monthlyContribution: r.monthly_contribution_cents / 100,
            emoji: r.emoji
        }));
        
        return { investments: investments };
    } catch (err) {
        console.error("Fetch investments error:", err);
        return { error: "Erro ao buscar investimentos." };
    }
}
