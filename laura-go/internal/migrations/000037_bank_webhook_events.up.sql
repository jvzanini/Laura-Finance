-- Migration 000037: Pluggy webhook events (Fase 15)
--
-- Cria fila de eventos recebidos via webhook do Pluggy. Handler faz
-- INSERT assíncrono (202) e worker consome a fila (polling 30s).
--
-- Também adiciona item_id a bank_accounts (Pluggy agrupa contas por
-- item), permitindo resolver workspace a partir do payload.

ALTER TABLE bank_accounts
    ADD COLUMN IF NOT EXISTS item_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_item_id
    ON bank_accounts(item_id) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bank_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    CONSTRAINT bwe_dedup UNIQUE (item_id, event_type, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_bwe_unprocessed
    ON bank_webhook_events(received_at)
    WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bwe_workspace
    ON bank_webhook_events(workspace_id);

ALTER TABLE bank_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bwe_workspace_isolation ON bank_webhook_events;
CREATE POLICY bwe_workspace_isolation ON bank_webhook_events
    USING (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true)::uuid);
