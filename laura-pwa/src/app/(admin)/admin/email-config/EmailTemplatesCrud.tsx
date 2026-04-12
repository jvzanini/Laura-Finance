"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Edit2, X, Save, Eye, EyeOff, ChevronDown, ChevronUp, Zap } from "lucide-react";
import {
    type EmailTemplate,
    createEmailTemplateAction,
    updateEmailTemplateAction,
    activateEmailTemplateAction,
    deleteEmailTemplateAction,
} from "@/lib/actions/adminConfig";
import { EMAIL_TEMPLATE_TYPES } from "@/lib/emailTemplateTypes";

const TYPE_LABELS: Record<string, { label: string; vars: readonly string[] }> = {};
for (const t of EMAIL_TEMPLATE_TYPES) {
    TYPE_LABELS[t.value] = { label: t.label, vars: t.vars };
}

function HtmlPreview({ html }: { html: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    return (
        <iframe
            ref={ref}
            srcDoc={html}
            className="w-full h-64 rounded-lg border border-border/30 bg-white"
            sandbox="allow-same-origin"
            title="Preview"
        />
    );
}

function TemplateForm({ type, initial, onSave, onCancel, isPending }: {
    type: string;
    initial?: EmailTemplate;
    onSave: (data: { name: string; subject: string; html_body: string; description: string }) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const [name, setName] = useState(initial?.name || "");
    const [subject, setSubject] = useState(initial?.subject || "");
    const [htmlBody, setHtmlBody] = useState(initial?.html_body || "");
    const [description, setDescription] = useState(initial?.description || "");
    const [showPreview, setShowPreview] = useState(false);

    const typeInfo = TYPE_LABELS[type];

    return (
        <div className="p-4 space-y-3 border border-border/30 rounded-lg bg-muted/10 mt-2">
            <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] text-muted-foreground block mb-1">Nome do Template *</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reset Moderno" className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs" />
                </div>
                <div className="flex-1 min-w-[250px]">
                    <label className="text-[10px] text-muted-foreground block mb-1">Assunto do Email *</label>
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Recuperação de senha" className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs" />
                </div>
            </div>
            <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Descrição</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do template..." className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs" />
            </div>
            {typeInfo && typeInfo.vars.length > 0 && (
                <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Variáveis disponíveis:</p>
                    <div className="flex flex-wrap gap-1">
                        {typeInfo.vars.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(`{{${v}}}`);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                title={`Clique para copiar {{${v}}}`}
                            >
                                {"{{" + v + "}}"}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-muted-foreground">HTML do Email *</label>
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-[10px] text-primary flex items-center gap-1 hover:underline"
                    >
                        {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showPreview ? "Esconder Preview" : "Ver Preview"}
                    </button>
                </div>
                <textarea
                    value={htmlBody}
                    onChange={(e) => setHtmlBody(e.target.value)}
                    rows={10}
                    placeholder="<div>Seu HTML aqui...</div>"
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-xs font-mono resize-y"
                />
            </div>
            {showPreview && htmlBody && <HtmlPreview html={htmlBody} />}
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="h-8 px-3 rounded-md bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700">Cancelar</button>
                <button
                    onClick={() => onSave({ name, subject, html_body: htmlBody, description })}
                    disabled={isPending || !name || !subject || !htmlBody}
                    className="h-8 px-4 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1"
                >
                    <Save className="h-3 w-3" /> {isPending ? "..." : "Salvar"}
                </button>
            </div>
        </div>
    );
}

export function EmailTemplatesCrud({ initial }: { initial: EmailTemplate[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [expandedType, setExpandedType] = useState<string | null>(null);
    const [creatingType, setCreatingType] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewId, setPreviewId] = useState<string | null>(null);

    const grouped: Record<string, EmailTemplate[]> = {};
    for (const tpl of initial) {
        if (!grouped[tpl.type]) grouped[tpl.type] = [];
        grouped[tpl.type].push(tpl);
    }

    const handleCreate = (type: string, data: { name: string; subject: string; html_body: string; description: string }) => {
        startTransition(async () => {
            await createEmailTemplateAction({ type, ...data });
            setCreatingType(null);
            router.refresh();
        });
    };

    const handleUpdate = (id: string, data: { name: string; subject: string; html_body: string; description: string }) => {
        startTransition(async () => {
            await updateEmailTemplateAction(id, data);
            setEditingId(null);
            router.refresh();
        });
    };

    const handleActivate = (id: string, type: string) => {
        startTransition(async () => {
            await activateEmailTemplateAction(id, type);
            router.refresh();
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Excluir template "${name}"?`)) return;
        startTransition(async () => {
            await deleteEmailTemplateAction(id);
            router.refresh();
        });
    };

    return (
        <div className="space-y-3">
            {EMAIL_TEMPLATE_TYPES.map((typeInfo) => {
                const templates = grouped[typeInfo.value] || [];
                const isExpanded = expandedType === typeInfo.value;
                const activeCount = templates.filter(t => t.active).length;

                return (
                    <div key={typeInfo.value} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                        <button
                            onClick={() => setExpandedType(isExpanded ? null : typeInfo.value)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-accent/10 transition-colors text-left"
                        >
                            <div className="flex-1">
                                <p className="text-sm font-semibold">{typeInfo.label}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{typeInfo.value}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""}</span>
                            {activeCount > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">1 ativo</span>
                            )}
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>

                        {isExpanded && (
                            <div className="border-t border-border/30">
                                <div className="p-3 border-b border-border/20 flex justify-end">
                                    <button
                                        onClick={() => setCreatingType(creatingType === typeInfo.value ? null : typeInfo.value)}
                                        className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" /> Novo Template
                                    </button>
                                </div>

                                {creatingType === typeInfo.value && (
                                    <div className="px-4 pb-4">
                                        <TemplateForm
                                            type={typeInfo.value}
                                            onSave={(data) => handleCreate(typeInfo.value, data)}
                                            onCancel={() => setCreatingType(null)}
                                            isPending={isPending}
                                        />
                                    </div>
                                )}

                                <div className="divide-y divide-border/20">
                                    {templates.map((tpl) => (
                                        <div key={tpl.id}>
                                            {editingId === tpl.id ? (
                                                <div className="px-4 py-3">
                                                    <TemplateForm
                                                        type={tpl.type}
                                                        initial={tpl}
                                                        onSave={(data) => handleUpdate(tpl.id, data)}
                                                        onCancel={() => setEditingId(null)}
                                                        isPending={isPending}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="px-4 py-3 hover:bg-accent/5 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium">{tpl.name}</p>
                                                                {tpl.active && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium flex items-center gap-1">
                                                                        <Check className="h-2.5 w-2.5" /> Ativo
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground truncate">{tpl.subject}</p>
                                                            {tpl.description && <p className="text-[10px] text-muted-foreground/60 truncate">{tpl.description}</p>}
                                                        </div>

                                                        <button
                                                            onClick={() => setPreviewId(previewId === tpl.id ? null : tpl.id)}
                                                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                                                            title="Preview"
                                                        >
                                                            {previewId === tpl.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </button>

                                                        {!tpl.active && (
                                                            <button
                                                                onClick={() => handleActivate(tpl.id, tpl.type)}
                                                                disabled={isPending}
                                                                className="h-6 px-2 rounded flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                                                                title="Ativar este template"
                                                            >
                                                                <Zap className="h-3 w-3" /> Ativar
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => setEditingId(tpl.id)}
                                                            disabled={isPending}
                                                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(tpl.id, tpl.name)}
                                                            disabled={isPending}
                                                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/15"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>

                                                    {previewId === tpl.id && (
                                                        <div className="mt-3">
                                                            <HtmlPreview html={tpl.html_body} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {templates.length === 0 && (
                                        <div className="p-6 text-center text-xs text-muted-foreground">Nenhum template para este tipo</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
