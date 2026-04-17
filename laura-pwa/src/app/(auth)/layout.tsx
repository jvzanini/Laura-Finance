import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#0A0A0F] px-4 py-8 [contain:paint] sm:py-12">
            {/* Fundo com orbs animadas na paleta violet → fuchsia → rose */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -left-32 -top-24 h-[22rem] w-[22rem] rounded-full bg-violet-600/25 opacity-60 blur-3xl animate-orb-float" />
                <div className="absolute right-[-6rem] top-1/3 h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/20 opacity-50 blur-3xl animate-orb-float-delayed" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.1),transparent_60%)]" />
            </div>

            <div className="relative mx-auto w-full max-w-md">
                <div className="mb-6 flex flex-col items-center gap-2 sm:mb-8 sm:gap-3">
                    <Link
                        href="/"
                        aria-label="Laura Finance"
                        className="inline-flex flex-col items-center gap-2 rounded-2xl px-3 py-1.5 transition hover:opacity-90"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/30">
                            LF
                        </span>
                        <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                            Laura Finance
                        </span>
                    </Link>
                    <p className="text-xs text-white/40">Gestão financeira inteligente via WhatsApp</p>
                </div>

                {children}
            </div>
        </div>
    );
}
