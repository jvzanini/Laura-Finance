"use server";

import { assertSuperAdmin } from "@/lib/actions/admin";
import { callLauraGo } from "@/lib/apiClient";
import { pool } from "@/lib/db";

// ─── System Config ───

export async function fetchAdminConfigAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ configs: any[] }>("/api/v1/admin/config");
        if (res) return { configs: res.configs };
    } catch { /* fallback */ }

    const result = await pool.query("SELECT key, value, description FROM system_config ORDER BY key");
    return { configs: result.rows };
}

export async function updateAdminConfigAction(key: string, value: any) {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ success: boolean }>(`/api/v1/admin/config/${key}`, {
            method: "PUT", body: { value },
        });
        if (res) return { success: true };
    } catch { /* fallback */ }

    await pool.query("UPDATE system_config SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = $2",
        [JSON.stringify(value), key]);
    return { success: true };
}

// ─── Plans ───

export async function fetchAdminPlansAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ plans: any[] }>("/api/v1/admin/plans");
        if (res) return { plans: res.plans };
    } catch { /* fallback */ }

    const result = await pool.query("SELECT row_to_json(t) as data FROM subscription_plans t ORDER BY sort_order");
    return { plans: result.rows.map(r => r.data) };
}

// ─── Payment Processors ───

export async function fetchAdminProcessorsAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ processors: any[] }>("/api/v1/admin/processors");
        if (res) return { processors: res.processors };
    } catch { /* fallback */ }

    const result = await pool.query("SELECT row_to_json(t) as data FROM payment_processors t ORDER BY name");
    return { processors: result.rows.map(r => r.data) };
}

// ─── Generic Options ───

async function fetchAdminOptions(goPath: string, table: string) {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ items: any[] }>(goPath);
        if (res) return { items: res.items };
    } catch { /* fallback */ }

    const result = await pool.query(`SELECT row_to_json(t) as data FROM ${table} t ORDER BY sort_order, name`);
    return { items: result.rows.map(r => r.data) };
}

export async function fetchAdminBanksAction() { return fetchAdminOptions("/api/v1/admin/banks", "bank_options"); }
export async function fetchAdminCardBrandsAction() { return fetchAdminOptions("/api/v1/admin/card-brands", "card_brand_options"); }
export async function fetchAdminBrokersAction() { return fetchAdminOptions("/api/v1/admin/brokers", "broker_options"); }
export async function fetchAdminInvestmentTypesAction() { return fetchAdminOptions("/api/v1/admin/investment-types", "investment_type_options"); }
export async function fetchAdminGoalTemplatesAction() { return fetchAdminOptions("/api/v1/admin/goal-templates", "goal_templates"); }
export async function fetchAdminCategoryTemplatesAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ templates: any[] }>("/api/v1/admin/category-templates");
        if (res) return { templates: res.templates };
    } catch { /* fallback */ }

    const result = await pool.query("SELECT row_to_json(t) as data FROM category_templates t ORDER BY sort_order");
    return { templates: result.rows.map(r => r.data) };
}

// ─── Workspaces ───

export async function fetchAdminWorkspacesAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ workspaces: any[] }>("/api/v1/admin/workspaces");
        if (res) return { workspaces: res.workspaces };
    } catch { /* fallback */ }

    const result = await pool.query(
        `SELECT w.id, w.name, w.plan_slug, w.suspended_at, w.created_at,
                u.name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*)::int FROM users WHERE workspace_id = w.id) AS member_count,
                (SELECT COUNT(*)::int FROM transactions WHERE workspace_id = w.id) AS tx_count
         FROM workspaces w
         JOIN users u ON u.workspace_id = w.id AND u.role = 'proprietário'
         ORDER BY w.created_at DESC`
    );
    return { workspaces: result.rows };
}

// ─── Audit Log ───

