"use server";

import { pool } from "@/lib/db";
import { getSession, deleteSession } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { redirect } from "next/navigation";

export async function deleteAccountAction(formData: FormData) {
    const confirmText = formData.get("confirmString") as string;
    if (confirmText !== "DELETAR MINHA CONTA") {
        return { error: "A frase de confirmação não confere." };
    }

    const session = await getSession();
    if (!session || !session.userId) {
        return { error: "Sem sessão." };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Obter dados do workspace para hard delete
        const userRes = await client.query("SELECT workspace_id, role FROM users WHERE id = $1", [session.userId]);

        if (userRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return { error: "Usuário não encontrado." };
        }

        const { workspace_id, role } = userRes.rows[0];

        if (role !== "proprietário") {
            await client.query("ROLLBACK");
            return { error: "Apenas o proprietário do Workspace pode invocar a Exclusão Definitiva (Hard Delete)." };
        }

        const wsRes = await client.query("SELECT stripe_subscription_id, plan_status FROM workspaces WHERE id = $1", [workspace_id]);
        const { stripe_subscription_id } = wsRes.rows[0];

        // Se houver assinatura, cancelar na Stripe para evitar cobranças indevidas pós-extinção
        if (stripe_subscription_id) {
            try {
                await stripe.subscriptions.cancel(stripe_subscription_id);
            } catch (stripeError) {
                console.error("Cancelamento no Stripe falhou silenciosamente (provavel ambiente mockado ou key fake): ", stripeError);
            }
        }

        // Hard Delete: como a tabela USERS e as demais possuem CASCADE,
        // Deletar o Workspace destruirá tudo atomicamente para cumprir a Lei (LGPD)
        await client.query("DELETE FROM workspaces WHERE id = $1", [workspace_id]);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("LGPD Deletion error:", error);
        return { error: "Falha na desintegração de seus dados. Contate o suporte técnico." };
    } finally {
        client.release();
    }

    // Finalização do ciclo destruindo sessão Client-side no Next (Cookies)
    await deleteSession();
    redirect("/");
}
