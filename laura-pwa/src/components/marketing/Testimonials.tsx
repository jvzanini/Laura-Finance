import { Quote } from "lucide-react";

type Testimonial = {
    quote: string;
    author: string;
    role: string;
};

const testimonials: Testimonial[] = [
    {
        quote:
            "A Laura virou uma sócia nossa. A família toda registra gastos no WhatsApp e a gente finalmente tem clareza no fim do mês.",
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
            "O que me convenceu foi o score. Ver aquela nota subir semana a semana é motivador.",
        author: "Helena R.",
        role: "professora",
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
    return (
        <section
            aria-labelledby="depoimentos-heading"
            className="relative overflow-hidden py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2
                        id="depoimentos-heading"
                        className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Famílias que já têm clareza
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        O que dizem quem trocou planilhas pela conversa com a Laura.
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
                    {testimonials.map((t) => (
                        <figure
                            key={t.author}
                            className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
                        >
                            <Quote
                                className="size-6 text-violet-400"
                                aria-hidden
                            />
                            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-100 sm:text-base">
                                “{t.quote}”
                            </blockquote>
                            <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-emerald-500/30 text-sm font-semibold text-white ring-1 ring-inset ring-white/10">
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
                        </figure>
                    ))}
                </div>
            </div>
        </section>
    );
}
