"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addCardAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        const brand = formData.get("brand") as string;
        const color = formData.get("color") as string;
        const closing_day = parseInt(formData.get("closing_day") as string, 10);
        const due_day = parseInt(formData.get("due_day") as string, 10);
        const last_four = formData.get("last_four") as string;

        if (!name || isNaN(closing_day) || isNaN(due_day)) {
            return { error: "Nome e datas de vencimento/fechamento são obrigatórios." };
        }

        const client = await pool.connect();
        try {
            // Find Workspace ID for user
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO cards (workspace_id, name, brand, color, closing_day, due_day, last_four)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [workspaceId, name, brand, color, closing_day, due_day, last_four]
            );

        } finally {
            client.release();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("DB Save Card Error:", err);
        return { error: "Erro ao salvar o cartão." };
    }
}
