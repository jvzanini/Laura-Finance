-- Migration 000039: buffer de signups multi-step.
-- Guarda dados do usuário enquanto email e WhatsApp ainda não foram verificados.
-- Expira em 1h (finalize remove ou expiração garbage-collect).

CREATE TABLE IF NOT EXISTS pending_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    desired_plan_slug VARCHAR(50),
    email_verified_at TIMESTAMPTZ,
    whatsapp_verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_email_active
    ON pending_signups(email)
    WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_whatsapp_active
    ON pending_signups(whatsapp)
    WHERE consumed_at IS NULL;
