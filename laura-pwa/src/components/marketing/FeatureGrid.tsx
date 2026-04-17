import {
    Banknote,
    Gauge,
    MessageSquare,
    Sparkles,
    Tags,
    Target,
    type LucideIcon,
} from "lucide-react";

type Feature = {
    icon: LucideIcon;
    title: string;
    description: string;
};

const features: Feature[] = [
    {
        icon: MessageSquare,
        title: "Converse no WhatsApp",
        description:
            "Cadastre transações, consulte saldos e receba insights por mensagem.",
    },
    {
        icon: Gauge,
        title: "Score familiar em tempo real",
        description:
            "Uma nota única de 0–100 que reflete a saúde financeira da família.",
    },
    {
        icon: Tags,
        title: "Categorização automática",
        description: "A IA classifica suas transações em categorias inteligentes.",
    },
    {
        icon: Target,
        title: "Metas compartilhadas",
        description:
            "Planeje e acompanhe objetivos com todos os membros da família.",
    },
    {
        icon: Banknote,
        title: "Open Finance",
        description:
            "Conecte seus bancos e deixe a Laura importar tudo automaticamente.",
    },
    {
        icon: Sparkles,
        title: "Relatórios com IA",
        description:
            "Entenda para onde vai seu dinheiro com resumos personalizados.",
    },
];

export function FeatureGrid() {
    return (
        <section
            id="recursos"
            aria-labelledby="recursos-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2
                        id="recursos-heading"
                        className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Tudo que a família precisa,{" "}
                        <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                            em um só lugar.
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Funcionalidades pensadas para tirar o peso das planilhas e dar
                        clareza ao seu dinheiro.
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ icon: Icon, title, description }) => (
                        <article
                            key={title}
                            className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/30 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-violet-950/30"
                        >
                            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20 text-violet-300 ring-1 ring-inset ring-white/10">
                                <Icon className="size-5" aria-hidden />
                            </div>
                            <h3 className="mt-5 text-lg font-semibold text-white">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                                {description}
                            </p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
