import { fetchAdminProcessorsAction } from "@/lib/actions/adminConfig";
import { Building2 } from "lucide-react";
import { getBoolean, getField, getString, isObject, isString } from "@/lib/typeGuards";

export default async function ProcessorsPage() {
    const result = await fetchAdminProcessorsAction();
    const processors: unknown[] = "processors" in result ? (result.processors ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Operadoras de Pagamento</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie taxas por parcela de cada operadora</p>
                </div>
            </div>

            <div className="grid gap-4">
                {processors.map((p, idx) => {
                    const feesRaw = getField(p, "fees");
                    let fees: Record<string, unknown> = {};
                    if (isString(feesRaw)) {
                        try {
                            const parsed = JSON.parse(feesRaw);
                            if (isObject(parsed)) fees = parsed;
                        } catch { /* noop */ }
                    } else if (isObject(feesRaw)) {
                        fees = feesRaw;
                    }
                    const active = getBoolean(p, "active", true);
                    const keyId = getString(p, "id") || getString(p, "slug") || String(idx);
                    return (
                        <div key={keyId} className="rounded-xl border border-border/50 bg-card p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{getString(p, "name")}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{getString(p, "slug")}</p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                    {active ? "Ativo" : "Inativo"}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                                {Array.from({ length: 12 }, (_, i) => {
                                    const key = `${i + 1}x`;
                                    const feeRaw = fees[key];
                                    const fee = typeof feeRaw === "number" ? feeRaw : null;
                                    return (
                                        <div key={key} className="text-center rounded-lg border border-border/30 bg-background/50 p-2">
                                            <p className="text-[10px] text-muted-foreground">{key}</p>
                                            <p className={`text-xs font-mono font-semibold ${fee != null ? (fee <= 5 ? "text-emerald-400" : fee <= 10 ? "text-amber-400" : "text-red-400") : "text-zinc-600"}`}>
                                                {fee != null ? `${fee}%` : "-"}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                {processors.length === 0 && (
                    <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                        <p className="text-muted-foreground">Nenhuma operadora cadastrada. Execute a migration 000016 para seed.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
