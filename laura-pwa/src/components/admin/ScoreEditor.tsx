"use client";

import { useState, useTransition } from "react";
import { updateAdminConfigAction } from "@/lib/actions/adminConfig";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";

type Weights = { billsOnTime: number; budgetRespect: number; savingsRate: number; debtLevel: number };
type Thresholds = { excellent: number; good: number; fair: number };

const FACTOR_META: { key: keyof Weights; label: string; color: string; description: string }[] = [
    { key: "billsOnTime", label: "Faturas em Dia", color: "#34d399", description: "% de faturas pagas antes do vencimento" },
    { key: "budgetRespect", label: "Respeito ao Orcamento", color: "#60a5fa", description: "% de categorias dentro do teto" },
    { key: "savingsRate", label: "Taxa de Poupanca", color: "#fbbf24", description: "% da receita nao gasta" },
    { key: "debtLevel", label: "Nivel de Divida", color: "#f87171", description: "Inverso do % comprometido com dividas" },
];

function ScoreGauge({ thresholds }: { thresholds: Thresholds }) {
    const segments = [
        { label: "Critico", from: 0, to: thresholds.fair, color: "#ef4444" },
        { label: "Regular", from: thresholds.fair, to: thresholds.good, color: "#f59e0b" },
        { label: "Bom", from: thresholds.good, to: thresholds.excellent, color: "#3b82f6" },
        { label: "Excelente", from: thresholds.excellent, to: 100, color: "#10b981" },
    ];

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Preview da barra de score</p>
            <div className="h-6 rounded-full overflow-hidden flex">
                {segments.map((s) => (
                    <div
                        key={s.label}
                        className="h-full flex items-center justify-center text-[9px] font-bold text-white/90 transition-all duration-300"
                        style={{ width: `${s.to - s.from}%`, backgroundColor: s.color }}
                    >
                        {s.to - s.from >= 12 ? `${s.label} (${s.from}-${s.to})` : s.to - s.from >= 8 ? `${s.from}-${s.to}` : ""}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0</span>
                <span>{thresholds.fair}</span>
                <span>{thresholds.good}</span>
                <span>{thresholds.excellent}</span>
                <span>100</span>
            </div>
        </div>
    );
}

export function ScoreEditor({
    initialWeights,
    initialThresholds,
    initialLookback,
}: {
    initialWeights: Weights;
    initialThresholds: Thresholds;
    initialLookback: number;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [weights, setWeights] = useState<Weights>(initialWeights);
    const [thresholds, setThresholds] = useState<Thresholds>(initialThresholds);
    const [lookback, setLookback] = useState(initialLookback);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const isBalanced = Math.abs(totalWeight - 1) < 0.005;

    const updateWeight = (key: keyof Weights, raw: number) => {
        setWeights((prev) => ({ ...prev, [key]: Math.round(raw * 100) / 100 }));
        setSaved(false);
    };

    const normalizeWeights = () => {
        if (totalWeight === 0) return;
        const factor = 1 / totalWeight;
        const normalized: Weights = { billsOnTime: 0, budgetRespect: 0, savingsRate: 0, debtLevel: 0 };
        for (const k of Object.keys(weights) as (keyof Weights)[]) {
            normalized[k] = Math.round(weights[k] * factor * 100) / 100;
        }
        // Adjust rounding to sum exactly 1.0
        const diff = 1 - Object.values(normalized).reduce((a: number, b: number) => a + b, 0);
        normalized.billsOnTime = Math.round((normalized.billsOnTime + diff) * 100) / 100;
        setWeights(normalized);
        setSaved(false);
    };

    const handleSave = () => {
        setError("");
        startTransition(async () => {
            const r1 = await updateAdminConfigAction("score_weights", weights);
            if (r1.error) { setError(r1.error); return; }
            const r2 = await updateAdminConfigAction("score_thresholds", thresholds);
            if (r2.error) { setError(r2.error); return; }
            const r3 = await updateAdminConfigAction("score_lookback_days", lookback);
            if (r3.error) { setError(r3.error); return; }
            setSaved(true);
            router.refresh();
            setTimeout(() => setSaved(false), 3000);
        });
    };

    const handleReset = () => {
        setWeights(initialWeights);
        setThresholds(initialThresholds);
        setLookback(initialLookback);
        setSaved(false);
        setError("");
    };

    return (
        <div className="space-y-6">
            {/* Weights */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="font-semibold">Pesos dos Fatores</h2>
                    <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded ${isBalanced ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        Total: {Math.round(totalWeight * 100)}%
                    </span>
                    {!isBalanced && (
                        <button onClick={normalizeWeights} className="text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors">
                            Normalizar
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FACTOR_META.map((f) => {
                        const val = weights[f.key];
                        const pct = Math.round(val * 100);
                        return (
                            <div key={f.key} className="rounded-lg border border-border/30 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                                    <span className="text-sm font-medium flex-1">{f.label}</span>
                                    <span className="font-mono text-lg font-bold">{pct}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={pct}
                                    onChange={(e) => updateWeight(f.key, Number(e.target.value) / 100)}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
                                />
                                <p className="text-[10px] text-muted-foreground">{f.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Thresholds */}
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
                <h2 className="font-semibold">Classificacao do Score</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                        { key: "excellent" as const, label: "Excelente (>=)", color: "emerald" },
                        { key: "good" as const, label: "Bom (>=)", color: "blue" },
                        { key: "fair" as const, label: "Regular (>=)", color: "amber" },
                    ]).map((t) => (
                        <div key={t.key} className={`rounded-lg border border-border/30 p-4 bg-${t.color}-500/5`}>
                            <label className="text-xs text-muted-foreground block mb-1">{t.label}</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={thresholds[t.key]}
                                onChange={(e) => {
                                    setThresholds((prev) => ({ ...prev, [t.key]: Number(e.target.value) }));
                                    setSaved(false);
                                }}
                                className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm font-mono"
                            />
                        </div>
                    ))}
                </div>
                <ScoreGauge thresholds={thresholds} />
            </div>

            {/* Lookback */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
                <h2 className="font-semibold mb-3">Parametros</h2>
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border/30">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Lookback Period</p>
                        <p className="text-[10px] text-muted-foreground">Janela de analise para calculo do score (dias)</p>
                    </div>
                    <input
                        type="number"
                        min={7}
                        max={365}
                        value={lookback}
                        onChange={(e) => { setLookback(Number(e.target.value)); setSaved(false); }}
                        className="w-24 h-9 px-3 rounded-md bg-background border border-border text-sm font-mono text-right"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    <Save className="h-4 w-4" />
                    {isPending ? "Salvando..." : "Salvar Configuracoes"}
                </button>
                <button
                    onClick={handleReset}
                    disabled={isPending}
                    className="h-9 px-4 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    <RotateCcw className="h-4 w-4" />
                    Resetar
                </button>
                {saved && <span className="text-xs text-emerald-400 animate-pulse">Salvo com sucesso!</span>}
                {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
        </div>
    );
}
