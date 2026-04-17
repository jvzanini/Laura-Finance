"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
    Car,
    Film,
    ShoppingCart,
    UtensilsCrossed,
    Users,
    type LucideIcon,
} from "lucide-react";

type Membro = {
    id: string;
    nome: string;
    cor: string;
    corSecundaria: string;
    mensagem: string;
    categoria: string;
    valor: number;
    icone: LucideIcon;
};

const membros: Membro[] = [
    {
        id: "joao",
        nome: "João",
        cor: "#7C3AED",
        corSecundaria: "#5B21B6",
        mensagem: "Laura, gastei R$ 85 no mercado",
        categoria: "Mercado",
        valor: 8500,
        icone: ShoppingCart,
    },
    {
        id: "maria",
        nome: "Maria",
        cor: "#D946EF",
        corSecundaria: "#A21CAF",
        mensagem: "Registra R$ 32 no Uber",
        categoria: "Transporte",
        valor: 3200,
        icone: Car,
    },
    {
        id: "lucas",
        nome: "Lucas",
        cor: "#F472B6",
        corSecundaria: "#BE185D",
        mensagem: "Paguei R$ 22 no lanche",
        categoria: "Alimentação",
        valor: 2200,
        icone: UtensilsCrossed,
    },
    {
        id: "clara",
        nome: "Clara",
        cor: "#F59E0B",
        corSecundaria: "#B45309",
        mensagem: "Gastei R$ 150 no cinema",
        categoria: "Lazer",
        valor: 15000,
        icone: Film,
    },
];

