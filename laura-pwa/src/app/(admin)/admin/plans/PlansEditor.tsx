"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Plus, X, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { updatePlanFullAction } from "@/lib/actions/adminConfig";

type Plan = {
    id: string;
    slug: string;
    name: string;
    price_cents: number;
    stripe_price_id: string | null;
    capabilities: Record<string, boolean>;
    ai_model_config: Record<string, any>;
    limits: Record<string, any>;
    features_description: string[];
    active: boolean;
    sort_order: number;
};

function parsePlan(raw: any): Plan {
    return {
        id: raw.id,
        slug: raw.slug,
        name: raw.name ?? "",
        price_cents: raw.price_cents ?? 0,
        stripe_price_id: raw.stripe_price_id ?? "",
        capabilities: typeof raw.capabilities === "string" ? JSON.parse(raw.capabilities) : (raw.capabilities || {}),
        ai_model_config: typeof raw.ai_model_config === "string" ? JSON.parse(raw.ai_model_config) : (raw.ai_model_config || {}),
        limits: typeof raw.limits === "string" ? JSON.parse(raw.limits) : (raw.limits || {}),
        features_description: typeof raw.features_description === "string" ? JSON.parse(raw.features_description) : (raw.features_description || []),
        active: raw.active !== false,
        sort_order: raw.sort_order ?? 0,
    };
}

const AI_PROVIDERS = ["groq", "openai", "gemini"] as const;
const CAPABILITIES = ["text", "audio", "image", "document"] as const;
const LIMIT_NUMBERS = ["max_members", "max_cards", "max_transactions_month"] as const;

