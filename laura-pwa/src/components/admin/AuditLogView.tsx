"use client";

import { useState, useTransition, useCallback } from "react";
import { fetchAdminAuditLogFilteredAction } from "@/lib/actions/adminConfig";
import { Search, ChevronDown, ChevronRight, Filter, Loader2 } from "lucide-react";
import type { JsonValue } from "@/types/admin";

type AuditEntry = {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_value: JsonValue;
    new_value: JsonValue;
    created_at: string;
    admin_user_id: string;
    admin_name: string;
};

type Filters = {
    action: string;
    entity_type: string;
    admin_user_id: string;
    from_date: string;
    to_date: string;
    search: string;
};

const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-emerald-500/15 text-emerald-400",
    UPDATE: "bg-amber-500/15 text-amber-400",
    DELETE: "bg-red-500/15 text-red-400",
};

function getActionColor(action: string) {
    return ACTION_COLORS[action?.toUpperCase()] || "bg-zinc-800 text-zinc-400";
}

function JsonDiff({ label, data }: { label: string; data: JsonValue }) {
    if (!data) return null;
    const str = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
    return (
        <div>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">{label}</p>
            <pre className="text-[11px] font-mono bg-muted/30 rounded-lg p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {str}
            </pre>
        </div>
    );
}

export default function AuditLogView({
    initialEntries,
    initialTotal,
    actionTypes,
    entityTypes,
    adminUsers,
}: {
    initialEntries: AuditEntry[];
    initialTotal: number;
    actionTypes: string[];
    entityTypes: string[];
    adminUsers: { id: string; name: string }[];
}) {
    const [entries, setEntries] = useState<AuditEntry[]>(initialEntries);
    const [total, setTotal] = useState(initialTotal);
    const [offset, setOffset] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showFilters, setShowFilters] = useState(false);
    const LIMIT = 50;

    const [filters, setFilters] = useState<Filters>({
        action: "",
        entity_type: "",
        admin_user_id: "",
        from_date: "",
        to_date: "",
        search: "",
    });

    const fetchData = useCallback(
        (newOffset: number, currentFilters: Filters) => {
            startTransition(async () => {
                const result = await fetchAdminAuditLogFilteredAction({
                    action: currentFilters.action || undefined,
                    entity_type: currentFilters.entity_type || undefined,
                    admin_user_id: currentFilters.admin_user_id || undefined,
                    from_date: currentFilters.from_date || undefined,
                    to_date: currentFilters.to_date || undefined,
                    search: currentFilters.search || undefined,
                    limit: LIMIT,
                    offset: newOffset,
                });
                if ("entries" in result) {
                    setEntries(result.entries);
                    setTotal(result.total);
                    setOffset(newOffset);
                }
            });
        },
        []
    );

    const applyFilters = () => {
        setOffset(0);
        fetchData(0, filters);
    };

    const clearFilters = () => {
        const empty: Filters = { action: "", entity_type: "", admin_user_id: "", from_date: "", to_date: "", search: "" };
        setFilters(empty);
        fetchData(0, empty);
    };

    const hasActiveFilters = Object.values(filters).some(Boolean);
    const totalPages = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;

    return (
        <div className="space-y-4">
            {/* Search + filter toggle */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por entity_id ou acao..."
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/50 bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`h-9 px-3 rounded-lg border border-border/50 text-sm flex items-center gap-2 transition-colors ${
                        showFilters || hasActiveFilters ? "bg-primary/10 text-primary border-primary/30" : "bg-card text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Filter className="h-4 w-4" />
                    Filtros
                    {hasActiveFilters && (
                        <span className="h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                            {Object.values(filters).filter(Boolean).length}
                        </span>
                    )}
                </button>
                <button
                    onClick={applyFilters}
                    disabled={isPending}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Buscar
                </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="rounded-xl border border-border/50 bg-card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Acao</label>
                        <select
                            value={filters.action}
                            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                            <option value="">Todas</option>
                            {actionTypes.map((a) => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Entidade</label>
                        <select
                            value={filters.entity_type}
                            onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                            <option value="">Todas</option>
                            {entityTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Admin</label>
                        <select
                            value={filters.admin_user_id}
                            onChange={(e) => setFilters((f) => ({ ...f, admin_user_id: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                            <option value="">Todos</option>
                            {adminUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">De</label>
                        <input
                            type="date"
                            value={filters.from_date}
                            onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Ate</label>
                        <input
                            type="date"
                            value={filters.to_date}
                            onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-border/50 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                    <div className="flex items-end">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/30 bg-muted/30">
                                <th className="w-8 px-2 py-3" />
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Data/Hora</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Admin</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Acao</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Entidade</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Resumo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => {
                                const isExpanded = expandedId === entry.id;
                                const hasDetails = entry.old_value || entry.new_value;
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

                                return (
                                    <>
                                        <tr
                                            key={entry.id}
                                            className={`border-b border-border/20 transition-colors ${
                                                hasDetails ? "cursor-pointer hover:bg-accent/30" : ""
                                            } ${isExpanded ? "bg-accent/20" : ""}`}
                                            onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.id)}
                                        >
                                            <td className="px-2 py-3 text-center text-muted-foreground">
                                                {hasDetails ? (
                                                    isExpanded ? (
                                                        <ChevronDown className="h-3.5 w-3.5 inline" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 inline" />
                                                    )
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {dateFormatted}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium">{entry.admin_name || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionColor(entry.action)}`}
                                                >
                                                    {entry.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                {entry.entity_type}
                                                <span className="text-foreground/40">:</span>
                                                <span className="text-foreground/70">{entry.entity_id}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                                                {hasDetails ? (
                                                    <span className="text-[10px] text-primary/60">clique para expandir</span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr key={`${entry.id}-detail`} className="border-b border-border/20 bg-accent/10">
                                                <td />
                                                <td colSpan={5} className="px-4 py-3">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <JsonDiff label="Valor anterior" data={entry.old_value} />
                                                        <JsonDiff label="Novo valor" data={entry.new_value} />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {entries.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        {isPending ? "Carregando..." : "Nenhuma acao registrada"}
                    </div>
                )}

                {/* Pagination */}
                {total > LIMIT && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
                        <p className="text-[10px] text-muted-foreground">
                            {offset + 1}-{Math.min(offset + LIMIT, total)} de {total}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => fetchData(offset - LIMIT, filters)}
                                disabled={offset === 0 || isPending}
                                className="h-7 px-3 rounded-md text-xs border border-border/50 bg-card hover:bg-accent/40 disabled:opacity-30 transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="h-7 px-2 flex items-center text-xs text-muted-foreground">
                                {currentPage}/{totalPages}
                            </span>
                            <button
                                onClick={() => fetchData(offset + LIMIT, filters)}
                                disabled={offset + LIMIT >= total || isPending}
                                className="h-7 px-3 rounded-md text-xs border border-border/50 bg-card hover:bg-accent/40 disabled:opacity-30 transition-colors"
                            >
                                Proximo
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
