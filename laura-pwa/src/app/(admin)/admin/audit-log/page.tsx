import { fetchAdminAuditLogAction } from "@/lib/actions/adminConfig";
import { ClipboardList } from "lucide-react";

export default async function AuditLogPage() {
    const result = await fetchAdminAuditLogAction();
    const entries = "entries" in result ? (result.entries ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {entries.length} acao{entries.length !== 1 ? "oes" : ""} registrada{entries.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/30 bg-muted/30">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Data/Hora</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Admin</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Acao</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Entidade</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry: any) => {
                                const dateFormatted = entry.created_at
                                    ? new Date(entry.created_at).toLocaleString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                      })
                                    : "-";

                                const actionColor =
                                    entry.action === "DELETE"
                                        ? "bg-red-500/15 text-red-400"
                                        : entry.action === "CREATE"
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : entry.action === "UPDATE"
                                            ? "bg-amber-500/15 text-amber-400"
                                            : "bg-zinc-800 text-zinc-400";

                                return (
                                    <tr key={entry.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{dateFormatted}</td>
                                        <td className="px-4 py-3 text-xs font-medium">{entry.admin_name || "-"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${actionColor}`}>
                                                {entry.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                            {entry.entity_type}:{entry.entity_id}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                                            {entry.old_value || entry.new_value ? (
                                                <span className="font-mono text-[10px]">
                                                    {entry.old_value ? `De: ${typeof entry.old_value === "object" ? JSON.stringify(entry.old_value) : entry.old_value}` : ""}
                                                    {entry.old_value && entry.new_value ? " → " : ""}
                                                    {entry.new_value ? `Para: ${typeof entry.new_value === "object" ? JSON.stringify(entry.new_value) : entry.new_value}` : ""}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {entries.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">Nenhuma acao registrada</div>
                )}
            </div>
        </div>
    );
}
