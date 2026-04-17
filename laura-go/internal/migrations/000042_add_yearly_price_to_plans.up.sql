-- Migration 000042: planos ganham preço anual opcional para toggle mensal/anual na LP.
-- Super admin preenche via /admin/plans (ambos opcionais).

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS price_cents_yearly INTEGER,
    ADD COLUMN IF NOT EXISTS stripe_price_id_yearly VARCHAR(200);
