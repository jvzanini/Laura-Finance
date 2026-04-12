"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Power, Edit2, X, Save, ChevronDown, ChevronUp } from "lucide-react";
import {
    type AdminCategoryTemplate,
    createCategoryTemplateFullAction,
    updateCategoryTemplateFullAction,
    toggleCategoryTemplateAction,
    deleteCategoryTemplateFullAction,
} from "@/lib/actions/adminConfig";

type SubItem = { name: string; emoji: string };

function SubcategoryEditor({ subs, onChange }: { subs: SubItem[]; onChange: (s: SubItem[]) => void }) {
    const [newName, setNewName] = useState("");
    const [newEmoji, setNewEmoji] = useState("");

    const addSub = () => {
        if (!newName) return;
        onChange([...subs, { name: newName, emoji: newEmoji || "📄" }]);
        setNewName("");
        setNewEmoji("");
    };

    const removeSub = (i: number) => {
        onChange(subs.filter((_, idx) => idx !== i));
    };

    return (
        <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subcategorias ({subs.length})</p>
            <div className="flex flex-wrap gap-1.5">
                {subs.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-background border border-border/30">
                        <span>{s.emoji}</span>
                        <span>{s.name}</span>
                        <button onClick={() => removeSub(i)} className="ml-1 text-zinc-500 hover:text-red-400">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    placeholder="📄"
                    className="w-12 h-7 px-1 text-center rounded-md bg-background border border-border text-xs"
                />
                <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome da subcategoria"
                    className="flex-1 h-7 px-2 rounded-md bg-background border border-border text-xs"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())}
                />
                <button onClick={addSub} className="h-7 px-2 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20">
                    <Plus className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

function CategoryForm({ initial, onSave, onCancel, isPending }: {
    initial?: AdminCategoryTemplate;
    onSave: (data: { name: string; emoji: string; color: string; description: string; subcategories: SubItem[] }) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const [name, setName] = useState(initial?.name || "");
    const [emoji, setEmoji] = useState(initial?.emoji || "📂");
    const [color, setColor] = useState(initial?.color || "#808080");
    const [description, setDescription] = useState(initial?.description || "");
    const [subs, setSubs] = useState<SubItem[]>(initial?.subcategories || []);

    return (
        <div className="p-4 space-y-3 border-b border-border/30 bg-muted/20">
            <div className="flex flex-wrap gap-2">
                <div className="w-16">
                    <label className="text-[10px] text-muted-foreground block mb-1">Emoji</label>
                    <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-full h-8 px-2 text-center rounded-md bg-background border border-border text-sm" />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] text-muted-foreground block mb-1">Nome *</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pessoal" required className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs" />
                </div>
                <div className="w-24">
                    <label className="text-[10px] text-muted-foreground block mb-1">Cor</label>
                    <div className="flex items-center gap-1">
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 bg-transparent" />
                        <input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 h-8 px-1 rounded-md bg-background border border-border text-[10px] font-mono" />
                    </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] text-muted-foreground block mb-1">Descricao</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descricao..." className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs" />
                </div>
            </div>
            <SubcategoryEditor subs={subs} onChange={setSubs} />
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="h-8 px-3 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700">Cancelar</button>
                <button
                    onClick={() => onSave({ name, emoji, color, description, subcategories: subs })}
                    disabled={isPending || !name}
                    className="h-8 px-4 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1"
                >
                    <Save className="h-3 w-3" /> {isPending ? "..." : "Salvar"}
                </button>
            </div>
        </div>
    );
}

export function CategoryTemplatesCrud({ initial }: { initial: AdminCategoryTemplate[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleCreate = (data: { name: string; emoji: string; color: string; description: string; subcategories: SubItem[] }) => {
        startTransition(async () => {
            await createCategoryTemplateFullAction(data);
            setShowCreate(false);
            router.refresh();
        });
    };

    const handleUpdate = (id: string, data: { name: string; emoji: string; color: string; description: string; subcategories: SubItem[] }) => {
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
        if (!confirm(`Excluir categoria "${name}" e todas suas subcategorias?`)) return;
        startTransition(async () => {
            await deleteCategoryTemplateFullAction(id);
            router.refresh();
        });
    };

    return (
        <div className="rounded-xl border border-border/50 bg-card">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <h3 className="font-semibold text-sm flex-1">Templates de Categorias</h3>
                <span className="text-xs text-muted-foreground mr-2">{initial.length} categorias</span>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> Nova Categoria
                </button>
            </div>

            {showCreate && (
                <CategoryForm onSave={handleCreate} onCancel={() => setShowCreate(false)} isPending={isPending} />
            )}

            <div className="divide-y divide-border/20">
                {initial.map((cat) => (
                    <div key={cat.id}>
                        {editingId === cat.id ? (
                            <CategoryForm
                                initial={cat}
                                onSave={(data) => handleUpdate(cat.id, data)}
                                onCancel={() => setEditingId(null)}
                                isPending={isPending}
                            />
                        ) : (
                            <div className="px-4 py-3 hover:bg-accent/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{cat.emoji}</span>
                                    <div
                                        className="h-4 w-4 rounded-full shrink-0 border border-border/30"
                                        style={{ backgroundColor: cat.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{cat.name}</p>
                                        {cat.description && <p className="text-[10px] text-muted-foreground truncate">{cat.description}</p>}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{cat.subcategories.length} subs</span>
                                    <button
                                        onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                                    >
                                        {expandedId === cat.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                        onClick={() => setEditingId(cat.id)}
                                        disabled={isPending}
                                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                                        title="Editar"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleToggle(cat.id, cat.active)}
                                        disabled={isPending}
                                        className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${cat.active ? "text-emerald-400 hover:bg-emerald-500/15" : "text-zinc-500 hover:bg-zinc-800"}`}
                                        title={cat.active ? "Desativar" : "Ativar"}
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id, cat.name)}
                                        disabled={isPending}
                                        className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/15"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {expandedId === cat.id && cat.subcategories.length > 0 && (
                                    <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                                        {cat.subcategories.map((s, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-background/80 border border-border/30 text-muted-foreground">
                                                <span>{s.emoji}</span> {s.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {initial.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">Nenhum template de categoria cadastrado</div>
                )}
            </div>
        </div>
    );
}
