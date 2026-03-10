-- Phones (Dependentes permitidos no WhatsApp para determinado Workspace)
CREATE TABLE IF NOT EXISTS phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL, -- DDI+DDD+Number e.g 5511999999999
    role VARCHAR(50) DEFAULT 'membro', -- "proprietario", "membro", "filho"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_phone_per_workspace UNIQUE (workspace_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_phones_workspace ON phones(workspace_id);
CREATE INDEX IF NOT EXISTS idx_phones_number ON phones(phone_number);
