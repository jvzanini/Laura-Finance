import { cn } from "@/lib/utils";

export type LFBrandMarkVariant = "navbar" | "footer";

export type LFBrandMarkProps = {
    variant: LFBrandMarkVariant;
    className?: string;
};

type Config = {
    container: string;
    badge: string;
    badgeText: string;
    wordmark: string;
};

// Variants têm o mesmo "quadrado rosa" (gradient violet→fuchsia→rose)
// herdado da identidade original, mas com letras LF maiores que a versão
// inicial para dar peso visual de logo.
const VARIANT_CONFIG: Record<LFBrandMarkVariant, Config> = {
    navbar: {
        container: "inline-flex items-center gap-2.5",
        badge: "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 shadow-lg shadow-violet-600/40 ring-1 ring-inset ring-white/20",
        badgeText: "text-base font-extrabold tracking-tight text-white",
        wordmark: "text-xl font-bold tracking-tight text-white",
    },
    footer: {
        container: "inline-flex items-center gap-2.5",
        badge: "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 shadow-lg shadow-violet-600/40 ring-1 ring-inset ring-white/20",
        badgeText: "text-base font-extrabold tracking-tight text-white",
        wordmark: "text-lg font-bold tracking-tight text-white",
    },
};

export function LFBrandMark({ variant, className }: LFBrandMarkProps) {
    const cfg = VARIANT_CONFIG[variant];
    return (
        <span className={cn(cfg.container, className)}>
            <span aria-hidden className={cfg.badge}>
                <span className={cfg.badgeText}>LF</span>
            </span>
            <span className={cfg.wordmark}>
                Laura{" "}
                <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                    Finance
                </span>
            </span>
        </span>
    );
}
