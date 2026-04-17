import { Sparkles, CreditCard, Lock, ShieldCheck } from "lucide-react";

const items = [
    { icon: ShieldCheck, text: "Sem cartão no trial" },
    { icon: CreditCard, text: "Cancele quando quiser" },
    { icon: Lock, text: "Criptografia de ponta a ponta" },
    { icon: Sparkles, text: "IA que te entende" },
];

export function TrustBar() {
    return (
        <section
            aria-label="Garantias de segurança e transparência"
            className="relative border-y border-white/10 bg-gradient-to-r from-white/[0.02] via-violet-950/10 to-white/[0.02] backdrop-blur-sm"
        >
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 py-6 sm:grid-cols-2 sm:divide-x sm:divide-white/10 lg:grid-cols-4 lg:gap-0 lg:px-8">
                {items.map(({ icon: Icon, text }) => (
                    <div
                        key={text}
                        className="flex min-h-11 items-center justify-center gap-2.5 px-4 text-sm text-zinc-300"
                    >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-300 ring-1 ring-inset ring-white/10">
                            <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span>{text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
