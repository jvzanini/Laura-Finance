-- Investments
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,           -- "Nu Invest", "BTG", "Binance"
    broker VARCHAR(255),                  -- Corretora
    type VARCHAR(50) DEFAULT 'Investimentos',  -- Investimentos, Cripto, Poupança
    invested_cents INTEGER NOT NULL DEFAULT 0,  -- Total investido em centavos
    current_cents INTEGER NOT NULL DEFAULT 0,   -- Valor atual em centavos
    monthly_contribution_cents INTEGER DEFAULT 0, -- Aporte mensal em centavos
    emoji VARCHAR(10) DEFAULT '🏦',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investments_workspace ON investments(workspace_id);
