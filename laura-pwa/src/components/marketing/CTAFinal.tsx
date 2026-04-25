import Link from "next/link";
import { ArrowRight, Shield, Sparkles, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LauraShowcase } from "@/components/brand/LauraShowcase";

export function CTAFinal() {
    return (
        <section
            aria-labelledby="cta-final-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                {/* Wrapper externo permite a Laura sangrar pra fora do card.
                    pt grande compensa o overflow no topo. */}
                <div className="relative pt-40 sm:pt-48">
                    {/* Showcase da Laura — quebra a borda superior do card */}
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 sm:-top-12">
                        <LauraShowcase size="hero" priority parallax />
                    </div>

                    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#14101F] via-[#1A0F22] to-[#0E0A18] px-6 py-16 text-center shadow-2xl shadow-violet-950/60 sm:px-12 sm:py-20">
                        {/* Glow radial central */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.35),_transparent_60%)]"
                        />
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(217,70,239,0.5),_transparent_70%)] blur-3xl"
                        />
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,_rgba(244,114,182,0.35),_transparent_70%)] blur-3xl"
                        />
                        {/* Borda luminosa interna */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-[2.5rem] [mask-image:linear-gradient(180deg,black,transparent_60%)]"
                            style={{
                                background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)",
                            }}
                        />

                        <div className="relative">
                            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                                <Sparkles className="size-3.5" aria-hidden />
                                Experimente sem compromisso
                            </div>

                            <h2
                                id="cta-final-heading"
                                className="mx-auto mt-6 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-5xl"
                            >
                                Pronto para{" "}
                                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-200 bg-clip-text text-transparent">
                                    assumir o controle?
                                </span>
                            </h2>
                            <p className="mx-auto mt-5 max-w-xl text-base text-zinc-300 sm:text-lg">
                                Ative seu trial de 7 dias e descubra clareza total
                                sobre seu dinheiro.
                            </p>
                            <div className="mx-auto mt-10 flex justify-center">
                                <Link href="/register">
                                    <Button className="h-14 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-8 text-base font-semibold text-white shadow-2xl shadow-violet-600/50 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-violet-500/60 sm:text-lg">
                                        Começar 7 dias grátis
                                        <ArrowRight className="size-5" aria-hidden />
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-white/40">
                                <span className="inline-flex items-center gap-1.5">
                                    <Shield className="size-3" aria-hidden />
                                    Sem cartão
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <XCircle className="size-3" aria-hidden />
                                    Cancele quando quiser
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
