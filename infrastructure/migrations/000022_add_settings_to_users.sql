-- Preferências pessoais em JSONB para o user logado (tela /settings).
--
-- Shape esperado:
--   {
--     "hideBalances": false,
--     "notifications": true,
--     "darkMode": true
--   }
--
-- Fica como JSONB aberto para permitir novas preferências no futuro
-- sem migration (ex: language, timezone, notification_channels).
-- Default '{}' garante que users existentes não quebrem queries.

ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