export async function fetchAdminAuditLogAction() {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ entries: any[] }>("/api/v1/admin/audit-log");
        if (res) return { entries: res.entries };
    } catch { /* fallback */ }

    const result = await pool.query(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_value, a.new_value,
                a.created_at, u.name AS admin_name
         FROM admin_audit_log a JOIN users u ON u.id = a.admin_user_id
         ORDER BY a.created_at DESC LIMIT 100`
    );
    return { entries: result.rows };
}

export async function fetchAdminAuditLogFilteredAction(filters?: {
    action?: string;
    entity_type?: string;
    admin_user_id?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<{ entries: any[]; total: number } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters?.action) {
        conditions.push(`a.action = $${idx++}`);
        params.push(filters.action);
    }
    if (filters?.entity_type) {
        conditions.push(`a.entity_type = $${idx++}`);
        params.push(filters.entity_type);
    }
    if (filters?.admin_user_id) {
        conditions.push(`a.admin_user_id = $${idx++}`);
        params.push(filters.admin_user_id);
    }
    if (filters?.from_date) {
        conditions.push(`a.created_at >= $${idx++}::timestamptz`);
        params.push(filters.from_date);
    }
    if (filters?.to_date) {
        conditions.push(`a.created_at <= $${idx++}::timestamptz`);
        params.push(filters.to_date + "T23:59:59Z");
    }
    if (filters?.search) {
        conditions.push(`(a.entity_id::text ILIKE $${idx} OR a.action ILIKE $${idx})`);
        params.push(`%${filters.search}%`);
        idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM admin_audit_log a ${where}`,
        params
    );

    const result = await pool.query(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_value, a.new_value,
                a.created_at, a.admin_user_id, u.name AS admin_name
         FROM admin_audit_log a JOIN users u ON u.id = a.admin_user_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
    );

    return { entries: result.rows, total: countResult.rows[0]?.total || 0 };
}

// ─── Write Actions (CRUD) ───

async function adminWriteAction(
    goPath: string,
    method: "POST" | "PUT" | "DELETE",
    body?: any
): Promise<{ success?: boolean; id?: string; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ success: boolean; id?: string }>(goPath, {
            method: method as any,
            body: body || undefined,
        });
        if (res) return { success: true, id: res.id };
    } catch (err: any) {
        if (err?.status >= 400 && err?.status < 500) {
            return { error: err.message || "Erro de validação" };
        }
        console.warn("[admin:write] laura-go failed, no fallback for writes");
    }

    return { error: "Operação não disponível sem laura-go" };
}

// Config
export async function saveAdminConfigAction(key: string, value: any) {
    return adminWriteAction(`/api/v1/admin/config/${key}`, "PUT", { value });
}

// Processors
export async function createProcessorAction(data: any) {
    return adminWriteAction("/api/v1/admin/processors", "POST", data);
}
export async function updateProcessorAction(id: string, data: any) {
    return adminWriteAction(`/api/v1/admin/processors/${id}`, "PUT", data);
}
export async function deleteProcessorAction(id: string) {
    return adminWriteAction(`/api/v1/admin/processors/${id}`, "DELETE");
}

// Category templates
export async function createCategoryTemplateAction(data: any) {
    return adminWriteAction("/api/v1/admin/category-templates", "POST", data);
}
export async function updateCategoryTemplateAction(id: string, data: any) {
    return adminWriteAction(`/api/v1/admin/category-templates/${id}`, "PUT", data);
}
export async function deleteCategoryTemplateAction(id: string) {
    return adminWriteAction(`/api/v1/admin/category-templates/${id}`, "DELETE");
}

// Generic option CRUD (banks, brands, brokers, investment-types, goal-templates)
export async function createOptionAction(resource: string, data: any) {
    return adminWriteAction(`/api/v1/admin/${resource}`, "POST", data);
}
export async function toggleOptionAction(resource: string, id: string, active: boolean) {
    return adminWriteAction(`/api/v1/admin/${resource}/${id}`, "PUT", { active });
}
export async function deleteOptionAction(resource: string, id: string) {
    return adminWriteAction(`/api/v1/admin/${resource}/${id}`, "DELETE");
}

