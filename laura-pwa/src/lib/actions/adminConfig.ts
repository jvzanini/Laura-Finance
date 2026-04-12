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

// Workspaces
export async function suspendWorkspaceAction(id: string, reason: string) {
    return adminWriteAction(`/api/v1/admin/workspaces/${id}/suspend`, "PUT", { reason });
}
export async function reactivateWorkspaceAction(id: string) {
    return adminWriteAction(`/api/v1/admin/workspaces/${id}/reactivate`, "PUT");
}
