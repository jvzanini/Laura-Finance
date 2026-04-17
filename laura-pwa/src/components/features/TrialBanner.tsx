"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Clock, X } from "lucide-react";
import { useSubscriptionOptional } from "@/lib/contexts/subscription";

/**
 * Chave localStorage única por dia — usuário dispensa o banner em
 * um dia, mas ele volta no dia seguinte para lembrar do trial.
 */
function todayKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `laura_trial_banner_dismissed_${y}${m}${day}`;
}

function readDismissed(): boolean {
    try {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(todayKey()) === "1";
    } catch {
        return false;
    }
}

// useSyncExternalStore evita setState-in-effect e garante que SSR
// renderiza "não dismissado" (o subscribe nunca chega no server).
const emptyUnsubscribe = () => () => {};
function useClientDismissed(): boolean {
    return useSyncExternalStore(
        emptyUnsubscribe,
        readDismissed,
        () => false,
    );
}

type Tone = {
    container: string;
    cta: string;
    Icon: typeof Clock;
};

function toneFor(daysRemaining: number): Tone {
    if (daysRemaining <= 1) {
        return {
            container:
                "bg-red-500/10 border-red-500/30 text-red-300",
            cta:
                "bg-red-500 text-white hover:bg-red-600 border-red-500",
            Icon: AlertCircle,
        };
    }
    if (daysRemaining <= 3) {
        return {
            container:
                "bg-amber-500/10 border-amber-500/30 text-amber-300",
            cta:
                "bg-amber-500 text-white hover:bg-amber-600 border-amber-500",
            Icon: AlertTriangle,
        };
    }
    return {
        container:
            "bg-primary/10 border-primary/30 text-primary",
        cta:
            "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
        Icon: Clock,
    };
}

/**
 * TrialBanner exibe um aviso no topo do dashboard enquanto o trial
 * ainda está ativo. Muda de cor conforme os dias restantes — quanto
 * mais próximo do fim, mais agressivo o tom. Pode ser dispensado
 * uma vez por dia.
 */
export function TrialBanner() {
    const subscription = useSubscriptionOptional();
    const storedDismissed = useClientDismissed();
    const [localDismissed, setLocalDismissed] = useState(false);

    if (!subscription) return null;
    if (subscription.state !== "trial_active") return null;
    if (storedDismissed || localDismissed) return null;

    const days = Math.max(0, subscription.days_remaining);
    const tone = toneFor(days);
    const Icon = tone.Icon;

    const handleDismiss = () => {
        try {
            if (typeof window !== "undefined") {
                window.localStorage.setItem(todayKey(), "1");
            }
        } catch {
            // ignora — dismiss apenas in-memory
        }
        setLocalDismissed(true);
    };

    return (
        <div
            className={`border-b px-4 py-2 ${tone.container}`}
            data-testid="trial-banner"
        >
            <div className="max-w-7xl mx-auto flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0 text-[12px] sm:text-sm">
                    Você tem <strong>{days}</strong>{" "}
                    {days === 1 ? "dia" : "dias"} de trial. Assine a qualquer
                    momento.
                </div>
                <Link
                    href="/subscription"
                    className={`hidden sm:inline-flex items-center justify-center text-[12px] font-semibold px-3 h-8 rounded-md border transition-colors ${tone.cta}`}
                >
                    Assinar agora
                </Link>
                <Link
                    href="/subscription"
                    className={`sm:hidden inline-flex items-center justify-center text-[11px] font-semibold px-2 h-8 rounded-md border transition-colors ${tone.cta}`}
                >
                    Assinar
                </Link>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dispensar aviso de trial"
                    className="h-11 w-11 -my-2 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
