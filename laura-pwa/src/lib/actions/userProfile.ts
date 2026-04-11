"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
    DEFAULT_SETTINGS,
    type UserProfile,
    type UserSettings,
} from "@/lib/types/userProfile";

// Re-export dos types para que quem importa de "@/lib/actions/userProfile"
// continue funcionando sem precisar mudar o import path.
// Arquivos com "use server" no topo (Next 15/16) só podem exportar async
// functions — por isso o type + const concretos vivem em @/lib/types/userProfile.
export type { UserProfile, UserSettings };

/**
 * fetchUserProfileAction devolve os dados do usuário logado junto com
 * o nome do workspace associado. Usado na tela /settings.
 */
export async function fetchUserProfileAction(): Promise<UserProfile | null> {
    try {
        const session = await getSession();
        if (!session || !session.userId) return null;

        const res = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, w.name AS workspace_name,
                    u.phone_number, u.settings, u.email_verified
             FROM users u
             JOIN workspaces w ON w.id = u.workspace_id
             WHERE u.id = $1
             LIMIT 1`,
            [session.userId]
        );

        if (res.rowCount === 0) return null;
        const r = res.rows[0];
        const rawSettings = (r.settings ?? {}) as Partial<UserSettings>;
        const settings: UserSettings = {
            hideBalances: rawSettings.hideBalances ?? DEFAULT_SETTINGS.hideBalances,
            notifications: rawSettings.notifications ?? DEFAULT_SETTINGS.notifications,
            darkMode: rawSettings.darkMode ?? DEFAULT_SETTINGS.darkMode,
        };
        return {
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            workspaceName: r.workspace_name,
            phoneNumber: r.phone_number ?? null,
            emailVerified: Boolean(r.email_verified),
            settings,
        };
    } catch (err) {
        console.error("fetchUserProfileAction error:", err);
        return null;
    }
}

/**
 * updateUserProfileAction atualiza campos editáveis do perfil (nome,
 * email, phone_number). Valida email único dentro da tabela users —
 * retorna erro se outro user já usa esse email. Campos não fornecidos
 * (strings vazias) são ignorados.
 */
export async function updateUserProfileAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const name = (formData.get("name") as string | null)?.trim() ?? "";
        const email = (formData.get("email") as string | null)?.trim() ?? "";
        const phoneNumberRaw = (formData.get("phone_number") as string | null)?.trim() ?? "";

        if (!name || !email) {
            return { error: "Nome e e-mail são obrigatórios." };
        }
        if (!email.includes("@")) {
            return { error: "E-mail inválido." };
        }

        const phoneNumber = phoneNumberRaw ? phoneNumberRaw.replace(/\D/g, "") : null;

        const client = await pool.connect();
        try {
            const dupe = await client.query(
                "SELECT id FROM users WHERE email = $1 AND id != $2",
                [email, session.userId]
            );
            if (dupe.rowCount && dupe.rowCount > 0) {
                return { error: "Este e-mail já está em uso por outro usuário." };
            }

            await client.query(
                `UPDATE users
                 SET name = $1,
                     email = $2,
                     phone_number = $3
                 WHERE id = $4`,
                [name, email, phoneNumber, session.userId]
            );
        } finally {
            client.release();
        }

        revalidatePath("/settings");
        return { success: true };
    } catch (err) {
        console.error("updateUserProfileAction error:", err);
        return { error: "Erro interno ao atualizar o perfil." };
    }
}

/**
 * updateUserSettingsAction faz merge das preferências (hideBalances,
 * notifications, darkMode) no campo settings JSONB do usuário logado.
 * Aceita um Partial<UserSettings> para atualizações parciais, mas na
 * prática o SettingsView sempre envia o shape completo.
 */
export async function updateUserSettingsAction(settings: Partial<UserSettings>) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        // Sanitize: apenas campos conhecidos. Evita acidente de persistir
        // chave arbitrária vinda do client.
        const sanitized: Partial<UserSettings> = {};
        if (typeof settings.hideBalances === "boolean") sanitized.hideBalances = settings.hideBalances;
        if (typeof settings.notifications === "boolean") sanitized.notifications = settings.notifications;
        if (typeof settings.darkMode === "boolean") sanitized.darkMode = settings.darkMode;

        await pool.query(
            `UPDATE users
             SET settings = settings || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify(sanitized), session.userId]
        );

        revalidatePath("/settings");
        return { success: true };
    } catch (err) {
        console.error("updateUserSettingsAction error:", err);
        return { error: "Erro ao salvar preferências." };
    }
}

/**
 * changePasswordAction muda a senha do user logado após validar a
 * senha atual via bcrypt.compare. Retorna erro específico se a atual
 * estiver errada.
 */
export async function changePasswordAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const currentPassword = formData.get("currentPassword") as string;
        const newPassword = formData.get("newPassword") as string;

        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return { error: "Informe a senha atual e uma nova senha com 6+ caracteres." };
        }

        const client = await pool.connect();
        try {
            const res = await client.query(
                "SELECT password_hash FROM users WHERE id = $1",
                [session.userId]
            );
            if (res.rowCount === 0) {
                return { error: "Usuário não encontrado." };
            }
            const match = await bcrypt.compare(currentPassword, res.rows[0].password_hash);
            if (!match) {
                return { error: "Senha atual incorreta." };
            }
            const newHash = await bcrypt.hash(newPassword, 10);
            await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, session.userId]);
        } finally {
            client.release();
        }
        return { success: true };
    } catch (err) {
        console.error("changePasswordAction error:", err);
        return { error: "Erro interno ao trocar a senha." };
    }
}
