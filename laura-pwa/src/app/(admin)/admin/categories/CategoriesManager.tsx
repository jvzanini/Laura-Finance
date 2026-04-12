"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, X, Save, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import {
    type AdminCategoryTemplate,
    createCategoryTemplateFullAction,
    updateCategoryTemplateFullAction,
    toggleCategoryTemplateAction,
    deleteCategoryTemplateFullAction,
} from "@/lib/actions/adminConfig";

/* ─── Types ─── */

type SubItem = { name: string; emoji: string; description?: string };

type CategoryFormData = {
    name: string;
    emoji: string;
    color: string;
    description: string;
    subcategories: SubItem[];
};

/* ─── Toggle Switch ─── */

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
                ${checked ? "bg-emerald-500" : "bg-zinc-600"}
            `}
        >
            <span
                className={`
                    pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0
                    transition-transform duration-200 ease-in-out
                    ${checked ? "translate-x-5" : "translate-x-0"}
                `}
            />
        </button>
    );
}

/* ─── Color Picker ─── */

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 w-9 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-24 h-9 px-2 rounded-lg bg-background border border-border text-xs font-mono text-foreground"
                placeholder="#000000"
            />
        </div>
    );
}

/* ─── Subcategory List (view mode) ─── */

function SubcategoryList({ subs }: { subs: SubItem[] }) {
    if (subs.length === 0) {
        return <p className="text-xs text-muted-foreground italic py-2">Nenhuma subcategoria cadastrada</p>;
    }
    return (
        <div className="space-y-2">
            {subs.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-background/60 border border-border/30">
                    <span className="text-lg mt-0.5 shrink-0">{s.emoji}</span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        {s.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Subcategory Editor ─── */

function SubcategoryEditor({ subs, onChange }: { subs: SubItem[]; onChange: (s: SubItem[]) => void }) {
    const [newEmoji, setNewEmoji] = useState("📄");
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editEmoji, setEditEmoji] = useState("");
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");

    const addSub = () => {
        if (!newName.trim()) return;
        onChange([...subs, { name: newName.trim(), emoji: newEmoji || "📄", description: newDesc.trim() || undefined }]);
        setNewName("");
        setNewEmoji("📄");
        setNewDesc("");
    };

    const removeSub = (i: number) => {
        onChange(subs.filter((_, idx) => idx !== i));
    };

    const startEdit = (i: number) => {
        setEditingIdx(i);
        setEditEmoji(subs[i].emoji);
        setEditName(subs[i].name);
        setEditDesc(subs[i].description || "");
    };

    const saveEdit = () => {
        if (editingIdx === null || !editName.trim()) return;
        const updated = [...subs];
        updated[editingIdx] = { name: editName.trim(), emoji: editEmoji || "📄", description: editDesc.trim() || undefined };
        onChange(updated);
        setEditingIdx(null);
    };

    const cancelEdit = () => setEditingIdx(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Subcategorias ({subs.length})
                </p>
            </div>

            {/* Existing subcategories */}
            <div className="space-y-2">
                {subs.map((s, i) => (
                    <div key={i}>
                        {editingIdx === i ? (
                            <div className="p-3 rounded-lg bg-background border border-primary/30 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        value={editEmoji}
                                        onChange={(e) => setEditEmoji(e.target.value)}
                                        className="w-12 h-9 px-1 text-center rounded-lg bg-muted border border-border text-base"
                                    />
                                    <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1 h-9 px-3 rounded-lg bg-muted border border-border text-sm text-foreground"
                                        placeholder="Nome"
                                    />
                                </div>
                                <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs text-foreground resize-none"
                                    placeholder="Descrição da subcategoria (opcional)"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={cancelEdit} className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted">
                                        Cancelar
                                    </button>
                                    <button onClick={saveEdit} className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-background/60 border border-border/30 group">
                                <span className="text-lg mt-0.5 shrink-0">{s.emoji}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                                    {s.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                        onClick={() => startEdit(i)}
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                                        title="Editar"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => removeSub(i)}
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                        title="Remover"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add new subcategory */}
            <div className="p-3 rounded-lg border border-dashed border-border/50 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adicionar subcategoria</p>
                <div className="flex gap-2">
                    <input
                        value={newEmoji}
                        onChange={(e) => setNewEmoji(e.target.value)}
                        className="w-12 h-9 px-1 text-center rounded-lg bg-background border border-border text-base"
                        placeholder="📄"
                    />
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                        placeholder="Nome da subcategoria"
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())}
                    />
                </div>
                <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground resize-none"
                    placeholder="Descrição da subcategoria (opcional)"
                />
                <div className="flex justify-end">
                    <button
                        onClick={addSub}
                        disabled={!newName.trim()}
                        className="h-8 px-4 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Category Create/Edit Form ─── */

function CategoryForm({
    initial,
    onSave,
    onCancel,
    isPending,
    title,
}: {
    initial?: AdminCategoryTemplate;
    onSave: (data: CategoryFormData) => void;
    onCancel: () => void;
    isPending: boolean;
    title: string;
}) {
    const [name, setName] = useState(initial?.name || "");
    const [emoji, setEmoji] = useState(initial?.emoji || "📂");
    const [color, setColor] = useState(initial?.color || "#808080");
    const [description, setDescription] = useState(initial?.description || "");
    const [subs, setSubs] = useState<SubItem[]>(initial?.subcategories || []);

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <button onClick={onCancel} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="p-5 space-y-5">
                {/* Row 1: Emoji + Name */}
                <div className="flex gap-3">
                    <div className="w-20">
                        <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Emoji</label>
                        <input
                            value={emoji}
                            onChange={(e) => setEmoji(e.target.value)}
                            className="w-full h-10 px-2 text-center rounded-lg bg-background border border-border text-xl"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Nome *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Alimentação, Transporte, Lazer..."
                            required
                            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50"
                        />
                    </div>
                </div>

                {/* Row 2: Color */}
                <div>
                    <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Cor</label>
                    <ColorPicker value={color} onChange={setColor} />
                </div>

                {/* Row 3: Description */}
                <div>
                    <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Descrição</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Descreva esta categoria em detalhes. Essa descrição ajuda a IA a categorizar transações automaticamente..."
                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                    />
                </div>

                {/* Row 4: Subcategories */}
                <SubcategoryEditor subs={subs} onChange={setSubs} />

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-2 border-t border-border/30">
                    <button
                        onClick={onCancel}
                        className="h-9 px-4 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onSave({ name, emoji, color, description, subcategories: subs })}
                        disabled={isPending || !name.trim()}
                        className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {isPending ? "Salvando..." : "Salvar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Category Card ─── */

function CategoryCard({
    cat,
    isExpanded,
    isEditing,
    isPending,
    onToggleExpand,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onToggleActive,
    onDelete,
}: {
    cat: AdminCategoryTemplate;
    isExpanded: boolean;
    isEditing: boolean;
    isPending: boolean;
    onToggleExpand: () => void;
    onStartEdit: () => void;
    onSaveEdit: (data: CategoryFormData) => void;
    onCancelEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
}) {
    if (isEditing) {
        return (
            <CategoryForm
                initial={cat}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
                isPending={isPending}
                title={`Editando: ${cat.emoji} ${cat.name}`}
            />
        );
    }

    return (
        <div className={`rounded-xl border bg-card overflow-hidden transition-all duration-200 ${cat.active ? "border-border" : "border-border/30 opacity-60"}`}>
            {/* Card Header */}
            <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                    {/* Emoji + Color */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-3xl">{cat.emoji}</span>
                        <div
                            className="h-4 w-4 rounded-full ring-2 ring-background shrink-0"
                            style={{ backgroundColor: cat.color }}
                            title={cat.color}
                        />
                    </div>

                    {/* Name + Description */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">{cat.name}</h3>
                            {!cat.active && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                                    Inativa
                                </span>
                            )}
                        </div>
                        {cat.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                                {cat.description}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Subcategory count badge */}
                        <button
                            onClick={onToggleExpand}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <span className="font-medium">{cat.subcategories.length}</span>
                            <span>sub{cat.subcategories.length !== 1 ? "s" : ""}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        {/* Toggle */}
                        <ToggleSwitch
                            checked={cat.active}
                            onChange={onToggleActive}
                            disabled={isPending}
                        />

                        {/* Edit */}
                        <button
                            onClick={onStartEdit}
                            disabled={isPending}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar categoria"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Delete */}
                        <button
                            onClick={onDelete}
                            disabled={isPending}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir categoria"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded: Subcategories */}
            {isExpanded && (
                <div className="px-5 pb-4 pt-0">
                    <div className="pt-4 border-t border-border/30">
                        <SubcategoryList subs={cat.subcategories} />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main Manager ─── */

export function CategoriesManager({ initial }: { initial: AdminCategoryTemplate[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleCreate = (data: CategoryFormData) => {
        startTransition(async () => {
            await createCategoryTemplateFullAction(data);
            setShowCreate(false);
            router.refresh();
        });
    };

    const handleUpdate = (id: string, data: CategoryFormData) => {
        startTransition(async () => {
            await updateCategoryTemplateFullAction(id, data);
            setEditingId(null);
            router.refresh();
        });
    };

    const handleToggle = (id: string, active: boolean) => {
        startTransition(async () => {
            await toggleCategoryTemplateAction(id, !active);
            router.refresh();
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Excluir a categoria "${name}" e todas as suas subcategorias? Esta ação não pode ser desfeita.`)) return;
        startTransition(async () => {
            await deleteCategoryTemplateFullAction(id);
            router.refresh();
        });
    };

    return (
        <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {initial.filter((c) => c.active).length} ativas de {initial.length} categorias
                </p>
                <button
                    onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Nova Categoria
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <CategoryForm
                    onSave={handleCreate}
                    onCancel={() => setShowCreate(false)}
                    isPending={isPending}
                    title="Criar nova categoria"
                />
            )}

            {/* Category cards grid */}
            <div className="space-y-3">
                {initial.map((cat) => (
                    <CategoryCard
                        key={cat.id}
                        cat={cat}
                        isExpanded={expandedIds.has(cat.id)}
                        isEditing={editingId === cat.id}
                        isPending={isPending}
                        onToggleExpand={() => toggleExpand(cat.id)}
                        onStartEdit={() => { setEditingId(cat.id); setShowCreate(false); }}
                        onSaveEdit={(data) => handleUpdate(cat.id, data)}
                        onCancelEdit={() => setEditingId(null)}
                        onToggleActive={() => handleToggle(cat.id, cat.active)}
                        onDelete={() => handleDelete(cat.id, cat.name)}
                    />
                ))}
            </div>

            {/* Empty state */}
            {initial.length === 0 && !showCreate && (
                <div className="rounded-xl border border-dashed border-border/50 bg-card p-12 text-center">
                    <span className="text-4xl block mb-3">📂</span>
                    <p className="text-sm text-muted-foreground mb-4">Nenhuma categoria cadastrada ainda</p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Criar primeira categoria
                    </button>
                </div>
            )}
        </div>
    );
}
