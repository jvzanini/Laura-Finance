ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS monthly_enabled,
    DROP COLUMN IF EXISTS yearly_enabled,
    DROP COLUMN IF EXISTS price_cents_yearly_discount;
