import { CreditCard, FileCheck, Lock, ShieldCheck } from "lucide-react";

const items = [
    { icon: ShieldCheck, text: "Sem cartão no trial" },
    { icon: CreditCard, text: "Cancele quando quiser" },
    { icon: Lock, text: "Dados criptografados" },
    { icon: FileCheck, text: "LGPD compliant" },
];

export function TrustBar() {
    return (
        <section
            aria-label="Garantias de segurança e transparência"
            className="relative border-y border-white/5 bg-white/[0.02]"
        >
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 py-6 sm:grid-cols-2 sm:divide-x sm:divide-white/10 lg:grid-cols-4 lg:gap-0 lg:px-8">
                {items.map(({ icon: Icon, text }) => (
                    <div
                        key={text}
                        className="flex min-h-11 items-center justify-center gap-2.5 px-4 text-sm text-zinc-300"
                    >
                        <Icon
                            className="size-4 shrink-0 text-emerald-400"
                            aria-hidden
                        />
                        <span>{text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
