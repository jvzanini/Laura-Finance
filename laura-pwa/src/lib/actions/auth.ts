"use server";

import { pool } from "@/lib/db";
import { createSession, getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { DEFAULT_SEED_CATEGORIES } from "@/app/(dashboard)/categories/default-seed";

async function getCategoryTemplatesFromDB(): Promise<typeof DEFAULT_SEED_CATEGORIES | null> {
    try {
        const res = await pool.query(
            "SELECT name, emoji, color, description, subcategories FROM category_templates WHERE active = true ORDER BY sort_order"
        );
        if (res.rowCount && res.rowCount > 0) {
            return res.rows.map(r => ({
                name: r.name,
                emoji: r.emoji || "📂",
                color: r.color || "#808080",
                description: r.description || "",
                subcategories: (typeof r.subcategories === "string" ? JSON.parse(r.subcategories) : r.subcategories) || [],
            }));
        }
    } catch { /* fallback to hardcoded */ }
    return null;
}
import { createVerifyEmailToken } from "@/lib/verifyEmailToken";
import { sendVerifyEmailEmail } from "@/lib/email";

function buildAppUrl(path: string): string {
    const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "http://localhost:3100";
    return `${base}${path}`;
}

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

        // Auto-seed: popula o workspace novo com a taxonomia completa.
        // Tenta ler de category_templates (configurável via admin panel).
        // Se não houver templates no banco, usa o fallback hardcoded.
        const seedCategories = await getCategoryTemplatesFromDB() || DEFAULT_SEED_CATEGORIES;
        for (const cat of seedCategories) {
            const catRes = await client.query(
                `INSERT INTO categories (workspace_id, name, emoji, color, description, monthly_limit_cents)
                 VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
                [workspaceId, cat.name, cat.emoji, cat.color, cat.description]
            );
            const catId = catRes.rows[0].id;
            for (const sub of cat.subcategories) {
                await client.query(
                    `INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [workspaceId, catId, sub.name, sub.emoji, sub.description]
                );
            }
        }

        await client.query("COMMIT");

        const userId = userRes.rows[0].id;
        await createSession(userId);

        // Dispara email de verificação em best-effort (não bloqueia o
        // flow de register). Se o Resend falhar, o user já está logado
        // e pode usar "Reenviar verificação" via banner no dashboard.
        try {
            const token = createVerifyEmailToken(userId, email);
            await sendVerifyEmailEmail(email, buildAppUrl(`/verify-email/${token}`), name);
        } catch (emailErr) {
            console.warn("[register] verification email failed:", emailErr);
        }
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

/**
 * resendVerificationEmailAction reenvia o email de verificação para o
 * usuário logado. Usado pelo banner do dashboard quando
 * email_verified = false. Retorna { success: true } mesmo se o user
 * já estiver verificado (idempotente).
 */
export async function resendVerificationEmailAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const res = await pool.query(
            "SELECT id, name, email, email_verified FROM users WHERE id = $1 LIMIT 1",
            [session.userId]
        );
        if (res.rowCount === 0) return { error: "Usuário não encontrado." };

        const { id, name, email, email_verified } = res.rows[0];
        if (email_verified) return { success: true, alreadyVerified: true };

        const token = createVerifyEmailToken(id, email);
        await sendVerifyEmailEmail(email, buildAppUrl(`/verify-email/${token}`), name);
        return { success: true };
    } catch (err) {
        console.error("resendVerificationEmailAction error:", err);
        return { error: "Erro ao reenviar email de verificação." };
    }
}

/**
 * confirmEmailVerificationAction aplica o token, valida que o email
 * ainda bate com o user no banco, e marca email_verified = TRUE.
 * Chamada pela página /verify-email/[token] no mount.
 */
export async function confirmEmailVerificationAction(token: string) {
    try {
        const { verifyEmailToken } = await import("@/lib/verifyEmailToken");
        const verified = verifyEmailToken(token);
        if (!verified.valid) {
            return { error: verified.error };
        }

        const res = await pool.query(
            "SELECT id, email, email_verified FROM users WHERE id = $1 LIMIT 1",
            [verified.userId]
        );
        if (res.rowCount === 0) return { error: "Usuário não encontrado." };
        if (res.rows[0].email.toLowerCase() !== verified.email.toLowerCase()) {
            return { error: "Token não corresponde ao email atual do usuário." };
        }
        if (res.rows[0].email_verified) {
            return { success: true, alreadyVerified: true };
        }

        await pool.query(
            "UPDATE users SET email_verified = TRUE, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1",
            [verified.userId]
        );
        return { success: true };
    } catch (err) {
        console.error("confirmEmailVerificationAction error:", err);
        return { error: "Erro interno ao verificar email." };
    }
}