function PlanCard({ plan: rawPlan }: { plan: any }) {
    const initial = parsePlan(rawPlan);
    const [name, setName] = useState(initial.name);
    const [priceCents, setPriceCents] = useState(initial.price_cents);
    const [stripePriceId, setStripePriceId] = useState(initial.stripe_price_id ?? "");
    const [capabilities, setCapabilities] = useState<Record<string, boolean>>(initial.capabilities);
    const [aiConfig, setAiConfig] = useState<Record<string, any>>(initial.ai_model_config);
    const [limits, setLimits] = useState<Record<string, any>>(initial.limits);
    const [features, setFeatures] = useState<string[]>(initial.features_description);
    const [active, setActive] = useState(initial.active);
    const [newFeature, setNewFeature] = useState("");
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const isVip = initial.slug === "vip";

    const handleSave = () => {
        setSaved(false);
        setError("");
        startTransition(async () => {
            const res = await updatePlanFullAction(initial.slug, {
                name,
                price_cents: priceCents,
                stripe_price_id: stripePriceId || undefined,
                capabilities,
                ai_model_config: aiConfig,
                limits,
                features_description: features,
                active,
            });
            if (res.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
                router.refresh();
            } else {
                setError(res.error || "Erro ao salvar");
            }
        });
    };

    const priceDisplay = (priceCents / 100).toFixed(2).replace(".", ",");

    const toggleCap = (cap: string) => {
        setCapabilities((prev) => ({ ...prev, [cap]: !prev[cap] }));
    };

    const setAiField = (key: string, value: any) => {
        setAiConfig((prev) => ({ ...prev, [key]: value }));
    };

    const setLimit = (key: string, value: any) => {
        setLimits((prev) => ({ ...prev, [key]: value }));
    };

    const addFeature = () => {
        if (!newFeature.trim()) return;
        setFeatures((prev) => [...prev, newFeature.trim()]);
        setNewFeature("");
    };

    const removeFeature = (i: number) => {
        setFeatures((prev) => prev.filter((_, idx) => idx !== i));
    };

    const inputClass = "w-full h-8 px-2.5 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";
    const labelClass = "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold";

    return (
        <div className={`rounded-xl border bg-card p-6 flex flex-col gap-5 ${isVip ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-border/50"}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isVip ? "bg-amber-500/15" : "bg-primary/10"}`}>
                        {isVip ? <Sparkles className="h-5 w-5 text-amber-400" /> : <CreditCard className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                        <p className="font-mono text-xs text-muted-foreground">{initial.slug}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch checked={active} onCheckedChange={(val) => setActive(val)} size="sm" />
                </div>
            </div>

            {/* Name & Price */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className={labelClass}>Nome</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                    <label className={labelClass}>Preco (R$)</label>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <input
                            type="text"
                            value={priceDisplay}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d,]/g, "").replace(",", ".");
                                const parsed = Math.round(parseFloat(raw || "0") * 100);
                                if (!isNaN(parsed)) setPriceCents(parsed);
                            }}
                            className={`${inputClass} pl-8`}
                        />
                    </div>
                </div>
            </div>

            {/* Stripe Price ID */}
            <div className="space-y-1.5">
                <label className={labelClass}>Stripe Price ID</label>
                <input value={stripePriceId} onChange={(e) => setStripePriceId(e.target.value)} placeholder="price_..." className={inputClass} />
            </div>

            {/* Capabilities */}
            <div className="space-y-2">
                <p className={labelClass}>Capabilities</p>
                <div className="grid grid-cols-2 gap-3">
                    {CAPABILITIES.map((cap) => (
                        <label key={cap} className="flex items-center gap-2.5 cursor-pointer">
                            <Switch checked={!!capabilities[cap]} onCheckedChange={() => toggleCap(cap)} size="sm" />
                            <span className="text-sm capitalize">{cap}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* AI Model Config */}
            <div className="space-y-3">
                <p className={labelClass}>Modelo IA</p>
                <div className="rounded-lg border border-border/30 bg-background/50 p-3 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Provider</label>
                        <select
                            value={aiConfig.provider || "groq"}
                            onChange={(e) => setAiField("provider", e.target.value)}
                            className={`${inputClass} appearance-none cursor-pointer`}
                        >
                            {AI_PROVIDERS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Chat Model</label>
                        <input value={aiConfig.chat_model || ""} onChange={(e) => setAiField("chat_model", e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Whisper Model</label>
                        <input value={aiConfig.whisper_model || ""} onChange={(e) => setAiField("whisper_model", e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Temperature: {Number(aiConfig.temperature ?? 0.1).toFixed(2)}</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={aiConfig.temperature ?? 0.1}
                            onChange={(e) => setAiField("temperature", parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none bg-border accent-primary cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Limits */}
            <div className="space-y-3">
                <p className={labelClass}>Limites</p>
                <div className="rounded-lg border border-border/30 bg-background/50 p-3 space-y-3">
                    {LIMIT_NUMBERS.map((key) => (
                        <div key={key} className="flex items-center justify-between gap-4">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">{key.replace(/_/g, " ")}</label>
                            <input
                                type="number"
                                value={limits[key] ?? 0}
                                onChange={(e) => setLimit(key, parseInt(e.target.value) || 0)}
                                className="w-24 h-7 px-2 rounded-md bg-background border border-border text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-xs text-muted-foreground">advanced reports</label>
                        <Switch
                            checked={!!limits.advanced_reports}
                            onCheckedChange={(val) => setLimit("advanced_reports", val)}
                            size="sm"
                        />
                    </div>
                </div>
            </div>

            {/* Features Description */}
            <div className="space-y-2">
                <p className={labelClass}>Features ({features.length})</p>
                <div className="space-y-1.5">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate">{f}</span>
                            <button onClick={() => removeFeature(i)} className="text-zinc-500 hover:text-red-400 shrink-0">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addFeature()}
                        placeholder="Nova feature..."
                        className={`${inputClass} flex-1`}
                    />
                    <button
                        onClick={addFeature}
                        className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-all ${
                        saved
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                    } disabled:opacity-50`}
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {saved ? "Salvo" : "Salvar"}
                </button>
                {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
        </div>
    );
}

export default function PlansEditor({ plans }: { plans: any[] }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {plans.map((plan: any) => (
                <PlanCard key={plan.id || plan.slug} plan={plan} />
            ))}
            {plans.length === 0 && (
                <div className="col-span-full rounded-xl border border-border/50 bg-card p-8 text-center">
                    <p className="text-muted-foreground">Nenhum plano cadastrado</p>
                </div>
            )}
        </div>
    );
}
