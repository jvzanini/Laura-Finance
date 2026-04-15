-- Transactions Logs (Audit and Contextual History of WhatsApp Messages)
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    raw_message TEXT NOT NULL,
    processed_json JSONB, -- O output que o LLM enviou (Intent parsing)
    status VARCHAR(50) DEFAULT 'processed', -- "processed", "error", "ignored_by_rule"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_msg_logs_workspace ON message_logs(workspace_id);
