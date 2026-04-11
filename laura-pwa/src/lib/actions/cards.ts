"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoCardItem = {
    id: string;
    name: string;
    brand: string | null;
    color: string;
    closing_day: number | null;
    due_day: number | null;
    last_four: string | null;
    card_type: string;
    bank_broker: string | null;
    holder: string | null;
    credit_limit_cents: number;
};

type GoCardsResponse = { cards: GoCardItem[] | null };

export async function addCardAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        const name = formData.get("name") as string;
        const brand = formData.get("brand") as string;
        const color = formData.get("color") as string;
        const closing_day = parseInt(formData.get("closingDay") as string, 10);
        const due_day = parseInt(formData.get("dueDay") as string, 10);
        const last_four = formData.get("lastFour") as string;
        
        // New fields
        const card_type = formData.get("type") as string;
        const bank_broker = formData.get("bankBroker") as string;
        const holder = formData.get("holder") as string;
        const creditLimitStr = formData.get("creditLimit") as string;

        if (!name || isNaN(closing_day) || isNaN(due_day)) {
            return { error: "Nome e datas de vencimento/fechamento são obrigatórios." };
        }
        
        const credit_limit_cents = creditLimitStr ? Math.round(parseFloat(creditLimitStr.replace(",", ".")) * 100) : 0;

        try {
            const goResp = await callLauraGo<{ id: string; success: boolean }>("/api/v1/cards", {
                method: "POST",
                body: {
                    name,
                    brand: brand || null,
                    color: color || "#7C3AED",
                    closing_day: closing_day,
                    due_day: due_day,
                    last_four: last_four || null,
                    card_type: card_type || "ambos",
                    bank_broker: bank_broker || null,
                    holder: holder || null,
                    credit_limit_cents,
                },
            });
            if (goResp) {
                revalidatePath("/cards");
                return { success: true };
            }
        } catch (err) {
            console.warn("[cards:add] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO cards (workspace_id, name, brand, color, closing_day, due_day, last_four, card_type, bank_broker, holder, credit_limit_cents)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [workspaceId, name, brand, color, closing_day, due_day, last_four, card_type || 'ambos', bank_broker, holder, credit_limit_cents]
            );
        } finally {
            client.release();
        }

        revalidatePath("/cards");
        return { success: true };
    } catch (err) {
        console.error("DB Save Card Error:", err);
        return { error: "Erro ao salvar o cartão." };
    }
}

export async function fetchCardsAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        try {
            const goResponse = await callLauraGo<GoCardsResponse>("/api/v1/cards");
            if (goResponse) {
                const cards = (goResponse.cards ?? []).map((c) => ({
                    id: c.id,
                    name: c.name,
                    brand: c.brand,
                    type: c.card_type,
                    color: c.color,
                    lastFour: c.last_four,
                    closingDay: c.closing_day,
                    dueDay: c.due_day,
                    bankBroker: c.bank_broker,
                    holder: c.holder,
                    creditLimit: c.credit_limit_cents,
                }));
                return { cards };
            }
        } catch (err) {
            console.warn("[cards] laura-go failed, fallback:", err);
        }

        const res = await pool.query(
            `SELECT c.id, c.name, c.brand, c.color, c.closing_day, c.due_day, c.last_four, c.card_type, c.bank_broker, c.holder, c.credit_limit_cents
             FROM cards c
             JOIN users u ON u.workspace_id = c.workspace_id
             WHERE u.id = $1
             ORDER BY c.created_at DESC`,
            [session.userId]
        );
        
        const cards = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            brand: r.brand,
            type: r.card_type,
            color: r.color,
            lastFour: r.last_four,
            closingDay: r.closing_day,
            dueDay: r.due_day,
            bankBroker: r.bank_broker,
            holder: r.holder,
            creditLimit: r.credit_limit_cents
        }));
        
        return { cards: cards };
    } catch (err) {
        console.error("Fetch cards error:", err);
        return { error: "Erro ao buscar cartões." };
    }
}

export async function deleteCardAction(id: string) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Acesso negado." };

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspace_id = userRes.rows[0].workspace_id;

            await client.query("DELETE FROM cards WHERE id = $1 AND workspace_id = $2", [id, workspace_id]);
        } finally {
            client.release();
        }

        revalidatePath("/cards");
        return { success: true };
    } catch (err) {
        console.error("Delete card error:", err);
        return { error: "Erro ao excluir cartão." };
    }
}
