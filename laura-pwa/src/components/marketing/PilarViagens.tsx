"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Meses PT-BR para montar "Paris — <mês> <ano>" de forma dinâmica.
const MESES_VIAGEM = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];
const MESES_ABREV = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
];

/** Mês da viagem = mês atual + 2 (rollover pra ano seguinte se Nov/Dez). */
function proximaViagem(): { nomeMes: string; ano: number; idxMes: number } {
    const hoje = new Date();
    const idxMes = (hoje.getMonth() + 2) % 12;
    const ano =
        hoje.getMonth() + 2 >= 12 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    return { nomeMes: MESES_VIAGEM[idxMes], ano, idxMes };
}

import {
    Coffee,
    Globe2,
    Hotel,
    LineChart,
    MousePointerClick,
    PieChart,
    Plane,
    Repeat2,
    ShoppingBag,
    Ticket,
    type LucideIcon,
} from "lucide-react";

type ItemOrcamento = {
    id: string;
    label: string;
    icone: LucideIcon;
    orcado: number;
    gasto: number;
};

const itens: ItemOrcamento[] = [
    {
        id: "passagens",
        label: "Passagens aéreas",
        icone: Plane,
        orcado: 320000,
        gasto: 320000,
    },
    {
        id: "hospedagem",
        label: "Hospedagem",
        icone: Hotel,
        orcado: 270000,
        gasto: 210000,
    },
    {
        id: "cafe",
        label: "Café da manhã",
        icone: Coffee,
        orcado: 40000,
        gasto: 18000,
    },
    {
        id: "passeios",
        label: "Passeios",
        icone: Ticket,
        orcado: 75000,
        gasto: 45000,
    },
    {
        id: "compras",
        label: "Compras",
        icone: ShoppingBag,
        orcado: 60000,
        gasto: 18000,
    },
];

type RelatorioId = "orcamento" | "diario" | "categorias" | "conversao";

type DiaGasto = {
    dia: string;
    label: string;
    totalBrl: number;
    eur: number;
};

// Gastos por dia são gerados dinamicamente a partir do mês da viagem
// (proximaViagem().mesAbrev em lowercase) — mantém os dias/valores, atualiza só o mês.
function buildGastosDiarios(mesAbrevLower: string): DiaGasto[] {
    return [
        { dia: "SEG", label: `10/${mesAbrevLower}`, totalBrl: 48200, eur: 8480 },
        { dia: "TER", label: `11/${mesAbrevLower}`, totalBrl: 62400, eur: 10984 },
        { dia: "QUA", label: `12/${mesAbrevLower}`, totalBrl: 38900, eur: 6848 },
        { dia: "QUI", label: `13/${mesAbrevLower}`, totalBrl: 71200, eur: 12534 },
        { dia: "SEX", label: `14/${mesAbrevLower}`, totalBrl: 55600, eur: 9788 },
        { dia: "SAB", label: `15/${mesAbrevLower}`, totalBrl: 82400, eur: 14510 },
        { dia: "DOM", label: `16/${mesAbrevLower}`, totalBrl: 44100, eur: 7763 },
    ];
}

type CategoriaViagem = {
    id: string;
    label: string;
    cor: string;
    valor: number;
};

const categoriasViagem: CategoriaViagem[] = [
    { id: "passagens", label: "Passagens", cor: "#7C3AED", valor: 320000 },
    { id: "hospedagem", label: "Hospedagem", cor: "#A855F7", valor: 210000 },
    { id: "alimentacao", label: "Alimentação", cor: "#D946EF", valor: 48000 },
    { id: "passeios", label: "Passeios", cor: "#EC4899", valor: 45000 },
    { id: "compras", label: "Compras", cor: "#F472B6", valor: 18000 },
];

type Conversao = {
    origem: string;
    destino: string;
    taxa: string;
    destaque: string;
};

const conversoes: Conversao[] = [
    { origem: "1 EUR", destino: "R$ 5,70", taxa: "+0,12%", destaque: "euro" },
    { origem: "1 USD", destino: "R$ 5,20", taxa: "+0,08%", destaque: "dolar" },
    { origem: "1 GBP", destino: "R$ 6,64", taxa: "-0,05%", destaque: "libra" },
    { origem: "1 JPY", destino: "R$ 0,034", taxa: "+0,03%", destaque: "iene" },
];

function brl(centavos: number): string {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
    });
}

