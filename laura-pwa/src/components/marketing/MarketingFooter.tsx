import Link from "next/link";

export function MarketingFooter() {
    return (
        <footer className="relative border-t border-white/10 bg-[#0A0A0F]">
            {/* Linha luminosa superior */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
            />

            <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-6 lg:px-8">
                <Link
                    href="/"
                    aria-label="Laura Finance"
                    className="inline-flex min-h-11 items-center gap-2"
                >
                    <span
                        aria-hidden
                        className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 text-[10px] font-bold text-white shadow-lg shadow-violet-600/40 ring-1 ring-inset ring-white/20"
                    >
                        LF
                    </span>
                    <span className="text-lg font-bold tracking-tight text-white">
                        Laura{" "}
                        <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                            Finance
                        </span>
                    </span>
                </Link>
                <p className="max-w-md text-sm text-zinc-400">
                    Sua plataforma financeira completa. Dashboard, app e
                    WhatsApp em um só lugar.
                </p>
                <p className="text-xs text-zinc-500">
                    © 2026 Laura Finance
                </p>
            </div>
        </footer>
    );
}
