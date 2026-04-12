import { fetchAdminConfigAction } from "@/lib/actions/adminConfig";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import { Shield } from "lucide-react";

export default async function SecurityPage() {
    const result = await fetchAdminConfigAction();
    const configs = "configs" in result ? (result.configs ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Seguranca</h1>
                    <p className="text-sm text-muted-foreground">Politica de senha e configuracoes de seguranca</p>
                </div>
            </div>
            <AdminConfigEditor
                configs={configs}
                filter={["password_min_length", "nlp_confidence_threshold"]}
            />
            <div className="rounded-xl border border-border/50 bg-card p-5">
                <h3 className="font-semibold mb-3">Roles do Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { role: "proprietario", label: "Proprietario", desc: "Acesso total ao workspace, pode excluir conta", color: "text-amber-400" },
                        { role: "administrador", label: "Administrador", desc: "Cadastra cartoes, membros, categorias", color: "text-blue-400" },
                        { role: "membro", label: "Membro", desc: "Registra gastos, visualiza extrato", color: "text-emerald-400" },
                        { role: "dependente", label: "Dependente", desc: "Gastos ocultos, perfil simplificado", color: "text-zinc-400" },
                    ].map((r) => (
                        <div key={r.role} className="rounded-lg border border-border/30 p-3">
                            <p className={`text-sm font-semibold ${r.color}`}>{r.label}</p>
                            <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
