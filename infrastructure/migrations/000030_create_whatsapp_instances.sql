-- Instâncias WhatsApp para multi-conexão (estilo Evolution API).
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'disconnected',
    webhook_url VARCHAR(500),
    webhook_events JSONB DEFAULT '["message_received","message_sent","status_change"]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);
