-- Migration 000035: Security hardening
-- NOT NULL constraints, CHECK constraints, composite indexes, triggers, FK fixes

BEGIN;

-- ═══════════════════════════════════════════════════════
-- 1. NOT NULL on workspace_id (tabelas que permitem NULL)
-- ═══════════════════════════════════════════════════════

-- Limpar eventuais órfãos antes de aplicar constraint
DELETE FROM cards WHERE workspace_id IS NULL;
DELETE FROM categories WHERE workspace_id IS NULL;
DELETE FROM subcategories WHERE workspace_id IS NULL;
DELETE FROM transactions WHERE workspace_id IS NULL;
DELETE FROM message_logs WHERE workspace_id IS NULL;
DELETE FROM financial_goals WHERE workspace_id IS NULL;
DELETE FROM investments WHERE workspace_id IS NULL;
DELETE FROM debt_rollovers WHERE workspace_id IS NULL;

ALTER TABLE cards ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE subcategories ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE message_logs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE financial_goals ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE investments ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE debt_rollovers ALTER COLUMN workspace_id SET NOT NULL;

-- users.workspace_id — pode ter super_admin sem workspace, então SET NOT NULL com cuidado
-- ALTER TABLE users ALTER COLUMN workspace_id SET NOT NULL;
-- ^ Comentado: super_admins podem não ter workspace

-- ═══════════════════════════════════════════════════════
-- 2. CHECK constraints em campos enum-like
-- ═══════════════════════════════════════════════════════

ALTER TABLE transactions ADD CONSTRAINT chk_transaction_type
    CHECK (type IN ('expense', 'income'));

ALTER TABLE transactions ADD CONSTRAINT chk_transaction_amount_positive
    CHECK (amount > 0);

ALTER TABLE financial_goals ADD CONSTRAINT chk_goal_target_positive
    CHECK (target_cents > 0);

ALTER TABLE financial_goals ADD CONSTRAINT chk_goal_current_non_negative
    CHECK (current_cents >= 0);

ALTER TABLE financial_goals ADD CONSTRAINT chk_goal_status
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled'));

ALTER TABLE invoices ADD CONSTRAINT chk_invoice_status
    CHECK (status IN ('open', 'paid', 'overdue', 'cancelled'));

ALTER TABLE debt_rollovers ADD CONSTRAINT chk_rollover_status
    CHECK (status IN ('simulado', 'concluido', 'cancelado'));

-- Cards: closing_day e due_day entre 1 e 31
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cards' AND column_name='closing_day') THEN
        RAISE NOTICE 'cards.closing_day não existe, pulando CHECK';
    ELSE
        ALTER TABLE cards ADD CONSTRAINT chk_card_closing_day CHECK (closing_day BETWEEN 1 AND 31);
        ALTER TABLE cards ADD CONSTRAINT chk_card_due_day CHECK (due_day BETWEEN 1 AND 31);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 3. Índices compostos para queries frequentes
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_trans_workspace_date
    ON transactions(workspace_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_trans_workspace_category
    ON transactions(workspace_id, category_id);

CREATE INDEX IF NOT EXISTS idx_trans_workspace_type
    ON transactions(workspace_id, type);

CREATE INDEX IF NOT EXISTS idx_trans_card
    ON transactions(card_id) WHERE card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msg_logs_phone
    ON message_logs(phone_number);

CREATE INDEX IF NOT EXISTS idx_msg_logs_workspace_created
    ON message_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status
    ON invoices(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace_due
    ON invoices(workspace_id, due_date);

CREATE INDEX IF NOT EXISTS idx_goals_workspace
    ON financial_goals(workspace_id);

CREATE INDEX IF NOT EXISTS idx_investments_workspace
    ON investments(workspace_id);

CREATE INDEX IF NOT EXISTS idx_debt_rollovers_workspace
    ON debt_rollovers(workspace_id);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_workspace_date
    ON financial_score_snapshots(workspace_id, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════
-- 4. Trigger para updated_at automático
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'workspaces', 'cards', 'categories', 'subcategories',
        'transactions', 'financial_goals', 'investments', 'invoices',
        'debt_rollovers', 'system_config', 'subscription_plans',
        'email_templates', 'whatsapp_instances'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t
        );
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════
-- 5. FK fixes — ON DELETE actions
-- ═══════════════════════════════════════════════════════

-- admin_audit_log: permitir deleção de admin (SET NULL)
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_user_id_fkey;
ALTER TABLE admin_audit_log ALTER COLUMN admin_user_id DROP NOT NULL;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_admin_user_id_fkey
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- system_config.updated_by: SET NULL on delete
ALTER TABLE system_config DROP CONSTRAINT IF EXISTS system_config_updated_by_fkey;
ALTER TABLE system_config ADD CONSTRAINT system_config_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
