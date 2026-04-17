import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import Stripe from "stripe";
import {
    sendReceiptEmail,
    sendPaymentFailedEmail,
    sendPaymentResumedEmail,
    sendCanceledEmail,
} from "@/lib/email";

const GRACE_DAYS = parseInt(process.env.PAST_DUE_GRACE_DAYS || "3", 10);

function brl(cents: number | null | undefined): string {
    if (!cents) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function ddmmyyyy(date: Date | null | undefined): string {
    if (!date) return "-";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function recordEvent(event: Stripe.Event): Promise<boolean> {
    // Idempotência: INSERT devolve 0 linhas se já existe (ON CONFLICT DO NOTHING).
    const res = await pool.query(
        `INSERT INTO stripe_events (id, type, payload)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [event.id, event.type, JSON.stringify(event)],
    );
    return (res.rowCount ?? 0) > 0;
}

async function markEventProcessed(eventId: string) {
    await pool.query(`UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1`, [eventId]);
}

async function findPlanBySlug(slug: string) {
    const res = await pool.query(
        `SELECT slug, name, price_cents, price_cents_yearly, stripe_price_id, stripe_price_id_yearly
         FROM subscription_plans WHERE slug = $1 LIMIT 1`,
        [slug],
    );
    return res.rows[0] || null;
}

async function findPlanByPriceId(priceId: string) {
    const res = await pool.query(
        `SELECT slug, name, price_cents, price_cents_yearly, stripe_price_id, stripe_price_id_yearly
         FROM subscription_plans
         WHERE stripe_price_id = $1 OR stripe_price_id_yearly = $1
         LIMIT 1`,
        [priceId],
    );
    return res.rows[0] || null;
}

async function extractCardInfo(subscription: Stripe.Subscription): Promise<{ brand?: string; last4?: string; expMonth?: number; expYear?: number }> {
    try {
        const pmId = (subscription.default_payment_method as string) || "";
        if (!pmId) return {};
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.card) {
            return {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
            };
        }
        return {};
    } catch {
        return {};
    }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.subscription) return;
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    const userId = session.client_reference_id;
    const metadata = session.metadata || {};
    const planSlug = metadata.plan_slug || "vip";

    const userRes = await pool.query("SELECT id, workspace_id, email, name FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];
    if (!user) throw new Error("user not found for checkout session");

    const card = await extractCardInfo(subscription);
    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null;

    await pool.query(
        `UPDATE workspaces SET
            stripe_subscription_id = $1,
            stripe_customer_id = $2,
            subscription_status = 'active',
            current_plan_slug = $3,
            current_period_end = $4,
            past_due_grace_until = NULL,
            canceled_at = NULL,
            card_brand = $5,
            card_last4 = $6,
            card_exp_month = $7,
            card_exp_year = $8,
            plan_status = 'active'
         WHERE id = $9`,
        [
            subscription.id,
            subscription.customer as string,
            planSlug,
            currentPeriodEnd,
            card.brand || null,
            card.last4 || null,
            card.expMonth || null,
            card.expYear || null,
            user.workspace_id,
        ],
    );

    const plan = await findPlanBySlug(planSlug);
    const planName = plan?.name || "Laura Finance";
    await sendReceiptEmail(user.email, planName, brl(session.amount_total));
}

async function handleInvoicePaid(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null;

    const wsRes = await pool.query(
        `SELECT id, subscription_status FROM workspaces WHERE stripe_subscription_id = $1`,
        [subscription.id],
    );
    const ws = wsRes.rows[0];
    if (!ws) return;

    const wasPastDue = ws.subscription_status === "past_due";

    await pool.query(
        `UPDATE workspaces SET
            subscription_status = 'active',
            current_period_end = $1,
            past_due_grace_until = NULL,
            plan_status = 'active'
         WHERE id = $2`,
        [currentPeriodEnd, ws.id],
    );

    if (wasPastDue) {
        const userRes = await pool.query("SELECT email, name FROM users WHERE workspace_id = $1 LIMIT 1", [ws.id]);
        if (userRes.rowCount) {
            await sendPaymentResumedEmail(userRes.rows[0].email, userRes.rows[0].name);
        }
    }
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
    if (!subscriptionId) return;

    const graceUntil = new Date();
    graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);

    const wsRes = await pool.query(
        `UPDATE workspaces SET
            subscription_status = 'past_due',
            past_due_grace_until = $1
         WHERE stripe_subscription_id = $2
         RETURNING id, current_plan_slug`,
        [graceUntil, subscriptionId],
    );
    if (wsRes.rowCount === 0) return;

    const userRes = await pool.query(
        "SELECT email, name FROM users WHERE workspace_id = $1 AND role = 'proprietário' LIMIT 1",
        [wsRes.rows[0].id],
    );
    if (userRes.rowCount === 0) return;

    const plan = wsRes.rows[0].current_plan_slug ? await findPlanBySlug(wsRes.rows[0].current_plan_slug) : null;
    const planName = plan?.name || "Laura";
    const amountCents = invoice.amount_due ?? plan?.price_cents ?? 0;
    await sendPaymentFailedEmail(userRes.rows[0].email, userRes.rows[0].name, planName, brl(amountCents), ddmmyyyy(graceUntil));
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = priceId ? await findPlanByPriceId(priceId) : null;

    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null;

    const card = await extractCardInfo(subscription);

    let status = "active";
    if (cancelAtPeriodEnd) status = "canceled";

    await pool.query(
        `UPDATE workspaces SET
            subscription_status = $1,
            current_plan_slug = COALESCE($2, current_plan_slug),
            current_period_end = COALESCE($3, current_period_end),
            canceled_at = CASE WHEN $1 = 'canceled' THEN CURRENT_TIMESTAMP ELSE NULL END,
            card_brand = COALESCE($4, card_brand),
            card_last4 = COALESCE($5, card_last4),
            card_exp_month = COALESCE($6, card_exp_month),
            card_exp_year = COALESCE($7, card_exp_year)
         WHERE stripe_subscription_id = $8`,
        [
            status,
            plan?.slug || null,
            currentPeriodEnd,
            card.brand || null,
            card.last4 || null,
            card.expMonth || null,
            card.expYear || null,
            subscription.id,
        ],
    );

    if (status === "canceled") {
        const wsRes = await pool.query(
            "SELECT id FROM workspaces WHERE stripe_subscription_id = $1",
            [subscription.id],
        );
        if (wsRes.rowCount) {
            const userRes = await pool.query(
                "SELECT email, name FROM users WHERE workspace_id = $1 AND role = 'proprietário' LIMIT 1",
                [wsRes.rows[0].id],
            );
            if (userRes.rowCount) {
                await sendCanceledEmail(userRes.rows[0].email, userRes.rows[0].name, ddmmyyyy(currentPeriodEnd));
            }
        }
    }
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    await pool.query(
        `UPDATE workspaces SET
            subscription_status = 'expired',
            canceled_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $1`,
        [subscription.id],
    );
}

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature") as string;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return new NextResponse("Webhook secret não configurado", { status: 500 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error("[stripe webhook] signature verify failed", err);
        return new NextResponse("Webhook inválido", { status: 400 });
    }

    // Idempotência
    const firstSeen = await recordEvent(event);
    if (!firstSeen) {
        return new NextResponse(null, { status: 200 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutSessionCompleted(event);
                break;
            case "invoice.paid":
            case "invoice.payment_succeeded":
                await handleInvoicePaid(event);
                break;
            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(event);
                break;
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event);
                break;
            default:
                // no-op
                break;
        }
        await markEventProcessed(event.id);
    } catch (err) {
        console.error("[stripe webhook] processing failed", err);
        return new NextResponse("Processing error", { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
