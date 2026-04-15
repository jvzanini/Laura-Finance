# Fase 15 — Quality Escalation (spec v2 — review #1)

**Mudanças vs v1:**
- Incluídos: observability (metrics Prometheus, spans OTel, Sentry),
  rate limiting webhook, feature flags, runbooks, ADR pub/sub,
  documentação de handoff, memory updates.
- Refinado: worker model (pg-listen descartado, polling com advisory
  lock).
- Detalhado: estratégia de invalidação do loop pub/sub (instance UUID).

**Data:** 2026-04-15
**Contexto:** Fase 14 preparada. Fase 15 ataca dívida técnica sem
STANDBYs externas.

## Objetivos (inalterado)

1. Coverage Go 16.6% → ≥25% (meta 30% via CI gate progressivo).
2. PWA `no-explicit-any` 85 → 0.
3. Cache pub/sub cross-instance (Redis).
4. Pluggy webhooks.
5. CI gate Go coverage → 25%.

## Non-goals (inalterado)

Mobile, multi-region, deploy real, features novas.

## Escopo detalhado

### 1. Coverage Go — handlers/services

**handlers/ (2.8% → ≥25%):**
- `handlers/auth.go`
- `handlers/transactions.go`
- `handlers/categories.go`
- `handlers/dashboard.go`
- `handlers/banking.go`
- Ferramentas: httptest + Fiber `app.Test()`, `testutil.SignedSession`,
  testcontainers pgvector (build tag `integration`).

**services/ (19.8% → ≥35%):**
- `services/score.go` (paridade PWA crítica)
- `services/nlp.go`
- `services/rollover.go`
- `services/workflow.go`
- Ferramentas: table-driven, mocks via interfaces (`ChatCompletioner`
  já existe).

**Documentação:** atualizar `docs/architecture.md` se surgirem
interfaces novas.

### 2. PWA typing sprint 2

- Rodar `eslint --format json -o /tmp/eslint.json` e priorizar top-5
  arquivos por densidade.
- Padrão: extrair para `src/types/{admin,financial,billing}.ts`.
- Type guards em `src/lib/typeGuards.ts` para payloads de API/LLM.
- **Gate CI**: expandir override em `eslint.config.mjs` para
  `src/lib/actions/admin/**` e `src/components/features/admin/**` com
  `no-explicit-any: error`; `pwa-ci.yml` roda `--max-warnings=0` no
  escopo.

### 3. Cache pub/sub cross-instance

**Loop prevention:**
- Cada instância gera `instanceUUID` (uuid.New) em boot.
- Payload pub/sub: `{instance_uuid, workspace_id, key_pattern}`.
- Subscriber ignora mensagens com `instance_uuid == self.instanceUUID`.

**Model:**
- Canal Redis: `laura:cache:invalidate`.
- `RedisCache.Invalidate*` publica DEPOIS de apagar local (at-least-once
  entrega).
- Subscriber: goroutine em `RedisCache.Start(ctx)`, retry exponential
  backoff em falha de conexão (log warn, Sentry warn em >5 falhas).
- `InMemoryCache`: no-op.
- Kill-switch: `CACHE_PUBSUB_DISABLED=true` → subscriber não inicia,
  publish vira no-op.

**Observability:**
- Metric `cache_pubsub_publishes_total{type}` counter.
- Metric `cache_pubsub_receives_total{outcome=applied|self|error}`.
- Span OTel `cache.pubsub.publish` + `cache.pubsub.apply`.
- Log slog `cache.pubsub` com `workspace_id`.

**Testes:**
- Unit: mock Redis pub/sub com `miniredis` ou duas conexões
  testcontainers.
- Integration: 2 `RedisCache` sharing Redis, invalidate em A aparece
  em B <500ms, self-publish ignorado.

**ADR:** `docs/adr/002-cache-pubsub-cross-instance.md` documentando
escolha pub/sub vs CRDT vs stampede lock.

### 4. Pluggy webhooks

