-- Categories (Caçambas Orçamentárias Base)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,            -- "Lazer", "Supermercado"
    monthly_limit_cents INTEGER,           -- Limite do Teto Mensal Fixo (CENTS -> NUNCA FLOAT)
    color VARCHAR(50) DEFAULT '#10B981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);
