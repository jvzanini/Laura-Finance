-- Super admin flag: bypass workspace isolation, permite acessar /admin/*
-- com agregados cross-workspace (dashboard operacional do SaaS).
--
-- Semântica: diferente de users.role (que é o papel DENTRO do workspace:
-- proprietário/administrador/membro/dependente), is_super_admin é uma
-- flag global para operadores da plataforma. Um super admin continua
-- tendo seu próprio workspace normal — apenas ganha acesso extra.
--
-- Seed: o primeiro user criado (menor created_at) vira super_admin
-- automaticamente, para que o bootstrap inicial do SaaS não fique
-- travado. Em produção, escalar para outros users via SQL direto.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed: marca o primeiro user como super_admin (só se nenhum existir ainda).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE is_super_admin = TRUE) THEN
        UPDATE users
        SET is_super_admin = TRUE
        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;
