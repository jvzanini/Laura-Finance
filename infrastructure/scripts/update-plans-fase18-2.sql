-- Fase 18.2: novos valores de planos.
-- Básico:
--   R$ 9,90 / mês (somente mensal; não há plano anual).
-- VIP:
--   R$ 29,90 / mês (cobrança mensal disponível).
--   R$ 299,90 / ano (cobrança anual — sem parcelas, sem desconto Pix).
--   Ambos habilitados; toggle da LP decide qual preço é mostrado.

BEGIN;

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE subscription_plans
SET name = 'Básico',
    price_cents = 990,
    price_cents_yearly = NULL,
    price_cents_yearly_discount = NULL,
    monthly_enabled = TRUE,
    yearly_enabled = FALSE,
    capabilities = '{"text":true,"audio":true,"image":false}'::jsonb,
    limits = '{"max_members":3,"max_cards_per_member":2,"max_transactions_month":200,"advanced_reports":false,"travel_mode":false,"open_finance":false}'::jsonb,
    features_description = '[
        "Texto e áudio via WhatsApp",
        "Até 3 membros",
        "Até 2 cartões por membro",
        "200 transações por mês",
        "Relatórios"
    ]'::jsonb,
    sort_order = 1,
    active = TRUE
WHERE slug = 'standard';

UPDATE subscription_plans
SET name = 'VIP',
    price_cents = 2990,
    price_cents_yearly = 29990,
    price_cents_yearly_discount = NULL,
    monthly_enabled = TRUE,
    yearly_enabled = TRUE,
    capabilities = '{"text":true,"audio":true,"image":true}'::jsonb,
    limits = '{"max_members":6,"max_cards_per_member":-1,"max_transactions_month":-1,"advanced_reports":true,"travel_mode":true,"open_finance":true}'::jsonb,
    features_description = '[
        "Texto, áudio e imagem via WhatsApp",
        "Até 6 membros",
        "Cartões ilimitados",
        "Transações ilimitadas",
        "Relatórios avançados",
        "Suporte prioritário",
        "Modo viagem (planejamento de viagens)",
        "Integração Open Finance"
    ]'::jsonb,
    sort_order = 2,
    active = TRUE
WHERE slug = 'vip';

SELECT slug, name, price_cents, price_cents_yearly, price_cents_yearly_discount,
       monthly_enabled, yearly_enabled
FROM subscription_plans
ORDER BY sort_order;

COMMIT;
