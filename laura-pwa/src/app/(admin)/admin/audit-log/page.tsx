import { fetchAdminAuditLogFilteredAction } from "@/lib/actions/adminConfig";
import { pool } from "@/lib/db";
import { assertSuperAdmin } from "@/lib/actions/admin";
import { ClipboardList } from "lucide-react";
import AuditLogView from "@/components/admin/AuditLogView";

export default async function AuditLogPage() {
    const result = await fetchAdminAuditLogFilteredAction({ limit: 50, offset: 0 });
    const entries = "entries" in result ? result.entries : [];
    const total = "total" in result ? result.total : 0;

    // Fetch distinct values for filter dropdowns
    const gate = await assertSuperAdmin();
    let actionTypes: string[] = [];
    let entityTypes: string[] = [];
    let adminUsers: { id: string; name: string }[] = [];

    if (gate.ok) {
        const [actionsRes, entitiesRes, adminsRes] = await Promise.all([
            pool.query("SELECT DISTINCT action FROM admin_audit_log ORDER BY action"),
            pool.query("SELECT DISTINCT entity_type FROM admin_audit_log ORDER BY entity_type"),
            pool.query(
                "SELECT DISTINCT u.id, u.name FROM admin_audit_log a JOIN users u ON u.id = a.admin_user_id ORDER BY u.name"
            ),
        ]);
        actionTypes = actionsRes.rows.map((r: any) => r.action);
        entityTypes = entitiesRes.rows.map((r: any) => r.entity_type);
        adminUsers = adminsRes.rows;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {total} acao{total !== 1 ? "es" : ""} registrada{total !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                </div>
            </div>

            <AuditLogView
                initialEntries={entries}
                initialTotal={total}
                actionTypes={actionTypes}
                entityTypes={entityTypes}
                adminUsers={adminUsers}
            />
        </div>
    );
}
