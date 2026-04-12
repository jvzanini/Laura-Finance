-- Templates de categorias globais usados como seed no registro de novos workspaces.
CREATE TABLE IF NOT EXISTS category_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) DEFAULT '📂',
    color VARCHAR(7) DEFAULT '#808080',
    description VARCHAR(500),
    subcategories JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

INSERT INTO category_templates (name, emoji, color, subcategories, sort_order) VALUES
    ('Pessoal', '👤', '#8B5CF6', '[{"name":"Saúde","emoji":"💊"},{"name":"Higiene","emoji":"🧴"},{"name":"Roupas","emoji":"👕"},{"name":"Assinaturas","emoji":"📺"},{"name":"Presentes","emoji":"🎁"}]', 1),
    ('Moradia', '🏠', '#3B82F6', '[{"name":"Aluguel","emoji":"🔑"},{"name":"Condomínio","emoji":"🏢"},{"name":"Energia","emoji":"⚡"},{"name":"Água","emoji":"💧"},{"name":"Internet","emoji":"📡"},{"name":"Manutenção","emoji":"🔧"}]', 2),
    ('Alimentação', '🍔', '#10B981', '[{"name":"Mercado","emoji":"🛒"},{"name":"Restaurantes","emoji":"🍽️"},{"name":"Delivery","emoji":"📦"},{"name":"Padaria","emoji":"🥖"},{"name":"Feira","emoji":"🥬"}]', 3),
    ('Transporte', '🚗', '#F59E0B', '[{"name":"Combustível","emoji":"⛽"},{"name":"Uber/99","emoji":"🚕"},{"name":"Estacionamento","emoji":"🅿️"},{"name":"Pedágio","emoji":"🛣️"},{"name":"Manutenção Veículo","emoji":"🔧"}]', 4),
    ('Lazer', '🎮', '#EC4899', '[{"name":"Cinema","emoji":"🎬"},{"name":"Jogos","emoji":"🎮"},{"name":"Bares","emoji":"🍺"},{"name":"Viagens","emoji":"✈️"},{"name":"Esportes","emoji":"⚽"}]', 5),
    ('Finanças', '💰', '#EF4444', '[{"name":"Cartão de Crédito","emoji":"💳"},{"name":"Empréstimos","emoji":"🏦"},{"name":"Impostos","emoji":"📋"},{"name":"Seguros","emoji":"🛡️"},{"name":"Investimentos","emoji":"📈"}]', 6),
    ('Trabalho', '💼', '#06B6D4', '[{"name":"Material","emoji":"📎"},{"name":"Software","emoji":"💻"},{"name":"Marketing","emoji":"📢"},{"name":"Contabilidade","emoji":"🧮"}]', 7),
    ('Viagem', '✈️', '#0EA5E9', '[{"name":"Hospedagem","emoji":"🏨"},{"name":"Passagens","emoji":"🎫"},{"name":"Alimentação Viagem","emoji":"🍽️"},{"name":"Passeios","emoji":"🗺️"}]', 8)
ON CONFLICT DO NOTHING;
