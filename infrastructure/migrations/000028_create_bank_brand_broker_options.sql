-- Opções de bancos (select de criação de cartão)
CREATE TABLE IF NOT EXISTS bank_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO bank_options (name, slug, sort_order) VALUES
    ('Nubank', 'nubank', 1), ('Banco Inter', 'inter', 2), ('C6 Bank', 'c6', 3),
    ('Bradesco', 'bradesco', 4), ('Itaú', 'itau', 5), ('Santander', 'santander', 6),
    ('Caixa Econômica', 'caixa', 7), ('Banco do Brasil', 'bb', 8), ('BTG Pactual', 'btg', 9),
    ('PagBank', 'pagbank', 10), ('Neon', 'neon', 11), ('Banco Pan', 'pan', 12),
    ('Safra', 'safra', 13), ('Mercado Pago', 'mercadopago', 14), ('PicPay', 'picpay', 15)
ON CONFLICT DO NOTHING;

-- Bandeiras de cartão
CREATE TABLE IF NOT EXISTS card_brand_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(30) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO card_brand_options (name, slug, sort_order) VALUES
    ('Mastercard', 'mastercard', 1), ('Visa', 'visa', 2), ('Elo', 'elo', 3),
    ('American Express', 'amex', 4), ('Hipercard', 'hipercard', 5), ('Diners Club', 'diners', 6)
ON CONFLICT DO NOTHING;

-- Corretoras de investimento
CREATE TABLE IF NOT EXISTS broker_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    emoji VARCHAR(10) DEFAULT '🏦',
    category VARCHAR(50) DEFAULT 'nacional',
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO broker_options (name, slug, emoji, category, sort_order) VALUES
    ('Ágora', 'agora', '🏦', 'nacional', 1), ('BTG', 'btg', '🏦', 'nacional', 2),
    ('Clear', 'clear', '🏦', 'nacional', 3), ('Inter', 'inter', '🏦', 'nacional', 4),
    ('Nu Invest', 'nuinvest', '🏦', 'nacional', 5), ('Rico', 'rico', '🏦', 'nacional', 6),
    ('XP', 'xp', '🏦', 'nacional', 7), ('Binance', 'binance', '💎', 'cripto', 8),
    ('IC Markets', 'icmarkets', '📈', 'internacional', 9), ('IQ Option', 'iqoption', '📊', 'internacional', 10)
ON CONFLICT DO NOTHING;

-- Tipos de investimento
CREATE TABLE IF NOT EXISTS investment_type_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO investment_type_options (name, slug, sort_order) VALUES
    ('Investimentos', 'investimentos', 1), ('Cripto', 'cripto', 2), ('Poupança', 'poupanca', 3),
    ('Renda Fixa', 'renda-fixa', 4), ('Renda Variável', 'renda-variavel', 5), ('FIIs', 'fiis', 6)
ON CONFLICT DO NOTHING;
