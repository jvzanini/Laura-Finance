"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Brain, Zap, DollarSign, MessageSquare, Mic, Image,
    Save, Check, Eye, EyeOff, Key, Settings2, Cpu,
    ChevronDown, ChevronUp,
} from "lucide-react";
import { updateAdminConfigAction, updatePlanAction } from "@/lib/actions/adminConfig";
import type { JsonValue } from "@/types/admin";

// ─── Types ───

type ConfigMap = Record<string, JsonValue>;

type PlanData = {
    slug: string;
    name: string;
    ai_model_config: Record<string, JsonValue>;
};

type ModelInfo = {
    provider: string;
    providerColor: string;
    model: string;
    description: string;
    inputPer1M: number;
    outputPer1M: number;
    speed: string;
    supportsText: boolean;
    supportsAudio: boolean;
    supportsImage: boolean;
    recommended?: string;
};

// ─── Static Data ───

const PROVIDERS = [
    { id: "groq", name: "Groq", color: "#F55036", configKey: "groq_api_key", hint: "gsk_..." },
    { id: "openai", name: "OpenAI", color: "#10A37F", configKey: "openai_api_key", hint: "sk-..." },
    { id: "gemini", name: "Google / Gemini", color: "#4285F4", configKey: "gemini_api_key", hint: "AIza..." },
] as const;

const MODELS: ModelInfo[] = [
    { provider: "Groq", providerColor: "#F55036", model: "llama-3.3-70b-versatile", description: "Melhor custo-beneficio para NLP", inputPer1M: 0.59, outputPer1M: 0.79, speed: "~800 tok/s", supportsText: true, supportsAudio: false, supportsImage: false, recommended: "Standard" },
    { provider: "Groq", providerColor: "#F55036", model: "llama-3.1-8b-instant", description: "Ultra rapido, menor custo", inputPer1M: 0.05, outputPer1M: 0.08, speed: "~1200 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "Groq", providerColor: "#F55036", model: "mixtral-8x7b-32768", description: "Contexto grande (32k)", inputPer1M: 0.24, outputPer1M: 0.24, speed: "~600 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "Groq", providerColor: "#F55036", model: "whisper-large-v3-turbo", description: "Transcricao de audio (portugues)", inputPer1M: 0.04, outputPer1M: 0, speed: "Real-time", supportsText: false, supportsAudio: true, supportsImage: false },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1", description: "Mais capaz, multimodal completo", inputPer1M: 2.00, outputPer1M: 8.00, speed: "~100 tok/s", supportsText: true, supportsAudio: true, supportsImage: true, recommended: "VIP" },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1-mini", description: "Rapido e barato, boa qualidade", inputPer1M: 0.40, outputPer1M: 1.60, speed: "~200 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1-nano", description: "Ultra economico", inputPer1M: 0.10, outputPer1M: 0.40, speed: "~300 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4o", description: "Multimodal equilibrado", inputPer1M: 2.50, outputPer1M: 10.00, speed: "~100 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4o-mini", description: "Versao compacta do 4o", inputPer1M: 0.15, outputPer1M: 0.60, speed: "~200 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.5-pro", description: "Mais capaz do Google, multimodal", inputPer1M: 1.25, outputPer1M: 10.00, speed: "~150 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.5-flash", description: "Rapido e barato, bom para volume", inputPer1M: 0.15, outputPer1M: 0.60, speed: "~300 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.0-flash", description: "Geracao anterior, ultra economico", inputPer1M: 0.10, outputPer1M: 0.40, speed: "~350 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
];

const TEXT_MODELS = MODELS.filter((m) => m.supportsText);

// ─── Helpers ───

function maskKey(val: string | undefined | null): string {
    if (!val || typeof val !== "string") return "";
    const clean = val.replace(/^"|"$/g, "");
    if (clean.length <= 4) return clean;
    return "*".repeat(Math.min(clean.length - 4, 30)) + clean.slice(-4);
}

function rawVal(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            return typeof parsed === "string" ? parsed : String(v);
        } catch {
            return v;
        }
    }
    return String(v);
}

