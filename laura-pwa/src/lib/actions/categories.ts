"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoSubcategoryItem = {
    id: string;
    name: string;
    emoji: string | null;
    description: string | null;
};

type GoCategoryItem = {
    id: string;
    name: string;
    emoji: string | null;
    color: string;
    description: string | null;
    monthly_limit_cents: number;
    subcategories: GoSubcategoryItem[];
};

type GoCategoriesResponse = { categories: GoCategoryItem[] | null };

export async function addCategoryAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        const limitString = formData.get("limit") as string;
        const color = formData.get("color") as string;
        const emoji = formData.get("emoji") as string;
        const description = formData.get("description") as string;

        if (!name || !limitString) {
            return { error: "Nome e Teto Orçamentário são obrigatórios." };
        }

        const parsedFloat = parseFloat(limitString.replace(",", "."));
        if (isNaN(parsedFloat) || parsedFloat < 0) {
            return { error: "Valor de teto inválido." };
        }
        const limitCents = Math.round(parsedFloat * 100);

        try {
            const goResp = await callLauraGo<{ id: string; success: boolean }>("/api/v1/categories", {
                method: "POST",
                body: { name, emoji, color, description, monthly_limit_cents: limitCents },
            });
            if (goResp) {
                revalidatePath("/categories");
                return { success: true };
            }
        } catch (err) {
            console.warn("[categories:add] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            await client.query(
                `INSERT INTO categories (workspace_id, name, monthly_limit_cents, color, emoji, description)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [workspaceId, name, limitCents, color, emoji, description]
            );
        } finally {
            client.release();
        }

        revalidatePath("/categories");
        return { success: true };
    } catch (err) {
        console.error("Save category error:", err);
        return { error: "Erro interno ao salvar." };
    }
}

export async function fetchCategoriesAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Não autorizado." };

        try {
            const goResponse = await callLauraGo<GoCategoriesResponse>("/api/v1/categories");
            if (goResponse) {
                const categories = (goResponse.categories ?? []).map((c) => ({
                    id: c.id,
                    name: c.name,
                    emoji: c.emoji || "📁",
                    color: c.color || "#808080",
                    description: c.description || "",
                    monthlyLimit: c.monthly_limit_cents / 100,
                    subcategories: (c.subcategories ?? []).map((s) => ({
                        id: s.id,
                        name: s.name,
                        emoji: s.emoji || "📄",
                        description: s.description || "",
                    })),
                }));
                return { categories };
            }
        } catch (err) {
            console.warn("[categories] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado." };
            const workspaceId = userRes.rows[0].workspace_id;

            const catRes = await client.query(
                "SELECT id, name, emoji, color, description, monthly_limit_cents FROM categories WHERE workspace_id = $1 ORDER BY name ASC",
                [workspaceId]
            );

            const subRes = await client.query(
                "SELECT id, category_id, name, emoji, description FROM subcategories WHERE workspace_id = $1",
                [workspaceId]
            );

            const categories = catRes.rows.map(c => {
                return {
                    id: c.id,
                    name: c.name,
                    emoji: c.emoji || "📁",
                    color: c.color || "#808080",
                    description: c.description || "",
                    monthlyLimit: c.monthly_limit_cents / 100,
                    subcategories: subRes.rows.filter(s => s.category_id === c.id).map(s => ({
                        id: s.id,
                        name: s.name,
                        emoji: s.emoji || "📄",
                        description: s.description || ""
                    }))
                };
            });

            return { categories };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Fetch categories error:", err);
        return { error: "Erro interno ao buscar." };
    }
}

export async function fetchCategorySummariesAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Não autorizado." };

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            if (userRes.rowCount === 0) return { error: "Workspace não encontrado." };

            const workspaceId = userRes.rows[0].workspace_id;
            const catRes = await client.query("SELECT id, name FROM categories WHERE workspace_id = $1 ORDER BY name ASC", [workspaceId]);

            return { categories: catRes.rows.map(r => ({ id: r.id, name: r.name })) };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Fetch categories summaries error:", err);
        return { error: "Erro interno ao buscar." };
    }
}

async function getCategoryTemplatesFromDB() {
    try {
        const result = await pool.query(
            "SELECT name, emoji, color, description, subcategories FROM category_templates WHERE active = true ORDER BY sort_order"
        );
        if (result.rowCount === 0) return null;
        return result.rows.map((r: any) => {
            const subs = typeof r.subcategories === "string" ? JSON.parse(r.subcategories) : (r.subcategories || []);
            return {
                name: r.name,
                emoji: r.emoji || "📂",
                color: r.color || "#808080",
                description: r.description || "",
                subcategories: subs.map((s: any) => ({
                    name: s.name,
                    emoji: s.emoji || "📄",
                    description: s.description || "",
                })),
            };
        });
    } catch {
        return null;
    }
}

export async function seedCategoriesAction(categoriesData: any) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Não autorizado." };

        // Use admin-configured templates from DB if available
        const dbTemplates = await getCategoryTemplatesFromDB();
        const seedData = dbTemplates && dbTemplates.length > 0 ? dbTemplates : categoriesData;

        try {
            const goResp = await callLauraGo<{ success: boolean }>("/api/v1/categories/seed", {
                method: "POST",
                body: { categories: seedData },
            });
            if (goResp) {
                revalidatePath("/categories");
                return { success: true };
            }
        } catch (err) {
            console.warn("[categories:seed] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [session.userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            for (const cat of seedData) {
                const res = await client.query(
                    `INSERT INTO categories (workspace_id, name, emoji, color, description, monthly_limit_cents)
                     VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
                    [workspaceId, cat.name, cat.emoji, cat.color, cat.description]
                );
                const catId = res.rows[0].id;

                for (const sub of cat.subcategories) {
                    await client.query(
                        `INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [workspaceId, catId, sub.name, sub.emoji, sub.description]
                    );
                }
            }

            await client.query("COMMIT");
            revalidatePath("/categories");
            return { success: true };
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Seed categories error:", err);
        return { error: "Erro interno ao popular categorias." };
    }
}
