"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

type Testimonial = {
    quote: string;
    author: string;
    role: string;
};

const testimonials: Testimonial[] = [
    {
        quote:
            "A Laura virou uma sócia nossa. Registro gastos no WhatsApp, planejo viagens no app e abro o dashboard pra decidir. Tudo em um lugar só.",
        author: "Mariana C.",
        role: "publicitária",
    },
    {
        quote:
            "Eu tentei planilhas por anos. Em uma semana com a Laura entendi mais do que em todos os meses somados.",
        author: "André F.",
        role: "engenheiro",
    },
    {
        quote:
            "O que me convenceu foi o score. Ver aquela nota subir semana a semana é motivador — e o modo viagem salvou o orçamento no último rolê.",
        author: "Helena R.",
        role: "professora",
    },
    {
        quote:
            "Conectei meus bancos e em 2 semanas a família inteira estava lançando gastos no WhatsApp. Acabou a planilha.",
        author: "Pedro S.",
        role: "analista financeiro",
    },
    {
        quote:
            "Usei o Modo Viagem na nossa lua de mel e voltei sem aquela dor de cabeça do cartão explodindo sem aviso.",
        author: "Camila L.",
        role: "designer",
    },
    {
        quote:
            "Tirei foto de um cupom de mercado e a IA identificou cada item. Isso mudou meu dia a dia.",
        author: "Rafael M.",
        role: "empresário",
    },
];

function initials(name: string): string {
    return name
        .split(/\s+/)
        .map((s) => s.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function Testimonials() {
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const scrollBy = (dir: "left" | "right") => {
        const el = scrollerRef.current;
        if (!el) return;
        const cardWidth = el.clientWidth / 3 + 20;
        el.scrollBy({
            left: dir === "left" ? -cardWidth : cardWidth,
            behavior: "smooth",
        });
    };

    return (
        <section
            id="depoimentos"
            aria-labelledby="depoimentos-heading"
            className="relative overflow-hidden py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                        Depoimentos
                    </div>
                    <h2
                        id="depoimentos-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Quem já tem{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-300 bg-clip-text text-transparent">
                            clareza financeira
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        O que dizem quem trocou caos e planilhas pela Laura.
                    </p>
                </div>

                <div className="relative mt-12">
                    {/* Setas de navegação */}
                    <button
                        type="button"
                        onClick={() => scrollBy("left")}
                        aria-label="Depoimento anterior"
                        className="absolute top-1/2 -left-2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur-sm transition hover:border-violet-400/60 hover:bg-violet-500/15 hover:text-white sm:-left-4 md:flex"
                    >
                        <ChevronLeft className="size-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollBy("right")}
                        aria-label="Próximo depoimento"
                        className="absolute top-1/2 -right-2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur-sm transition hover:border-violet-400/60 hover:bg-violet-500/15 hover:text-white sm:-right-4 md:flex"
                    >
                        <ChevronRight className="size-5" />
                    </button>

                    <div
                        ref={scrollerRef}
                        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 pb-4 [scrollbar-width:thin]"
                    >
                        {testimonials.map((t) => (
                            <article
                                key={t.author}
                                className="flex w-[85%] shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-violet-500/30 sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
                            >
                                <Quote
                                    className="size-6 text-violet-300"
                                    aria-hidden
                                />
                                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-100 sm:text-base">
                                    &ldquo;{t.quote}&rdquo;
                                </blockquote>
                                <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-semibold text-white ring-1 ring-inset ring-white/20">
                                        {initials(t.author)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-white">
                                            {t.author}
                                        </span>
                                        <span className="text-xs text-zinc-400">
                                            {t.role}
                                        </span>
                                    </div>
                                </figcaption>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
