"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addCategoryAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        const limitString = formData.get("limit") as string;
        const color = formData.get("color") as string;

        if (!name || !limitString) {
            return { error: "Nome e Teto Orçamentário são obrigatórios." };
        }

        // Convert string localized value to integer cents
        // Handle "2000", "2000,50", "2000.50"
        const parsedFloat = parseFloat(limitString.replace(",", "."));
        if (isNaN(parsedFloat) || parsedFloat < 0) {
            return { error: "Valor de teto inválido." };
        }
        const limitCents = Math.round(parsedFloat * 100);

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO categories (workspace_id, name, monthly_limit_cents, color)
         VALUES ($1, $2, $3, $4)`,
                [workspaceId, name, limitCents, color]
            );
        } finally {
            client.release();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("Save Category Error:", err);
        return { error: "Erro ao salvar o orçamento." };
    }
}
