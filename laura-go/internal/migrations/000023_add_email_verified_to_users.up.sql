-- Email verification flag para users. Default FALSE em novos registros;
-- usuários existentes migrados continuam FALSE (precisam verificar ao
-- próximo login, ou aceitar o banner).
--
-- O fluxo de verificação usa HMAC-signed token (mesmo padrão de
-- resetToken.ts do PWA) — não precisa de tabela de tokens separada.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified) WHERE email_verified = FALSE;
