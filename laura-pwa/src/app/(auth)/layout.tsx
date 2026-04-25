import Link from "next/link";
import type { ReactNode } from "react";

import { LauraShowcase } from "@/components/brand/LauraShowcase";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#0A0A0F] px-4 py-8 [contain:paint] sm:px-6 sm:py-12 md:px-8">
            {/* Fundo com orbs animadas na paleta violet → fuchsia → rose */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            >
                <div className="absolute -left-20 -top-16 h-[16rem] w-[16rem] rounded-full bg-violet-600/25 opacity-60 blur-3xl animate-orb-float sm:-left-32 sm:-top-24 sm:h-[22rem] sm:w-[22rem]" />
                <div className="absolute right-[-4rem] top-1/3 h-[14rem] w-[14rem] rounded-full bg-fuchsia-500/20 opacity-50 blur-3xl animate-orb-float-delayed sm:right-[-6rem] sm:h-[18rem] sm:w-[18rem]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.1),transparent_60%)]" />
            </div>

            <div className="relative mx-auto w-full max-w-md">
                {/* Showcase da Laura — emerge acima do card de login.
                    Margem negativa puxa o card pra colar visualmente nela.
                    Sem wordmark sobreposto: o card já tem subtitle "Laura
                    Finance". */}
                <div className="relative z-10 -mb-20 flex justify-center sm:-mb-24">
                    <Link
                        href="/"
                        aria-label="Laura Finance"
                        className="group inline-flex items-center justify-center rounded-full transition hover:scale-[1.02]"
                    >
                        <LauraShowcase size="lg" priority parallax />
                    </Link>
                </div>

                <div className="relative z-20">{children}</div>
            </div>
        </div>
    );
}
