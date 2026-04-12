"use client";

import { useState, useTransition } from "react";
import { createOptionAction, toggleOptionAction, deleteOptionAction } from "@/lib/actions/adminConfig";
import { Plus, Trash2, Power } from "lucide-react";
import { useRouter } from "next/navigation";

type OptionItem = {
    id: string;
    name: string;
    slug?: string;
    emoji?: string;
    category?: string;
    active: boolean;
    sort_order?: number;
};

type FieldConfig = {
    name: string;
    label: string;
    placeholder: string;
    required?: boolean;
};

export function AdminOptionsCrud({
    resource,
    items,
    fields,
    title,
    icon: Icon,
}: {
    resource: string;
    items: OptionItem[];
    fields: FieldConfig[];
    title: string;
    icon: React.ElementType;
}) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const handleCreate = (formData: FormData) => {
        setError("");
        const data: Record<string, any> = {};
        for (const f of fields) {
            data[f.name] = formData.get(f.name) as string;
        }
        if (!data.slug && data.name) {
            data.slug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        }

        startTransition(async () => {
            const res = await createOptionAction(resource, data);
            if (res.error) {
                setError(res.error);
            } else {
                setShowForm(false);
                router.refresh();
            }
        });
    };

    const handleToggle = (id: string, currentActive: boolean) => {
        startTransition(async () => {
            await toggleOptionAction(resource, id, !currentActive);
            router.refresh();
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Excluir "${name}"?`)) return;
        startTransition(async () => {
            await deleteOptionAction(resource, id);
            router.refresh();
        });
    };

    return (
        <div className="rounded-xl border border-border/50 bg-card">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm flex-1">{title}</h3>
                <span className="text-xs text-muted-foreground mr-2">{items.length} itens</span>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> Novo
                </button>
            </div>

            {showForm && (
                <form action={handleCreate} className="p-4 border-b border-border/30 bg-muted/20">
                    <div className="flex flex-wrap gap-2 items-end">
                        {fields.map((f) => (
                            <div key={f.name} className="flex-1 min-w-[120px]">
                                <label className="text-[10px] text-muted-foreground mb-1 block">{f.label}</label>
                                <input
                                    name={f.name}
                                    placeholder={f.placeholder}
                                    required={f.required}
                                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs"
                                />
                            </div>
                        ))}
                        <button
                            type="submit"
                            disabled={isPending}
                            className="h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {isPending ? "..." : "Salvar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="h-8 px-3 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                        >
                            Cancelar
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                </form>
            )}

            <div className="divide-y divide-border/20">
                {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                        {item.emoji && <span className="text-base">{item.emoji}</span>}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            {item.slug && <p className="text-[10px] text-muted-foreground font-mono">{item.slug}</p>}
                        </div>
                        {item.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{item.category}</span>
                        )}
                        <button
                            onClick={() => handleToggle(item.id, item.active)}
                            disabled={isPending}
                            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${item.active ? "text-emerald-400 hover:bg-emerald-500/15" : "text-zinc-500 hover:bg-zinc-800"}`}
                            title={item.active ? "Desativar" : "Ativar"}
                        >
                            <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => handleDelete(item.id, item.name)}
                            disabled={isPending}
                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                            title="Excluir"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado</div>
                )}
            </div>
        </div>
    );
}