**Migration 000037** (arquivo
`laura-go/internal/migrations/000037_bank_webhook_events.sql`):
```sql
CREATE TABLE bank_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  CONSTRAINT bank_webhook_events_dedup UNIQUE (item_id, event_type, received_at)
);
CREATE INDEX idx_bwe_unprocessed ON bank_webhook_events (received_at)
  WHERE processed_at IS NULL;
ALTER TABLE bank_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY bwe_workspace_isolation ON bank_webhook_events
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

**Handler `POST /api/banking/webhooks/pluggy`:**
- Public route (sem middleware de sessão).
- **Rate limit**: 100 req/min por IP (shared bucket Redis).
- HMAC verify: header `X-Pluggy-Signature` = `sha256=<hex>`,
  recomputado com `PLUGGY_WEBHOOK_SECRET`. Constant-time compare.
- Falha HMAC → 401 + `log.Warn("webhook.unauthorized")` + Sentry tag.
- Payload parse → resolve `workspace_id` via `bank_accounts.item_id`
  lookup; se não encontrado → 404 (log warn, não é erro 5xx).
- Insert dedupe: `ON CONFLICT DO NOTHING`; se já existe → 200 (idempotente).
- Responde 202 imediato (processamento assíncrono).

**Worker:**
- Polling a cada 30s: `SELECT ... WHERE processed_at IS NULL LIMIT 50
  FOR UPDATE SKIP LOCKED`.
- Advisory lock por `item_id` para evitar dois workers processando
  mesmo item.
- Dispatch:
  - `item/updated` ou `transactions/created` → `pluggy.SyncWorkspace`.
  - `item/error` → log + Sentry + alert.
  - outros → log + marcar processed.
- On error: incrementa `error_message`, mantém `processed_at = NULL`
  com backoff (retry max 5, depois marca processado com erro final).
- Métrica `pluggy_webhook_processed_total{event,outcome}`.
- Span OTel `pluggy.webhook.process`.

**Feature flag:** `FEATURE_PLUGGY_WEBHOOKS=false` default → handler
retorna 503 e worker fica ocioso. Habilita em prod após smoke.

**Runbook:** `docs/ops/pluggy-webhooks.md` cobrindo:
- Como configurar webhook URL no dashboard Pluggy.
- Como rotacionar `PLUGGY_WEBHOOK_SECRET`.
- Comandos SQL para inspecionar fila.
- Replay manual.

**Testes:**
- Unit: HMAC verify (válido/inválido/ausente).
- Handler: httptest POST com signature correta/errada, dedup, feature
  flag off.
- Worker: table-driven dispatch por event type, retry, advisory lock.
- E2E Playwright: mock fetch do endpoint (não hit real Pluggy).

### 5. CI gate coverage

- `go-ci.yml` step atual `coverage >= 15` → subir para `>= 25` após
  merge dos testes.
- Nenhuma mudança no workflow, só env var.

## Observability (transversal)

**Metrics Prometheus novos:**
- `cache_pubsub_publishes_total{type}`
- `cache_pubsub_receives_total{outcome}`
- `pluggy_webhook_received_total{event}`
- `pluggy_webhook_processed_total{event,outcome}`
- `pluggy_webhook_queue_depth` gauge

**Spans OTel:**
- `cache.pubsub.publish|apply`
- `pluggy.webhook.receive|process`

**Sentry:**
- HMAC failures (warn).
- Worker process errors (error).
- Pub/sub connection loss >5 retries (warn).

## Arquitetura (diagrama)

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Instance A  │─pub─▶│  Redis pub/  │─sub─▶│ Instance B   │
│ Cache       │      │  sub channel │      │ Cache        │
│ (UUID a)    │      │              │      │ (UUID b)     │
└─────────────┘      └──────────────┘      └──────────────┘
  ignores msgs com instance_uuid == self

Pluggy ─HMAC─▶ /banking/webhooks/pluggy (rate-limit 100/min)
                        │
                  verify HMAC
                        │
                  INSERT ON CONFLICT DO NOTHING
                        │
                     202 OK
                        │
                        ▼
              worker (polling 30s + SKIP LOCKED)
                        │
                 dispatch por event_type
                        │
                        ▼
                  SyncWorkspace(ctx)
```

## Riscos + mitigações (expandido)

| Risco | Mitigação |
|-|-|
| Cobertura handlers exige DB | testcontainers pgvector existente |
| Pub/sub loop infinito | instance UUID marker |
| Pub/sub perde mensagens | at-least-once + TTL cache mantém fallback |
| Webhook flood | rate-limit 100/min IP + dedupe DB |
| Worker parado silenciosamente | metric `queue_depth` + alerta >1000 |
| HMAC secret rotation | runbook + suporte a 2 secrets simultâneos (old+new) |
| PWA type regressions | CI gate `--max-warnings=0` no escopo |

## Testes (quantitativos atualizados)

- Go: +60 unit +10 integration → coverage ≥25%.
- PWA: 0 warnings no escopo gated; suite Vitest se houver.
- Playwright: +1 E2E smoke webhook.

## Critérios de aceite (ampliados)

- [ ] Coverage total Go ≥25% (handlers ≥25%, services ≥35%).
- [ ] `eslint --max-warnings=0` no escopo gated.
- [ ] Migration 000037 aplicada local + rollback SQL documentado.
- [ ] 2 instâncias locais invalidam cache cruzado <500ms.
- [ ] Webhook handler: aceita válido, rejeita ruim, dedupe, 503 se
  flag off.
- [ ] Worker: dispatcha updated → sync, error → Sentry, retry backoff.
- [ ] Metrics Prometheus e spans OTel novos expostos.
- [ ] ADR 002 + runbook pluggy-webhooks commitados.
- [ ] HANDOFF.md + project-context.md + memory atualizados.
- [ ] Tag `phase-15-prepared`.
- [ ] CI verde (4 core: go-ci gate 25%, pwa-ci, playwright, security).

## STANDBYs

- `PLUGGY_WEBHOOK_SECRET` (placeholder `.env.example`; real em prod).
- Nenhuma STANDBY bloqueante.

## Documentação entregável

- `docs/adr/002-cache-pubsub-cross-instance.md`
- `docs/ops/pluggy-webhooks.md`
- `docs/HANDOFF.md` (seção Fase 15)
- `_bmad-output/project-context.md` (seção snapshot atualizada)
- `.env.example` com novas vars
</content>
</invoke>