function TorreEiffel({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 380"
            className={className}
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="100" y1="10" x2="100" y2="35" />
            <path d="M 92 35 L 108 35 L 104 55 L 96 55 Z" />
            <path d="M 96 55 L 104 55 L 112 105 L 88 105 Z" />
            <line x1="85" y1="105" x2="115" y2="105" />
            <line x1="85" y1="115" x2="115" y2="115" />
            <path d="M 88 115 L 112 115 L 125 200 L 75 200 Z" />
            <line x1="70" y1="200" x2="130" y2="200" />
            <line x1="70" y1="212" x2="130" y2="212" />
            <path d="M 78 212 Q 100 260 122 212" />
            <line x1="75" y1="212" x2="45" y2="370" />
            <line x1="125" y1="212" x2="155" y2="370" />
            <line x1="88" y1="212" x2="78" y2="370" />
            <line x1="112" y1="212" x2="122" y2="370" />
            <line x1="40" y1="370" x2="160" y2="370" />
            <line x1="96" y1="55" x2="96" y2="105" />
            <line x1="104" y1="55" x2="104" y2="105" />
            <line x1="90" y1="115" x2="95" y2="200" />
            <line x1="110" y1="115" x2="105" y2="200" />
            <line x1="100" y1="55" x2="100" y2="200" />
            <line x1="92" y1="65" x2="108" y2="95" />
            <line x1="108" y1="65" x2="92" y2="95" />
            <line x1="90" y1="130" x2="110" y2="180" />
            <line x1="110" y1="130" x2="90" y2="180" />
        </svg>
    );
}

// Avião SVG estilizado com trilha pontilhada curva — substitui o Cristo
// Redentor. Padrão fintech de viagem: avião em diagonal com rota.
function AviaoRoute({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 260 380"
            className={className}
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* Rota pontilhada curva (da base ao topo) */}
            <path
                d="M 20 340 Q 120 280 130 180 Q 140 80 230 40"
                strokeWidth="1.2"
                strokeDasharray="3 6"
                opacity="0.55"
            />
            {/* Pontos de partida/chegada */}
            <circle cx="20" cy="340" r="4" fill="currentColor" opacity="0.6" />
            <circle cx="230" cy="40" r="4" fill="currentColor" opacity="0.6" />
            {/* Avião (simples, diagonal) */}
            <g transform="translate(135 175) rotate(-35)">
                <path
                    d="M 0 -40 L 6 -14 L 42 -8 L 42 4 L 6 10 L 2 26 L 12 30 L 12 38 L -12 38 L -12 30 L -2 26 L -6 10 L -42 4 L -42 -8 L -6 -14 Z"
                    fill="currentColor"
                    opacity="0.85"
                />
            </g>
            {/* Glow sutil no avião */}
            <circle
                cx="135"
                cy="175"
                r="22"
                fill="currentColor"
                opacity="0.12"
            />
        </svg>
    );
}

// Helpers geométricos da pizza.
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

const relatorios: Array<{
    id: RelatorioId;
    label: string;
    icone: LucideIcon;
}> = [
    { id: "orcamento", label: "Orçamento", icone: Plane },
    { id: "diario", label: "Gastos por dia", icone: LineChart },
    { id: "categorias", label: "Por categoria", icone: PieChart },
    { id: "conversao", label: "Conversão", icone: Repeat2 },
];

