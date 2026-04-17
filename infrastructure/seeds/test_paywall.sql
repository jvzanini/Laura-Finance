-- infrastructure/seeds/test_paywall.sql
-- Seed idempotente usado pelos E2E de paywall.
-- Cria 2 workspaces + users em estados opostos:
--   - paywall-expired@laura.test (senha PaywallTest123!) → bloqueado
--   - paywall-active@laura.test  (senha PaywallTest123!) → ativo
-- Ambos são proprietários do próprio workspace.

-- Workspace expired
INSERT INTO workspaces (id, name, subscription_status, current_plan_slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  'Paywall Expired Workspace',
  'expired',
  'standard',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET subscription_status = EXCLUDED.subscription_status;

INSERT INTO users (
  id, workspace_id, name, email, password_hash, role,
  email_verified, is_super_admin, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000100',
  'Paywall Expired User',
  'paywall-expired@laura.test',
  '$2b$10$arvTzoFfKu5FcAA52W.5L.oU4NB/khDpWqY9HIIUkq88wMpDUBVGu',
  'proprietário',
  TRUE,
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Workspace active
INSERT INTO workspaces (id, name, subscription_status, current_plan_slug, current_period_end, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000200',
  'Paywall Active Workspace',
  'active',
  'standard',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET subscription_status = EXCLUDED.subscription_status;

INSERT INTO users (
  id, workspace_id, name, email, password_hash, role,
  email_verified, is_super_admin, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000200',
  'Paywall Active User',
  'paywall-active@laura.test',
  '$2b$10$arvTzoFfKu5FcAA52W.5L.oU4NB/khDpWqY9HIIUkq88wMpDUBVGu',
  'proprietário',
  TRUE,
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
