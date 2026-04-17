# Subscription state machine

Documenta como o estado de assinatura da workspace é calculado e
transita. Ver ADR 007 para contexto arquitetural.

## Campos na tabela `workspaces`

| Coluna | Tipo | Descrição |
|---|---|---|
| `subscription_status` | VARCHAR | Raw: `trial` / `active` / `past_due` / `canceled` / `expired`. |
| `current_plan_slug` | VARCHAR | FK informal para `subscription_plans.slug`. |
| `trial_ends_at` | TIMESTAMPTZ | Fim do trial (usado quando status=trial). |
| `current_period_end` | TIMESTAMPTZ | Fim do período pago (quando active/canceled). |
| `past_due_grace_until` | TIMESTAMPTZ | Quando status vira blocked após payment_failed. |
| `canceled_at` | TIMESTAMPTZ | Quando user pediu cancelamento. |
| `card_brand`, `card_last4`, `card_exp_*` | VARCHAR/SMALLINT | Info do cartão mascarado. |

## Estados computados (`SubscriptionState`)

`ComputeState(snapshot, now)` devolve um dos 7:

| Estado | Quando | `IsBlocked`? |
|---|---|---|
| `trial_active` | `status=trial` E `trial_ends_at > now` | não |
| `trial_ended` | `status=trial` E `trial_ends_at < now` | **sim** |
| `active` | `status=active` | não |
| `past_due_grace` | `status=past_due` E `past_due_grace_until > now` | não |
| `past_due_blocked` | `status=past_due` E `past_due_grace_until < now` | **sim** |
| `canceled_grace` | `status=canceled` E `current_period_end > now` | não |
| `expired` | `status=expired` OU `canceled` com período vencido | **sim** |

## Transições

```
  (signup/finalize)
        ↓
   trial_active ──────────────(webhook invoice.paid)─────────► active
        │                                                        │
  trial_ends_at < now                                            │
        │                                            (invoice.payment_failed)
        ▼                                                        ▼
   trial_ended                                              past_due_grace
        │                                                        │
        │                                               (grace esgotou)
        │                                                        ▼
        │                                              past_due_blocked
        │                                                        │
        │                                               (novo pagamento)
        │                                                        │
        ▼                                                        ▼
      expired ◄────── (período vencido) ◄── canceled_grace ◄── active (cancel)
        ▲                                                        
        │                                                        
        └───────── (webhook subscription.deleted) ────────── active/past_due
```

## Fontes de transição

| Transição | Origem |
|---|---|
| `→ trial_active` | `POST /public/signup/finalize` |
| `trial_active → active` | Webhook `checkout.session.completed` / `invoice.paid` |
| `trial_active → trial_ended` | Cron `cron_trial.go` 04:00 UTC (tempo) |
| `active → past_due_grace` | Webhook `invoice.payment_failed` |
| `past_due_grace → active` | Webhook `invoice.paid` |
| `past_due_grace → past_due_blocked` | Cron (tempo) |
| `active → canceled_grace` | Server action `subscriptionCancelAction` + webhook `customer.subscription.updated` |
| `canceled_grace → active` | Server action `subscriptionReactivateAction` |
| `canceled_grace → expired` | Tempo (current_period_end) |
| `trial_ended/past_due_blocked/expired → active` | Novo checkout (`checkout.session.completed`) |

## Paywall (Go middleware)

`RequireActiveSubscription` aplicado em `/api/v1/transactions*`, `/cards*`, `/goals*`, `/reports*`, etc. **NÃO** aplicado em `/me*`, `/admin*`, `/public/*`.

- Super admin sempre passa.
- Se `IsBlocked(state) == true`: responde `402 Payment Required` JSON `{error:"subscription_blocked", state, redirect:"/subscription"}`.

## Paywall (PWA layout dashboard)

O layout `(dashboard)/layout.tsx` faz `GET /api/v1/me/subscription` server-side e:

- Se superadmin → passa.
- Se `is_blocked === true` E path não está na whitelist (`/subscription`, `/settings`) → redirect `/subscription?blocked=1`.

## Banners

- `TrialBanner` em `trial_active` com tom por `days_remaining` (violeta / âmbar / vermelho).
- `PastDueBanner` em `past_due_grace` / `past_due_blocked` — não dismissable.

## Emails disparados

| Email | Quando | Origem |
|---|---|---|
| `codigo_verificacao_email` | Signup start / resend | Go handler `signup.go` |
| `trial_iniciado` | Signup finalize | Go handler `signup.go` |
| `trial_terminando_d3` | Cron D-3 | Go cron |
| `trial_terminando_d1` | Cron D-1 | Go cron |
| `trial_expirado` | Cron expirou | Go cron |
| `pagamento_falhou` | Webhook invoice.payment_failed | PWA webhook |
| `pagamento_retomado` | Webhook invoice.paid vindo de past_due | PWA webhook |
| `assinatura_cancelada` | Webhook subscription.updated com cancel_at_period_end | PWA webhook |
| `comprovante_pagamento` | Webhook checkout.session.completed | PWA webhook (legado) |

## Idempotência webhook

Tabela `stripe_events`:
- `INSERT INTO stripe_events(id, type, payload) ON CONFLICT (id) DO NOTHING RETURNING id`.
- Se 0 linhas voltam, evento já foi processado → 200 OK cedo.
- Após processar, `UPDATE stripe_events SET processed_at = now() WHERE id = $1`.

## Observabilidade recomendada

- Grafana: contagem de eventos `stripe_events WHERE processed_at IS NULL AND received_at < now()-1h` (alerta de webhook travado).
- Grafana: distribuição por `subscription_status` ao longo do tempo.
- Grafana: taxa de conversão `trial → active` semanal.
