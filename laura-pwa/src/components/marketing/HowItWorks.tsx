"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
    LayoutDashboard,
    MessageCircle,
    UserPlus,
    type LucideIcon,
} from "lucide-react";

type Step = {
    icon: LucideIcon;
    title: string;
    description: string;
};

const steps: Step[] = [
    {
        icon: UserPlus,
        title: "Crie sua conta",
        description: "7 dias grátis, sem cartão.",
    },
    {
        icon: MessageCircle,
        title: "Converse no WhatsApp",
        description: "A Laura registra tudo em PT-BR.",
    },
    {
        icon: LayoutDashboard,
        title: "Acompanhe tudo organizado",
        description: "Painel, metas, score e relatórios.",
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
                    <h2
                        id="como-funciona-heading"
                        className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Comece em minutos
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Três passos simples e a Laura já está cuidando das suas finanças.
                    </p>
                </div>

                <div ref={containerRef} className="relative mt-16">
                    {/* Linha conectora desktop */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute top-8 left-[16.66%] right-[16.66%] hidden h-px overflow-hidden rounded-full bg-white/10 lg:block"
                    >
                        <motion.div
                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500"
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
                                <div className="relative z-10 flex size-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-600/30 to-emerald-600/20 text-white shadow-lg shadow-violet-950/40 backdrop-blur-sm">
                                    <Icon className="size-6" aria-hidden />
                                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-md">
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold text-white">
                                    {title}
                                </h3>
                                <p className="mt-2 max-w-xs text-sm text-zinc-300">
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
