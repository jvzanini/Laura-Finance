-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    card_id UUID REFERENCES cards(id) ON DELETE SET NULL, -- Se foi num cartão, qual cartão
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL, -- Valores em modulo (positivos)
    type VARCHAR(20) NOT NULL, -- "expense" ou "income"
    description VARCHAR(255) NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Campos extras para AI
    confidence_score DECIMAL(3,2), -- Confiança da categorização NLP (0.00 to 1.00)
    needs_review BOOLEAN DEFAULT FALSE -- Flag se necessita Desambiguação
);

CREATE INDEX IF NOT EXISTS idx_trans_workspace ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(transaction_date);
