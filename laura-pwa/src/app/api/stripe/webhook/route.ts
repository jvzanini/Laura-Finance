import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import Stripe from "stripe";
import { sendReceiptEmail } from "@/lib/email";

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature") as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error) {
        const err = error as Error;
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (event.type === "checkout.session.completed") {
        // Retreive the subscription details 
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        );

        const client = await pool.connect();
        try {
            if (!session?.client_reference_id) {
                throw new Error("No client reference ID");
            }

            const userId = session.client_reference_id;

            await client.query("BEGIN");

            // Get the workspace id for the user
            const userRes = await client.query("SELECT workspace_id FROM users WHERE id = $1", [userId]);
            const workspaceId = userRes.rows[0].workspace_id;

            // Update workspace billing details
            await client.query(
                "UPDATE workspaces SET stripe_subscription_id = $1, stripe_customer_id = $2, plan_status = $3 WHERE id = $4",
                [subscription.id, subscription.customer as string, "active", workspaceId]
            );

            // Fetch user email to send receipt
            const emailRes = await client.query("SELECT email FROM users WHERE id = $1", [userId]);
            const userEmail = emailRes.rows[0].email;

            await client.query("COMMIT");

            // Send Receipt Email async post-commit
            let amountFormatted = "R$ ...";
            if (session.amount_total) {
                amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(session.amount_total / 100);
            }
            await sendReceiptEmail(userEmail, "Plano Pro", amountFormatted);

        } catch (dbError) {
            await client.query("ROLLBACK");
            console.error("Failed to commit stripe details to DB", dbError);
            return new NextResponse("Database Error", { status: 500 });
        } finally {
            client.release();
        }
    }

    // Handle other events like invoice.payment_succeeded or failed here...

    return new NextResponse(null, { status: 200 });
}
