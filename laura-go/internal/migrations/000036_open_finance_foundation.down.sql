-- Migration 000036 rollback: Open Finance Foundation

DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON bank_accounts;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
