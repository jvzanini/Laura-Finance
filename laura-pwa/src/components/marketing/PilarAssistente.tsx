"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Wallet } from "lucide-react";

type Categoria = {
    id: string;
    label: string;
    cor: string;
    valor: number; // centavos
};

const categorias: Categoria[] = [
    { id: "alimentacao", label: "Alimentação", cor: "#7C3AED", valor: 128450 },
    { id: "transporte", label: "Transporte", cor: "#D946EF", valor: 62780 },
    { id: "lazer", label: "Lazer", cor: "#F472B6", valor: 48200 },
    { id: "moradia", label: "Moradia", cor: "#8B5CF6", valor: 215000 },
    { id: "saude", label: "Saúde", cor: "#EC4899", valor: 37640 },
    { id: "outros", label: "Outros", cor: "#A78BFA", valor: 22110 },
];

const tabs = [
    { id: "todas", label: "Todas" },
    { id: "alimentacao", label: "Alimentação" },
    { id: "transporte", label: "Transporte" },
    { id: "lazer", label: "Lazer" },
    { id: "moradia", label: "Moradia" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// Linhas da "planilha feia" — deliberadamente inconsistentes.
const planilhaLinhas = [
    { mes: "Jan", gasto: "R$ 1.245,60", categoria: "mercado" },
    { mes: "jan.", gasto: "382,90", categoria: "Uber" },
    { mes: "FEV", gasto: "R$2100", categoria: "aluguel" },
    { mes: "Fev 2026", gasto: "R$ 89,00", categoria: "lanche ifood" },
    { mes: "março", gasto: "R$1.800,00", categoria: "Mercado + feira" },
    { mes: "MAR", gasto: "450", categoria: "posto" },
    { mes: "abr", gasto: "R$ 320,50", categoria: "Farmácia" },
    { mes: "Abril", gasto: "R$ 1.2k", categoria: "cartão nubank" },
];

function brl(centavos: number): string {
    const reais = centavos / 100;
    return reais.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
    });
}

