-- Financial Goals
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    emoji VARCHAR(10) DEFAULT '🎯',
    target_cents INTEGER NOT NULL,        -- Meta em centavos
    current_cents INTEGER DEFAULT 0,      -- Acumulado em centavos
    deadline DATE,                        -- Prazo final
    color VARCHAR(50) DEFAULT '#8B5CF6',
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, paused
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON financial_goals(workspace_id);
