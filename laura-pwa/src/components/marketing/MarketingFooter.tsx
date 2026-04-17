import Link from "next/link";

type FooterGroup = {
    title: string;
    links: { label: string; href: string }[];
};

const groups: FooterGroup[] = [
    {
        title: "Produto",
        links: [
            { label: "Recursos", href: "#recursos" },
            { label: "Planos", href: "#planos" },
            { label: "FAQ", href: "#faq" },
        ],
    },
    {
        title: "Empresa",
        links: [
            { label: "Sobre", href: "#" },
            { label: "Blog", href: "#" },
            { label: "Contato", href: "#" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Termos", href: "#" },
            { label: "Privacidade", href: "#" },
            { label: "LGPD", href: "#" },
        ],
    },
];

export function MarketingFooter() {
    return (
        <footer className="relative border-t border-white/10 bg-[#0A0A0F]">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-1">
                        <Link
                            href="/"
                            aria-label="Laura Finance"
                            className="inline-flex min-h-11 items-center"
                        >
                            <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                                Laura
                            </span>
                        </Link>
                        <p className="mt-3 max-w-xs text-sm text-zinc-400">
                            Gestão financeira familiar inteligente, direto do seu WhatsApp.
                        </p>
                    </div>

                    {groups.map((group) => (
                        <nav key={group.title} aria-label={group.title}>
                            <h3 className="text-sm font-semibold text-white">
                                {group.title}
                            </h3>
                            <ul className="mt-4 flex flex-col gap-1">
                                {group.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="inline-flex min-h-11 min-w-11 items-center text-sm text-zinc-400 transition-colors hover:text-white"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>

                <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
                    <p className="text-xs text-zinc-500">
                        © 2026 Laura Finance. Todos os direitos reservados.
                    </p>
                    <p className="text-xs text-zinc-500">
                        Feito com carinho para famílias brasileiras.
                    </p>
                </div>
            </div>
        </footer>
    );
}
