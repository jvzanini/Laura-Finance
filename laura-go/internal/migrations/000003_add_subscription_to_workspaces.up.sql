-- Add Stripe subscription details to workspaces table
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS plan_status VARCHAR(50) DEFAULT 'free';

-- Index for webhooks fast lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON workspaces(stripe_customer_id);
