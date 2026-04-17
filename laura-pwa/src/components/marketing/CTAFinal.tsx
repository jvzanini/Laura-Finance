import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CTAFinal() {
    return (
        <section
            aria-labelledby="cta-final-heading"
            className="relative overflow-hidden py-20 sm:py-28"
        >
            <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-emerald-600/20"
            />
            <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.12),_transparent_60%)]"
            />
            <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
                <h2
                    id="cta-final-heading"
                    className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                >
                    Pronto para entender suas finanças?
                </h2>
                <p className="mt-4 text-base text-zinc-200 sm:text-lg">
                    Ative seu trial de 7 dias e veja como é simples ter clareza no
                    dinheiro da família.
                </p>
                <div className="mt-10 flex justify-center">
                    <Link href="/register">
                        <Button className="h-14 gap-2 rounded-xl bg-violet-600 px-8 text-base font-semibold text-white shadow-xl shadow-violet-600/40 hover:bg-violet-500 sm:text-lg">
                            Começar agora
                            <ArrowRight className="size-5" aria-hidden />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
