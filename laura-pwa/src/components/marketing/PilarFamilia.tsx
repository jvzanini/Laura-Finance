"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
    Car,
    Film,
    MessageCircle,
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
        mensagem: "Laura, gastei R$ 150 no mercado",
        categoria: "Mercado",
        valor: 15000,
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
        mensagem: "Gastei R$ 70 no cinema",
        categoria: "Lazer",
        valor: 7000,
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
            className="h-12 w-auto drop-shadow-md sm:h-14"
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

type FiltroMembro = "hoje" | Membro["id"];

// Orçamento detalhado por membro — mostrado ao clicar em avatar/chip.
// Categorias DIFERENTES por pessoa para mostrar dinamismo real da plataforma.
// Cada membro tem cota mensal (maior que os gastos) para barra de utilização.
type OrcamentoItem = { category: string; amount: number };
type OrcamentoMembro = {
    items: OrcamentoItem[];
    cotaReais: number;
};
const MEMBER_BUDGETS: Record<Membro["id"], OrcamentoMembro> = {
    joao: {
        cotaReais: 1800,
        items: [
            { category: "Mercado", amount: 480 },
            { category: "Combustível", amount: 320 },
            { category: "Restaurantes", amount: 180 },
            { category: "Academia", amount: 120 },
            { category: "Farmácia", amount: 85 },
        ],
    },
    maria: {
        cotaReais: 2500,
        items: [
            { category: "Viagem", amount: 1200 },
            { category: "Presentes", amount: 340 },
            { category: "Salão", amount: 220 },
            { category: "Streaming", amount: 95 },
            { category: "Cafés", amount: 60 },
        ],
    },
    lucas: {
        cotaReais: 800,
        items: [
            { category: "Lanches", amount: 140 },
            { category: "Games", amount: 210 },
            { category: "Uber", amount: 75 },
            { category: "Material escolar", amount: 95 },
        ],
    },
    clara: {
        cotaReais: 900,
        items: [
            { category: "Cinema", amount: 70 },
            { category: "Livros", amount: 160 },
            { category: "Roupas", amount: 240 },
            { category: "Pet", amount: 180 },
        ],
    },
};

const MESES_PT = [
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

const mesAtual = MESES_PT[new Date().getMonth()];

function brlFromReais(reais: number): string {
    return reais.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
    });
}

