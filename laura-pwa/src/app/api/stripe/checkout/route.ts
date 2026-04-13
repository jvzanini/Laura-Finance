import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const session = await getSession();

        if (!session || !session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { origin } = new URL(req.url);

        // Mock Price ID or env variable
        const priceId = process.env.STRIPE_PRO_PRICE_ID || "price_mock";

        const stripeSession = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
            cancel_url: `${origin}/dashboard?canceled=true`,
            client_reference_id: session.userId, // Link Stripe checkout with user's ID
        });

        return NextResponse.json({ url: stripeSession.url });
    } catch (error) {
        console.error("[STRIPE_ERROR]", error);
        return NextResponse.json({ error: "Erro ao criar sessão de pagamento" }, { status: 500 });
    }
}
