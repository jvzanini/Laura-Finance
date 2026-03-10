"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function addPhoneAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        let phone_number = formData.get("phone_number") as string;
        const role = formData.get("role") as string;

        if (!name || !phone_number) {
            return { error: "Nome e Telefone são obrigatórios." };
        }

        // Normalização bruta do telefone (apenas números para bater com webhook e.164 formatação simples)
        phone_number = phone_number.replace(/\D/g, "");

        if (phone_number.length < 10) {
            return { error: "Número inválido. Insira código do país, DDD e telefone." };
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id, role FROM users WHERE id = $1", [session.userId]);
            const { workspace_id, role: userRole } = userRes.rows[0];

            if (userRole !== "proprietário" && userRole !== "administrador") {
                return { error: "Sem privilégios suficientes para adicionar membros." };
            }

            // Evita duplicação do mesmo número para outro workspace
            const phoneExists = await client.query("SELECT id FROM phones WHERE phone_number = $1", [phone_number]);
            if (phoneExists.rowCount && phoneExists.rowCount > 0) {
                return { error: "Este número já está em uso em um Workspace da Laura." };
            }

            await client.query(
                `INSERT INTO phones (workspace_id, name, phone_number, role)
         VALUES ($1, $2, $3, $4)`,
                [workspace_id, name, phone_number, role || "membro"]
            );

        } finally {
            client.release();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("DB Save Phone Error:", err);
        return { error: "Erro ao cadastrar autorização do número. " };
    }
}
