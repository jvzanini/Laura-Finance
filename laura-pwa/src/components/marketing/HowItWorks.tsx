"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
    LayoutDashboard,
    Link2,
    Sparkles,
    type LucideIcon,
} from "lucide-react";

type Step = {
    icon: LucideIcon;
    title: string;
    description: string;
};

const steps: Step[] = [
    {
        icon: Sparkles,
        title: "Assine grátis por 7 dias",
        description: "Sem cartão de crédito. Sem fidelidade.",
    },
    {
        icon: Link2,
        title: "Conecte WhatsApp e bancos",
        description: "Laura importa extratos e conversa no seu WhatsApp.",
    },
    {
        icon: LayoutDashboard,
        title: "Veja tudo organizado",
        description: "Dashboard, metas, score e relatórios em tempo real.",
    },
];

export function HowItWorks() {
    const containerRef = useRef<HTMLDivElement>(null);
    const inView = useInView(containerRef, { once: true, amount: 0.4 });

    return (
        <section
            aria-labelledby="como-funciona-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                        Como funciona
                    </div>
                    <h2
                        id="como-funciona-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Comece em{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-300 bg-clip-text text-transparent">
                            minutos
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Três passos simples e a Laura já está cuidando das suas
                        finanças.
                    </p>
                </div>

                <div ref={containerRef} className="relative mt-16">
                    {/* Linha conectora desktop */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute top-8 right-[16.66%] left-[16.66%] hidden h-px overflow-hidden rounded-full bg-white/10 lg:block"
                    >
                        <motion.div
                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400"
                            initial={{ width: 0 }}
                            animate={inView ? { width: "100%" } : { width: 0 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                    </div>

                    <ol className="relative grid grid-cols-1 gap-10 lg:grid-cols-3">
                        {steps.map(({ icon: Icon, title, description }, i) => (
                            <li
                                key={title}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="relative z-10 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-xl shadow-violet-600/40 ring-1 ring-inset ring-white/20">
                                    <Icon className="size-6" aria-hidden />
                                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-400 text-xs font-bold text-white shadow-md ring-2 ring-[#0A0A0F]">
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold text-white">
                                    {title}
                                </h3>
                                <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-300">
                                    {description}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