// Plans
export async function updatePlanAction(slug: string, data: any) {
    return adminWriteAction(`/api/v1/admin/plans/${slug}`, "PUT", data);
}

export async function updatePlanFullAction(slug: string, data: {
    name: string;
    price_cents: number;
    stripe_price_id?: string;
    capabilities: Record<string, boolean>;
    ai_model_config: Record<string, any>;
    limits: Record<string, any>;
    features_description: string[];
    active: boolean;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE subscription_plans SET name=$1, price_cents=$2, stripe_price_id=$3,
         capabilities=$4::jsonb, ai_model_config=$5::jsonb, limits=$6::jsonb,
         features_description=$7::jsonb, active=$8 WHERE slug=$9`,
        [data.name, data.price_cents, data.stripe_price_id || null,
         JSON.stringify(data.capabilities), JSON.stringify(data.ai_model_config),
         JSON.stringify(data.limits), JSON.stringify(data.features_description), data.active, slug]
    );
    return { success: true };
}

// Workspaces
export async function changeWorkspacePlanAction(workspaceId: string, planSlug: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ success: boolean }>(`/api/v1/admin/workspaces/${workspaceId}/plan`, {
            method: "PUT",
            body: { plan_slug: planSlug },
        });
        if (res) return { success: true };
    } catch { /* fallback */ }

    await pool.query("UPDATE workspaces SET plan_slug = $1 WHERE id = $2", [planSlug, workspaceId]);
    return { success: true };
}

export async function suspendWorkspaceAction(id: string, reason: string) {
    return adminWriteAction(`/api/v1/admin/workspaces/${id}/suspend`, "PUT", { reason });
}
export async function reactivateWorkspaceAction(id: string) {
    return adminWriteAction(`/api/v1/admin/workspaces/${id}/reactivate`, "PUT");
}

// ─── WhatsApp Instances ───

export type WhatsAppInstance = {
    id: string;
    name: string;
    phone_number: string;
    status: string;
    webhook_url: string | null;
};

export async function fetchWhatsAppInstancesAction(): Promise<{ instances: WhatsAppInstance[] } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    try {
        const res = await callLauraGo<{ instances: WhatsAppInstance[] }>("/api/v1/admin/whatsapp/instances");
        if (res) return { instances: res.instances ?? [] };
    } catch { /* fallback */ }

    return { instances: [] };
}

export async function createWhatsAppInstanceAction(name: string) {
    return adminWriteAction("/api/v1/admin/whatsapp/instances", "POST", { name });
}

export async function connectWhatsAppInstanceAction(id: string) {
    return adminWriteAction(`/api/v1/admin/whatsapp/instances/${id}/connect`, "POST");
}

export async function disconnectWhatsAppInstanceAction(id: string) {
    return adminWriteAction(`/api/v1/admin/whatsapp/instances/${id}/disconnect`, "POST");
}

export async function deleteWhatsAppInstanceAction(id: string) {
    return adminWriteAction(`/api/v1/admin/whatsapp/instances/${id}`, "DELETE");
}

// ─── Category Templates CRUD (with subcategories) ───

export type AdminCategoryTemplate = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description: string | null;
    subcategories: { name: string; emoji: string; description?: string }[];
    sort_order: number;
    active: boolean;
};

export async function fetchAdminCategoryTemplatesFullAction(): Promise<{ templates: AdminCategoryTemplate[] } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const result = await pool.query(
        "SELECT id, name, emoji, color, description, subcategories, sort_order, active FROM category_templates ORDER BY sort_order, name"
    );
    const templates = result.rows.map((r: any) => ({
        ...r,
        subcategories: typeof r.subcategories === "string" ? JSON.parse(r.subcategories) : (r.subcategories || []),
    }));
    return { templates };
}

export async function createCategoryTemplateFullAction(data: {
    name: string; emoji: string; color: string; description?: string;
    subcategories: { name: string; emoji: string; description?: string }[];
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };
    if (!data.name) return { error: "Nome obrigatório" };

    await pool.query(
        `INSERT INTO category_templates (name, emoji, color, description, subcategories, sort_order)
         VALUES ($1, $2, $3, $4, $5::jsonb, (SELECT COALESCE(MAX(sort_order),0)+1 FROM category_templates))`,
        [data.name, data.emoji || "📂", data.color || "#808080", data.description || null, JSON.stringify(data.subcategories || [])]
    );
    return { success: true };
}

export async function updateCategoryTemplateFullAction(id: string, data: {
    name: string; emoji: string; color: string; description?: string;
    subcategories: { name: string; emoji: string; description?: string }[];
    active?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE category_templates SET name=$1, emoji=$2, color=$3, description=$4,
         subcategories=$5::jsonb, active=COALESCE($6, active) WHERE id=$7`,
        [data.name, data.emoji, data.color, data.description || null, JSON.stringify(data.subcategories || []), data.active ?? null, id]
    );
    return { success: true };
}

