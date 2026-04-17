-- ═══════════════════════════════════════════════════════════════
-- Wipe completo de dados transacionais + seed de super admin único.
-- ═══════════════════════════════════════════════════════════════
--
-- IMPORTANTE: roda APÓS as migrations 000001-000042 já aplicadas.
-- Preserva: subscription_plans, system_config, email_templates,
-- category_templates, bank_options, card_brand_options,
-- broker_options, investment_type_options, goal_templates,
-- payment_processors (tabelas seed/config global).
--
-- Apaga tudo que é dado de cliente (workspaces + cascata).
--
-- Como rodar em produção (Portainer):
--   1. Stacks → laura-finance → Container "laura-finance_postgres_1" → Console (sh).
--   2. psql -U laura -d laura_finance -f /caminho/para/wipe-and-seed-admin.sql
--      OU cole este arquivo no prompt: psql -U laura -d laura_finance
--      depois \i /path/to/wipe-and-seed-admin.sql
--
-- Credenciais do super admin criado:
--   email:    nexusai360@gmail.com
--   senha:    nexus.AI@360   (bcrypt hash pré-computado)
--   is_super_admin: TRUE
--   role:     proprietário
--
-- Após rodar, faça login em /login com o email acima.

BEGIN;

-- ── 1. Limpa tabelas transacionais em ordem (respeitando FKs) ──

-- Fase 18 (novas)
TRUNCATE TABLE otp_codes RESTART IDENTITY CASCADE;
TRUNCATE TABLE pending_signups RESTART IDENTITY CASCADE;
TRUNCATE TABLE stripe_events RESTART IDENTITY CASCADE;

-- Auditoria / logs
TRUNCATE TABLE admin_audit_log RESTART IDENTITY CASCADE;
TRUNCATE TABLE message_logs RESTART IDENTITY CASCADE;

-- Score snapshots
TRUNCATE TABLE financial_score_snapshots RESTART IDENTITY CASCADE;

-- Features transacionais
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE debt_rollovers RESTART IDENTITY CASCADE;
TRUNCATE TABLE invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE financial_goals RESTART IDENTITY CASCADE;
TRUNCATE TABLE investments RESTART IDENTITY CASCADE;
TRUNCATE TABLE subcategories RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE cards RESTART IDENTITY CASCADE;

-- Open Finance (fase 13-15)
-- Protegido contra ausência em bancos antigos.
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

-- WhatsApp instances (opcional — remove instâncias conectadas de dev)
TRUNCATE TABLE whatsapp_instances RESTART IDENTITY CASCADE;

-- Finalmente users + workspaces (last because FKs convergem aqui)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;

-- ── 2. Cria workspace + usuário super admin ──

WITH new_ws AS (
    INSERT INTO workspaces (
        name,
        plan_status,
        subscription_status,
        current_plan_slug,
        trial_ends_at,
        current_period_end
    )
    VALUES (
        'Nexus AI',
        'active',
        'active',
        'vip',
        NULL,
        NULL
    )
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
    w.subscription_status,
    w.current_plan_slug
FROM users u
JOIN workspaces w ON w.id = u.workspace_id
WHERE u.email = 'nexusai360@gmail.com';

COMMIT;
