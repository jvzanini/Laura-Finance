"use server";

import { pool } from "@/lib/db";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function registerAction(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!name || !email || !password || password.length < 6) {
        return { error: "Por favor, preencha todos os campos e utilize uma senha de 6+ caracteres." };
    }

    // Criptografia AES / Hash usando BCrypt para segurança no Postgres
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Check if user already exists
        const checkExistent = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (checkExistent.rowCount && checkExistent.rowCount > 0) {
            await client.query("ROLLBACK");
            return { error: "E-mail já está em uso." };
        }

        // Criar uma Conta Tenant / Workspace da familia
        const wsName = `Espaço de ${name.split(" ")[0]}`;
        const wsRes = await client.query(
            "INSERT INTO workspaces (name) VALUES ($1) RETURNING id",
            [wsName]
        );
        const workspaceId = wsRes.rows[0].id;

        // Criar Usuário como Proprietário
        const userRes = await client.query(
            "INSERT INTO users (workspace_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [workspaceId, name, email, passwordHash, "proprietário"]
        );

        await client.query("COMMIT");

        const userId = userRes.rows[0].id;
        await createSession(userId);

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Database error:", err);
        return { error: "Ocorreu um erro interno. Tente mais tarde." };
    } finally {
        client.release();
    }

    redirect("/dashboard");
}
