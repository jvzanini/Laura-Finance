-- Templates de objetivos financeiros que aparecem como presets na tela /goals.
CREATE TABLE IF NOT EXISTS goal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) NOT NULL DEFAULT '🎯',
    description VARCHAR(500),
    default_target_cents INTEGER DEFAULT 0,
    color VARCHAR(7) NOT NULL DEFAULT '#8B5CF6',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

INSERT INTO goal_templates (name, emoji, color, sort_order) VALUES
    ('Viagem', '✈️', '#3B82F6', 1),
    ('Carro', '🚗', '#10B981', 2),
    ('Casa Própria', '🏠', '#F59E0B', 3),
    ('iPhone / Eletrônicos', '📱', '#8B5CF6', 4),
    ('Fundo de Emergência', '🐷', '#EF4444', 5),
    ('Educação', '🎓', '#06B6D4', 6),
    ('Casamento', '💍', '#EC4899', 7),
    ('Investimento Inicial', '🏆', '#F97316', 8)
ON CONFLICT DO NOTHING;
