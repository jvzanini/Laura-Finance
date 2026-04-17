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
            {/* Linha luminosa superior */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
            />

            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-1">
                        <Link
                            href="/"
                            aria-label="Laura Finance"
                            className="inline-flex min-h-11 items-center gap-2"
                        >
                            <span
                                aria-hidden
                                className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 text-sm font-bold text-white shadow-lg shadow-violet-600/40 ring-1 ring-inset ring-white/20"
                            >
                                L
                            </span>
                            <span className="text-xl font-bold tracking-tight text-white">
                                Laura
                            </span>
                        </Link>
                        <p className="mt-3 max-w-xs text-sm text-zinc-400">
                            Sua plataforma financeira completa — dashboard, app
                            e WhatsApp em um só lugar.
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
                                            className="inline-flex min-h-11 min-w-11 items-center text-sm text-zinc-400 transition-colors hover:text-violet-200"
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
                        Feito no Brasil.
                    </p>
                </div>
            </div>
        </footer>
    );
}
