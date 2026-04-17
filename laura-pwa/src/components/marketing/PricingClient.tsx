"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import {
    CheckCircle2,
    CreditCard,
    Sparkles,
    XCircle,
    Zap,
} from "lucide-react";

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
    minimumFractionDigits: 2,
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

function TrialPricePanel() {
    return (
        <div className="mt-4">
            <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">
                    Grátis
                </span>
                <span className="text-sm text-zinc-400">por 7 dias</span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
                Sem cartão de crédito. Sem cobrança ao final.
            </p>
        </div>
    );
}

function VipPricePanel({
    plan,
    billing,
}: {
    plan: PublicPlan;
    billing: Billing;
}) {
    if (billing === "yearly" && plan.priceCentsYearly !== null) {
        const yearlyCents = plan.priceCentsYearly;
        return (
            <div className="mt-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm text-zinc-400">12×</span>
                    <span className="text-4xl font-bold tracking-tight text-white">
                        R$ 19,90
                    </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">
                    ou{" "}
                    <span className="font-semibold text-white">
                        {formatPrice(yearlyCents)}
                    </span>{" "}
                    no Pix
                </p>
            </div>
        );
    }
    // Mensal
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

function TrialCard() {
    return (
        <motion.article
            className="relative flex h-full w-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-white/20 sm:p-8"
            whileHover={{ y: -4, transition: { duration: 0.25 } }}
        >
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-white">Trial</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-200">
                    7 dias
                </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
                Teste tudo por 7 dias
            </p>

            <TrialPricePanel />

            <ul className="mt-6 flex flex-col gap-3">
                {[
                    "Tudo do VIP por 7 dias",
                    "WhatsApp + app + dashboard",
                    "Modo viagem + Open Finance",
                    "Sem cobrança ao final",
                ].map((feature, i) => (
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

            <div className="mt-auto pt-8">
                <Link
                    href="/register?plan=standard&cycle=monthly"
                    className="block"
                >
                    <Button className="h-12 w-full rounded-xl bg-white/10 text-base font-semibold text-white transition hover:bg-white/15 hover:text-white">
                        Comece grátis agora
                    </Button>
                </Link>
            </div>
        </motion.article>
    );
}

function VipCard({ plan, billing }: { plan: PublicPlan; billing: Billing }) {
    const href = `/register?plan=${encodeURIComponent(
        plan.slug
    )}&cycle=${billing}`;

    return (
        <motion.article
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            className="relative flex h-full w-full flex-col rounded-3xl border border-transparent bg-gradient-to-b from-violet-950/60 to-zinc-950/80 p-6 shadow-2xl shadow-violet-500/20 ring-2 ring-violet-500/60 sm:p-8"
        >
            <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <Sparkles className="size-3.5" aria-hidden />
                Mais popular
            </div>

            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-white">
                    {plan.name}
                </h3>
            </div>

            <VipPricePanel plan={plan} billing={billing} />

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

            <div className="mt-auto pt-8">
                <Link href={href} className="block">
                    <Button className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-base font-semibold text-white shadow-xl shadow-violet-600/40 hover:from-violet-500 hover:to-fuchsia-400">
                        Assinar agora
                    </Button>
                </Link>
            </div>
        </motion.article>
    );
}

export function PricingClient({ plans }: { plans: PublicPlan[] }) {
    // Default anual sempre (toggle aparece só se houver planos com ambas modalidades).
    const anyMonthly = plans.some(
        (p) => p.slug !== "standard" && p.monthlyEnabled
    );
    const anyYearly = plans.some(
        (p) => p.slug !== "standard" && p.yearlyEnabled
    );
    const showToggle = anyMonthly && anyYearly;
    const [billing, setBilling] = useState<Billing>("yearly");

    // Trial (slug=standard) sempre aparece; demais filtram pelo toggle.
    const trialPlan = plans.find((p) => p.slug === "standard");
    const vipPlans = plans.filter(
        (p) =>
            p.slug !== "standard" &&
            (billing === "monthly" ? p.monthlyEnabled : p.yearlyEnabled)
    );

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
                        Escolha seu plano
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        7 dias grátis em todos os planos. Sem cartão, sem
                        pegadinha.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/70">
                        <span className="inline-flex items-center gap-1.5">
                            <CreditCard
                                className="size-3.5 text-violet-300"
                                aria-hidden
                            />
                            Sem cartão
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Zap
                                className="size-3.5 text-violet-300"
                                aria-hidden
                            />
                            Acesso imediato
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <XCircle
                                className="size-3.5 text-violet-300"
                                aria-hidden
                            />
                            Cancele quando quiser
                        </span>
                    </div>
                    {showToggle && (
                        <div className="mt-8 flex justify-center">
                            <PricingToggle
                                value={billing}
                                onChange={setBilling}
                            />
                        </div>
                    )}
                </div>

                <div className="mx-auto mt-14 grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2">
                    {trialPlan && <TrialCard />}
                    {vipPlans.map((plan) => (
                        <VipCard
                            key={plan.slug}
                            plan={plan}
                            billing={billing}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
