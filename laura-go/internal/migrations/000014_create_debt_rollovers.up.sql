-- Debt Rollovers (Empurrar Fatura)
CREATE TABLE IF NOT EXISTS debt_rollovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
    institution VARCHAR(255) NOT NULL,     -- Maquininha usada
    invoice_value_cents INTEGER NOT NULL,  -- Valor original da fatura
    total_fees_cents INTEGER NOT NULL,     -- Total de taxas pagas
    total_operations INTEGER NOT NULL,     -- Quantidade de operações
    installments VARCHAR(10),             -- Parcelamento escolhido
    fee_percentage DECIMAL(5,2),          -- Taxa percentual
    status VARCHAR(20) DEFAULT 'concluido', -- concluido, parcial, cancelado
    operations_json JSONB,                -- Detalhamento das operações
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rollovers_workspace ON debt_rollovers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rollovers_card ON debt_rollovers(card_id);
