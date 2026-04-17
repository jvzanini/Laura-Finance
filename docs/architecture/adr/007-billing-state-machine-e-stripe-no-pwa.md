# ADR 007 — State machine de assinatura + Stripe SDK no PWA

**Data:** 2026-04-17
**Status:** ACEITO (Fase 18).

## Contexto

Fase 18 adiciona trial de 7 dias, paywall pós-trial, gestão de
assinatura (checkout / portal / cancel / reactivate) e webhooks Stripe
expandidos (invoice.paid, invoice.payment_failed, subscription
updated/deleted).

A arquitetura atual divide o app em PWA Next.js (com acesso direto ao
Postgres via `pg` e ao Stripe via `stripe-node`) e backend Go (Fiber)
que serve `/api/v1/*`. A decisão era onde colocar cada responsabilidade
nova.

## Decisão

1. **Stripe SDK fica SÓ no PWA.** Toda interação com Stripe (checkout
   session, billing portal, cancel/reactivate, webhook) roda via
   `stripe-node` em server actions do Next ou em `/api/stripe/webhook`.

2. **Go detém a state machine.** `services/subscription.go` implementa
   `ComputeState(snapshot, now) → SubscriptionState` puro.

3. **Fonte de verdade = Postgres.** Ambos lados leem/escrevem nas
   colunas `workspaces.subscription_status`, `trial_ends_at`,
   `current_period_end`, `past_due_grace_until`, `canceled_at`.

4. **Webhook Stripe (PWA) atualiza colunas.** Paywall do Go lê essas
   colunas e decide bloquear via middleware `RequireActiveSubscription`.

5. **Idempotência do webhook** via tabela `stripe_events (id PRIMARY KEY)`
   com `INSERT ... ON CONFLICT DO NOTHING RETURNING id`.

6. **Cron de trial lifecycle** roda no Go (`cron_trial.go`, 04:00 UTC
   diário) — marca expired, envia D-3/D-1/expired emails, expira
   past_due após grace.

7. **Emails: duplicação intencional.** PWA tem `lib/email.ts` (Resend TS)
   e Go tem `services/email.go` (Resend Go SDK). Duplicação aceita para
   desacoplamento — cada side pode disparar email do seu fluxo sem
   dependência cruzada. Ambos usam templates da tabela
   `email_templates`.

## Alternativas consideradas

- **Stripe SDK duplicado Go + PWA.** Rejeitado. Gera inconsistência de
  comportamento e oferece pouco ganho. O Go ainda não tinha stripe-go e
  trazer a dependência significaria manter 2 codepaths para checkout
  sessions e billing portal.

- **Webhook Stripe no Go.** Rejeitado. O Go não fala Stripe, e a
  verificação de signature do webhook fica atrelada a quem mais faz
  chamadas — o PWA já era o cliente natural do SDK.

- **Go expõe API interna para PWA chamar (proxy).** Rejeitado como
  complexidade desnecessária. PWA já tem acesso direto ao DB.

- **Source of truth no Stripe, sync on-demand.** Rejeitado para o
  paywall quente (lê a cada request) — latência/resiliência ruins.
  Webhook + DB local é robusto.

## Consequências

- Facilidade: mudanças de billing só tocam PWA (menos deploys Go).
- State machine testável e desacoplada de IO.
- Resiliência: webhook pode ser reprocessado (idempotente) e DB é o
  canônico.
- Trade-off: se PWA cair, webhooks ficam empilhados no Stripe (até 3
  dias de retry automático). Monitoramento de
  `processed_at IS NULL AND received_at < now()-1h` em Grafana
  recomendado pós-deploy.

## Documentação relacionada

- `docs/ops/subscription-state-machine.md` — diagrama + transições.
- `laura-go/internal/services/subscription.go` — state machine pura.
- `laura-go/internal/handlers/paywall.go` — middleware 402.
- `laura-pwa/src/app/api/stripe/webhook/route.ts` — ingestão de eventos.
- `laura-pwa/src/lib/actions/subscription.ts` — server actions Stripe.
- Migrations 000038–000042.
