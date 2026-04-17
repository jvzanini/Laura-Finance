"use client";

import { motion } from "motion/react";
import {
    Coffee,
    Hotel,
    Plane,
    ShoppingBag,
    Ticket,
    Train,
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

function brl(centavos: number): string {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
    });
}

function TorreEiffel({ className }: { className?: string }) {
    // Silhueta estilizada da Torre Eiffel — stroke only.
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
            {/* Antena */}
            <line x1="100" y1="10" x2="100" y2="35" />
            {/* Topo fino */}
            <path d="M 92 35 L 108 35 L 104 55 L 96 55 Z" />
            {/* Bloco superior */}
            <path d="M 96 55 L 104 55 L 112 105 L 88 105 Z" />
            {/* Plataforma superior */}
            <line x1="85" y1="105" x2="115" y2="105" />
            <line x1="85" y1="115" x2="115" y2="115" />
            {/* Tronco meio superior */}
            <path d="M 88 115 L 112 115 L 125 200 L 75 200 Z" />
            {/* Plataforma meio */}
            <line x1="70" y1="200" x2="130" y2="200" />
            <line x1="70" y1="212" x2="130" y2="212" />
            {/* Arco entre pés */}
            <path d="M 78 212 Q 100 260 122 212" />
            {/* Pernas em leque */}
            <line x1="75" y1="212" x2="45" y2="370" />
            <line x1="125" y1="212" x2="155" y2="370" />
            <line x1="88" y1="212" x2="78" y2="370" />
            <line x1="112" y1="212" x2="122" y2="370" />
            {/* Base horizontais */}
            <line x1="40" y1="370" x2="160" y2="370" />
            {/* Detalhes treliça central */}
            <line x1="96" y1="55" x2="96" y2="105" />
            <line x1="104" y1="55" x2="104" y2="105" />
            <line x1="90" y1="115" x2="95" y2="200" />
            <line x1="110" y1="115" x2="105" y2="200" />
            <line x1="100" y1="55" x2="100" y2="200" />
            {/* X treliça topo */}
            <line x1="92" y1="65" x2="108" y2="95" />
            <line x1="108" y1="65" x2="92" y2="95" />
            <line x1="90" y1="130" x2="110" y2="180" />
            <line x1="110" y1="130" x2="90" y2="180" />
        </svg>
    );
}

function CristoRedentor({ className }: { className?: string }) {
    // Silhueta estilizada do Cristo Redentor — stroke only, braços abertos.
    return (
        <svg
            viewBox="0 0 260 380"
            className={className}
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* Auréola sutil */}
            <circle cx="130" cy="35" r="22" opacity="0.35" />
            {/* Cabeça */}
            <circle cx="130" cy="48" r="13" />
            {/* Pescoço */}
            <line x1="130" y1="61" x2="130" y2="72" />
            {/* Tronco superior (ombros) */}
            <path d="M 100 85 Q 130 75 160 85" />
            {/* Braços abertos (estendidos horizontais) */}
            <line x1="100" y1="88" x2="20" y2="100" />
            <line x1="160" y1="88" x2="240" y2="100" />
            {/* Mãos (terminação) */}
            <circle cx="20" cy="100" r="4" />
            <circle cx="240" cy="100" r="4" />
            {/* Túnica — tronco */}
            <path d="M 104 90 L 94 200 Q 94 230 110 245" />
            <path d="M 156 90 L 166 200 Q 166 230 150 245" />
            {/* Túnica — saia */}
            <path d="M 94 200 L 70 300 L 80 310 L 110 245" />
            <path d="M 166 200 L 190 300 L 180 310 L 150 245" />
            {/* Base pedestal */}
            <line x1="94" y1="245" x2="166" y2="245" />
            <line x1="75" y1="300" x2="185" y2="300" />
            <line x1="80" y1="310" x2="180" y2="310" />
            {/* Pedestal base */}
            <path d="M 85 310 L 90 370 L 170 370 L 175 310" />
            <line x1="80" y1="370" x2="180" y2="370" />
            {/* Dobras sutis na túnica */}
            <line x1="118" y1="110" x2="115" y2="200" opacity="0.6" />
            <line x1="130" y1="115" x2="130" y2="240" opacity="0.6" />
            <line x1="142" y1="110" x2="145" y2="200" opacity="0.6" />
        </svg>
    );
}

