import { fetchAdminWorkspacesAction } from "@/lib/actions/adminConfig";
import { SuspendButton, ReactivateButton } from "@/components/admin/WorkspaceActions";
import { Users, AlertTriangle } from "lucide-react";

export default async function WorkspacesPage() {
    const result = await fetchAdminWorkspacesAction();
    const workspaces = "workspaces" in result ? (result.workspaces ?? []) : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} registrado{workspaces.length !== 1 ? "s" : ""}
                </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/30 bg-muted/30">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Workspace</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Proprietario</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Plano</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Membros</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Transacoes</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Criado em</th>
                                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Acao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workspaces.map((ws: any) => {
                                const isSuspended = !!ws.suspended_at;
                                return (
                                    <tr key={ws.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Users className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-medium">{ws.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs">{ws.owner_name}</p>
                                            <p className="text-[10px] text-muted-foreground">{ws.owner_email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${ws.plan_slug === "vip" ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-400"}`}>
                                                {(ws.plan_slug || "standard").toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-xs">{ws.member_count}</td>
                                        <td className="px-4 py-3 text-center font-mono text-xs">{ws.tx_count}</td>
                                        <td className="px-4 py-3 text-center">
                                            {isSuspended ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">
                                                    <AlertTriangle className="h-3 w-3" /> Suspenso
                                                </span>
                                            ) : (
                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                                                    Ativo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {new Date(ws.created_at).toLocaleDateString("pt-BR")}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isSuspended ? (
                                                <ReactivateButton workspaceId={ws.id} />
                                            ) : (
                                                <SuspendButton workspaceId={ws.id} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {workspaces.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">Nenhum workspace encontrado</div>
                )}
            </div>
        </div>
    );
}
