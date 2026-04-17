-- Migration 000038: tabela de códigos OTP para verificação em signup/login por email/whatsapp.
-- HMAC-SHA256(OTP_SECRET, code) armazenado em hex (64 chars). Expira em 10 min. Máx 5 tentativas.

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('email','whatsapp')),
    target_value VARCHAR(255) NOT NULL,
    code_hmac VARCHAR(64) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    context_id UUID,
    attempts SMALLINT NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup
    ON otp_codes(target_type, target_value, purpose)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_otp_context
    ON otp_codes(context_id)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_otp_rate
    ON otp_codes(target_type, target_value, created_at);
