import { Brain, Zap, DollarSign, Image, Mic, MessageSquare } from "lucide-react";

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

const MODELS: ModelInfo[] = [
    // Groq
    { provider: "Groq", providerColor: "#F55036", model: "llama-3.3-70b-versatile", description: "Melhor custo-beneficio para NLP", inputPer1M: 0.59, outputPer1M: 0.79, speed: "~800 tok/s", supportsText: true, supportsAudio: false, supportsImage: false, recommended: "Standard" },
    { provider: "Groq", providerColor: "#F55036", model: "llama-3.1-8b-instant", description: "Ultra rapido, menor custo", inputPer1M: 0.05, outputPer1M: 0.08, speed: "~1200 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "Groq", providerColor: "#F55036", model: "mixtral-8x7b-32768", description: "Contexto grande (32k)", inputPer1M: 0.24, outputPer1M: 0.24, speed: "~600 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "Groq", providerColor: "#F55036", model: "whisper-large-v3-turbo", description: "Transcricao de audio (portugues)", inputPer1M: 0.04, outputPer1M: 0, speed: "Real-time", supportsText: false, supportsAudio: true, supportsImage: false },
    // OpenAI
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1", description: "Mais capaz, multimodal completo", inputPer1M: 2.00, outputPer1M: 8.00, speed: "~100 tok/s", supportsText: true, supportsAudio: true, supportsImage: true, recommended: "VIP" },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1-mini", description: "Rapido e barato, boa qualidade", inputPer1M: 0.40, outputPer1M: 1.60, speed: "~200 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4.1-nano", description: "Ultra economico", inputPer1M: 0.10, outputPer1M: 0.40, speed: "~300 tok/s", supportsText: true, supportsAudio: false, supportsImage: false },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4o", description: "Multimodal equilibrado", inputPer1M: 2.50, outputPer1M: 10.00, speed: "~100 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "OpenAI", providerColor: "#10A37F", model: "gpt-4o-mini", description: "Versao compacta do 4o", inputPer1M: 0.15, outputPer1M: 0.60, speed: "~200 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    // Google
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.5-pro", description: "Mais capaz do Google, multimodal", inputPer1M: 1.25, outputPer1M: 10.00, speed: "~150 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.5-flash", description: "Rapido e barato, bom para volume", inputPer1M: 0.15, outputPer1M: 0.60, speed: "~300 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
    { provider: "Google", providerColor: "#4285F4", model: "gemini-2.0-flash", description: "Geracao anterior, ultra economico", inputPer1M: 0.10, outputPer1M: 0.40, speed: "~350 tok/s", supportsText: true, supportsAudio: true, supportsImage: true },
];

function CapBadge({ supported, label, icon: Icon }: { supported: boolean; label: string; icon: React.ElementType }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${supported ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

export default function AIConfigPage() {
    const grouped = MODELS.reduce<Record<string, ModelInfo[]>>((acc, m) => {
        if (!acc[m.provider]) acc[m.provider] = [];
        acc[m.provider].push(m);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuracao de IA</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Compare modelos, precos e capabilities para escolher o melhor para cada plano.
                </p>
            </div>

            {/* Comparison Table */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Comparativo de Modelos</h2>
                </div>
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
                            {Object.entries(grouped).map(([provider, models]) => (
                                models.map((m, i) => (
                                    <tr key={m.model} className={`border-b border-border/20 hover:bg-accent/30 transition-colors ${i === 0 ? "border-t border-border/50" : ""}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {i === 0 && (
                                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.providerColor }} />
                                                )}
                                                {i !== 0 && <span className="inline-block w-2 h-2 shrink-0" />}
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cost Estimator Cards */}
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

            {/* Provider API Keys */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
                <h3 className="font-semibold mb-4">API Keys dos Providers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { name: "Groq", color: "#F55036", hint: "gsk_..." },
                        { name: "OpenAI", color: "#10A37F", hint: "sk-..." },
                        { name: "Google", color: "#4285F4", hint: "AIza..." },
                    ].map((p) => (
                        <div key={p.name} className="rounded-lg border border-border/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-sm font-semibold">{p.name}</span>
                                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">Nao configurado</span>
                            </div>
                            <input
                                type="password"
                                placeholder={p.hint}
                                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm font-mono"
                                disabled
                            />
                            <p className="text-[10px] text-muted-foreground mt-2">Configuravel via system_config</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
