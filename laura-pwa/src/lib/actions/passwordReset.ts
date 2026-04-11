"use server";

import { pool } from "@/lib/db";
import { createResetToken, verifyResetToken } from "@/lib/resetToken";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

/**
 * requestPasswordResetAction recebe um email, olha se existe, gera um
 * token HMAC-SHA256 válido por 30min e dispara o email via Resend.
 *
 * Importante: sempre devolve { success: true } mesmo quando o email
 * não existe — evita oracle de enumeração de usuários. O erro só
 * aparece em caso de falha interna (banco, envio de email).
 */
export async function requestPasswordResetAction(formData: FormData) {
    try {
        const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
        if (!email || !email.includes("@")) {
            return { error: "Informe um e-mail válido." };
        }

        const res = await pool.query(
            "SELECT id, name FROM users WHERE LOWER(email) = $1 LIMIT 1",
            [email]
        );

        if (res.rowCount && res.rowCount > 0) {
            const { id, name } = res.rows[0];
            const token = createResetToken(id, email);

            const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.APP_URL ||
                "http://localhost:3100";
            const resetUrl = `${baseUrl}/reset-password/${token}`;

            // Envia em background — se Resend falhar, log mas não bloqueia
            // o usuário. Em produção, idealmente via queue retriable.
            await sendPasswordResetEmail(email, resetUrl, name);
        }

        return { success: true };
    } catch (err) {
        console.error("requestPasswordResetAction error:", err);
        return { error: "Erro interno ao processar a solicitação." };
    }
}

/**
 * confirmPasswordResetAction verifica o token, valida que o userId +
 * email ainda casam no banco (evita uso após mudança de email), e
 * atualiza o password_hash com bcrypt.
 */
export async function confirmPasswordResetAction(formData: FormData) {
    try {
        const token = (formData.get("token") as string | null) ?? "";
        const newPassword = (formData.get("newPassword") as string | null) ?? "";

        if (!newPassword || newPassword.length < 6) {
            return { error: "A nova senha precisa ter 6+ caracteres." };
        }

        const verified = verifyResetToken(token);
        if (!verified.valid) {
            return { error: verified.error };
        }

        // Re-checa que o user ainda existe com o email do payload.
        // Se trocou de email entre request e confirm, invalida o token.
        const res = await pool.query(
            "SELECT id, email FROM users WHERE id = $1 LIMIT 1",
            [verified.userId]
        );
        if (res.rowCount === 0) {
            return { error: "Usuário não encontrado." };
        }
        if (res.rows[0].email.toLowerCase() !== verified.email.toLowerCase()) {
            return { error: "Token não corresponde mais ao email do usuário. Solicite um novo reset." };
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            [hash, verified.userId]
        );

        return { success: true };
    } catch (err) {
        console.error("confirmPasswordResetAction error:", err);
        return { error: "Erro interno ao redefinir a senha." };
    }
}
