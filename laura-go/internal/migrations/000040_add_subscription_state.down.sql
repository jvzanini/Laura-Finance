BEGIN;

DROP TABLE IF EXISTS stripe_events;
DROP INDEX IF EXISTS idx_users_phone_unique;
DROP INDEX IF EXISTS idx_workspaces_subscription_status;

ALTER TABLE workspaces
    DROP COLUMN IF EXISTS subscription_status,
    DROP COLUMN IF EXISTS current_plan_slug,
    DROP COLUMN IF EXISTS trial_ends_at,
    DROP COLUMN IF EXISTS current_period_end,
    DROP COLUMN IF EXISTS past_due_grace_until,
    DROP COLUMN IF EXISTS canceled_at,
    DROP COLUMN IF EXISTS card_brand,
    DROP COLUMN IF EXISTS card_last4,
    DROP COLUMN IF EXISTS card_exp_month,
    DROP COLUMN IF EXISTS card_exp_year;

COMMIT;