function polarToCartesian(
    cx: number,
    cy: number,
    r: number,
    angleDeg: number
): [number, number] {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number
): string {
    const [sx, sy] = polarToCartesian(cx, cy, r, endAngle);
    const [ex, ey] = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 0 ${ex} ${ey} Z`;
}

export function PilarAssistente() {
    const [activeTab, setActiveTab] = useState<TabId>("todas");

    const total = useMemo(
        () => categorias.reduce((sum, c) => sum + c.valor, 0),
        []
    );

    // Cálculo das fatias do pizza (sem reassign local — usa acumulador no reduce)
    const fatias = useMemo(() => {
        return categorias.reduce<
            Array<Categoria & { startAngle: number; endAngle: number }>
        >((acc, c) => {
            const anterior = acc[acc.length - 1];
            const startAngle = anterior ? anterior.endAngle : 0;
            const endAngle = startAngle + (c.valor / total) * 360;
            acc.push({ ...c, startAngle, endAngle });
            return acc;
        }, []);
    }, [total]);

    // Top 3 categorias por valor
    const top3 = useMemo(
        () => [...categorias].sort((a, b) => b.valor - a.valor).slice(0, 3),
        []
    );

    const destaque = activeTab === "todas" ? null : activeTab;

    return (
        <section
            id="pilar-assistente"
            aria-labelledby="pilar-assistente-heading"
            className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
        >
            {/* Background dots sutil */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle,#ffffff_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
            />
            {/* Orbs violet */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.35),_transparent_70%)] blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -right-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,_rgba(217,70,239,0.25),_transparent_70%)] blur-3xl"
            />

            <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                        <Wallet className="size-3.5" aria-hidden />
                        Pilar 01 — Assistente financeiro
                    </div>
                    <h2
                        id="pilar-assistente-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                    >
                        1.{" "}
                        <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-200 bg-clip-text text-transparent">
                            Pare de usar planilha.
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Seu dashboard real, com gráficos interativos e filtros
                        em 1 clique. Experimente os filtros.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-8">
                    {/* Esquerda: planilha antiga feia */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6 }}
                        className="relative"
                        aria-label="Exemplo de planilha antiga caótica"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-4 rounded-2xl bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 blur-2xl"
                        />
                        <div
                            className="relative overflow-hidden rounded-sm border border-zinc-600 bg-[#E8E4DA] text-zinc-900 shadow-2xl"
                            style={{
                                transform: "rotate(-2.5deg)",
                                fontFamily:
                                    "'Courier New', Consolas, Menlo, monospace",
                                opacity: 0.85,
                            }}
                        >
                            {/* Barra de título estilo Excel */}
                            <div className="flex items-center justify-between border-b border-zinc-400 bg-[#D4CFC0] px-3 py-1">
                                <span
                                    className="text-[11px] font-bold text-zinc-700"
                                    style={{ fontFamily: "Arial, sans-serif" }}
                                >
                                    controle_gastos_FINAL_v3.xlsx
                                </span>
                                <div className="flex gap-1">
                                    <span
                                        aria-hidden
                                        className="block size-2.5 rounded-full bg-zinc-500"
                                    />
                                    <span
                                        aria-hidden
                                        className="block size-2.5 rounded-full bg-zinc-500"
                                    />
                                    <span
                                        aria-hidden
                                        className="block size-2.5 rounded-full bg-zinc-500"
                                    />
                                </div>
                            </div>
                            {/* Tabela */}
                            <table className="w-full border-collapse text-[11px]">
                                <thead>
                                    <tr className="bg-[#C4BFB0]">
                                        <th className="border border-zinc-400 px-2 py-1 text-left font-bold">
                                            Mês
                                        </th>
                                        <th className="border border-zinc-400 px-2 py-1 text-left font-bold">
                                            Gasto
                                        </th>
                                        <th className="border border-zinc-400 px-2 py-1 text-left font-bold">
                                            Categoria
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {planilhaLinhas.map((linha, i) => (
                                        <tr
                                            key={i}
                                            className={
                                                i % 2 === 0
                                                    ? "bg-[#F1EDE2]"
                                                    : "bg-[#E8E4DA]"
                                            }
                                        >
                                            <td className="border border-zinc-400 px-2 py-1">
                                                {linha.mes}
                                            </td>
                                            <td className="border border-zinc-400 px-2 py-1">
                                                {linha.gasto}
                                            </td>
                                            <td className="border border-zinc-400 px-2 py-1">
                                                {linha.categoria}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-[#E0DBCC]">
                                        <td
                                            colSpan={3}
                                            className="border border-zinc-400 px-2 py-1 text-[10px] italic"
                                        >
                                            ??? somar depois
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-center lg:text-left">
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-400 backdrop-blur-sm">
                                Planilha antiga · sem cor, sem filtro, sem
                                insight
                            </span>
                        </div>
                    </motion.div>

                    {/* Direita: plataforma Laura bonita e interativa */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="relative"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-rose-400/10 opacity-70 blur-2xl"
                        />
                        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#15121F]/95 via-[#0F0D1A]/95 to-[#0A0A10]/95 p-5 shadow-2xl shadow-violet-950/60 backdrop-blur-2xl sm:p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-violet-300">
                                        Laura Finance
                                    </span>
                                    <h3 className="mt-0.5 text-base font-semibold text-white sm:text-lg">
                                        Relatório por categoria
                                    </h3>
                                    <span className="text-xs text-zinc-400">
                                        Abril de 2026
                                    </span>
                                </div>
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                        Total
                                    </span>
                                    <span className="text-sm font-bold text-white sm:text-base">
                                        {brl(total)}
                                    </span>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div
                                role="tablist"
                                aria-label="Filtrar por categoria"
                                className="mt-5 flex flex-wrap gap-1.5"
                            >
                                {tabs.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() =>
                                                setActiveTab(tab.id as TabId)
                                            }
                                            className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold transition-all sm:text-sm ${
                                                isActive
                                                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/40"
                                                    : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Pizza SVG */}
                            <div className="mt-6 flex items-center justify-center">
                                <div className="relative">
                                    <svg
                                        width="220"
                                        height="220"
                                        viewBox="0 0 220 220"
                                        role="img"
                                        aria-label="Distribuição de gastos por categoria"
                                    >
                                        <defs>
                                            <filter
                                                id="pizza-shadow"
                                                x="-20%"
                                                y="-20%"
                                                width="140%"
                                                height="140%"
                                            >
                                                <feDropShadow
                                                    dx="0"
                                                    dy="0"
                                                    stdDeviation="6"
                                                    floodColor="#D946EF"
                                                    floodOpacity="0.55"
                                                />
                                            </filter>
                                        </defs>
                                        {fatias.map((f) => {
                                            const isHighlighted =
                                                destaque === f.id;
                                            const isDimmed =
                                                destaque !== null &&
                                                !isHighlighted;
                                            const midAngle =
                                                (f.startAngle + f.endAngle) / 2;
                                            const [ox, oy] = polarToCartesian(
                                                0,
                                                0,
                                                isHighlighted ? 10 : 0,
                                                midAngle
                                            );
                                            return (
                                                <motion.path
                                                    key={f.id}
                                                    d={arcPath(
                                                        110,
                                                        110,
                                                        90,
                                                        f.startAngle,
                                                        f.endAngle
                                                    )}
                                                    fill={f.cor}
                                                    stroke="#0A0A10"
                                                    strokeWidth="2"
                                                    animate={{
                                                        x: ox,
                                                        y: oy,
                                                        opacity: isDimmed
                                                            ? 0.25
                                                            : 1,
                                                        scale: isHighlighted
                                                            ? 1.02
                                                            : 1,
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 220,
                                                        damping: 20,
                                                    }}
                                                    style={{
                                                        transformOrigin:
                                                            "110px 110px",
                                                        filter: isHighlighted
                                                            ? "url(#pizza-shadow)"
                                                            : undefined,
                                                    }}
                                                />
                                            );
                                        })}
                                        {/* Centro */}
                                        <circle
                                            cx="110"
                                            cy="110"
                                            r="48"
                                            fill="#0F0D1A"
                                            stroke="rgba(255,255,255,0.08)"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x="110"
                                            y="104"
                                            textAnchor="middle"
                                            className="fill-zinc-400"
                                            style={{
                                                fontSize: 9,
                                                textTransform: "uppercase",
                                                letterSpacing: 1,
                                                fontWeight: 500,
                                            }}
                                        >
                                            Total mês
                                        </text>
                                        <text
                                            x="110"
                                            y="122"
                                            textAnchor="middle"
                                            className="fill-white"
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {brl(
                                                destaque
                                                    ? categorias.find(
                                                          (c) =>
                                                              c.id === destaque
                                                      )?.valor ?? total
                                                    : total
                                            )}
                                        </text>
                                    </svg>
                                </div>
                            </div>

                            {/* Top 3 categorias com barras */}
                            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                        Top categorias
                                    </span>
                                    <span className="text-[10px] font-medium text-violet-300">
                                        {categorias.length} no total
                                    </span>
                                </div>
                                <ul className="mt-3 space-y-3">
                                    {top3.map((c) => {
                                        const pct = (c.valor / total) * 100;
                                        const isDim =
                                            destaque !== null &&
                                            destaque !== c.id;
                                        return (
                                            <li
                                                key={c.id}
                                                className={`transition-opacity ${
                                                    isDim ? "opacity-40" : "opacity-100"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="flex items-center gap-2 text-zinc-200">
                                                        <span
                                                            aria-hidden
                                                            className="block size-2.5 rounded-full"
                                                            style={{
                                                                background:
                                                                    c.cor,
                                                            }}
                                                        />
                                                        {c.label}
                                                    </span>
                                                    <span className="font-semibold text-white">
                                                        {brl(c.valor)}
                                                    </span>
                                                </div>
                                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                                                    <motion.div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            background: `linear-gradient(90deg, ${c.cor}, #F472B6)`,
                                                        }}
                                                        initial={{ width: 0 }}
                                                        whileInView={{
                                                            width: `${pct}%`,
                                                        }}
                                                        viewport={{
                                                            once: true,
                                                            amount: 0.5,
                                                        }}
                                                        transition={{
                                                            duration: 0.8,
                                                            ease: "easeOut",
                                                        }}
                                                    />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                        <div className="mt-6 text-center lg:text-left">
                            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">
                                Plataforma Laura · filtro em 1 clique
                            </span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
