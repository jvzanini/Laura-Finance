"use server";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { callLauraGo } from "@/lib/apiClient";

export type PublicPlan = {
    slug: string;
    name: string;
    price_cents: number;
    price_cents_yearly?: number | null;
    features_description: string[];
    is_most_popular?: boolean;
};

export type SubscriptionStateRaw =
    | "trial_active"
    | "trial_ended"
    | "active"
    | "past_due_grace"
    | "past_due_blocked"
    | "canceled_grace"
    | "expired";

export type SubscriptionInfoDTO = {
    status: string;
    state: SubscriptionStateRaw;
    plan: {
        slug: string;
        name: string;
        price_cents: number;
        price_cents_yearly?: number | null;
    };
    trial_ends_at?: string | null;
    current_period_end?: string | null;
    past_due_grace_until?: string | null;
    canceled_at?: string | null;
    card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
    } | null;
    is_blocked: boolean;
    days_remaining: number;
};

type CheckoutInput = {
    planSlug: string;
    cycle: "monthly" | "yearly";
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function getWorkspace(userId: string) {
    const res = await pool.query(
        `SELECT w.id, w.stripe_customer_id, w.stripe_subscription_id,
                w.subscription_status, w.current_plan_slug,
                w.trial_ends_at, w.current_period_end,
                u.email, u.name
           FROM workspaces w
           JOIN users u ON u.workspace_id = w.id
          WHERE u.id = $1
          LIMIT 1`,
        [userId],
    );
    if (res.rows.length === 0) return null;
    return res.rows[0] as {
        id: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        subscription_status: string;
        current_plan_slug: string | null;
        trial_ends_at: Date | null;
        current_period_end: Date | null;
        email: string;
        name: string;
    };
}

async function getPlan(slug: string) {
    const res = await pool.query(
        `SELECT slug, name, price_cents, price_cents_yearly, stripe_price_id, stripe_price_id_yearly
         FROM subscription_plans WHERE slug = $1 AND active = TRUE LIMIT 1`,
        [slug],
    );
    if (res.rows.length === 0) return null;
    return res.rows[0] as {
        slug: string;
        name: string;
        price_cents: number;
        price_cents_yearly: number | null;
        stripe_price_id: string | null;
        stripe_price_id_yearly: string | null;
    };
}

export async function subscriptionCheckoutAction(input: CheckoutInput): Promise<ActionResult<{ url: string }>> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, message: "Sessão inválida" };

    const ws = await getWorkspace(session.userId);
    if (!ws) return { ok: false, message: "Workspace não encontrado" };

    const plan = await getPlan(input.planSlug);
    if (!plan) return { ok: false, message: "Plano não encontrado" };

    const priceId = input.cycle === "yearly" ? plan.stripe_price_id_yearly : plan.stripe_price_id;
    if (!priceId) {
        return { ok: false, message: `Preço ${input.cycle} não configurado para o plano ${plan.name}` };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
    const baseParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        client_reference_id: session.userId,
        success_url: `${appUrl}/subscription?checkout=success`,
        cancel_url: `${appUrl}/subscription?checkout=cancel`,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
            workspace_id: ws.id,
            plan_slug: plan.slug,
            cycle: input.cycle,
        },
        subscription_data: {
            metadata: {
                workspace_id: ws.id,
                plan_slug: plan.slug,
                cycle: input.cycle,
            },
        },
    };

    if (ws.stripe_customer_id) {
        baseParams.customer = ws.stripe_customer_id;
    } else {
        baseParams.customer_email = ws.email;
    }

    if (ws.subscription_status === "trial" && ws.trial_ends_at && ws.trial_ends_at.getTime() > Date.now()) {
        baseParams.subscription_data!.trial_end = Math.floor(ws.trial_ends_at.getTime() / 1000);
    }

    try {
        const checkout = await stripe.checkout.sessions.create(baseParams);
        if (!checkout.url) return { ok: false, message: "Stripe não retornou URL" };
        return { ok: true, data: { url: checkout.url } };
    } catch (err) {
        console.error("[subscription] checkout failed", err);
        return { ok: false, message: "Falha ao iniciar checkout" };
    }
}

