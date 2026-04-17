"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Crown, Loader2, Sparkles, Star } from "lucide-react";
import {
    fetchPublicPlansAction,
    subscriptionCheckoutAction,
    type PublicPlan,
} from "@/lib/actions/subscription";

type Cycle = "monthly" | "yearly";

type Props = {
    mode: "upgrade" | "change" | "reactivate";
    currentPlanSlug?: string;
};

function formatBRL(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function ctaLabel(mode: Props["mode"], isCurrent: boolean): string {
    if (isCurrent) return "Plano atual";
    if (mode === "upgrade") return "Fazer upgrade";
    if (mode === "reactivate") return "Assinar agora";
    return "Selecionar";
}

/**
 * PlanSelector renderiza os planos públicos em cards e dispara o
 * checkout Stripe na seleção. O componente é reutilizável em 3
 * cenários: upgrade (durante trial), change (troca entre planos
 * ativos) e reactivate (volta após expiração/cancelamento).
 */
export function PlanSelector({ mode, currentPlanSlug }: Props) {
    const [plans, setPlans] = useState<PublicPlan[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cycle, setCycle] = useState<Cycle>("monthly");
    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        let cancelled = false;
        fetchPublicPlansAction()
            .then((res) => {
                if (cancelled) return;
                setPlans(res.plans);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("[PlanSelector] fetch falhou", err);
                setLoadError("Não foi possível carregar os planos");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (loadError) {
        return (
            <div
                className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300"
                data-testid="plan-selector-error"
            >
                {loadError}
            </div>
        );
    }

    if (!plans) {
        return (
            <div
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
                data-testid="plan-selector-loading"
            >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando planos...
                </div>
            </div>
        );
    }

    const hasYearly = plans.some(
        (p) => typeof p.price_cents_yearly === "number" && (p.price_cents_yearly ?? 0) > 0,
    );

    const handleSelect = (slug: string) => {
        setCheckoutError(null);
        setActiveSlug(slug);
        startTransition(async () => {
            const res = await subscriptionCheckoutAction({ planSlug: slug, cycle });
            if (res.ok && res.data?.url) {
                window.location.href = res.data.url;
                return;
            }
            setCheckoutError(
                res.ok ? "Checkout sem URL" : res.message || "Falha ao iniciar checkout",
            );
            setActiveSlug(null);
        });
    };

    return (
        <div className="space-y-4" data-testid="plan-selector">
            {hasYearly ? (
                <div className="flex items-center justify-center">
                    <div
                        role="tablist"
                        aria-label="Ciclo de cobrança"
                        className="inline-flex rounded-full border border-white/10 bg-white/5 p-1"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={cycle === "monthly"}
                            onClick={() => setCycle("monthly")}
                            className={`px-4 h-9 min-h-[44px] sm:min-h-0 rounded-full text-sm font-medium transition-colors ${
                                cycle === "monthly"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid="plan-cycle-monthly"
                        >
                            Mensal
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={cycle === "yearly"}
                            onClick={() => setCycle("yearly")}
                            className={`px-4 h-9 min-h-[44px] sm:min-h-0 rounded-full text-sm font-medium transition-colors ${
                                cycle === "yearly"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid="plan-cycle-yearly"
                        >
                            Anual
                        </button>
                    </div>
                </div>
            ) : null}

            {checkoutError ? (
                <p
                    role="alert"
                    className="text-sm text-red-400"
                    data-testid="plan-selector-checkout-error"
                >
                    {checkoutError}
                </p>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                    const isCurrent = currentPlanSlug === plan.slug;
                    const priceMonthly = plan.price_cents;
                    const priceYearly = plan.price_cents_yearly ?? 0;
                    const hasYearlyPrice = priceYearly > 0;
                    const priceCents =
                        cycle === "yearly" && hasYearlyPrice ? priceYearly : priceMonthly;
                    const cycleLabel = cycle === "yearly" && hasYearlyPrice ? "/ano" : "/mês";
                    const unavailable = cycle === "yearly" && !hasYearlyPrice;

                    const ringClass = isCurrent
                        ? "ring-2 ring-emerald-500/60"
                        : plan.is_most_popular
                            ? "ring-2 ring-primary/60"
                            : "";

                    return (
                        <div
                            key={plan.slug}
                            className={`relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-xl flex flex-col gap-5 ${ringClass}`}
                            data-testid={`plan-card-${plan.slug}`}
                        >
                            {plan.is_most_popular && !isCurrent ? (
                                <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 h-6 text-[11px] font-semibold text-primary-foreground">
                                    <Star className="h-3 w-3" aria-hidden="true" />
                                    Mais popular
                                </div>
                            ) : null}
                            {isCurrent ? (
                                <div className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 h-6 text-[11px] font-semibold text-white">
                                    <Check className="h-3 w-3" aria-hidden="true" />
                                    Seu plano atual
                                </div>
                            ) : null}

                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    {plan.is_most_popular ? (
                                        <Sparkles className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Crown className="h-5 w-5 text-primary" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {plan.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {plan.slug}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xs text-muted-foreground">R$</span>
                                    <span className="text-3xl font-bold text-foreground">
                                        {formatBRL(priceCents)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {cycleLabel}
                                    </span>
                                </div>
                                {unavailable ? (
                                    <p className="mt-1 text-[11px] text-amber-400">
                                        Plano anual indisponível — apenas mensal
                                    </p>
                                ) : null}
                            </div>

                            {plan.features_description.length > 0 ? (
                                <ul className="space-y-2">
                                    {plan.features_description.map((f, i) => (
                                        <li
                                            key={i}
                                            className="flex items-start gap-2 text-sm text-muted-foreground"
                                        >
                                            <Check
                                                className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0"
                                                aria-hidden="true"
                                            />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            <div className="mt-auto">
                                <button
                                    type="button"
                                    onClick={() => handleSelect(plan.slug)}
                                    disabled={
                                        isCurrent ||
                                        unavailable ||
                                        (isPending && activeSlug !== null)
                                    }
                                    className={`w-full inline-flex items-center justify-center gap-2 h-11 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                                        isCurrent
                                            ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                                    } disabled:opacity-60`}
                                    data-testid={`plan-cta-${plan.slug}`}
                                >
                                    {isPending && activeSlug === plan.slug ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : null}
                                    {ctaLabel(mode, isCurrent)}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
