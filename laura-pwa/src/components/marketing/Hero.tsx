"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Gauge, MessageCircle, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

const chatMessages = [
    {
        from: "user" as const,
        text: "Gastei R$ 82,40 no mercado",
        delay: 0.1,
    },
    {
        from: "laura" as const,
        text: "Anotado em Alimentação. Você já gastou 42% do orçamento do mês nessa categoria.",
        delay: 0.35,
    },
    {
        from: "user" as const,
        text: "Qual meu saldo total?",
        delay: 0.6,
    },
    {
        from: "laura" as const,
        text: "R$ 7.812,00 nas contas da família. Score atual: 87 — saudável.",
        delay: 0.85,
    },
];

export function Hero() {
    return (
        <section className="relative isolate overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32">
            {/* Orbs decorativos */}
            <div
                aria-hidden
                className="animate-orb-float pointer-events-none absolute -top-24 -left-32 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.55),_transparent_70%)] blur-3xl"
            />
            <div
                aria-hidden
                className="animate-orb-float-delayed pointer-events-none absolute -right-32 -bottom-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,_rgba(16,185,129,0.45),_transparent_70%)] blur-3xl"
            />

            <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16 lg:px-8">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-sm">
                        <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden />
                        Sem cartão de crédito
                    </div>

                    <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                        Sua família no controle das finanças,{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                            sem planilhas.
                        </span>
                    </h1>

                    <p className="mt-6 max-w-xl text-base text-zinc-300 sm:text-lg">
                        Converse com a Laura pelo WhatsApp. Ela organiza tudo, acompanha o
                        orçamento e te ajuda a decidir.
                    </p>

                    <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <Link href="/register" className="w-full sm:w-auto">
                            <Button className="h-12 w-full min-w-11 gap-2 rounded-xl bg-violet-600 px-6 text-base font-semibold text-white shadow-xl shadow-violet-600/30 hover:bg-violet-500 sm:w-auto">
                                Começar 7 dias grátis
                                <ArrowRight className="size-4" aria-hidden />
                            </Button>
                        </Link>
                        <Link href="/login" className="w-full sm:w-auto">
                            <Button
                                variant="ghost"
                                className="h-12 w-full min-w-11 rounded-xl px-6 text-base text-zinc-200 hover:bg-white/5 hover:text-white sm:w-auto"
                            >
                                Já tenho conta
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Mock WhatsApp */}
                <div className="relative w-full">
                    <div className="relative mx-auto max-w-md">
                        {/* Chips ao redor */}
                        <div
                            className="animate-chat-bubble absolute -top-6 -left-3 z-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md sm:flex"
                            style={{ animationDelay: "0.9s" }}
                        >
                            <Gauge className="size-4 text-violet-300" aria-hidden />
                            Score 87
                        </div>
                        <div
                            className="animate-chat-bubble absolute -top-4 right-0 z-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md sm:flex"
                            style={{ animationDelay: "1.1s" }}
                        >
                            <Wallet className="size-4 text-emerald-300" aria-hidden />
                            R$ 7.812,00
                        </div>
                        <div
                            className="animate-chat-bubble absolute right-2 -bottom-4 z-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md sm:flex"
                            style={{ animationDelay: "1.3s" }}
                        >
                            <MessageCircle className="size-4 text-violet-300" aria-hidden />
                            Última transação agora
                        </div>

                        {/* Card glass mock */}
                        <div className="relative rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-violet-950/40 backdrop-blur-xl sm:p-6">
                            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 text-sm font-bold text-white">
                                    L
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-white">
                                        Laura Finance
                                    </span>
                                    <span className="text-xs text-emerald-400">online</span>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-3">
                                {chatMessages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            delay: msg.delay,
                                            duration: 0.35,
                                            ease: "easeOut",
                                        }}
                                        className={
                                            msg.from === "user"
                                                ? "ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-violet-600/90 px-3.5 py-2 text-sm text-white shadow-md"
                                                : "mr-auto max-w-[82%] rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2 text-sm text-zinc-100 shadow-md"
                                        }
                                    >
                                        {msg.text}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
