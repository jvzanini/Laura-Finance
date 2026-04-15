"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    AlertTriangle,
    Search,
    Building2,
    Ban,
    RotateCcw,
    ChevronDown,
} from "lucide-react";
import {
    suspendWorkspaceAction,
    reactivateWorkspaceAction,
    changeWorkspacePlanAction,
} from "@/lib/actions/adminConfig";

type Workspace = {
    id: string;
    name: string;
    plan_slug: string | null;
    suspended_at: string | null;
    suspended_reason?: string | null;
    created_at: string;
    owner_name: string;
    owner_email: string;
    member_count: number;
    tx_count: number;
};

type Plan = { slug: string; name: string };

const PLAN_COLORS: Record<string, string> = {
    vip: "bg-amber-500/15 text-amber-400",
    premium: "bg-purple-500/15 text-purple-400",
    standard: "bg-zinc-800 text-zinc-400",
};

function getPlanColor(slug: string | null) {
    return PLAN_COLORS[slug || "standard"] || PLAN_COLORS.standard;
}

function PlanDropdown({
    workspaceId,
    currentSlug,
    plans,
}: {
    workspaceId: string;
    currentSlug: string | null;
    plans: Plan[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    const handleChange = (slug: string) => {
        setOpen(false);
        if (slug === (currentSlug || "standard")) return;
        startTransition(async () => {
            await changeWorkspacePlanAction(workspaceId, slug);
            router.refresh();
        });
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(!open)}
                disabled={isPending}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${getPlanColor(currentSlug)} ${isPending ? "opacity-50" : "hover:opacity-80"}`}
            >
                {isPending ? "..." : (currentSlug || "standard").toUpperCase()}
                <ChevronDown className="h-3 w-3" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute z-50 mt-1 right-0 min-w-[120px] rounded-lg border border-border/50 bg-card shadow-xl py-1">
                        {plans.map((p) => (
                            <button
                                key={p.slug}
                                onClick={() => handleChange(p.slug)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent/40 transition-colors ${
                                    p.slug === (currentSlug || "standard")
                                        ? "text-primary font-bold"
                                        : "text-foreground"
                                }`}
                            >
                                {p.name || p.slug.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function SuspendButton({ workspaceId }: { workspaceId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSuspend = () => {
        const reason = prompt("Motivo da suspensao:");
        if (!reason) return;
        startTransition(async () => {
            await suspendWorkspaceAction(workspaceId, reason);
            router.refresh();
        });
    };

    return (
        <button
            onClick={handleSuspend}
            disabled={isPending}
            className="h-7 px-2 rounded-md text-[10px] font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
            <Ban className="h-3 w-3" />
            {isPending ? "..." : "Suspender"}
        </button>
    );
}

function ReactivateButton({ workspaceId }: { workspaceId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleReactivate = () => {
        if (!confirm("Reativar este workspace?")) return;
        startTransition(async () => {
            await reactivateWorkspaceAction(workspaceId);
            router.refresh();
        });
    };

    return (
        <button
            onClick={handleReactivate}
            disabled={isPending}
            className="h-7 px-2 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
            <RotateCcw className="h-3 w-3" />
            {isPending ? "..." : "Reativar"}
        </button>
    );
}

export default function WorkspacesView({
    workspaces: initialWorkspaces,
    plans,
}: {
    workspaces: Workspace[];
    plans: Plan[];
}) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
    const [planFilter, setPlanFilter] = useState<string>("all");

    const filtered = initialWorkspaces.filter((ws) => {
        const q = search.toLowerCase();
        const matchesSearch =
            !q ||
            ws.name.toLowerCase().includes(q) ||
            ws.owner_email.toLowerCase().includes(q) ||
            ws.owner_name?.toLowerCase().includes(q);

        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && !ws.suspended_at) ||
            (statusFilter === "suspended" && !!ws.suspended_at);

        const matchesPlan =
            planFilter === "all" || (ws.plan_slug || "standard") === planFilter;

        return matchesSearch && matchesStatus && matchesPlan;
    });

    const totalActive = initialWorkspaces.filter((ws) => !ws.suspended_at).length;
    const totalSuspended = initialWorkspaces.filter((ws) => !!ws.suspended_at).length;
    const planCounts = initialWorkspaces.reduce<Record<string, number>>((acc, ws) => {
        const p = ws.plan_slug || "standard";
        acc[p] = (acc[p] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total" value={initialWorkspaces.length} icon={<Building2 className="h-4 w-4 text-primary" />} />
                <StatCard label="Ativos" value={totalActive} icon={<Users className="h-4 w-4 text-emerald-400" />} color="text-emerald-400" />
                <StatCard label="Suspensos" value={totalSuspended} icon={<AlertTriangle className="h-4 w-4 text-red-400" />} color="text-red-400" />
                <div className="rounded-xl border border-border/50 bg-card p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Por plano</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(planCounts).map(([slug, count]) => (
                            <span key={slug} className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getPlanColor(slug)}`}>
                                {slug.toUpperCase()}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/50 bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "suspended")}
                    className="h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                    <option value="all">Todos status</option>
                    <option value="active">Ativos</option>
                    <option value="suspended">Suspensos</option>
                </select>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                    <option value="all">Todos planos</option>
                    {plans.map((p) => (
                        <option key={p.slug} value={p.slug}>
                            {p.name || p.slug}
                        </option>
                    ))}
                </select>
            </div>

            {/* Table */}
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
                            {filtered.map((ws) => {
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
                                            <PlanDropdown workspaceId={ws.id} currentSlug={ws.plan_slug} plans={plans} />
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-xs">{ws.member_count}</td>
                                        <td className="px-4 py-3 text-center font-mono text-xs">{ws.tx_count}</td>
                                        <td className="px-4 py-3 text-center">
                                            {isSuspended ? (
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 cursor-help"
                                                    title={ws.suspended_reason || "Sem motivo registrado"}
                                                >
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
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">Nenhum workspace encontrado</div>
                )}
                {filtered.length !== initialWorkspaces.length && (
                    <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border/20">
                        Mostrando {filtered.length} de {initialWorkspaces.length} workspaces
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color?: string;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">{label}</p>
                <p className={`text-lg font-bold ${color || ""}`}>{value}</p>
            </div>
        </div>
    );
}