export function PilarFamilia() {
    const [filtro, setFiltro] = useState<FiltroMembro>("hoje");

    // Total de "Hoje": soma dos gastos hoje de cada membro (valores em centavos).
    const totalHoje = useMemo(
        () => membros.reduce((sum, m) => sum + m.valor, 0),
        []
    );

    const membroSelecionado = useMemo(
        () =>
            filtro !== "hoje"
                ? membros.find((m) => m.id === filtro) ?? null
                : null,
        [filtro]
    );

    const orcamentoMembro = useMemo(() => {
        if (!membroSelecionado) return null;
        const budget = MEMBER_BUDGETS[membroSelecionado.id];
        const totalReais = budget.items.reduce((s, it) => s + it.amount, 0);
        const maxAmount = Math.max(...budget.items.map((it) => it.amount));
        const pctCota = Math.min(
            100,
            Math.round((totalReais / budget.cotaReais) * 100)
        );
        return {
            items: budget.items,
            totalReais,
            maxAmount,
            cotaReais: budget.cotaReais,
            pctCota,
        };
    }, [membroSelecionado]);

    // Valor exibido no header (Hoje → totalHoje; Membro → gastos mensais).
    const totalFiltrado = useMemo(() => {
        if (!membroSelecionado || !orcamentoMembro) return totalHoje;
        return orcamentoMembro.totalReais * 100;
    }, [membroSelecionado, orcamentoMembro, totalHoje]);

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
                            Gestão familiar.
                        </span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-none text-base text-zinc-300 sm:text-lg md:max-w-[64rem] md:whitespace-nowrap">
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
                                        <div className="flex items-center gap-2 text-xs text-white/70">
                                            <MessageCircle
                                                className="size-3.5 text-emerald-300"
                                                aria-hidden
                                            />
                                            <span>
                                                WhatsApp · {membro.nome}
                                            </span>
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
                                        {filtro === "hoje" ? "Hoje" : mesAtual}
                                    </span>
                                    <motion.span
                                        key={filtro}
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="text-base font-bold text-white sm:text-lg"
                                    >
                                        {brl(totalFiltrado)}
                                    </motion.span>
                                    {membroSelecionado && orcamentoMembro && (
                                        <span className="mt-0.5 text-[10px] text-zinc-500">
                                            de {brlFromReais(orcamentoMembro.cotaReais)} (cota)
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
                                    aria-selected={filtro === "hoje"}
                                    onClick={() => setFiltro("hoje")}
                                    className={
                                        filtro === "hoje"
                                            ? "inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/40 transition-all"
                                            : "inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                                    }
                                >
                                    Hoje
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

                            {/* Conteúdo: lista consolidada (todos) ou barras por categoria (membro) */}
                            <div className="mt-5 min-h-[24rem]">
                                <AnimatePresence mode="wait" initial={false}>
                                    {filtro === "hoje" ? (
                                        <motion.ul
                                            key="hoje"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{
                                                duration: 0.28,
                                                ease: [0.2, 0.8, 0.2, 1],
                                            }}
                                            className="space-y-2.5"
                                        >
                                            {membros.map((m) => {
                                                const Icon = m.icone;
                                                return (
                                                    <li
                                                        key={m.id}
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
                                                                {m.nome} ·{" "}
                                                                {m.categoria}
                                                            </span>
                                                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                                <Icon
                                                                    className="size-3 text-fuchsia-300"
                                                                    aria-hidden
                                                                />
                                                                via WhatsApp ·
                                                                agora
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-bold text-white tabular-nums">
                                                            − {brl(m.valor)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </motion.ul>
                                    ) : membroSelecionado && orcamentoMembro ? (
                                        <motion.div
                                            key={`membro-${membroSelecionado.id}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{
                                                duration: 0.28,
                                                ease: [0.2, 0.8, 0.2, 1],
                                            }}
                                            className="space-y-4"
                                        >
                                            {/* Header membro */}
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ring-1 ring-inset ring-white/20"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${membroSelecionado.cor}, ${membroSelecionado.corSecundaria})`,
                                                    }}
                                                    aria-hidden
                                                >
                                                    {membroSelecionado.nome.charAt(
                                                        0
                                                    )}
                                                </span>
                                                <div className="flex flex-col leading-tight">
                                                    <span className="text-base font-semibold text-white">
                                                        {membroSelecionado.nome}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400">
                                                        Gastos em {mesAtual}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Barras verticais — altura absoluta para funcionar sem h-full quebrado */}
                                            <div className="flex h-52 items-end justify-between gap-2 pt-2">
                                                {orcamentoMembro.items.map(
                                                    (item, i) => {
                                                        const pct = Math.max(
                                                            12,
                                                            Math.round(
                                                                (item.amount /
                                                                    orcamentoMembro.maxAmount) *
                                                                    100
                                                            )
                                                        );
                                                        return (
                                                            <motion.div
                                                                key={item.category}
                                                                initial={{
                                                                    opacity: 0,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                }}
                                                                transition={{
                                                                    duration: 0.3,
                                                                    delay: i * 0.05,
                                                                }}
                                                                className="flex flex-1 flex-col items-center justify-end gap-1.5"
                                                            >
                                                                <span className="text-[10px] font-semibold text-white tabular-nums">
                                                                    {brlFromReais(
                                                                        item.amount
                                                                    )}
                                                                </span>
                                                                <motion.div
                                                                    className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-400"
                                                                    initial={{
                                                                        height: "0%",
                                                                    }}
                                                                    animate={{
                                                                        height: `${pct}%`,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.55,
                                                                        delay:
                                                                            i *
                                                                            0.05,
                                                                        ease: "easeOut",
                                                                    }}
                                                                    style={{
                                                                        minHeight: 8,
                                                                    }}
                                                                />
                                                                <span className="w-full truncate text-center text-[10px] text-zinc-400">
                                                                    {item.category}
                                                                </span>
                                                            </motion.div>
                                                        );
                                                    }
                                                )}
                                            </div>

                                            {/* Total + barra de utilização da cota */}
                                            <div className="space-y-2 border-t border-white/10 pt-4">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-zinc-300">
                                                        Total gasto
                                                    </span>
                                                    <span className="font-bold text-white tabular-nums">
                                                        {brlFromReais(
                                                            orcamentoMembro.totalReais
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                                                    <motion.div
                                                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400"
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${orcamentoMembro.pctCota}%`,
                                                        }}
                                                        transition={{
                                                            duration: 0.7,
                                                            ease: "easeOut",
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                                    <span>
                                                        {orcamentoMembro.pctCota}
                                                        % da cota mensal
                                                    </span>
                                                    <span>
                                                        Cota{" "}
                                                        {brlFromReais(
                                                            orcamentoMembro.cotaReais
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>

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
