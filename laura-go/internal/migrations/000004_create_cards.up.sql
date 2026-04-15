-- Cards (Emissores de crédito e contas correntes vinculados à família/empresa)
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,            -- "Cartão Black PJ", "Nubank do João"
    brand VARCHAR(100),                    -- "Mastercard", "Visa"
    color VARCHAR(50) DEFAULT '#7C3AED',   -- Cor visual no PWA (ex: "#7C3AED")
    closing_day INTEGER,                   -- Dia de fechamento da fatura (ex: 20)
    due_day INTEGER,                       -- Dia de vencimento da fatura (ex: 27)
    last_four VARCHAR(4),                  -- Apenas quatro últimos dígitos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_workspace ON cards(workspace_id);