function brl(centavos: number): string {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

// Boneco SVG estilizado (círculo cabeça + corpo retangular arredondado).
function Boneco({ cor, corSecundaria }: { cor: string; corSecundaria: string }) {
    return (
        <svg
            viewBox="0 0 60 72"
            className="h-20 w-auto drop-shadow-xl sm:h-24"
            aria-hidden
        >
            <defs>
                <linearGradient
                    id={`body-${cor}`}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                >
                    <stop offset="0%" stopColor={cor} />
                    <stop offset="100%" stopColor={corSecundaria} />
                </linearGradient>
            </defs>
            {/* Cabeça */}
            <circle
                cx="30"
                cy="16"
                r="12"
                fill={cor}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1.5"
            />
            {/* Sombra face */}
            <circle cx="30" cy="18" r="10.5" fill={corSecundaria} opacity="0.3" />
            {/* Corpo */}
            <path
                d="M 10 68 Q 10 38 30 36 Q 50 38 50 68 Z"
                fill={`url(#body-${cor})`}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
            />
            {/* Brilho topo corpo */}
            <path
                d="M 18 42 Q 30 38 42 42"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
}

type FiltroMembro = "todos" | Membro["id"];

export function PilarFamilia() {
    const [filtro, setFiltro] = useState<FiltroMembro>("todos");

    const totalGeral = useMemo(
        () => membros.reduce((sum, m) => sum + m.valor, 0),
        []
    );

    const transacoesFiltradas = useMemo(() => {
        if (filtro === "todos") return membros;
        return membros.filter((m) => m.id === filtro);
    }, [filtro]);

    const totalFiltrado = useMemo(
        () => transacoesFiltradas.reduce((sum, m) => sum + m.valor, 0),
        [transacoesFiltradas]
    );

    return (
        <section
            id="pilar-familia"
            aria-labelledby="pilar-familia-heading"
            className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
        >
            {/* Gradient radial fuchsia→rose */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_rgba(217,70,239,0.2),_transparent_55%),radial-gradient(ellipse_at_80%_80%,_rgba(244,114,182,0.18),_transparent_55%)]"
            />
            {/* Orbs */}
            <div
                aria-hidden
                className="animate-orb-float pointer-events-none absolute top-10 -left-20 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,_rgba(217,70,239,0.35),_transparent_70%)] blur-3xl"
            />
            <div
                aria-hidden
                className="animate-orb-float-delayed pointer-events-none absolute right-0 -bottom-20 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,_rgba(244,114,182,0.3),_transparent_70%)] blur-3xl"
            />

            <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-fuchsia-200 backdrop-blur-sm">
                        <Users className="size-3.5" aria-hidden />
                        Pilar 02 — Gestão familiar
                    </div>
                    <h2
                        id="pilar-familia-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                    >
                        2.{" "}
                        <span className="bg-gradient-to-r from-fuchsia-300 via-rose-300 to-amber-200 bg-clip-text text-transparent">
                            Gestão familiar de verdade.
                        </span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
                        Cada membro lança seu gasto pelo WhatsApp ou app. Você
                        acompanha a família toda em um só painel.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
                    {/* Coluna esquerda: bonecos + bolhas WhatsApp */}
                    <div className="relative">
                        <ul className="flex flex-col gap-4 sm:gap-5">
                            {membros.map((membro, i) => (
                                <motion.li
                                    key={membro.id}
                                    initial={{
                                        opacity: 0,
                                        x: -20,
                                    }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, amount: 0.3 }}
                                    transition={{
                                        duration: 0.5,
                                        delay: i * 0.18,
                                        ease: "easeOut",
                                    }}
                                    className="flex items-center gap-4"
                                >
                                    <div className="flex shrink-0 flex-col items-center">
                                        <Boneco
                                            cor={membro.cor}
                                            corSecundaria={membro.corSecundaria}
                                        />
                                        <span className="mt-1 text-[11px] font-semibold text-white">
                                            {membro.nome}
                                        </span>
                                    </div>

                                    {/* Bolha WhatsApp */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true, amount: 0.3 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: i * 0.18 + 0.3,
                                        }}
                                        className="relative max-w-xs rounded-2xl rounded-bl-sm border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 px-4 py-3 backdrop-blur-sm"
                                        style={{
                                            boxShadow:
                                                "0 8px 24px -8px rgba(16,185,129,0.25)",
                                        }}
                                    >
                                        {/* Tail bolha */}
                                        <span
                                            aria-hidden
                                            className="absolute top-3 -left-1.5 size-3 rotate-45 border-b border-l border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"
                                        />
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                                            <span
                                                aria-hidden
                                                className="block size-1.5 rounded-full bg-emerald-400"
                                            />
                                            WhatsApp · {membro.nome}
                                        </div>
                                        <p className="mt-1 text-sm leading-relaxed text-zinc-100">
                                            {membro.mensagem}
                                        </p>
                                        <div className="mt-1 flex justify-end text-[10px] text-zinc-500">
                                            Enviado ✓✓
                                        </div>
                                    </motion.div>
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    {/* Coluna direita: painel da família consolidado */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-fuchsia-500/30 via-rose-400/20 to-amber-400/10 opacity-70 blur-2xl"
                        />
                        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1A0F22]/95 via-[#140B1C]/95 to-[#0A0A10]/95 p-5 shadow-2xl shadow-fuchsia-950/60 backdrop-blur-2xl sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-300">
                                        Laura Finance · Família
                                    </span>
                                    <h3 className="mt-0.5 text-base font-semibold text-white sm:text-lg">
                                        Painel da família
                                    </h3>
                                </div>
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                        Hoje
                                    </span>
                                    <motion.span
                                        key={filtro}
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="text-sm font-bold text-white"
                                    >
                                        {brl(totalFiltrado)}
                                    </motion.span>
                                    {filtro !== "todos" && (
                                        <span className="text-[10px] text-zinc-500">
                                            de {brl(totalGeral)} total
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Filtros por membro */}
                            <div
                                role="tablist"
                                aria-label="Filtrar transações por membro"
                                className="mt-4 flex flex-wrap items-center gap-2"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={filtro === "todos"}
                                    onClick={() => setFiltro("todos")}
                                    className={
                                        filtro === "todos"
                                            ? "inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 text-xs font-semibold text-white shadow-lg shadow-fuchsia-600/30 transition-all"
                                            : "inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                                    }
                                >
                                    Todos
                                </button>
                                {membros.map((m) => {
                                    const isActive = filtro === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => setFiltro(m.id)}
                                            aria-label={`Filtrar por ${m.nome}`}
                                            className={
                                                isActive
                                                    ? "inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-white shadow-lg transition-all ring-2 ring-white/30"
                                                    : "inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-zinc-300 transition-all hover:text-white ring-1 ring-inset ring-white/10 hover:ring-white/20"
                                            }
                                            style={{
                                                background: isActive
                                                    ? `linear-gradient(135deg, ${m.cor}, ${m.corSecundaria})`
                                                    : undefined,
                                            }}
                                        >
                                            <span
                                                aria-hidden
                                                className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-inset ring-white/20"
                                                style={{
                                                    background: `linear-gradient(135deg, ${m.cor}, ${m.corSecundaria})`,
                                                }}
                                            >
                                                {m.nome.charAt(0)}
                                            </span>
                                            {m.nome}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Lista transações filtrada */}
                            <ul className="mt-5 space-y-2.5">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {transacoesFiltradas.map((m) => {
                                        const Icon = m.icone;
                                        return (
                                            <motion.li
                                                key={m.id}
                                                layout
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                transition={{ duration: 0.25 }}
                                                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                                            >
                                                <span
                                                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-inset ring-white/20"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${m.cor}, ${m.corSecundaria})`,
                                                    }}
                                                    aria-hidden
                                                >
                                                    {m.nome.charAt(0)}
                                                </span>
                                                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                                    <span className="truncate text-xs font-semibold text-white sm:text-sm">
                                                        {m.nome} · {m.categoria}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                        <Icon
                                                            className="size-3 text-fuchsia-300"
                                                            aria-hidden
                                                        />
                                                        via WhatsApp · agora
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-white">
                                                    − {brl(m.valor)}
                                                </span>
                                            </motion.li>
                                        );
                                    })}
                                </AnimatePresence>
                            </ul>

                            <div className="mt-4 flex items-center justify-between rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.08] p-3">
                                <span className="text-[11px] text-fuchsia-100">
                                    Consolidado em tempo real
                                </span>
                                <span className="text-[10px] font-medium text-fuchsia-300">
                                    4 pessoas · 1 painel
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
