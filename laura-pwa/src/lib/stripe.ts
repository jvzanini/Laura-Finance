import Stripe from 'stripe';

// Lazy init: valida STRIPE_SECRET_KEY apenas no primeiro uso em runtime.
// Antes a validação era top-level, o que fazia o `next build` falhar ao
// coletar page data (importa módulos sem env real). Proxy mantém a API
// `stripe.xxx` dos callers existentes.

let _stripe: Stripe | null = null;

function resolveStripe(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
    _stripe = new Stripe(key);
    return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        return (resolveStripe() as unknown as Record<string | symbol, unknown>)[prop];
    },
}) as Stripe;
