-- Fase 18.4 — planos v3 pós-feedback.
-- Plano "standard" (slug preservado) vira display "Trial" — gratuito 7d com tudo do VIP.
-- VIP anual muda de R$ 358,80 (12× 29,90) para R$ 199,90 (12× 19,90) — mesmo valor à vista.

BEGIN;

UPDATE subscription_plans SET
    name = 'Trial',
    price_cents = 0,
    price_cents_yearly = NULL,
    price_cents_yearly_discount = NULL,
    monthly_enabled = TRUE,
    yearly_enabled = FALSE,
    features_description = '[
        "Tudo do VIP por 7 dias",
        "WhatsApp + app + dashboard",
        "Modo viagem + Open Finance",
        "Sem cobrança ao final"
    ]'::jsonb,
    sort_order = 1,
    active = TRUE
WHERE slug = 'standard';

UPDATE subscription_plans SET
    name = 'VIP',
    price_cents = 2990,
    price_cents_yearly = 19990,
    price_cents_yearly_discount = 19990,
    monthly_enabled = TRUE,
    yearly_enabled = TRUE,
    sort_order = 2,
    active = TRUE
WHERE slug = 'vip';

SELECT slug, name, price_cents, price_cents_yearly, price_cents_yearly_discount,
       monthly_enabled, yearly_enabled, features_description
FROM subscription_plans
ORDER BY sort_order;

COMMIT;
