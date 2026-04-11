-- Add phone_number coluna em users. Separada da tabela `phones` que
-- representa a lista de "membros autorizados no WhatsApp" do workspace
-- (Epic 2.1). Este campo em users serve como "telefone de contato do
-- próprio usuário logado" e é usado pelo backend Go nos nudges
-- individuais (laura-go/internal/services/cron.go budget alert e
-- score_nudges.go band check), que hoje já referenciam u.phone_number
-- em queries — esta migration fecha o gap.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
