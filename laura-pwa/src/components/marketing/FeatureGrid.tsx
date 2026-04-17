import {
    Banknote,
    LayoutDashboard,
    MessageCircle,
    Plane,
    Sparkles,
    Users,
    type LucideIcon,
} from "lucide-react";

type Feature = {
    icon: LucideIcon;
    title: string;
    description: string;
};

const features: Feature[] = [
    {
        icon: LayoutDashboard,
        title: "Plataforma completa",
        description:
            "Dashboard web, app PWA e WhatsApp. Tudo conversa entre si, tudo em tempo real.",
    },
    {
        icon: MessageCircle,
        title: "Converse no WhatsApp",
        description:
            "Registre gastos, tire dúvidas e peça relatórios por mensagem. Laura entende texto, áudio e imagem.",
    },
    {
        icon: Plane,
        title: "Modo viagem",
        description:
            "Planeje orçamento por dia, antecipe conversões e acompanhe gastos da viagem separados da rotina.",
    },
    {
        icon: Banknote,
        title: "Open Finance",
        description:
            "Conecte seus bancos e deixe Laura importar extratos automaticamente. Sem digitar nada.",
    },
    {
        icon: Users,
        title: "Membros da família",
        description:
            "Divida gastos entre os membros, controle cartões por pessoa e mantenha a casa organizada.",
    },
    {
        icon: Sparkles,
        title: "Relatórios com IA",
        description:
            "Insights personalizados sobre para onde vai seu dinheiro, com projeções e alertas.",
    },
];

export function FeatureGrid() {
    return (
        <section
            id="recursos"
            aria-labelledby="recursos-heading"
            className="relative py-20 sm:py-28"
        >
            {/* Orb sutil de fundo */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.12),_transparent_70%)] blur-3xl"
            />

            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                        Recursos
                    </div>
                    <h2
                        id="recursos-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Tudo que você precisa,{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-300 bg-clip-text text-transparent">
                            em um só lugar.
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Consolide planilhas, apps e bots num único produto que
                        pensa, organiza e te avisa.
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ icon: Icon, title, description }) => (
                        <article
                            key={title}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-violet-500/20"
                        >
                            {/* Brilho hover */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                            />

                            <div className="relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/30 ring-1 ring-inset ring-white/10">
                                <Icon className="size-5" aria-hidden />
                            </div>
                            <h3 className="relative mt-5 text-lg font-semibold text-white">
                                {title}
                            </h3>
                            <p className="relative mt-2 text-sm leading-relaxed text-zinc-300">
                                {description}
                            </p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
