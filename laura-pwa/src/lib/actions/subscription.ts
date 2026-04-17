"use server";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

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
