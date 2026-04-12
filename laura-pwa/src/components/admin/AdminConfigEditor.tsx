"use client";

import { useState, useTransition } from "react";
import { saveAdminConfigAction } from "@/lib/actions/adminConfig";
import { Save, Check } from "lucide-react";
import { useRouter } from "next/navigation";

type ConfigEntry = {
    key: string;
    value: any;
    description?: string;
    type?: "text" | "number" | "boolean" | "json";
};

export function AdminConfigEditor({ configs, filter }: { configs: ConfigEntry[]; filter?: string[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [values, setValues] = useState<Record<string, any>>(() => {
        const map: Record<string, any> = {};
        for (const c of configs) {
            let v = c.value;
            if (typeof v === "string") {
                try { v = JSON.parse(v); } catch { /* keep as string */ }
            }
            map[c.key] = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
        }
        return map;
    });

    const filtered = filter ? configs.filter((c) => filter.includes(c.key)) : configs;

    const handleSave = (key: string) => {
        let parsed: any = values[key];
        try { parsed = JSON.parse(parsed); } catch { /* keep as string */ }

        startTransition(async () => {
            await saveAdminConfigAction(key, parsed);
            setSaved((prev) => ({ ...prev, [key]: true }));
            setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
            router.refresh();
        });
    };

    const detectType = (key: string, value: any): "boolean" | "number" | "json" | "text" => {
        const v = typeof value === "string" ? value : String(value);
        if (v === "true" || v === "false") return "boolean";
        if (!isNaN(Number(v)) && v.trim() !== "" && !v.includes("{")) return "number";
        if (v.startsWith("{") || v.startsWith("[")) return "json";
        return "text";
    };

    return (
        <div className="space-y-3">
            {filtered.map((c) => {
                const type = detectType(c.key, values[c.key]);
                return (
                    <div key={c.key} className="rounded-lg border border-border/30 p-4 hover:bg-accent/10 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <code className="text-xs font-mono text-primary">{c.key}</code>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{type}</span>
                                </div>
                                {c.description && (
                                    <p className="text-[11px] text-muted-foreground mb-2">{c.description}</p>
                                )}
                                {type === "boolean" ? (
                                    <button
                                        onClick={() => {
                                            const newVal = values[c.key] === "true" ? "false" : "true";
                                            setValues((prev) => ({ ...prev, [c.key]: newVal }));
                                        }}
                                        className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${values[c.key] === "true" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}
                                    >
                                        {values[c.key] === "true" ? "Ativado" : "Desativado"}
                                    </button>
                                ) : type === "json" ? (
                                    <textarea
                                        value={values[c.key]}
                                        onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: e.target.value }))}
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-md bg-background border border-border text-xs font-mono resize-y"
                                    />
                                ) : (
                                    <input
                                        type={type === "number" ? "number" : "text"}
                                        value={values[c.key]}
                                        onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: e.target.value }))}
                                        className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm"
                                    />
                                )}
                            </div>
                            <button
                                onClick={() => handleSave(c.key)}
                                disabled={isPending}
                                className={`mt-6 h-8 w-8 rounded-md flex items-center justify-center transition-colors ${saved[c.key] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                title="Salvar"
                            >
                                {saved[c.key] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