function CapBadge({ supported, label, icon: Icon }: { supported: boolean; label: string; icon: React.ElementType }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${supported ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

// ─── Main Component ───

export function AiConfigEditor({ configs, plans }: { configs: ConfigMap; plans: PlanData[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [showTable, setShowTable] = useState(false);

    // API Keys state
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
        const m: Record<string, string> = {};
        for (const p of PROVIDERS) m[p.configKey] = "";
        return m;
    });
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});

    // Default settings state
    const [defaults, setDefaults] = useState({
        default_ai_provider: rawVal(configs["default_ai_provider"]) || "groq",
        default_ai_chat_model: rawVal(configs["default_ai_chat_model"]) || "llama-3.3-70b-versatile",
        default_ai_whisper_model: rawVal(configs["default_ai_whisper_model"]) || "whisper-large-v3-turbo",
        default_ai_temperature: rawVal(configs["default_ai_temperature"]) || "0.7",
    });

    // Plan model config state
    const [planConfigs, setPlanConfigs] = useState<Record<string, Record<string, string>>>(() => {
        const m: Record<string, Record<string, string>> = {};
        for (const p of plans) {
            const cfg = p.ai_model_config || {};
            const strOr = (v: JsonValue | undefined, fb = ""): string => (typeof v === "string" ? v : fb);
            m[p.slug] = {
                provider: strOr(cfg.provider),
                chat_model: strOr(cfg.chat_model) || strOr(cfg.model),
                whisper_model: strOr(cfg.whisper_model),
                temperature: cfg.temperature != null ? String(cfg.temperature) : "",
            };
        }
        return m;
    });

    // ─── Save helpers ───

    const markSaved = (key: string) => {
        setSaved((p) => ({ ...p, [key]: true }));
        setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2500);
    };

    const saveConfig = (key: string, value: JsonValue) => {
        startTransition(async () => {
            await updateAdminConfigAction(key, value);
            markSaved(key);
            router.refresh();
        });
    };

    const savePlanAiConfig = (slug: string) => {
        const cfg = planConfigs[slug];
        const payload = {
            provider: cfg.provider || undefined,
            chat_model: cfg.chat_model || undefined,
            whisper_model: cfg.whisper_model || undefined,
            temperature: cfg.temperature ? parseFloat(cfg.temperature) : undefined,
        };
        startTransition(async () => {
            await updatePlanAction(slug, { ai_model_config: payload });
            markSaved(`plan_${slug}`);
            router.refresh();
        });
    };

    const hasExistingKey = (configKey: string) => {
        const v = rawVal(configs[configKey]);
        return v.length > 0;
    };

    // ─── Grouped models for table ───
    const grouped = MODELS.reduce<Record<string, ModelInfo[]>>((acc, m) => {
        if (!acc[m.provider]) acc[m.provider] = [];
        acc[m.provider].push(m);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            {/* ═══════════ SECTION 1: API Keys ═══════════ */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">API Keys dos Providers</h2>
                </div>
                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {PROVIDERS.map((prov) => {
                        const existing = hasExistingKey(prov.configKey);
                        const masked = maskKey(rawVal(configs[prov.configKey]));
                        const isRevealed = revealed[prov.configKey] ?? false;
                        const inputVal = apiKeys[prov.configKey];

                        return (
                            <div key={prov.id} className="rounded-lg border border-border/30 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: prov.color }} />
                                    <span className="text-sm font-semibold">{prov.name}</span>
                                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded font-medium ${existing ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                                        {existing ? "Configurado" : "Nao configurado"}
                                    </span>
                                </div>

                                {existing && !inputVal && (
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs font-mono text-muted-foreground bg-background/50 rounded px-2 py-1.5 border border-border/20 truncate">
                                            {isRevealed ? rawVal(configs[prov.configKey]) : masked}
                                        </code>
                                        <button
                                            onClick={() => setRevealed((p) => ({ ...p, [prov.configKey]: !p[prov.configKey] }))}
                                            className="h-8 w-8 rounded-md flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                                            title={isRevealed ? "Ocultar" : "Revelar"}
                                        >
                                            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <input
                                        type="password"
                                        placeholder={existing ? "Nova key para substituir..." : prov.hint}
                                        value={inputVal}
                                        onChange={(e) => setApiKeys((p) => ({ ...p, [prov.configKey]: e.target.value }))}
                                        className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm font-mono placeholder:text-muted-foreground/50"
                                    />
                                    <button
                                        onClick={() => {
                                            if (!inputVal.trim()) return;
                                            saveConfig(prov.configKey, inputVal.trim());
                                            setApiKeys((p) => ({ ...p, [prov.configKey]: "" }));
                                        }}
                                        disabled={isPending || !inputVal.trim()}
                                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${saved[prov.configKey] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"}`}
                                        title="Salvar"
                                    >
                                        {saved[prov.configKey] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════ SECTION 2: Default AI Settings ═══════════ */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Configuracoes Padrao de IA</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Provider */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Provider Padrao</label>
                        <div className="flex items-center gap-2">
                            <select
                                value={defaults.default_ai_provider}
                                onChange={(e) => setDefaults((p) => ({ ...p, default_ai_provider: e.target.value }))}
                                className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm appearance-none cursor-pointer"
                            >
                                <option value="groq">Groq</option>
                                <option value="openai">OpenAI</option>
                                <option value="gemini">Google / Gemini</option>
                            </select>
                            <button
                                onClick={() => saveConfig("default_ai_provider", defaults.default_ai_provider)}
                                disabled={isPending}
                                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${saved["default_ai_provider"] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                title="Salvar"
                            >
                                {saved["default_ai_provider"] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Chat Model */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Modelo de Chat Padrao</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={defaults.default_ai_chat_model}
                                onChange={(e) => setDefaults((p) => ({ ...p, default_ai_chat_model: e.target.value }))}
                                placeholder="ex: llama-3.3-70b-versatile"
                                className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm font-mono"
                            />
                            <button
                                onClick={() => saveConfig("default_ai_chat_model", defaults.default_ai_chat_model)}
                                disabled={isPending}
                                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${saved["default_ai_chat_model"] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                title="Salvar"
                            >
                                {saved["default_ai_chat_model"] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Whisper Model */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Modelo de Whisper (Audio)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={defaults.default_ai_whisper_model}
                                onChange={(e) => setDefaults((p) => ({ ...p, default_ai_whisper_model: e.target.value }))}
                                placeholder="ex: whisper-large-v3-turbo"
                                className="flex-1 h-9 px-3 rounded-lg bg-background border border-border text-sm font-mono"
                            />
                            <button
                                onClick={() => saveConfig("default_ai_whisper_model", defaults.default_ai_whisper_model)}
                                disabled={isPending}
                                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${saved["default_ai_whisper_model"] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                title="Salvar"
                            >
                                {saved["default_ai_whisper_model"] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Temperature */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                            Temperatura Padrao: <span className="text-foreground font-mono">{defaults.default_ai_temperature}</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground">0</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={defaults.default_ai_temperature}
                                    onChange={(e) => setDefaults((p) => ({ ...p, default_ai_temperature: e.target.value }))}
                                    className="flex-1 h-2 rounded-lg appearance-none bg-zinc-700 accent-primary cursor-pointer"
                                />
                                <span className="text-[10px] text-muted-foreground">1</span>
                            </div>
                            <button
                                onClick={() => saveConfig("default_ai_temperature", parseFloat(defaults.default_ai_temperature))}
                                disabled={isPending}
                                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${saved["default_ai_temperature"] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                title="Salvar"
                            >
                                {saved["default_ai_temperature"] ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════ SECTION 3: Per-Plan AI Config ═══════════ */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Modelo de IA por Plano</h2>
                </div>
                <div className="p-4">
                    {plans.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano encontrado</p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {plans.map((plan) => {
                                const isVip = plan.slug === "vip";
                                const cfg = planConfigs[plan.slug] || {};

                                return (
                                    <div
                                        key={plan.slug}
                                        className={`rounded-lg border p-4 space-y-3 ${isVip ? "border-amber-500/40" : "border-border/30"}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${isVip ? "bg-amber-400" : "bg-primary"}`} />
                                                <span className="font-semibold text-sm">{plan.name}</span>
                                                <code className="text-[10px] text-muted-foreground font-mono">{plan.slug}</code>
                                            </div>
                                            <button
                                                onClick={() => savePlanAiConfig(plan.slug)}
                                                disabled={isPending}
                                                className={`h-8 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors ${saved[`plan_${plan.slug}`] ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                            >
                                                {saved[`plan_${plan.slug}`] ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                                {saved[`plan_${plan.slug}`] ? "Salvo" : "Salvar"}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Provider</label>
                                                <select
                                                    value={cfg.provider}
                                                    onChange={(e) => setPlanConfigs((p) => ({ ...p, [plan.slug]: { ...p[plan.slug], provider: e.target.value } }))}
                                                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs appearance-none cursor-pointer"
                                                >
                                                    <option value="">Usar padrao</option>
                                                    <option value="groq">Groq</option>
                                                    <option value="openai">OpenAI</option>
                                                    <option value="gemini">Google / Gemini</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Temperature</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={cfg.temperature}
                                                    onChange={(e) => setPlanConfigs((p) => ({ ...p, [plan.slug]: { ...p[plan.slug], temperature: e.target.value } }))}
                                                    placeholder="Padrao"
                                                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Chat Model</label>
                                                <input
                                                    type="text"
                                                    value={cfg.chat_model}
                                                    onChange={(e) => setPlanConfigs((p) => ({ ...p, [plan.slug]: { ...p[plan.slug], chat_model: e.target.value } }))}
                                                    placeholder="Usar padrao"
                                                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Whisper Model</label>
                                                <input
                                                    type="text"
                                                    value={cfg.whisper_model}
                                                    onChange={(e) => setPlanConfigs((p) => ({ ...p, [plan.slug]: { ...p[plan.slug], whisper_model: e.target.value } }))}
                                                    placeholder="Usar padrao"
                                                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════ SECTION 4: Model Comparison Table (collapsible) ═══════════ */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <button
                    onClick={() => setShowTable(!showTable)}
                    className="w-full p-4 border-b border-border/50 flex items-center gap-2 hover:bg-accent/10 transition-colors"
                >
                    <Brain className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Comparativo de Modelos</h2>
                    <span className="text-xs text-muted-foreground ml-2">({MODELS.length} modelos)</span>
                    <span className="ml-auto">
                        {showTable ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </span>
                </button>

                {showTable && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/30 bg-muted/30">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Modelo</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descricao</th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                                        <span className="flex items-center justify-end gap-1"><DollarSign className="h-3.5 w-3.5" />Input/1M</span>
                                    </th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                                        <span className="flex items-center justify-end gap-1"><DollarSign className="h-3.5 w-3.5" />Output/1M</span>
                                    </th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                                        <span className="flex items-center justify-center gap-1"><Zap className="h-3.5 w-3.5" />Velocidade</span>
                                    </th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Capabilities</th>
                                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sugerido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(grouped).map(([provider, models]) =>
                                    models.map((m, i) => (
                                        <tr key={m.model} className={`border-b border-border/20 hover:bg-accent/30 transition-colors ${i === 0 ? "border-t border-border/50" : ""}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {i === 0 ? (
                                                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.providerColor }} />
                                                    ) : (
                                                        <span className="inline-block w-2 h-2 shrink-0" />
                                                    )}
                                                    <div>
                                                        {i === 0 && <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.providerColor }}>{provider}</p>}
                                                        <p className="font-mono text-xs">{m.model}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">{m.description}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs">
                                                <span className={m.inputPer1M <= 0.15 ? "text-emerald-400" : m.inputPer1M <= 0.60 ? "text-amber-400" : "text-red-400"}>
                                                    ${m.inputPer1M.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs">
                                                <span className={m.outputPer1M <= 0.60 ? "text-emerald-400" : m.outputPer1M <= 2.00 ? "text-amber-400" : "text-red-400"}>
                                                    ${m.outputPer1M.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">{m.speed}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                    <CapBadge supported={m.supportsText} label="Texto" icon={MessageSquare} />
                                                    <CapBadge supported={m.supportsAudio} label="Audio" icon={Mic} />
                                                    <CapBadge supported={m.supportsImage} label="Imagem" icon={Image} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {m.recommended && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold ${m.recommended === "VIP" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-primary/15 text-primary border border-primary/30"}`}>
                                                        {m.recommended}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══════════ Cost Reference Cards ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/50 bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Mais Barato</p>
                            <p className="text-[10px] text-muted-foreground">Para plano Standard</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg font-bold text-emerald-400">Llama 3.1 8B</p>
                    <p className="text-xs text-muted-foreground mt-1">$0.05 input + $0.08 output / 1M tokens</p>
                    <p className="text-xs text-muted-foreground">~1000 mensagens/dia = ~$0.15/mes</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Melhor Custo-Beneficio</p>
                            <p className="text-[10px] text-muted-foreground">Recomendado</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg font-bold text-primary">Llama 3.3 70B</p>
                    <p className="text-xs text-muted-foreground mt-1">$0.59 input + $0.79 output / 1M tokens</p>
                    <p className="text-xs text-muted-foreground">~1000 msgs/dia = ~$2.50/mes</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                            <Brain className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Mais Capaz (VIP)</p>
                            <p className="text-[10px] text-muted-foreground">Texto + Audio + Imagem</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg font-bold text-amber-400">GPT-4.1</p>
                    <p className="text-xs text-muted-foreground mt-1">$2.00 input + $8.00 output / 1M tokens</p>
                    <p className="text-xs text-muted-foreground">~1000 msgs/dia = ~$18/mes</p>
                </div>
            </div>
        </div>
    );
}