export function PilarViagens() {
    const totalOrcado = itens.reduce((s, i) => s + i.orcado, 0);
    const totalGasto = itens.reduce((s, i) => s + i.gasto, 0);

    return (
        <section
            id="pilar-viagens"
            aria-labelledby="pilar-viagens-heading"
            className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
        >
            {/* Gradient horizonte (pôr do sol): rose/fuchsia topo → violet base */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(244,114,182,0.18)_0%,_rgba(217,70,239,0.15)_30%,_rgba(245,158,11,0.1)_55%,_rgba(124,58,237,0.2)_100%)]"
            />
            {/* Sol/orb central bem baixo */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-1/3 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(251,191,36,0.18),_transparent_70%)] blur-3xl"
            />

            {/* Torre Eiffel na borda esquerda — overflow visível */}
            <div
                aria-hidden
                className="pointer-events-none absolute -left-16 bottom-0 z-0 hidden h-[30rem] w-auto text-violet-200/25 sm:block md:-left-24 md:h-[34rem] lg:-left-10 lg:h-[38rem]"
            >
                <TorreEiffel className="h-full w-auto" />
            </div>

            {/* Cristo Redentor na borda direita */}
            <div
                aria-hidden
                className="pointer-events-none absolute -right-16 bottom-0 z-0 hidden h-[28rem] w-auto text-rose-200/25 sm:block md:-right-24 md:h-[32rem] lg:-right-10 lg:h-[36rem]"
            >
                <CristoRedentor className="h-full w-auto" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
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
                        <span className="bg-gradient-to-r from-rose-300 via-amber-200 to-fuchsia-300 bg-clip-text text-transparent">
                            Viaje com controle, não com planilha no Excel.
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-200 sm:text-lg">
                        Orçamento por categoria, acompanhamento em tempo real,
                        conversão automática de moeda. Para férias, lua de mel,
                        mochilão.
                    </p>
                </div>

                {/* Card central Paris */}
                <div className="relative mt-16 flex justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.6 }}
                        className="relative w-full max-w-xl"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-rose-500/30 via-fuchsia-500/20 to-amber-400/15 opacity-80 blur-2xl"
                        />
                        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1F1325]/95 via-[#170E1E]/95 to-[#0A0A10]/95 p-6 shadow-2xl shadow-rose-950/60 backdrop-blur-2xl sm:p-7">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col leading-tight">
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-rose-300">
                                        Laura Finance · Viagem
                                    </span>
                                    <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                                        Paris — Junho 2026
                                    </h3>
                                    <span className="mt-1 text-xs text-zinc-400">
                                        7 dias · 2 pessoas
                                    </span>
                                </div>
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                        Total
                                    </span>
                                    <span className="text-base font-bold text-white sm:text-lg">
                                        {brl(totalGasto)}
                                    </span>
                                    <span className="text-[11px] text-zinc-400">
                                        de {brl(totalOrcado)}
                                    </span>
                                </div>
                            </div>

                            {/* Barra total */}
                            <div className="mt-5">
                                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400"
                                        initial={{ width: 0 }}
                                        whileInView={{
                                            width: `${
                                                (totalGasto / totalOrcado) * 100
                                            }%`,
                                        }}
                                        viewport={{ once: true, amount: 0.5 }}
                                        transition={{
                                            duration: 1.1,
                                            ease: "easeOut",
                                        }}
                                    />
                                </div>
                                <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500">
                                    <span>
                                        {Math.round(
                                            (totalGasto / totalOrcado) * 100
                                        )}
                                        % do orçamento
                                    </span>
                                    <span>
                                        resta {brl(totalOrcado - totalGasto)}
                                    </span>
                                </div>
                            </div>

                            {/* Lista itens */}
                            <ul className="mt-6 space-y-3.5">
                                {itens.map((item, i) => {
                                    const pct = Math.min(
                                        100,
                                        Math.round(
                                            (item.gasto / item.orcado) * 100
                                        )
                                    );
                                    const Icon = item.icone;
                                    return (
                                        <motion.li
                                            key={item.id}
                                            initial={{ opacity: 0, x: -12 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{
                                                once: true,
                                                amount: 0.3,
                                            }}
                                            transition={{
                                                duration: 0.4,
                                                delay: i * 0.08,
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
                                                    whileInView={{
                                                        width: `${pct}%`,
                                                    }}
                                                    viewport={{
                                                        once: true,
                                                        amount: 0.4,
                                                    }}
                                                    transition={{
                                                        duration: 0.9,
                                                        delay: i * 0.08,
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

                            <div className="mt-5 flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-3">
                                <span className="text-[11px] text-rose-100">
                                    Conversão automática EUR → BRL
                                </span>
                                <span className="text-[10px] font-medium text-rose-300">
                                    cotação ao vivo
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Cards flutuantes de compras locais */}
                <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        {
                            icon: Coffee,
                            label: "Baguete",
                            val: "4,00 €",
                            conv: "R$ 22,80",
                        },
                        {
                            icon: Train,
                            label: "Métro",
                            val: "1,90 €",
                            conv: "R$ 10,80",
                        },
                        {
                            icon: Ticket,
                            label: "Louvre",
                            val: "22,00 €",
                            conv: "R$ 125,40",
                        },
                        {
                            icon: Hotel,
                            label: "Hotel/noite",
                            val: "140,00 €",
                            conv: "R$ 798,00",
                        },
                    ].map(({ icon: Icon, label, val, conv }, i) => (
                        <motion.div
                            key={label}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{
                                duration: 0.45,
                                delay: i * 0.08 + 0.3,
                            }}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm"
                        >
                            <div className="flex items-center gap-2">
                                <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-rose-500/20 text-rose-200 ring-1 ring-inset ring-white/10">
                                    <Icon className="size-3.5" aria-hidden />
                                </span>
                                <span className="text-xs font-semibold text-white">
                                    {label}
                                </span>
                            </div>
                            <div className="mt-2 flex items-baseline justify-between">
                                <span className="text-sm font-bold text-white">
                                    {val}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                    {conv}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
