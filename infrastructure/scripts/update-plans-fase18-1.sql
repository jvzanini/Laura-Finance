-- Atualiza os 2 planos default (standard/vip) com os novos valores/features
-- pedidos pelo usuário (fase 18.1).
--
-- Básico (ex-Standard):
--   R$ 9,90 / mês (mensal habilitado; sem anual)
--   Features: texto e áudio WhatsApp, até 3 membros, até 2 cartões por membro,
--   200 transações/mês, relatórios.
--
-- VIP:
--   R$ 29,90 / mês de referência (mensal DESABILITADO)
--   R$ 358,80 / ano (12× R$ 29,90) — plano anual parcelado
--   R$ 299,00 / ano à vista (desconto Pix)
--   Features: texto+áudio+imagem WhatsApp, até 6 membros, cartões ilimitados,
--   transações ilimitadas, relatórios avançados, suporte prioritário, modo viagem,
--   Open Finance.
--
-- Pré-requisito: migrations 000042 e 000043 já aplicadas (colunas
-- price_cents_yearly, stripe_price_id_yearly, monthly_enabled, yearly_enabled,
-- price_cents_yearly_discount).

BEGIN;

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
    price_cents_yearly = 35880,
    price_cents_yearly_discount = 29900,
    monthly_enabled = FALSE,
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

-- Confirma
SELECT slug, name, price_cents, price_cents_yearly, price_cents_yearly_discount,
       monthly_enabled, yearly_enabled, features_description
FROM subscription_plans
ORDER BY sort_order;

COMMIT;
