"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    CalendarClock,
    CreditCard,
    Crown,
    Loader2,
    RefreshCw,
    Undo2,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/contexts/subscription";
import {
    subscriptionPortalAction,
    subscriptionReactivateAction,
} from "@/lib/actions/subscription";
import { PlanSelector } from "./PlanSelector";
import { CancelDialog } from "./CancelDialog";

function formatBR(dateIso?: string | null): string | null {
    if (!dateIso) return null;
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const glassCard =
    "bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl";

/**
 * SubscriptionManager é o orquestrador do /subscription — mostra
 * o card adequado para cada `state` e delega CTAs para PlanSelector,
 * CancelDialog e o portal Stripe. Centralizar aqui garante que a
 * lógica de estado vive em um lugar só e a página server só precisa
 * renderizar este componente.
 */
export function SubscriptionManager() {
    const subscription = useSubscription();
    const router = useRouter();
    const [isPortalPending, startPortal] = useTransition();
    const [isReactivatePending, startReactivate] = useTransition();

    const handlePortal = () => {
        startPortal(async () => {
            const res = await subscriptionPortalAction();
            if (res.ok && res.data?.url) {
                window.location.href = res.data.url;
                return;
            }
            alert(res.ok ? "Portal sem URL" : res.message);
        });
    };

    const handleReactivate = () => {
        startReactivate(async () => {
            const res = await subscriptionReactivateAction();
            if (res.ok) {
                router.refresh();
                return;
            }
            alert(res.message);
        });
    };

    const { state, plan, trial_ends_at, current_period_end, past_due_grace_until, canceled_at, card, days_remaining } =
        subscription;

    // ── trial_active ──────────────────────────────────────────────
    if (state === "trial_active") {
        const trialEnd = formatBR(trial_ends_at);
        return (
            <div className="space-y-6">
                <div className={`${glassCard} border-primary/30`} data-testid="subscription-trial-active">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                            <CalendarClock className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-semibold text-foreground">
                                Seu trial ativo
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Você tem <strong>{days_remaining}</strong>{" "}
                                {days_remaining === 1 ? "dia" : "dias"} restantes
                                {trialEnd ? (
                                    <>
                                        {" "}(até <strong>{trialEnd}</strong>)
                                    </>
                                ) : null}{" "}
                                para assinar um plano sem perder acesso.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={glassCard}>
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                        Assinar agora
                    </h3>
                    <PlanSelector mode="upgrade" currentPlanSlug={plan.slug} />
                </div>
            </div>
        );
    }

    // ── active ────────────────────────────────────────────────────
    if (state === "active") {
        const nextCharge = formatBR(current_period_end);
        return (
            <div className="space-y-6">
                <div className={`${glassCard} border-primary/20`} data-testid="subscription-active">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                            <Crown className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-4">
                            <div>
                                <h2 className="text-xl font-semibold text-foreground">
                                    Plano ativo — {plan.name}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    R$ {formatPrice(plan.price_cents)}/mês
                                    {nextCharge ? (
                                        <>
                                            {" "}• Próxima cobrança em{" "}
                                            <strong>{nextCharge}</strong>
                                        </>
                                    ) : null}
                                </p>
                            </div>

                            {card ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                                    <span className="capitalize">{card.brand}</span>
                                    <span>•••• {card.last4}</span>
                                    <span>
                                        · {String(card.exp_month).padStart(2, "0")}/
                                        {String(card.exp_year).slice(-2)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                                    Nenhum cartão cadastrado
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="default"
                                    size="lg"
                                    className="min-h-[44px]"
                                    onClick={() => {
                                        document
                                            .getElementById("plan-change-section")
                                            ?.scrollIntoView({ behavior: "smooth" });
                                    }}
                                    data-testid="btn-change-plan"
                                >
                                    Mudar de plano
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    className="min-h-[44px] gap-2"
                                    onClick={handlePortal}
                                    disabled={isPortalPending}
                                    data-testid="btn-update-card"
                                >
                                    {isPortalPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="h-4 w-4" />
                                    )}
                                    Atualizar cartão
                                </Button>
                                <CancelDialog
                                    currentPeriodEnd={current_period_end}
                                    trigger={
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="lg"
                                            className="min-h-[44px] gap-2"
                                            data-testid="btn-cancel-subscription"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Cancelar assinatura
                                        </Button>
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    id="plan-change-section"
                    className={glassCard}
                    data-testid="subscription-change-plan"
                >
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                        Mudar de plano
                    </h3>
                    <PlanSelector mode="change" currentPlanSlug={plan.slug} />
                </div>
            </div>
        );
    }

    // ── past_due_grace ────────────────────────────────────────────
    if (state === "past_due_grace") {
        const graceDate = formatBR(past_due_grace_until);
        return (
            <div className={`${glassCard} border-red-500/30 bg-red-500/5`} data-testid="subscription-past-due">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-red-300">
                                Pagamento falhou
                            </h2>
                            <p className="mt-1 text-sm text-red-200/80">
                                {graceDate ? (
                                    <>
                                        Atualize sua forma de pagamento até{" "}
                                        <strong>{graceDate}</strong> para evitar
                                        bloqueio da conta.
                                    </>
                                ) : (
                                    <>
                                        Atualize sua forma de pagamento para evitar
                                        bloqueio da conta.
                                    </>
                                )}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="default"
                            size="lg"
                            className="min-h-[44px] gap-2 bg-red-500 hover:bg-red-600 text-white"
                            onClick={handlePortal}
                            disabled={isPortalPending}
                            data-testid="btn-past-due-update"
                        >
                            {isPortalPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CreditCard className="h-4 w-4" />
                            )}
                            Atualizar forma de pagamento
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── canceled_grace ────────────────────────────────────────────
    if (state === "canceled_grace") {
        const accessUntil = formatBR(current_period_end) ?? formatBR(canceled_at);
        return (
            <div className={`${glassCard} border-white/10`} data-testid="subscription-canceled-grace">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center shrink-0">
                        <Undo2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">
                                Assinatura cancelada
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {accessUntil ? (
                                    <>
                                        Você tem acesso até{" "}
                                        <strong>{accessUntil}</strong>. Reative
                                        para manter seu plano ativo.
                                    </>
                                ) : (
                                    <>Reative para manter seu plano ativo.</>
                                )}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="default"
                            size="lg"
                            className="min-h-[44px] gap-2"
                            onClick={handleReactivate}
                            disabled={isReactivatePending}
                            data-testid="btn-reactivate"
                        >
                            {isReactivatePending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Reativar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── trial_ended | past_due_blocked | expired ──────────────────
    return (
        <div className="space-y-6">
            <div className={`${glassCard} border-red-500/30 bg-red-500/5`} data-testid="subscription-blocked">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                        <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-semibold text-foreground">
                            Reative sua assinatura
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {state === "trial_ended"
                                ? "Seu trial acabou. Escolha um plano para continuar usando a Laura."
                                : state === "past_due_blocked"
                                    ? "Sua conta está bloqueada por falta de pagamento. Escolha um plano para reativar."
                                    : "Sua assinatura expirou. Escolha um plano para retomar o acesso."}
                        </p>
                    </div>
                </div>
            </div>

            <div className={glassCard}>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    Escolha um plano
                </h3>
                <PlanSelector mode="reactivate" currentPlanSlug={plan.slug} />
            </div>
        </div>
    );
}
