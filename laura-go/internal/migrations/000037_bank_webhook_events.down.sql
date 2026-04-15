-- Rollback migration 000037.

DROP TABLE IF EXISTS bank_webhook_events;

DROP INDEX IF EXISTS idx_bank_accounts_item_id;

ALTER TABLE bank_accounts DROP COLUMN IF EXISTS item_id;
