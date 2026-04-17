-- Migration 000040: estende workspaces com estado de assinatura completo + tabela de eventos Stripe (idempotência webhook).
-- Backfill a partir de plan_status legado. Mapeamento:
--   active   -> active
--   trial    -> trial (com trial_ends_at now+7d)
--   canceled -> canceled
--   outro    -> active (grandfathered gratuitamente; super admin pode reclassificar)

BEGIN;

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial','active','past_due','canceled','expired')),
    ADD COLUMN IF NOT EXISTS current_plan_slug VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS past_due_grace_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS card_brand VARCHAR(20),
    ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
    ADD COLUMN IF NOT EXISTS card_exp_month SMALLINT,
    ADD COLUMN IF NOT EXISTS card_exp_year SMALLINT;

UPDATE workspaces SET
    subscription_status = CASE plan_status
        WHEN 'active'   THEN 'active'
        WHEN 'trial'    THEN 'trial'
        WHEN 'canceled' THEN 'canceled'
        ELSE 'active'
    END,
    current_plan_slug = COALESCE(current_plan_slug, 'vip'),
    trial_ends_at = CASE
        WHEN plan_status = 'trial' THEN CURRENT_TIMESTAMP + INTERVAL '7 days'
        ELSE NULL
    END
WHERE subscription_status = 'trial';

CREATE INDEX IF NOT EXISTS idx_workspaces_subscription_status
    ON workspaces(subscription_status);

-- Unique phone_number per active user (allow NULL).
-- Deduplica antes: se alguma linha legada tem phone_number repetido,
-- mantém o registro mais antigo e zera os demais. Isso mantém a
-- migração segura em bancos com dados de teste já acumulados.
UPDATE users SET phone_number = NULL
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at) AS rn
        FROM users WHERE phone_number IS NOT NULL
    ) dup WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
    ON users(phone_number)
    WHERE phone_number IS NOT NULL;

-- Stripe events (idempotência webhooks)
CREATE TABLE IF NOT EXISTS stripe_events (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type
    ON stripe_events(type, received_at DESC);

COMMIT;
