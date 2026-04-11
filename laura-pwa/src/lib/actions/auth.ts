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

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const checkExistent = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (checkExistent.rowCount && checkExistent.rowCount > 0) {
            await client.query("ROLLBACK");
            return { error: "E-mail já está em uso." };
        }

        const wsName = `Espaço de ${name.split(" ")[0]}`;
        const wsRes = await client.query(
            "INSERT INTO workspaces (name) VALUES ($1) RETURNING id",
            [wsName]
        );
        const workspaceId = wsRes.rows[0].id;

        const userRes = await client.query(
            "INSERT INTO users (workspace_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [workspaceId, name, email, passwordHash, "proprietário"]
        );

        await client.query("COMMIT");

        const userId = userRes.rows[0].id;
        await createSession(userId);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Database error (register):", err);
        return { error: "Ocorreu um erro interno. Tente mais tarde." };
    } finally {
        client.release();
    }

    redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Por favor, preencha e-mail e senha." };
    }

    let userId: string | null = null;

    try {
        const result = await pool.query(
            "SELECT id, password_hash FROM users WHERE email = $1",
            [email]
        );

        if (result.rowCount === 0) {
            return { error: "E-mail ou senha inválidos." };
        }

        const { id, password_hash } = result.rows[0];
        const match = await bcrypt.compare(password, password_hash);

        if (!match) {
            return { error: "E-mail ou senha inválidos." };
        }

        userId = id;
    } catch (err) {
        console.error("Database error (login):", err);
        return { error: "Ocorreu um erro interno. Tente mais tarde." };
    }

    await createSession(userId!);
    redirect("/dashboard");
}
