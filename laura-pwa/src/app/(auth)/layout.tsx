import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0A0A0F] px-4 py-10">
            {/* Fundo com orbs animadas (mesma linguagem da LP) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -left-32 -top-24 h-[22rem] w-[22rem] rounded-full bg-violet-600/20 blur-3xl animate-orb-float" />
                <div className="absolute right-[-6rem] top-1/3 h-[18rem] w-[18rem] rounded-full bg-emerald-500/15 blur-3xl animate-orb-float-delayed" />
                <div className="absolute bottom-[-6rem] left-1/3 h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/10 blur-3xl animate-orb-float" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.08),transparent_60%)]" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="mb-8 flex flex-col items-center gap-2">
                    <Link
                        href="/"
                        aria-label="Laura Finance"
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-white/5"
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 text-sm font-bold text-white shadow-lg">
                            L
                        </span>
                        <span className="text-lg font-semibold tracking-tight text-white">Laura</span>
                    </Link>
                    <p className="text-xs text-white/40">Gestão financeira inteligente via WhatsApp</p>
                </div>

                {children}
            </div>
        </div>
    );
}
