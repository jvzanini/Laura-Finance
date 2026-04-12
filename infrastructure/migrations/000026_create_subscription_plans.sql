-- Planos de assinatura com capabilities de IA, limites e config de modelo.
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    stripe_price_id VARCHAR(200),
    capabilities JSONB NOT NULL DEFAULT '{"text":true,"audio":true,"image":false}',
    ai_model_config JSONB NOT NULL DEFAULT '{"provider":"groq","chat_model":"llama3-70b-8192","whisper_model":"whisper-large-v3-turbo","temperature":0.1}',
    limits JSONB NOT NULL DEFAULT '{"max_members":5,"max_cards":10,"max_transactions_month":500,"advanced_reports":false}',
    features_description JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO subscription_plans (name, slug, price_cents, capabilities, ai_model_config, limits, features_description, sort_order) VALUES
    ('Standard', 'standard', 0,
     '{"text":true,"audio":true,"image":false}',
     '{"provider":"groq","chat_model":"llama3-70b-8192","whisper_model":"whisper-large-v3-turbo","temperature":0.1}',
     '{"max_members":3,"max_cards":5,"max_transactions_month":200,"advanced_reports":false}',
     '["Texto e audio via WhatsApp","Ate 3 membros","Ate 5 cartoes","200 transacoes/mes","Relatorios basicos"]',
     1),
    ('VIP', 'vip', 4990,
     '{"text":true,"audio":true,"image":true}',
     '{"provider":"groq","chat_model":"llama3-70b-8192","whisper_model":"whisper-large-v3-turbo","temperature":0.1}',
     '{"max_members":20,"max_cards":50,"max_transactions_month":5000,"advanced_reports":true}',
     '["Texto, audio e imagem via WhatsApp","Ate 20 membros","Ate 50 cartoes","5000 transacoes/mes","Relatorios avancados","Suporte prioritario"]',
     2)
ON CONFLICT DO NOTHING;
