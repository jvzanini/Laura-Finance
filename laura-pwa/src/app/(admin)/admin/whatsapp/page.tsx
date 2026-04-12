"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Plug, PlugZap, Trash2, QrCode, Phone, Wifi, WifiOff } from "lucide-react";
import { callLauraGo } from "@/lib/apiClient";

type Instance = {
    id: string;
    name: string;
    phone_number: string;
    status: string;
    webhook_url: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    connected: { label: "Conectado", color: "bg-emerald-500/15 text-emerald-400", icon: Wifi },
    qr_pending: { label: "Aguardando QR", color: "bg-amber-500/15 text-amber-400", icon: QrCode },
    connecting: { label: "Conectando...", color: "bg-blue-500/15 text-blue-400", icon: PlugZap },
    disconnected: { label: "Desconectado", color: "bg-zinc-800 text-zinc-500", icon: WifiOff },
};

export default function WhatsAppPage() {
    const router = useRouter();
    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [isPending, startTransition] = useTransition();

    const loadInstances = async () => {
        try {
            const res = await callLauraGo<{ instances: Instance[] }>("/api/v1/admin/whatsapp/instances");
            if (res) setInstances(res.instances ?? []);
        } catch { /* fallback empty */ }
        setLoading(false);
    };

    useEffect(() => {
        loadInstances();
        const interval = setInterval(loadInstances, 10000); // refresh a cada 10s
        return () => clearInterval(interval);
    }, []);

    const handleCreate = () => {
        if (!newName) return;
        startTransition(async () => {
            try {
                await callLauraGo("/api/v1/admin/whatsapp/instances", { method: "POST", body: { name: newName } });
                setNewName("");
                setShowCreate(false);
                await loadInstances();
            } catch (e) { console.error(e); }
        });
    };

    const handleConnect = (id: string) => {
        startTransition(async () => {
            try {
                await callLauraGo(`/api/v1/admin/whatsapp/instances/${id}/connect`, { method: "POST" });
                await loadInstances();
            } catch (e) { console.error(e); }
        });
    };

    const handleDisconnect = (id: string) => {
        startTransition(async () => {
            try {
                await callLauraGo(`/api/v1/admin/whatsapp/instances/${id}/disconnect`, { method: "POST" });
                await loadInstances();
            } catch (e) { console.error(e); }
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Excluir instancia "${name}"?`)) return;
        startTransition(async () => {
            try {
                await callLauraGo(`/api/v1/admin/whatsapp/instances/${id}`, { method: "DELETE" as any });
                await loadInstances();
            } catch (e) { console.error(e); }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Instancias WhatsApp</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gerencie conexoes WhatsApp (multi-instancia, estilo Evolution API)
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Nova Instancia
                </button>
            </div>

            {showCreate && (
                <div className="rounded-xl border border-emerald-500/30 bg-card p-5">
                    <h3 className="font-semibold mb-3">Criar Nova Instancia</h3>
                    <div className="flex gap-3">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nome da instancia (ex: Laura Principal)"
                            className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={isPending || !newName}
                            className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {isPending ? "..." : "Criar"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="h-9 px-4 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instances.map((inst) => {
                    const status = STATUS_MAP[inst.status] || STATUS_MAP.disconnected;
                    const StatusIcon = status.icon;
                    return (
                        <div key={inst.id} className="rounded-xl border border-border/50 bg-card p-5">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <MessageSquare className="h-6 w-6 text-emerald-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold">{inst.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs font-mono text-muted-foreground">
                                            {inst.phone_number || "Nao conectado"}
                                        </span>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${status.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {inst.status === "disconnected" && (
                                    <button
                                        onClick={() => handleConnect(inst.id)}
                                        disabled={isPending}
                                        className="h-8 px-3 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <Plug className="h-3 w-3" /> Conectar
                                    </button>
                                )}
                                {(inst.status === "connected" || inst.status === "qr_pending") && (
                                    <button
                                        onClick={() => handleDisconnect(inst.id)}
                                        disabled={isPending}
                                        className="h-8 px-3 rounded-md bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <PlugZap className="h-3 w-3" /> Desconectar
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(inst.id, inst.name)}
                                    disabled={isPending}
                                    className="h-8 px-3 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-red-400 hover:bg-red-500/15 transition-colors flex items-center gap-1 disabled:opacity-50 ml-auto"
                                >
                                    <Trash2 className="h-3 w-3" /> Excluir
                                </button>
                            </div>

                            {inst.webhook_url && (
                                <div className="mt-3 pt-3 border-t border-border/30">
                                    <p className="text-[10px] text-muted-foreground">Webhook: <span className="font-mono">{inst.webhook_url}</span></p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!loading && instances.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma instancia criada</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Instancia" para criar sua primeira conexao WhatsApp</p>
                </div>
            )}
        </div>
    );
}
