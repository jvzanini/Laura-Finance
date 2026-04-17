"use client";

import { motion } from "motion/react";
import {
    ArrowUpRight,
    ShoppingBag,
    Wallet,
} from "lucide-react";

// DashboardMockup renderiza um mini preview estilizado do dashboard Laura
// usando apenas divs + SVG inline. Sem imagens externas.
export function DashboardMockup() {
    // Alturas das barras do gráfico (pct 0-100)
    const bars = [42, 68, 34, 82, 56, 91];

    return (
        <div
            aria-hidden
            className="relative w-full max-w-sm sm:max-w-md"
            style={{ perspective: "1400px" }}
        >
            {/* Card mockup com leve rotação 3D */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                style={{
                    transform:
                        "rotateY(-6deg) rotateX(4deg) translateZ(0)",
                    transformStyle: "preserve-3d",
                }}
                className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#15121F]/95 via-[#0F0D1A]/95 to-[#0A0A10]/95 p-5 shadow-2xl shadow-violet-950/50 backdrop-blur-2xl sm:p-6"
            >
                {/* Gradient acento topo */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-600/20 via-fuchsia-500/5 to-transparent"
                />

                {/* Header: avatar + saudação + saldo */}
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-lg shadow-violet-600/40">
                            JV
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                Olá,
                            </span>
                            <span className="text-sm font-semibold text-white">
                                João
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            Saldo total
                        </span>
                        <span className="text-sm font-bold text-white">
                            R$ 12.847,30
                        </span>
                    </div>
                </div>

                {/* Cards de métricas */}
                <div className="relative mt-5 grid grid-cols-3 gap-2.5">
                    {/* Score circular */}
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <ScoreRing value={87} />
                        <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                            Score
                        </span>
                    </div>
                    {/* Saldo do mês */}
                    <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex size-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                            <Wallet className="size-3.5" aria-hidden />
                        </div>
                        <span className="mt-1.5 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                            Esse mês
                        </span>
                        <span className="text-[11px] font-bold text-white">
                            R$ 4.120
                        </span>
                    </div>
                    {/* Variação semana */}
                    <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex size-6 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300">
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </div>
                        <span className="mt-1.5 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                            Semana
                        </span>
                        <span className="text-[11px] font-bold text-white">
                            +R$ 320
                        </span>
                    </div>
                </div>

                {/* Gráfico de barras */}
                <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            Gastos por semana
                        </span>
                        <span className="text-[10px] font-medium text-violet-300">
                            6 sem
                        </span>
                    </div>
                    <div className="mt-3 flex h-20 items-end gap-1.5">
                        {bars.map((height, i) => {
                            const isTallest = height === Math.max(...bars);
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{
                                        delay: 0.35 + i * 0.08,
                                        duration: 0.55,
                                        ease: "easeOut",
                                    }}
                                    className={
                                        isTallest
                                            ? "flex-1 rounded-t bg-gradient-to-t from-violet-600 via-fuchsia-500 to-rose-400"
                                            : "flex-1 rounded-t bg-gradient-to-t from-violet-700/70 to-violet-400/60"
                                    }
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Última transação */}
                <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-300 ring-1 ring-inset ring-white/10">
                        <ShoppingBag className="size-4" aria-hidden />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-xs font-semibold text-white">
                            Mercado Extra
                        </span>
                        <span className="text-[10px] text-zinc-400">
                            Alimentação · agora
                        </span>
                    </div>
                    <span className="text-xs font-bold text-white">
                        − R$ 85,00
                    </span>
                </div>
            </motion.div>
        </div>
    );
}

// ScoreRing desenha um anel de progresso SVG para o score 87/100.
function ScoreRing({ value }: { value: number }) {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="relative flex size-10 items-center justify-center">
            <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                className="-rotate-90"
                aria-hidden
            >
                <defs>
                    <linearGradient
                        id="score-ring-gradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor="#7C3AED" />
                        <stop offset="60%" stopColor="#D946EF" />
                        <stop offset="100%" stopColor="#F472B6" />
                    </linearGradient>
                </defs>
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="3"
                />
                <motion.circle
                    cx="20"
                    cy="20"
                    r={radius}
                    fill="none"
                    stroke="url(#score-ring-gradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                    {value}
                </span>
            </div>
        </div>
    );
}
