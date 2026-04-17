-- ═══════════════════════════════════════════════════════════════
-- FASE 18 — Recovery de migration dirty (39) + wipe + seed admin.
-- ═══════════════════════════════════════════════════════════════
--
-- Contexto: deploy prévio da fase 18 pegou migration 000039 com index
-- predicate contendo CURRENT_TIMESTAMP (não IMMUTABLE) — Postgres recusou.
-- golang-migrate marcou schema_migrations.version=39 como dirty=true.
-- Fix já está no repo (migration 000039 corrigida sem CURRENT_TIMESTAMP),
-- mas o api continua crashando no boot porque dirty=true bloqueia.
--
-- Este script faz:
--   1) Reset do schema_migrations (volta para v38) para migrate re-aplicar
--      39/40/41/42 limpos no próximo boot do api.
--   2) Garbage-collect de tabelas que possam ter ficado órfãs (mesmo que
--      a migração rodasse em transação, DROP IF EXISTS é seguro).
--   3) Wipe completo de dados transacionais (preserva tabelas seed/config).
--   4) Insert do super admin nexusai360@gmail.com (bcrypt pré-computado).
--
-- Como rodar: Actions → Prod DB Exec → Run workflow. O workflow reproduz
-- este arquivo inline via psql no container postgres.
--
-- Depois de rodar, reiniciar o service laura-api (ou acionar Deploy Prod)
-- para que ele execute 39/40/41/42 limpos e suba.

BEGIN;

-- ── 1. Reset do schema_migrations ──
-- golang-migrate grava (version, dirty). Se dirty=true, bloqueia boot.
-- Voltamos para v38 (última versão limpa, segurança hardening).
UPDATE schema_migrations SET version = 38, dirty = FALSE
 WHERE version >= 38;

-- Se por algum motivo o row não existe, insere.
INSERT INTO schema_migrations (version, dirty)
SELECT 38, FALSE
WHERE NOT EXISTS (SELECT 1 FROM schema_migrations);

-- ── 2. Garbage-collect de tabelas fase 18 (caso tenham ficado órfãs) ──
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS pending_signups CASCADE;
DROP TABLE IF EXISTS stripe_events CASCADE;

-- Colunas novas em workspaces caso tenham sido adicionadas parcialmente
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

DROP INDEX IF EXISTS idx_users_phone_unique;
DROP INDEX IF EXISTS idx_workspaces_subscription_status;

ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS price_cents_yearly,
    DROP COLUMN IF EXISTS stripe_price_id_yearly;

-- Templates fase 18 que talvez tenham sido inseridos
DELETE FROM email_templates WHERE type IN (
    'codigo_verificacao_email',
    'trial_iniciado',
    'trial_terminando_d3',
    'trial_terminando_d1',
    'trial_expirado',
    'pagamento_falhou',
    'pagamento_retomado',
    'assinatura_cancelada'
);

-- ── 3. Wipe completo dos dados transacionais ──
-- Preserva tabelas seed/config: subscription_plans, system_config,
-- email_templates (após limpeza do fase 18 acima), category_templates,
-- option_tables, payment_processors.

TRUNCATE TABLE admin_audit_log RESTART IDENTITY CASCADE;
TRUNCATE TABLE message_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE financial_score_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE debt_rollovers RESTART IDENTITY CASCADE;
TRUNCATE TABLE invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE financial_goals RESTART IDENTITY CASCADE;
TRUNCATE TABLE investments RESTART IDENTITY CASCADE;
TRUNCATE TABLE subcategories RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE cards RESTART IDENTITY CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bank_webhook_events') THEN
        EXECUTE 'TRUNCATE TABLE bank_webhook_events RESTART IDENTITY CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bank_accounts') THEN
        EXECUTE 'TRUNCATE TABLE bank_accounts RESTART IDENTITY CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bank_connections') THEN
        EXECUTE 'TRUNCATE TABLE bank_connections RESTART IDENTITY CASCADE';
    END IF;
END $$;

TRUNCATE TABLE whatsapp_instances RESTART IDENTITY CASCADE;

-- Users e workspaces por último (FKs)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;

-- ── 4. Cria workspace + super admin ──
-- Nota: neste ponto, as colunas fase 18 já foram removidas pelo bloco 2.
-- O api vai aplicar 39-42 no próximo boot, e esses dados respeitam as
-- colunas legadas (plan_status). Após boot, as colunas novas ganham
-- default via migration 000040 (subscription_status='trial').
-- Por isso só usamos plan_status aqui; migrations farão o resto.

WITH new_ws AS (
    INSERT INTO workspaces (name, plan_status)
    VALUES ('Nexus AI', 'active')
    RETURNING id
)
INSERT INTO users (
    workspace_id,
    email,
    name,
    password_hash,
    role,
    is_super_admin,
    email_verified,
    email_verified_at
)
SELECT
    new_ws.id,
    'nexusai360@gmail.com',
    'Nexus AI',
    '$2b$10$pJPbzRpNAeg/TDDx1Flnv.OnFcU4pNRpgTUxmIhRr/BkpzSE1RDTK',  -- bcrypt("nexus.AI@360", 10)
    'proprietário',
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
FROM new_ws;

-- Confirma
SELECT
    u.email,
    u.name,
    u.is_super_admin,
    u.email_verified,
    w.plan_status,
    (SELECT version FROM schema_migrations) AS schema_version
FROM users u
JOIN workspaces w ON w.id = u.workspace_id
WHERE u.email = 'nexusai360@gmail.com';

COMMIT;
