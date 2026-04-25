"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LauraAvatar } from "@/components/brand/LauraAvatar";

import { DashboardMockup } from "./DashboardMockup";

export function Hero() {
    return (
        <section
            className="relative isolate overflow-hidden pt-14 pb-20 [contain:paint] sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32"
        >
            {/* Textura grid sutil */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
            />

            {/* Orbs decorativos — 2 apenas, sem scale/opacity animada */}
            <div
                aria-hidden
                className="animate-orb-float pointer-events-none absolute -top-32 -left-40 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.55),_transparent_70%)] opacity-50 blur-3xl"
            />
            <div
                aria-hidden
                className="animate-orb-float-delayed pointer-events-none absolute -right-40 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,_rgba(217,70,239,0.45),_transparent_70%)] opacity-40 blur-3xl"
            />

            <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 px-4 sm:px-6 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-sm"
                    >
                        <ShieldCheck
                            className="size-3.5 text-violet-300"
                            aria-hidden
                        />
                        <span>Sem cartão no trial</span>
                        <span aria-hidden className="text-zinc-600">
                            ·
                        </span>
                        <span>Cancele quando quiser</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.05 }}
                        className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
                    >
                        Pare de viver no{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-300 bg-clip-text text-transparent">
                            caos financeiro.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.15 }}
                        className="mt-6 max-w-2xl text-lg text-white/70 sm:text-xl"
                    >
                        Chega de planilhas, apps dispersos e bots soltos. Laura
                        Finance é a plataforma completa.
                        <br className="hidden sm:block" />
                        <span className="mt-3 block">
                            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-300 bg-clip-text font-semibold text-transparent">
                                Assistente financeiro, gestão familiar e
                                planejador de viagens
                            </span>{" "}
                            em um só lugar.
                        </span>
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.3 }}
                        className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
                    >
                        <Link href="/register" className="w-full sm:w-auto">
                            <Button className="h-12 w-full min-w-11 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 text-base font-semibold text-white shadow-xl shadow-violet-600/40 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-violet-500/50 sm:w-auto">
                                Começar 7 dias grátis
                                <ArrowRight className="size-4" aria-hidden />
                            </Button>
                        </Link>
                        <Link href="/login" className="w-full sm:w-auto">
                            <Button
                                variant="ghost"
                                className="h-12 w-full min-w-11 rounded-xl border border-white/10 px-6 text-base text-zinc-200 hover:border-white/20 hover:bg-white/5 hover:text-white sm:w-auto"
                            >
                                Já tenho conta
                            </Button>
                        </Link>
                    </motion.div>
                </div>

                {/* Mockup dashboard + card WhatsApp flutuante */}
                <div className="relative flex w-full items-center justify-center lg:justify-end">
                    <div className="relative">
                        {/* Halo atrás do mockup */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-rose-400/10 opacity-70 blur-2xl"
                        />

                        <DashboardMockup />

                        {/* Card flutuante WhatsApp */}
                        <motion.div
                            initial={{ opacity: 0, x: 20, y: -10 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            transition={{
                                duration: 0.55,
                                delay: 0.6,
                                ease: "easeOut",
                            }}
                            className="absolute -bottom-6 -left-6 hidden max-w-[16rem] rounded-2xl border border-white/10 bg-gradient-to-br from-[#1E1B2E]/95 to-[#141221]/95 p-3 shadow-2xl shadow-violet-950/60 backdrop-blur-xl sm:-bottom-10 sm:-left-10 sm:block sm:max-w-xs sm:p-4"
                        >
                            <div className="flex items-center gap-2">
                                <LauraAvatar
                                    size="sm"
                                    ring="violet"
                                    halo="soft"
                                    priority
                                    withStatusDot
                                />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-semibold text-white">
                                        Laura Finance
                                    </span>
                                    <span className="text-[10px] text-violet-300">
                                        agora mesmo
                                    </span>
                                </div>
                            </div>
                            <p className="mt-2.5 text-xs leading-relaxed text-zinc-100">
                                Laura, registrei R$ 85 no mercado
                            </p>
                            <div className="mt-2 flex justify-end">
                                <span className="text-[10px] text-zinc-500">
                                    Enviado ✓✓
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
