"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoGoalItem = {
    id: string;
    name: string;
    description: string | null;
    emoji: string;
    target_cents: number;
    current_cents: number;
    deadline: string | null;
    color: string;
    status: string;
    created_at: string;
};

type GoGoalsResponse = {
    goals: GoGoalItem[] | null;
};

export async function addGoalAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        const targetString = formData.get("target") as string;
        const deadline = formData.get("deadline") as string;
        const emoji = formData.get("emoji") as string;
        const color = formData.get("color") as string;

        if (!name || !targetString || !deadline) {
            return { error: "Nome, meta e prazo são obrigatórios." };
        }

        const parsedFloat = parseFloat(targetString.replace(",", "."));
        if (isNaN(parsedFloat) || parsedFloat <= 0) {
            return { error: "Valor de meta inválido." };
        }
        const targetCents = Math.round(parsedFloat * 100);

        try {
            const goResp = await callLauraGo<{ id: string; success: boolean }>("/api/v1/goals", {
                method: "POST",
                body: {
                    name,
                    target_cents: targetCents,
                    deadline: deadline || null,
                    emoji: emoji || "🎯",
                    color: color || "#8B5CF6",
                },
            });
            if (goResp) {
                revalidatePath("/goals");
                return { success: true };
            }
        } catch (err) {
            console.warn("[goals:add] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO financial_goals (workspace_id, name, target_cents, deadline, emoji, color)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [workspaceId, name, targetCents, deadline, emoji || "🎯", color || "#8B5CF6"]
            );
        } finally {
            client.release();
        }

        revalidatePath("/goals");
        return { success: true };
    } catch (err) {
        console.error("Save goal error:", err);
        return { error: "Erro interno ao salvar objetivo." };
    }
}

export async function fetchGoalsAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão ativa." };

        // Tenta API Go primeiro
        try {
            const goResponse = await callLauraGo<GoGoalsResponse>("/api/v1/goals");
            if (goResponse) {
                const goals = (goResponse.goals ?? []).map((g) => ({
                    id: g.id,
                    name: g.name,
                    description: g.description,
                    emoji: g.emoji,
                    targetAmount: g.target_cents / 100,
                    currentAmount: g.current_cents / 100,
                    deadline: g.deadline,
                    color: g.color,
                    status: g.status,
                }));
                return { goals };
            }
        } catch (err) {
            console.warn("[goals] laura-go failed, fallback:", err);
        }

        const res = await pool.query(
            `SELECT g.id, g.name, g.description, g.emoji, g.target_cents, g.current_cents, g.deadline, g.color, g.status
             FROM financial_goals g
             JOIN users u ON u.workspace_id = g.workspace_id
             WHERE u.id = $1
             ORDER BY g.created_at DESC`,
            [session.userId]
        );
        
        const goals = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            emoji: r.emoji,
            targetAmount: r.target_cents / 100,
            currentAmount: r.current_cents / 100,
            deadline: r.deadline,
            color: r.color,
            status: r.status
        }));
        
        return { goals: goals };
    } catch (err) {
        console.error("Fetch goals error:", err);
        return { error: "Erro ao buscar objetivos." };
    }
}
