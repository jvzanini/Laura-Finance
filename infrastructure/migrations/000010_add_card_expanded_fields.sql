-- Expand cards table with holder, type, bank, and credit limit
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'credito'; -- credito, debito, ambos
ALTER TABLE cards ADD COLUMN IF NOT EXISTS holder VARCHAR(255);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS bank_broker VARCHAR(255);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS credit_limit_cents INTEGER DEFAULT 0;
