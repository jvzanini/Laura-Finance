"use client";

import { useState, useTransition } from "react";
import {
    createGoalTemplateFullAction,
    updateGoalTemplateFullAction,
    deleteGoalTemplateFullAction,
} from "@/lib/actions/adminConfig";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

type GoalTemplate = {
    id: string;
    name: string;
    emoji: string;
    description: string | null;
    default_target_cents: number;
    color: string;
    sort_order: number;
    active: boolean;
};

type FormData = {
    name: string;
    emoji: string;
    color: string;
    description: string;
    default_target_cents: number;
    active: boolean;
};

const EMPTY_FORM: FormData = { name: "", emoji: "🎯", color: "#8B5CF6", description: "", default_target_cents: 0, active: true };

function formatBRL(cents: number) {
    return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function TemplateForm({
    initial,
    onSubmit,
    onCancel,
    isPending,
    submitLabel,
}: {
    initial: FormData;
    onSubmit: (data: FormData) => void;
    onCancel: () => void;
    isPending: boolean;
    submitLabel: string;
}) {
    const [form, setForm] = useState<FormData>(initial);
    const set = (key: keyof FormData, val: any) => setForm((p) => ({ ...p, [key]: val }));

    return (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                    <input
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Ex: Viagem"
                        className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
                    <input
                        value={form.emoji}
                        onChange={(e) => set("emoji", e.target.value)}
                        placeholder="🎯"
                        className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={form.color}
                            onChange={(e) => set("color", e.target.value)}
                            className="h-9 w-12 rounded-md border border-border cursor-pointer bg-transparent"
                        />
                        <input
                            value={form.color}
                            onChange={(e) => set("color", e.target.value)}
                            placeholder="#8B5CF6"
                            className="flex-1 h-9 px-3 rounded-md bg-background border border-border text-sm font-mono"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Meta padrao (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.default_target_cents / 100}
                        onChange={(e) => set("default_target_cents", Math.round(Number(e.target.value) * 100))}
                        placeholder="0.00"
                        className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm font-mono"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descricao</label>
                <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Descricao do template de objetivo..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm resize-none"
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => onSubmit(form)}
                    disabled={isPending || !form.name.trim()}
                    className="h-8 px-4 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                    <Save className="h-3.5 w-3.5" />
                    {isPending ? "..." : submitLabel}
                </button>
                <button
                    onClick={onCancel}
                    className="h-8 px-4 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                >
                    <X className="h-3.5 w-3.5" />
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export function GoalTemplatesEditor({ templates }: { templates: GoalTemplate[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const handleCreate = (data: FormData) => {
        setError("");
        startTransition(async () => {
            const res = await createGoalTemplateFullAction({
                name: data.name,
                emoji: data.emoji,
                color: data.color,
                description: data.description || undefined,
                default_target_cents: data.default_target_cents,
            });
            if (res.error) { setError(res.error); return; }
            setShowCreate(false);
            router.refresh();
        });
    };

    const handleUpdate = (id: string, data: FormData) => {
        setError("");
        startTransition(async () => {
            const res = await updateGoalTemplateFullAction(id, {
                name: data.name,
                emoji: data.emoji,
                color: data.color,
                description: data.description || undefined,
                default_target_cents: data.default_target_cents,
                active: data.active,
            });
            if (res.error) { setError(res.error); return; }
            setEditingId(null);
            router.refresh();
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Excluir "${name}"?`)) return;
        setError("");
        startTransition(async () => {
            const res = await deleteGoalTemplateFullAction(id);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    const handleToggleActive = (t: GoalTemplate) => {
        startTransition(async () => {
            await updateGoalTemplateFullAction(t.id, {
                name: t.name,
                emoji: t.emoji,
                color: t.color,
                description: t.description || undefined,
                default_target_cents: t.default_target_cents,
                active: !t.active,
            });
            router.refresh();
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{templates.length} templates</span>
                <button
                    onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
                    className="ml-auto h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                    <Plus className="h-3.5 w-3.5" /> Novo Template
                </button>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-3">{error}</p>}

            {showCreate && (
                <TemplateForm
                    initial={EMPTY_FORM}
                    onSubmit={handleCreate}
                    onCancel={() => setShowCreate(false)}
                    isPending={isPending}
                    submitLabel="Criar"
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) =>
                    editingId === t.id ? (
                        <TemplateForm
                            key={t.id}
                            initial={{
                                name: t.name,
                                emoji: t.emoji || "🎯",
                                color: t.color || "#8B5CF6",
                                description: t.description || "",
                                default_target_cents: t.default_target_cents || 0,
                                active: t.active,
                            }}
                            onSubmit={(data) => handleUpdate(t.id, data)}
                            onCancel={() => setEditingId(null)}
                            isPending={isPending}
                            submitLabel="Atualizar"
                        />
                    ) : (
                        <div
                            key={t.id}
                            className={`rounded-xl border bg-card p-4 transition-colors ${t.active ? "border-border/50" : "border-border/30 opacity-60"}`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-3xl">{t.emoji || "🎯"}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                                        <span
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: t.color || "#8B5CF6" }}
                                        />
                                    </div>
                                    {t.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                                    )}
                                    {(t.default_target_cents ?? 0) > 0 && (
                                        <p className="text-xs font-mono text-muted-foreground mt-1">
                                            Meta: {formatBRL(t.default_target_cents)}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                                {/* Active toggle */}
                                <button
                                    onClick={() => handleToggleActive(t)}
                                    disabled={isPending}
                                    className="relative h-5 w-9 rounded-full transition-colors shrink-0"
                                    style={{ backgroundColor: t.active ? "#10b981" : "#3f3f46" }}
                                    title={t.active ? "Desativar" : "Ativar"}
                                >
                                    <span
                                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                                        style={{ left: t.active ? "1.1rem" : "0.15rem" }}
                                    />
                                </button>
                                <span className="text-[10px] text-muted-foreground">{t.active ? "Ativo" : "Inativo"}</span>
                                <div className="flex-1" />
                                <button
                                    onClick={() => { setEditingId(t.id); setShowCreate(false); }}
                                    disabled={isPending}
                                    className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id, t.name)}
                                    disabled={isPending}
                                    className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>

            {templates.length === 0 && !showCreate && (
                <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
                    Nenhum template cadastrado
                </div>
            )}
        </div>
    );
}
