import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import { Mail } from "lucide-react";

export default async function EmailConfigPage() {
    const result = await fetchAdminConfigAction();
    const configs = "configs" in result ? (result.configs ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Configuracao de Email</h1>
                    <p className="text-sm text-muted-foreground">Remetente, dominio e validade de tokens</p>
                </div>
            </div>
            <AdminConfigEditor
                configs={configs}
                filter={["sender_email", "sender_name", "verify_email_ttl_hours", "password_reset_ttl_minutes"]}
            />
        </div>
    );
}
