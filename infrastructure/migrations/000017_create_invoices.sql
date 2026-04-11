-- Invoices: representação persistente de uma fatura fechada de um cartão
-- num determinado mês, com due_date e paid_at. Fornece os dados estruturados
-- necessários para:
--   1. Calcular billsOnTime real no Score Financeiro (Story 9.2).
--   2. Rastrear histórico de pagamentos para nudges do Epic 4.
--   3. Suportar a tela /invoices com dados reais (hoje renderiza mock).
--
-- Convenções:
--   - Um invoice representa 1 cartão × 1 mês de referência (month_ref é o
--     primeiro dia do mês a que a fatura pertence).
--   - total_cents é o total fechado no fechamento (integer cents, sem float).
--   - due_date é a data de vencimento real (após o fechamento).
--   - paid_at é NULL enquanto a fatura não foi quitada; passa a ter valor
--     quando o usuário marca como paga ou um fluxo automático detecta.
--   - status reflete a situação derivada: 'open' (ainda não venceu),
--     'paid' (quitada), 'overdue' (vencida e não paga).

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    month_ref DATE NOT NULL,              -- primeiro dia do mês de referência
    total_cents INTEGER NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoices_workspace_card_month_unique UNIQUE (workspace_id, card_id, month_ref)
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_card ON invoices(card_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE status != 'paid';
