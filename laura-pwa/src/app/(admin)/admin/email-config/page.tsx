import { fetchAdminConfigAction, fetchEmailTemplatesAction } from "@/lib/actions/adminConfig";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import { EmailTemplatesCrud } from "./EmailTemplatesCrud";
import { Mail } from "lucide-react";

export default async function EmailConfigPage() {
    const [configResult, templatesResult] = await Promise.all([
        fetchAdminConfigAction(),
        fetchEmailTemplatesAction(),
    ]);

    const configs = "configs" in configResult ? (configResult.configs ?? []) : [];
    const templates = "templates" in templatesResult ? (templatesResult.templates ?? []) : [];

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Configuração de Email</h1>
                    <p className="text-sm text-muted-foreground">Remetente, templates HTML e tokens</p>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-3">Remetente</h2>
                <AdminConfigEditor
                    configs={configs}
                    filter={["sender_email", "sender_name", "verify_email_ttl_hours", "password_reset_ttl_minutes"]}
                />
            </div>

            <div>
                <h2 className="text-lg font-semibold mb-3">Templates de Email</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Crie e gerencie templates HTML para cada tipo de email. Apenas um template ativo por tipo — o ativo é usado pelo sistema ao enviar.
                </p>
                <EmailTemplatesCrud initial={templates} />
            </div>
        </div>
    );
}
