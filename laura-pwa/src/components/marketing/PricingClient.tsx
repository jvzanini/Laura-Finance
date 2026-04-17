"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PublicPlan = {
    slug: string;
    name: string;
    priceCents: number;
    priceCentsYearly: number | null;
    priceCentsYearlyDiscount: number | null;
    monthlyEnabled: boolean;
    yearlyEnabled: boolean;
    features: string[];
    sortOrder: number;
    isMostPopular: boolean;
};

type Billing = "monthly" | "yearly";

const currencyFmt = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

function formatPrice(cents: number): string {
    if (cents <= 0) return "Grátis";
    return currencyFmt.format(cents / 100);
}

function PricingToggle({
    value,
    onChange,
}: {
    value: Billing;
    onChange: (v: Billing) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Alternar entre cobrança mensal e anual"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-sm"
        >
            <button
                type="button"
                onClick={() => onChange("monthly")}
                aria-pressed={value === "monthly"}
                className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-medium transition-colors",
                    value === "monthly"
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md"
                        : "text-zinc-300 hover:text-white"
                )}
            >
                Mensal
            </button>
            <button
                type="button"
                onClick={() => onChange("yearly")}
                aria-pressed={value === "yearly"}
                className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-medium transition-colors",
                    value === "yearly"
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md"
                        : "text-zinc-300 hover:text-white"
                )}
            >
                Anual
            </button>
        </div>
    );
}

// resolveBillingForPlan decide qual cobrança exibir para um plano considerando
// a preferência global do toggle E os flags monthly_enabled/yearly_enabled.
function resolveBillingForPlan(plan: PublicPlan, preferred: Billing): Billing {
    if (preferred === "monthly" && plan.monthlyEnabled) return "monthly";
    if (preferred === "yearly" && plan.yearlyEnabled) return "yearly";
    if (plan.monthlyEnabled) return "monthly";
    return "yearly";
}

function PricePanel({ plan, billing }: { plan: PublicPlan; billing: Billing }) {
    if (billing === "yearly" && plan.priceCentsYearly !== null) {
        const monthly = plan.priceCents > 0 ? plan.priceCents : Math.round(plan.priceCentsYearly / 12);
        return (
            <div className="mt-4">
                <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-zinc-300">12×</span>
                    <span className="text-4xl font-bold tracking-tight text-white">
                        {formatPrice(monthly)}
                    </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                    ou {formatPrice(plan.priceCentsYearly)} à vista
                </p>
                {plan.priceCentsYearlyDiscount !== null && plan.priceCentsYearlyDiscount > 0 && (
                    <p className="mt-1 text-xs font-medium text-fuchsia-300">
                        {formatPrice(plan.priceCentsYearlyDiscount)} no Pix (desconto)
                    </p>
                )}
            </div>
        );
    }
    // monthly (ou fallback quando não há yearly)
    return (
        <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-white">
                {formatPrice(plan.priceCents)}
            </span>
            {plan.priceCents > 0 && (
                <span className="text-sm text-zinc-400">/mês</span>
            )}
        </div>
    );
}

export function PricingClient({ plans }: { plans: PublicPlan[] }) {
    // Toggle só aparece se há pelo menos um plano com yearly E um com monthly.
    const anyMonthly = plans.some((p) => p.monthlyEnabled);
    const anyYearly = plans.some((p) => p.yearlyEnabled);
    const showToggle = anyMonthly && anyYearly;

    // Default do toggle: anual se for o único habilitado; senão mensal.
    const defaultBilling: Billing = !anyMonthly && anyYearly ? "yearly" : "monthly";
    const [billing, setBilling] = useState<Billing>(defaultBilling);

    return (
        <section
            id="planos"
            aria-labelledby="planos-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2
                        id="planos-heading"
                        className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Planos simples, sem pegadinha
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Todos começam com 7 dias grátis — sem cadastrar cartão.
                    </p>
                    {showToggle && (
                        <div className="mt-8 flex justify-center">
                            <PricingToggle value={billing} onChange={setBilling} />
                        </div>
                    )}
                </div>

                <div
                    className={cn(
                        "mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2",
                        plans.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
                    )}
                >
                    {plans.map((plan) => {
                        const effectiveBilling = resolveBillingForPlan(plan, billing);
                        const yearlyOnly = plan.yearlyEnabled && !plan.monthlyEnabled;

                        return (
                            <motion.article
                                key={plan.slug}
                                whileHover={
                                    plan.isMostPopular
                                        ? { y: -6, transition: { duration: 0.25 } }
                                        : undefined
                                }
                                className={cn(
                                    "relative flex flex-col rounded-3xl border p-6 backdrop-blur-sm transition-all sm:p-8",
                                    plan.isMostPopular
                                        ? "border-transparent bg-gradient-to-b from-violet-950/60 to-zinc-950/80 ring-2 ring-violet-500/60 shadow-2xl shadow-violet-500/20"
                                        : "border-white/10 bg-white/5 hover:-translate-y-1 hover:border-white/20"
                                )}
                            >
                                {plan.isMostPopular && (
                                    <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                                        <Sparkles className="size-3.5" aria-hidden />
                                        Mais popular
                                    </div>
                                )}

                                <div className="flex items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-semibold text-white">
                                        {plan.name}
                                    </h3>
                                    {yearlyOnly && (
                                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                                            Apenas anual
                                        </span>
                                    )}
                                </div>

                                <PricePanel plan={plan} billing={effectiveBilling} />

                                {plan.features.length > 0 && (
                                    <ul className="mt-6 flex flex-col gap-3">
                                        {plan.features.map((feature, i) => (
                                            <li
                                                key={i}
                                                className="flex items-start gap-2.5 text-sm text-zinc-200"
                                            >
                                                <CheckCircle2
                                                    className="mt-0.5 size-4 shrink-0 text-violet-300"
                                                    aria-hidden
                                                />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="mt-8">
                                    <Link
                                        href={`/register?plan=${encodeURIComponent(plan.slug)}`}
                                        className="block"
                                    >
                                        <Button
                                            className={cn(
                                                "h-12 w-full rounded-xl text-base font-semibold",
                                                plan.isMostPopular
                                                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-xl shadow-violet-600/40 hover:from-violet-500 hover:to-fuchsia-400"
                                                    : "bg-white/10 text-white hover:bg-white/15"
                                            )}
                                        >
                                            Começar 7 dias grátis
                                        </Button>
                                    </Link>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
