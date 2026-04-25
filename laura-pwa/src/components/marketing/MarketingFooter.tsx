import Link from "next/link";

import { LFBrandMark } from "@/components/brand/LFBrandMark";

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
                    <LFBrandMark variant="footer" />
                </Link>
                <p className="max-w-4xl text-sm text-zinc-400 md:whitespace-nowrap">
                    Sua plataforma financeira completa. Dashboard, app e WhatsApp em um só lugar.
                </p>
                <p className="text-xs text-zinc-500">
                    © 2026 Laura Finance
                </p>
            </div>
        </footer>
    );
}
