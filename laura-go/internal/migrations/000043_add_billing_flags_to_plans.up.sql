-- Migration 000043: flags monthly_enabled/yearly_enabled + campo de desconto à vista.
-- Permite configurar planos como "só anual" (ex.: VIP) ou só mensal ou ambos.
-- price_cents_yearly_discount é para Pix/à vista (opcional).

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS monthly_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS yearly_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS price_cents_yearly_discount INTEGER;