export function PilarViagens() {
    const [relatorio, setRelatorio] = useState<RelatorioId>("orcamento");
    const viagem = useMemo(() => proximaViagem(), []);

    return (
        <section
            id="pilar-viagens"
            aria-labelledby="pilar-viagens-heading"
            className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
        >
            {/* Gradient violet → rose → fuchsia (sem amber) */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(244,114,182,0.16)_0%,_rgba(217,70,239,0.18)_45%,_rgba(124,58,237,0.22)_100%)]"
            />
            {/* Orb central bem sutil (violet) */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-1/3 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.22),_transparent_70%)] blur-3xl"
            />

            {/* Torre Eiffel na borda esquerda */}
            <div
                aria-hidden
                className="pointer-events-none absolute -left-16 bottom-0 z-0 hidden h-[30rem] w-auto text-violet-200/25 sm:block md:-left-24 md:h-[34rem] lg:-left-10 lg:h-[38rem]"
            >
                <TorreEiffel className="h-full w-auto" />
            </div>

            {/* Avião + rota na borda direita (substitui Cristo Redentor) */}
            <div
                aria-hidden
                className="pointer-events-none absolute -right-12 bottom-0 z-0 hidden h-[28rem] w-auto text-rose-200/30 sm:block md:-right-20 md:h-[32rem] lg:-right-8 lg:h-[36rem]"
            >
                <AviaoRoute className="h-full w-auto" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-rose-200 backdrop-blur-sm">
                        <Plane className="size-3.5" aria-hidden />
                        Pilar 03 — Planejador de viagens
                    </div>
                    <h2
                        id="pilar-viagens-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                    >
                        3.{" "}
                        <span className="bg-gradient-to-r from-rose-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                            Planeje sua viagem e saiba exatamente quanto gastar.
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-200 sm:text-lg">
                        Orçamento por categoria, acompanhamento em tempo real,
                        conversão automática de moeda. Para férias, lua de mel,
                        mochilão.
                    </p>
                </div>

                <div className="relative mt-16 flex justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.94 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-120px" }}
                        transition={{
                            duration: 0.5,
                            delay: 0.1,
                            ease: "easeOut",
                        }}
                        className="relative w-full max-w-5xl"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20 opacity-80 blur-2xl"
                        />
                        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1F1325]/95 via-[#170E1E]/95 to-[#0A0A10]/95 shadow-2xl shadow-rose-950/60 backdrop-blur-2xl">
                            {/* Header do card com contexto da viagem */}
                            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
                                <div className="flex flex-col leading-tight">
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-rose-300">
                                        <Globe2
                                            className="size-3.5"
                                            aria-hidden
                                        />
                                        Laura Finance · Viagem
                                    </span>
                                    <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                                        Paris — {viagem.nomeMes} {viagem.ano}
                                    </h3>
                                    <span className="mt-1 text-xs text-zinc-400">
                                        7 dias · 2 pessoas
                                    </span>
                                </div>
                                {/* Chamariz pulsante */}
                                <motion.span
                                    animate={{
                                        scale: [1, 1.06, 1],
                                        opacity: [0.8, 1, 0.8],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-200 ring-1 ring-violet-400/30"
                                >
                                    <MousePointerClick
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Navegue pelos relatórios
                                </motion.span>
                            </div>

                            {/* Layout: sidebar + conteúdo */}
                            <div className="grid grid-cols-1 md:grid-cols-[15rem_1fr]">
                                {/* Sidebar desktop / abas mobile */}
                                <nav
                                    role="tablist"
                                    aria-label="Escolher relatório"
                                    className="flex gap-1.5 overflow-x-auto border-b border-white/10 p-3 md:flex-col md:border-b-0 md:border-r md:p-3"
                                >
                                    {relatorios.map((r) => {
                                        const isActive = relatorio === r.id;
                                        const Icon = r.icone;
                                        return (
                                            <button
                                                key={r.id}
                                                role="tab"
                                                aria-selected={isActive}
                                                onClick={() =>
                                                    setRelatorio(r.id)
                                                }
                                                className={
                                                    isActive
                                                        ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/40 transition-all sm:text-sm md:justify-start md:px-4"
                                                        : "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:text-sm md:justify-start md:px-4"
                                                }
                                            >
                                                <Icon
                                                    className={
                                                        isActive
                                                            ? "size-4 text-white"
                                                            : "size-4 text-zinc-500"
                                                    }
                                                    aria-hidden
                                                />
                                                {r.label}
                                            </button>
                                        );
                                    })}
                                </nav>

                                {/* Conteúdo do relatório selecionado — altura FIXA pra evitar
                                    layout shift ao trocar entre relatórios. */}
                                <div className="relative h-auto min-h-[28rem] overflow-hidden p-5 sm:p-7 lg:h-[32rem]">
                                    <AnimatePresence mode="wait" initial={false}>
                                        {relatorio === "orcamento" && (
                                            <motion.div
                                                key="orcamento"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                                                className="absolute inset-0 overflow-y-auto p-5 sm:p-6"
                                            >
                                                <RelatorioOrcamento />
                                            </motion.div>
                                        )}
                                        {relatorio === "diario" && (
                                            <motion.div
                                                key="diario"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                                                className="absolute inset-0 overflow-y-auto p-5 sm:p-6"
                                            >
                                                <RelatorioDiario />
                                            </motion.div>
                                        )}
                                        {relatorio === "categorias" && (
                                            <motion.div
                                                key="categorias"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                                                className="absolute inset-0 overflow-y-auto p-5 sm:p-6"
                                            >
                                                <RelatorioCategorias />
                                            </motion.div>
                                        )}
                                        {relatorio === "conversao" && (
                                            <motion.div
                                                key="conversao"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                                                className="absolute inset-0 overflow-y-auto p-5 sm:p-6"
                                            >
                                                <RelatorioConversao />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ─── Views por relatório ─────────────────────────────────────────────────

function RelatorioOrcamento() {
    const totalOrcado = itens.reduce((s, i) => s + i.orcado, 0);
    const totalGasto = itens.reduce((s, i) => s + i.gasto, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Orçamento
                    </span>
                    <span className="text-sm font-semibold text-white">
                        Gastos vs. planejado
                    </span>
                </div>
                <div className="flex flex-col items-end leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Total
                    </span>
                    <span className="text-base font-bold text-white">
                        {brl(totalGasto)}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                        de {brl(totalOrcado)}
                    </span>
                </div>
            </div>

            <div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400"
                        initial={{ width: 0 }}
                        animate={{
                            width: `${(totalGasto / totalOrcado) * 100}%`,
                        }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500">
                    <span>
                        {Math.round((totalGasto / totalOrcado) * 100)}% do
                        orçamento
                    </span>
                    <span>resta {brl(totalOrcado - totalGasto)}</span>
                </div>
            </div>

            <ul className="space-y-3">
                {itens.map((item, i) => {
                    const pct = Math.min(
                        100,
                        Math.round((item.gasto / item.orcado) * 100)
                    );
                    const Icon = item.icone;
                    return (
                        <motion.li
                            key={item.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                                duration: 0.3,
                                delay: i * 0.05,
                            }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-xs font-medium text-zinc-200 sm:text-sm">
                                    <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-200 ring-1 ring-inset ring-white/10">
                                        <Icon
                                            className="size-3.5"
                                            aria-hidden
                                        />
                                    </span>
                                    {item.label}
                                </span>
                                <span className="text-xs font-semibold text-white sm:text-sm">
                                    {brl(item.gasto)}
                                    <span className="font-normal text-zinc-500">
                                        {" "}
                                        / {brl(item.orcado)}
                                    </span>
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{
                                        duration: 0.7,
                                        delay: i * 0.06,
                                        ease: "easeOut",
                                    }}
                                />
                            </div>
                            <div className="mt-1 flex justify-end text-[10px] text-zinc-500">
                                {pct}%
                            </div>
                        </motion.li>
                    );
                })}
            </ul>
        </motion.div>
    );
}

function RelatorioDiario() {
    const viagem = useMemo(() => proximaViagem(), []);
    const mesAbrev = MESES_ABREV[viagem.idxMes].toLowerCase();
    const gastosDiarios = useMemo(
        () => buildGastosDiarios(mesAbrev),
        [mesAbrev]
    );
    const max = useMemo(
        () => Math.max(...gastosDiarios.map((d) => d.totalBrl)),
        [gastosDiarios]
    );
    const total = useMemo(
        () => gastosDiarios.reduce((s, d) => s + d.totalBrl, 0),
        [gastosDiarios]
    );

    const width = 280;
    const height = 120;
    const padX = 8;
    const padY = 12;
    const stepX = (width - padX * 2) / (gastosDiarios.length - 1);

    const points = gastosDiarios.map((d, i) => {
        const x = padX + i * stepX;
        const y =
            height - padY - (d.totalBrl / max) * (height - padY * 2);
        return { x, y };
    });

    const linePath = points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${
        height - padY
    } L ${points[0].x} ${height - padY} Z`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Gastos por dia
                    </span>
                    <span className="text-sm font-semibold text-white">
                        Últimos 7 dias em Paris · {viagem.nomeMes}
                    </span>
                </div>
                <div className="flex flex-col items-end leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Total semana
                    </span>
                    <span className="text-base font-bold text-white">
                        {brl(total)}
                    </span>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-32 w-full"
                    role="img"
                    aria-label="Gráfico de linha de gastos por dia"
                >
                    <defs>
                        <linearGradient
                            id="viagens-area"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                        >
                            <stop
                                offset="0%"
                                stopColor="#F472B6"
                                stopOpacity="0.45"
                            />
                            <stop
                                offset="100%"
                                stopColor="#7C3AED"
                                stopOpacity="0"
                            />
                        </linearGradient>
                        <linearGradient
                            id="viagens-line"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                        >
                            <stop offset="0%" stopColor="#7C3AED" />
                            <stop offset="50%" stopColor="#D946EF" />
                            <stop offset="100%" stopColor="#F472B6" />
                        </linearGradient>
                    </defs>
                    <motion.path
                        d={areaPath}
                        fill="url(#viagens-area)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                    />
                    <motion.path
                        d={linePath}
                        stroke="url(#viagens-line)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                    {points.map((p, i) => (
                        <motion.circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="#F472B6"
                            stroke="#0A0A10"
                            strokeWidth="1.5"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                                duration: 0.25,
                                delay: 0.6 + i * 0.05,
                            }}
                        />
                    ))}
                </svg>
                <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                    {gastosDiarios.map((d) => (
                        <span key={d.dia}>{d.dia}</span>
                    ))}
                </div>
            </div>

            <ul className="space-y-1.5">
                {gastosDiarios.map((d, i) => (
                    <motion.li
                        key={d.dia}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                    >
                        <span className="flex items-center gap-2 text-zinc-300">
                            <span className="inline-flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-[10px] font-bold text-violet-200">
                                {d.dia}
                            </span>
                            {d.label}
                        </span>
                        <span className="flex items-baseline gap-2">
                            <span className="font-semibold text-white">
                                {brl(d.totalBrl)}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                                €{" "}
                                {(d.eur / 100).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </span>
                    </motion.li>
                ))}
            </ul>
        </motion.div>
    );
}

function RelatorioCategorias() {
    const total = useMemo(
        () => categoriasViagem.reduce((s, c) => s + c.valor, 0),
        []
    );

    const fatias = useMemo(() => {
        return categoriasViagem.reduce<
            Array<CategoriaViagem & { startAngle: number; endAngle: number }>
        >((acc, c) => {
            const anterior = acc[acc.length - 1];
            const startAngle = anterior ? anterior.endAngle : 0;
            const endAngle = startAngle + (c.valor / total) * 360;
            acc.push({ ...c, startAngle, endAngle });
            return acc;
        }, []);
    }, [total]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Por categoria
                    </span>
                    <span className="text-sm font-semibold text-white">
                        Distribuição da viagem
                    </span>
                </div>
                <div className="flex flex-col items-end leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Total
                    </span>
                    <span className="text-base font-bold text-white">
                        {brl(total)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr]">
                <div className="flex items-center justify-center">
                    <svg
                        width="170"
                        height="170"
                        viewBox="0 0 220 220"
                        role="img"
                        aria-label="Pizza de categorias da viagem"
                    >
                        {fatias.map((f) => (
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4 }}
                            />
                        ))}
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
                            {categoriasViagem.length} cat.
                        </text>
                        <text
                            x="110"
                            y="122"
                            textAnchor="middle"
                            className="fill-white"
                            style={{ fontSize: 14, fontWeight: 700 }}
                        >
                            {brl(total)}
                        </text>
                    </svg>
                </div>

                <ul className="space-y-2">
                    {categoriasViagem.map((c, i) => {
                        const pct = Math.round((c.valor / total) * 100);
                        return (
                            <motion.li
                                key={c.id}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.3,
                                    delay: i * 0.05,
                                }}
                                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                            >
                                <span className="flex items-center gap-2 text-zinc-200">
                                    <span
                                        aria-hidden
                                        className="block size-2.5 rounded-full"
                                        style={{ background: c.cor }}
                                    />
                                    {c.label}
                                </span>
                                <span className="flex items-baseline gap-2">
                                    <span className="font-semibold text-white">
                                        {brl(c.valor)}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                        {pct}%
                                    </span>
                                </span>
                            </motion.li>
                        );
                    })}
                </ul>
            </div>
        </motion.div>
    );
}

function RelatorioConversao() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Conversão de moedas
                    </span>
                    <span className="text-sm font-semibold text-white">
                        Cotação em tempo real
                    </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-200">
                    <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-rose-400"
                    />
                    Ao vivo
                </span>
            </div>

            <ul className="space-y-2">
                {conversoes.map((c, i) => {
                    const isUp = c.taxa.startsWith("+");
                    return (
                        <motion.li
                            key={c.origem}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-rose-500/20 text-sm font-bold text-white ring-1 ring-inset ring-white/10">
                                    {c.origem.split(" ")[1]}
                                </span>
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-semibold text-white">
                                        {c.origem} = {c.destino}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                        {c.destaque}
                                    </span>
                                </div>
                            </div>
                            <span
                                className={
                                    isUp
                                        ? "text-xs font-semibold text-emerald-300"
                                        : "text-xs font-semibold text-rose-300"
                                }
                            >
                                {c.taxa}
                            </span>
                        </motion.li>
                    );
                })}
            </ul>

            <div className="flex items-center justify-between rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] p-3">
                <span className="text-[11px] text-violet-100">
                    Conversão automática ao registrar gasto
                </span>
                <span className="text-[10px] font-medium text-violet-300">
                    atualização minuto a minuto
                </span>
            </div>
        </motion.div>
    );
}
