ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS price_cents_yearly,
    DROP COLUMN IF EXISTS stripe_price_id_yearly;