export async function subscriptionPortalAction(): Promise<ActionResult<{ url: string }>> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, message: "Sessão inválida" };

    const ws = await getWorkspace(session.userId);
    if (!ws) return { ok: false, message: "Workspace não encontrado" };
    if (!ws.stripe_customer_id) {
        return { ok: false, message: "Nenhum método de pagamento cadastrado ainda" };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
    const returnUrl = process.env.STRIPE_BILLING_PORTAL_RETURN_URL || `${appUrl}/subscription`;

    try {
        const portal = await stripe.billingPortal.sessions.create({
            customer: ws.stripe_customer_id,
            return_url: returnUrl,
        });
        return { ok: true, data: { url: portal.url } };
    } catch (err) {
        console.error("[subscription] portal failed", err);
        return { ok: false, message: "Falha ao abrir portal" };
    }
}

export async function subscriptionCancelAction(): Promise<ActionResult<{ canceled: boolean }>> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, message: "Sessão inválida" };

    const ws = await getWorkspace(session.userId);
    if (!ws) return { ok: false, message: "Workspace não encontrado" };
    if (!ws.stripe_subscription_id) {
        return { ok: false, message: "Sem assinatura ativa para cancelar" };
    }

    try {
        await stripe.subscriptions.update(ws.stripe_subscription_id, {
            cancel_at_period_end: true,
        });
        await pool.query(
            `UPDATE workspaces SET subscription_status = 'canceled', canceled_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [ws.id],
        );
        return { ok: true, data: { canceled: true } };
    } catch (err) {
        console.error("[subscription] cancel failed", err);
        return { ok: false, message: "Falha ao cancelar assinatura" };
    }
}

export async function subscriptionReactivateAction(): Promise<ActionResult<{ reactivated: boolean }>> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, message: "Sessão inválida" };

    const ws = await getWorkspace(session.userId);
    if (!ws) return { ok: false, message: "Workspace não encontrado" };
    if (!ws.stripe_subscription_id) {
        return { ok: false, message: "Sem assinatura para reativar" };
    }

    try {
        await stripe.subscriptions.update(ws.stripe_subscription_id, {
            cancel_at_period_end: false,
        });
        await pool.query(
            `UPDATE workspaces SET subscription_status = 'active', canceled_at = NULL WHERE id = $1`,
            [ws.id],
        );
        return { ok: true, data: { reactivated: true } };
    } catch (err) {
        console.error("[subscription] reactivate failed", err);
        return { ok: false, message: "Falha ao reativar assinatura" };
    }
}

// ───────────── Fetchers (GET) ─────────────
//
// Os fetchers abaixo tentam sempre o backend Go primeiro (fonte da
// verdade para state machine + dias restantes) e caem em fallback
// local quando laura-go não está configurado / online. Isso permite
// dev sem o backend Go rodando e mantém a UI funcional.

function computeStateFromWorkspace(ws: {
    subscription_status: string;
    trial_ends_at: Date | null;
    current_period_end: Date | null;
}): { state: SubscriptionStateRaw; is_blocked: boolean; days_remaining: number } {
    const now = Date.now();
    if (ws.subscription_status === "trial") {
        if (ws.trial_ends_at && ws.trial_ends_at.getTime() > now) {
            const days = Math.max(
                0,
                Math.ceil((ws.trial_ends_at.getTime() - now) / (1000 * 60 * 60 * 24)),
            );
            return { state: "trial_active", is_blocked: false, days_remaining: days };
        }
        return { state: "trial_ended", is_blocked: true, days_remaining: 0 };
    }
    if (ws.subscription_status === "active") {
        const days = ws.current_period_end
            ? Math.max(
                  0,
                  Math.ceil((ws.current_period_end.getTime() - now) / (1000 * 60 * 60 * 24)),
              )
            : 0;
        return { state: "active", is_blocked: false, days_remaining: days };
    }
    if (ws.subscription_status === "past_due") {
        return { state: "past_due_grace", is_blocked: false, days_remaining: 0 };
    }
    if (ws.subscription_status === "canceled") {
        return { state: "canceled_grace", is_blocked: false, days_remaining: 0 };
    }
    return { state: "expired", is_blocked: true, days_remaining: 0 };
}

export async function fetchMySubscriptionAction(): Promise<SubscriptionInfoDTO | null> {
    const session = await getSession();
    if (!session?.userId) return null;

    // Tenta Go primeiro — é a fonte canônica.
    try {
        const res = await callLauraGo<SubscriptionInfoDTO>(
            "/api/v1/me/subscription",
        );
        if (res) return res;
    } catch (err) {
        console.warn("[subscription] me/subscription via Go falhou:", err);
    }

    // Fallback: monta do DB local. Sem dados de cartão (só o Go tem
    // via Stripe), mas suficiente para o gate funcionar em dev.
    const ws = await getWorkspace(session.userId);
    if (!ws) return null;

    const planRes = await pool.query(
        `SELECT slug, name, price_cents, price_cents_yearly
           FROM subscription_plans
          WHERE slug = COALESCE($1, 'standard')
          LIMIT 1`,
        [ws.current_plan_slug],
    );
    const plan = planRes.rows[0] as
        | {
              slug: string;
              name: string;
              price_cents: number;
              price_cents_yearly: number | null;
          }
        | undefined;

    const derived = computeStateFromWorkspace(ws);
    return {
        status: ws.subscription_status,
        state: derived.state,
        plan: plan
            ? {
                  slug: plan.slug,
                  name: plan.name,
                  price_cents: plan.price_cents,
                  price_cents_yearly: plan.price_cents_yearly,
              }
            : {
                  slug: ws.current_plan_slug ?? "standard",
                  name: ws.current_plan_slug ?? "Standard",
                  price_cents: 0,
                  price_cents_yearly: null,
              },
        trial_ends_at: ws.trial_ends_at ? ws.trial_ends_at.toISOString() : null,
        current_period_end: ws.current_period_end
            ? ws.current_period_end.toISOString()
            : null,
        past_due_grace_until: null,
        canceled_at: null,
        card: null,
        is_blocked: derived.is_blocked,
        days_remaining: derived.days_remaining,
    };
}

export async function fetchPublicPlansAction(): Promise<{
    plans: PublicPlan[];
}> {
    try {
        const res = await callLauraGo<{ plans: PublicPlan[] }>(
            "/api/v1/public/plans",
        );
        if (res) return { plans: res.plans ?? [] };
    } catch (err) {
        console.warn("[subscription] public/plans via Go falhou:", err);
    }

    const result = await pool.query(
        `SELECT slug, name, price_cents, price_cents_yearly, features_description
           FROM subscription_plans
          WHERE active = TRUE
          ORDER BY sort_order ASC`,
    );

    // Replica a regra do backend Go: marca is_most_popular no plano
    // com o maior price_cents (> 0). Se todos forem 0, nenhum fica
    // marcado.
    const plans: PublicPlan[] = result.rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        price_cents: r.price_cents,
        price_cents_yearly: r.price_cents_yearly,
        features_description: Array.isArray(r.features_description)
            ? r.features_description
            : typeof r.features_description === "string"
                ? (() => {
                      try {
                          return JSON.parse(r.features_description);
                      } catch {
                          return [];
                      }
                  })()
                : [],
        is_most_popular: false,
    }));

    let maxIdx = -1;
    let maxPrice = 0;
    plans.forEach((p, i) => {
        if (p.price_cents > maxPrice) {
            maxPrice = p.price_cents;
            maxIdx = i;
        }
    });
    if (maxIdx >= 0) plans[maxIdx].is_most_popular = true;

    return { plans };
}
