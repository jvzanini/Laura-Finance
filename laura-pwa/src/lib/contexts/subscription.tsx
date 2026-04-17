"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * SubscriptionState espelha o campo `state` retornado por
 * GET /api/v1/me/subscription no backend Go. Controla qual CTA,
 * banner e paywall são mostrados no PWA.
 */
export type SubscriptionState =
    | "trial_active"
    | "trial_ended"
    | "active"
    | "past_due_grace"
    | "past_due_blocked"
    | "canceled_grace"
    | "expired";

export type SubscriptionPlan = {
    slug: string;
    name: string;
    price_cents: number;
    price_cents_yearly?: number | null;
};

export type SubscriptionCard = {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
};

export type SubscriptionInfo = {
    status: string;
    state: SubscriptionState;
    plan: SubscriptionPlan;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
    past_due_grace_until?: string | null;
    canceled_at?: string | null;
    card?: SubscriptionCard | null;
    is_blocked: boolean;
    days_remaining: number;
};

const SubscriptionContext = createContext<SubscriptionInfo | null>(null);

export function SubscriptionProvider({
    value,
    children,
}: {
    value: SubscriptionInfo | null;
    children: ReactNode;
}) {
    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

/**
 * useSubscription expõe o contexto. Dispara erro se o provider não
 * embrulhou a árvore — evita bugs silenciosos em que um componente
 * client renderiza fora do layout do dashboard.
 */
export function useSubscription(): SubscriptionInfo {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) {
        throw new Error(
            "useSubscription precisa ser usado dentro de <SubscriptionProvider />",
        );
    }
    return ctx;
}

/**
 * useSubscriptionOptional retorna null quando o provider ainda não
 * montou — útil em banners que podem ser renderizados antes do
 * fetch do /me/subscription concluir.
 */
export function useSubscriptionOptional(): SubscriptionInfo | null {
    return useContext(SubscriptionContext);
}