export async function toggleCategoryTemplateAction(id: string, active: boolean): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("UPDATE category_templates SET active = $1 WHERE id = $2", [active, id]);
    return { success: true };
}

export async function deleteCategoryTemplateFullAction(id: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("DELETE FROM category_templates WHERE id = $1", [id]);
    return { success: true };
}

// ─── Email Templates ───

export type EmailTemplate = {
    id: string;
    type: string;
    name: string;
    subject: string;
    html_body: string;
    description: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export async function fetchEmailTemplatesAction(): Promise<{ templates: EmailTemplate[] } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const result = await pool.query(
        "SELECT id, type, name, subject, html_body, description, active, created_at, updated_at FROM email_templates ORDER BY type, active DESC, name"
    );
    return { templates: result.rows };
}

export async function createEmailTemplateAction(data: {
    type: string; name: string; subject: string; html_body: string; description?: string;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };
    if (!data.type || !data.name || !data.subject || !data.html_body) return { error: "Campos obrigatórios faltando" };

    await pool.query(
        `INSERT INTO email_templates (type, name, subject, html_body, description, active)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [data.type, data.name, data.subject, data.html_body, data.description || null]
    );
    return { success: true };
}

export async function updateEmailTemplateAction(id: string, data: {
    name: string; subject: string; html_body: string; description?: string;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE email_templates SET name=$1, subject=$2, html_body=$3, description=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
        [data.name, data.subject, data.html_body, data.description || null, id]
    );
    return { success: true };
}

export async function activateEmailTemplateAction(id: string, type: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("UPDATE email_templates SET active = FALSE WHERE type = $1", [type]);
        await client.query("UPDATE email_templates SET active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
    return { success: true };
}

export async function deleteEmailTemplateAction(id: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("DELETE FROM email_templates WHERE id = $1", [id]);
    return { success: true };
}

// ─── Goal Templates Full CRUD ───

export async function createGoalTemplateFullAction(data: {
    name: string; emoji: string; color: string; description?: string; default_target_cents?: number;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `INSERT INTO goal_templates (name, emoji, color, description, default_target_cents, sort_order)
         VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order),0)+1 FROM goal_templates))`,
        [data.name, data.emoji || "🎯", data.color || "#8B5CF6", data.description || null, data.default_target_cents || 0]
    );
    return { success: true };
}

export async function updateGoalTemplateFullAction(id: string, data: {
    name: string; emoji: string; color: string; description?: string; default_target_cents?: number; active?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE goal_templates SET name=$1, emoji=$2, color=$3, description=$4, default_target_cents=$5, active=COALESCE($6, active) WHERE id=$7`,
        [data.name, data.emoji, data.color, data.description || null, data.default_target_cents || 0, data.active ?? null, id]
    );
    return { success: true };
}

export async function deleteGoalTemplateFullAction(id: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("DELETE FROM goal_templates WHERE id = $1", [id]);
    return { success: true };
}
