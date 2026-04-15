# Fase 15 — Quality Escalation (spec v1)

**Data:** 2026-04-15
**Autor:** agente autônomo (LEI #1)
**Contexto:** Fase 14 preparada (tag `phase-14-prepared`). Deploy real
bloqueado por STANDBYs externas (credenciais Vercel/Fly/Groq). Esta fase
ataca dívida técnica e qualidade sem depender de secrets do usuário.

## Objetivos

1. **Coverage Go 16.6% → 30%** via testes em `handlers/` (2.8% → ≥25%)
   e `services/` (19.8% → ≥35%).
2. **PWA typing sprint 2**: 85 warnings `no-explicit-any` → 0 (foco em
   `src/lib/actions/admin/*` e restos em features).
3. **Cache pub/sub cross-instance**: Redis pub/sub para invalidação
   entre instâncias Fly (multi-machine ready).
4. **Pluggy webhooks**: endpoint `POST /api/banking/webhooks/pluggy`
   + HMAC verify + tabela `bank_webhook_events` + idempotência.
5. **CI gate coverage Go → 25%** (progressivo, meta 30% fim Fase 15).

## Non-goals

- Mobile native foundation (Capacitor) — fica para Fase 16.
- Multi-region read replica — fica para Fase 16.
- Deploy real / qualquer STANDBY externa.
- Novas features de produto.

## Escopo detalhado

### 1. Coverage Go — handlers/services

**handlers/ (2.8% → ≥25%)** — priorizar arquivos de maior impacto:
- `handlers/auth.go` — login/logout/session refresh
- `handlers/transactions.go` — CRUD transações
- `handlers/categories.go` — CRUD categorias
- `handlers/dashboard.go` — métricas/score
- `handlers/banking.go` — connect/sync (já tem parcial)
- Tipo de teste: httptest com Fiber `app.Test()`, mock de services via
  interfaces já existentes. Reaproveitar `testutil.SignedSession`.

**services/ (19.8% → ≥35%)** — alvos:
- `services/score.go` — cálculo financeiro (paridade PWA, fundamental)
- `services/nlp.go` — parsing WhatsApp
- `services/rollover.go` — cron mensal
- `services/workflow.go` — orquestração mensagem
- Tipo: table-driven tests, mock LLM via stub `ChatCompletioner`.

### 2. PWA typing sprint 2

- Inventário: rodar `eslint --format json` e agrupar warnings por
  arquivo.
- Ordem de ataque: `lib/actions/admin/*` (maior densidade), depois
  `components/features/admin/*`, depois `components/features/*`.
- Padrão: extrair types para `src/types/` (seguir padrão `types/admin.ts`
  existente). Nunca `any` — se vier de API, tipar resposta; se vier de
  lib externa, criar `unknown` + type guard.
- Gate: `pwa-ci.yml` com `--max-warnings=0` já está ativo em `lib/api/`,
  expandir override para `src/lib/actions/admin/**`.

### 3. Cache pub/sub cross-instance

**Problema:** hoje `InvalidateWorkspace(ctx, wsID)` apaga chaves no
Redis local de UMA instância. Com multi-machine Fly, outras instâncias
servem dados stale até TTL.

**Solução:**
- Canal Redis `laura:cache:invalidate` carregando `workspace_id`.
- `RedisCache` subscribe em boot (goroutine); on-receive chama
  invalidation local sem republicar (evitar loop).
- `Invalidate*` publica no canal além de apagar localmente.
- `InMemoryCache` ignora pub/sub (single-instance dev).
- Flag `CACHE_PUBSUB_DISABLED` para kill-switch.

**Testes:** 2 instâncias testcontainers compartilhando Redis →
invalidação em uma propaga para outra em <500ms.

### 4. Pluggy webhooks

**Contrato (Pluggy docs):** POST com header
`X-Pluggy-Signature: sha256=<hmac>`; payload JSON com `event`,
`itemId`, `payload`.

**Implementação:**
- Migration 000037: tabela `bank_webhook_events (id, workspace_id,
  event_type, item_id, payload jsonb, signature text, received_at,
  processed_at, error_message)` com RLS por workspace.
- Handler `POST /api/banking/webhooks/pluggy` (public, sem auth de
  sessão; autenticado via HMAC).
- Verify HMAC: `PLUGGY_WEBHOOK_SECRET` env. Falha → 401.
- Idempotência: dedupe por `item_id + event_type + received_at` (5min
  window).
- Dispatch: `item/updated` → trigger `SyncWorkspace`; `item/error` →
  log + alert Sentry; outros → log + store only.
- Workflow assíncrono: inserir em tabela, retornar 202; worker interno
  consome (pg-listen ou polling simples 30s).

### 5. CI gate coverage

- `go-ci.yml` step coverage: gate atual 15% → subir para 25% ao fim
  da fase. Após merge final, bump para 30%.

## Arquitetura (diagrama texto)

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Instance A  │      │    Redis     │      │ Instance B   │
│             │──pub─▶│              │──sub─▶│             │
│ Cache       │      │   pub/sub    │      │ Cache       │
│ InvalidateWS│      │  channel     │      │ InvalidateWS│
└─────────────┘      └──────────────┘      └──────────────┘

Pluggy ──HMAC webhook──▶ /banking/webhooks/pluggy
                              │
                              ▼
                    bank_webhook_events (202)
                              │
                         worker polling
                              │
                              ▼
                       SyncWorkspace(ctx)
```

## Riscos + mitigações

| Risco | Mitigação |
|-|-|
| Cobertura handlers exige DB real | Usar testcontainers pgvector já ativo |
| Pub/sub loop infinito | Goroutine marker "origem=self" via UUID de instância |
| Webhook Pluggy signature inválida | Teste com fixture real + httptest mock |
| PWA type regressions | Gate ESLint `--max-warnings=0` expande gradual |

## Testes (quantitativos)

- **Go**: +60 testes unit, +10 integration. Coverage total ≥25%.
- **PWA**: regressão ESLint 0 warnings no escopo.
- **E2E Playwright**: +1 smoke test do webhook Pluggy (mock do POST).

## Critérios de aceite

- [ ] `go test ./... -cover` total ≥25%.
- [ ] `handlers/` coverage ≥25%, `services/` ≥35%.
- [ ] `npx eslint src --max-warnings=0` passa.
- [ ] Migration 000037 escrita + aplicada local + testada rollback.
- [ ] 2 instâncias locais compartilhando Redis invalidam cache
  cruzado em teste.
- [ ] Pluggy webhook handler aceita POST válido, rejeita signature
  ruim, processa `item/updated` → SyncWorkspace chamado.
- [ ] CI gate Go coverage em 25% verde.
- [ ] Tag `phase-15-prepared`.

## STANDBYs esperados

- `PLUGGY_WEBHOOK_SECRET` — placeholder no `.env.example`; valor real
  só em prod. Teste local usa fixture hardcoded.
- Nenhuma STANDBY bloqueante nova.
</content>
</invoke>