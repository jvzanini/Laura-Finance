-- scripts/e2e-seed.sql
-- Executado via `docker compose --profile seed run --rm seed-e2e`.
-- Idempotente. Requer migrations aplicadas via MIGRATE_ON_BOOT=true.

INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2E Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, workspace_id, name, email, password_hash, role, email_verified, is_super_admin, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'E2E User',
  'e2e@laura.test',
  '$2a$10$ZJg9YtSplWOH/aFZODDSQuVzZArbA0dZ0Hunk/n2HUgLUVXu1t1dq',
  'proprietário',
  TRUE, FALSE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, workspace_id, name, email, password_hash, role, email_verified, is_super_admin, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'E2E Admin',
  'admin@laura.test',
  '$2a$10$5v0MfrFcRHQg6UG.pideGeNpNRA5B6tY0CokokzPAMRppFwCJrxp2',
  'proprietário',
  TRUE, TRUE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;
