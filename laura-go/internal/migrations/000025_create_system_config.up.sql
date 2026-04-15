-- Configurações globais do sistema (key/value JSONB).
-- Permite ao super admin alterar parâmetros sem deploy.
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    description VARCHAR(500),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

INSERT INTO system_config (key, value, description) VALUES
    ('app_name', '"Laura Finance"', 'Nome exibido no sistema'),
    ('sender_email', '"laura@suaempresa.com"', 'Email remetente (Resend)'),
    ('sender_name', '"Laura Finance"', 'Nome do remetente'),
    ('registration_enabled', 'true', 'Cadastro aberto para novos usuarios'),
    ('maintenance_mode', 'false', 'Modo manutencao (bloqueia acesso)'),
    ('default_plan', '"standard"', 'Plano padrao para novos registros'),
    ('budget_alert_hour', '20', 'Hora do alerta diario de orcamento (0-23)'),
    ('score_snapshot_hour', '2', 'Hora do snapshot diario do score (0-23)'),
    ('score_weights', '{"billsOnTime":0.35,"budgetRespect":0.25,"savingsRate":0.25,"debtLevel":0.15}', 'Pesos do Score Financeiro'),
    ('score_thresholds', '{"excellent":80,"good":60,"fair":40}', 'Thresholds do Score'),
    ('score_lookback_days', '90', 'Periodo de lookback para calculo do score (dias)'),
    ('nlp_confidence_threshold', '0.85', 'Confianca minima para auto-classificar transacao'),
    ('password_min_length', '6', 'Tamanho minimo de senha'),
    ('verify_email_ttl_hours', '24', 'Validade do token de verificacao de email (horas)'),
    ('password_reset_ttl_minutes', '30', 'Validade do token de reset de senha (minutos)')
ON CONFLICT DO NOTHING;
