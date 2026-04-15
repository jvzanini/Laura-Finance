-- Rastreabilidade de autoria em transactions: quem criou cada lançamento.
-- Desbloqueia a aba "Por Membro" dos Relatórios (Story 9.3) e abre
-- caminho para auditoria de multi-tenant/multi-user.
--
-- Dois vetores de origem possíveis para uma transaction:
--   1. PWA direto → author_user_id preenchido (usuário logado criou manualmente)
--   2. WhatsApp worker Go → author_phone_id preenchido (phone_number que mandou
--      a mensagem, resolvido para phones.id no workflow.go)
--
-- Ambas as colunas são nullable e não se anulam mutuamente (podem coexistir
-- no futuro se uma operação combinada ocorrer). A query de "por autor"
-- usa COALESCE(u.name, p.name, 'Desconhecido').

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS author_phone_id UUID REFERENCES phones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trans_author_user ON transactions(author_user_id) WHERE author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trans_author_phone ON transactions(author_phone_id) WHERE author_phone_id IS NOT NULL;
