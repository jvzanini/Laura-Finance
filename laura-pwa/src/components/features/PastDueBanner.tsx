"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { useSubscriptionOptional } from "@/lib/contexts/subscription";
import { subscriptionPortalAction } from "@/lib/actions/subscription";

function formatBR(dateIso?: string | null): string | null {
    if (!dateIso) return null;
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * PastDueBanner alerta sobre falhas de cobrança. Não é dispensável
 * — a intenção é forçar o usuário a atualizar o cartão. O CTA tenta
 * abrir o portal Stripe; se não estiver disponível, redireciona
 * para /subscription onde o SubscriptionManager cuida dos próximos
 * passos.
 */
export function PastDueBanner() {
    const subscription = useSubscriptionOptional();
    const [isPending, startTransition] = useTransition();

    if (!subscription) return null;
    if (
        subscription.state !== "past_due_grace" &&
        subscription.state !== "past_due_blocked"
    ) {
        return null;
    }

    const limitDate = formatBR(subscription.past_due_grace_until);

    const handleOpenPortal = () => {
        startTransition(async () => {
            const res = await subscriptionPortalAction();
            if (res.ok && res.data?.url) {
                window.location.href = res.data.url;
                return;
            }
            // fallback: vai para /subscription onde o manager mostra
            // alternativas (reassinar via checkout, etc.)
            window.location.href = "/subscription";
        });
    };

    return (
        <div
            className="bg-red-500/10 border-b border-red-500/30 text-red-300"
            data-testid="past-due-banner"
        >
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0 text-[12px] sm:text-sm">
                    Pagamento em atraso.{" "}
                    {limitDate ? (
                        <>
                            Atualize sua forma de pagamento até{" "}
                            <strong>{limitDate}</strong>.
                        </>
                    ) : (
                        <>Atualize sua forma de pagamento para evitar bloqueio.</>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={isPending}
                    className="hidden sm:inline-flex items-center gap-2 text-[12px] font-semibold px-3 h-9 min-h-[44px] sm:min-h-0 rounded-md border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                    {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Atualizar agora
                </button>
                <Link
                    href="/subscription"
                    className="sm:hidden inline-flex items-center justify-center text-[11px] font-semibold px-2 h-11 rounded-md border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                    Atualizar
                </Link>
            </div>
        </div>
    );
}
