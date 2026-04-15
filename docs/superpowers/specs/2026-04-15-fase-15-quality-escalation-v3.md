# Fase 15 — Quality Escalation (spec v3 FINAL — review #2)

**Mudanças vs v2:**
- Dedupe webhook via `sha256(payload)` em vez de `received_at`.
- Replay protection: rejeita eventos >15min (clock guard).
- Worker iniciado via `bootstrap/worker.go`.
- Sub-sprints ordenados com dependência explícita.
- Comandos de verificação exatos.
- Suporte a rotação dual-secret do HMAC (accepted_secrets array).
- RLS webhook: worker usa `SET LOCAL app.workspace_id` após resolver.

## Objetivos

1. Coverage Go ≥25% (handlers ≥25%, services ≥35%), CI gate 25%.
2. PWA `no-explicit-any` 85 → 0 no escopo gated.
3. Cache pub/sub cross-instance Redis.
4. Pluggy webhooks (handler + worker + HMAC + dedupe).
5. Documentação + HANDOFF + memory + tag `phase-15-prepared`.

## Non-goals

Mobile native, multi-region, deploy real, features de produto novas.

## Ordem de execução (sub-sprints)

```
Sprint A — Coverage Go handlers  (independente)
Sprint B — Coverage Go services  (independente, paralelo a A)
Sprint C — PWA typing batch      (independente)
Sprint D — Cache pub/sub         (depende de infra cache existente)
Sprint E — Pluggy webhooks       (depende de D para metrics pattern)
Sprint F — CI gate + docs + tag  (final)
```

## Sprint A — handlers/ coverage 2.8% → ≥25%

**Arquivos alvo:** `handlers/auth.go`, `handlers/transactions.go`,
`handlers/categories.go`, `handlers/dashboard.go`, `handlers/banking.go`.

**Padrão teste:**
```go
// handlers/handlers_auth_test.go
func TestAuth_Login_Success(t *testing.T) {
    app, deps := newTestApp(t)
    body := `{"email":"x@y","password":"secret"}`
    req := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(body))
    resp, _ := app.Test(req)
    require.Equal(t, 200, resp.StatusCode)
}
```

**Helper**: `testutil.NewApp(t)` setup Fiber + mock services + signed
session. Usar testcontainers pgvector (build tag `integration`).

**Verificação:** `cd laura-go && go test ./internal/handlers/... -cover`
→ ≥25%.

## Sprint B — services/ coverage 19.8% → ≥35%

**Arquivos alvo:** `services/score.go`, `services/nlp.go`,
`services/rollover.go`, `services/workflow.go`.

**Foco `score.go`** (crítico — paridade PWA):
- Testes table-driven cobrindo combinações de pesos 35/25/25/15.
- Fixture JSON compartilhado com PWA (opcional em Fase 16).

**Foco `nlp.go`**: stub `ChatCompletioner` retornando JSON canônico.

**Verificação:** `cd laura-go && go test ./internal/services/... -cover`
→ ≥35%.

## Sprint C — PWA typing 85 → 0

**Inventário:**
```bash
cd laura-pwa && npx eslint src --ext .ts,.tsx --format json \
  -o /tmp/eslint.json && jq -r '.[] | select(.warningCount>0) |
  "\(.warningCount)\t\(.filePath)"' /tmp/eslint.json | sort -rn | head -20
```

**Batches (cada um = 1 commit):**
1. `lib/actions/admin/*` (top densidade).
2. `components/features/admin/*`.
3. `components/features/*` restante.
4. `lib/api/*` + utils.

**Padrão:**
- Extrair types para `src/types/{admin,financial,billing,banking}.ts`.
- Type guards em `src/lib/typeGuards.ts`.
- NUNCA `any`. Se vier de lib externa: `unknown` + guard.

**Gate CI:** `eslint.config.mjs` adiciona override
`no-explicit-any: error` para paths trabalhados. `pwa-ci.yml` roda
`--max-warnings=0` full.

**Verificação:**
```bash
cd laura-pwa && npx eslint src --ext .ts,.tsx --max-warnings=0
```

## Sprint D — Cache pub/sub cross-instance

**Instance UUID:** gerado em `bootstrap/cache.go` boot; injetado em
`RedisCache{instanceID: uuid.New()}`.

**Canal:** `laura:cache:invalidate`.

**Payload:**
```json
{"instance_id":"<uuid>","workspace_id":"<uuid>","pattern":"dashboard:*"}
```

**Publish** (`RedisCache.InvalidateWorkspace`):
```go
// 1. delete local keys matching pattern
// 2. publish msg (if !CACHE_PUBSUB_DISABLED)
// 3. increment metric
```

**Subscribe** (`RedisCache.Start(ctx)`):
- Goroutine. `PSubscribe("laura:cache:invalidate")`.
- On message: unmarshal; if `instance_id == self.instanceID` → skip.
- Else: delete local keys matching pattern (sem republicar).
- Retry exponential backoff em disconnect; Sentry warn após 5 falhas.

**Kill-switch:** `CACHE_PUBSUB_DISABLED=true` → `Start()` no-op,
publish no-op.

**Interface Cache** (inalterada — pub/sub é interno a RedisCache):
```go
type Cache interface {
    Get, Set, Delete, InvalidateWorkspace, GetOrCompute, Ping
}
```

**Metrics:**
- `cache_pubsub_publishes_total{pattern_kind}`
- `cache_pubsub_receives_total{outcome}` (applied|self|invalid|error)

**Spans OTel:**
- `cache.pubsub.publish` (parent: request span).
- `cache.pubsub.apply` (root, background).

**Testes:**
```go
// Two RedisCache instances sharing testcontainer Redis
a, _ := NewRedisCache(redisURL)
b, _ := NewRedisCache(redisURL)
a.Start(ctx); b.Start(ctx)
a.InvalidateWorkspace(ctx, wsID)
// Assert: b's local keys for wsID gone within 500ms
```

**ADR:** `docs/adr/002-cache-pubsub-cross-instance.md`.

**Verificação:**
```bash
cd laura-go && go test ./internal/cache/... -tags=integration -run PubSub
```

## Sprint E — Pluggy webhooks

### E.1 Migration 000037

`laura-go/internal/migrations/000037_bank_webhook_events.sql`:
```sql
BEGIN;
CREATE TABLE bank_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  CONSTRAINT bwe_dedup UNIQUE (item_id, event_type, payload_hash)
);
CREATE INDEX idx_bwe_unprocessed ON bank_webhook_events (received_at)
  WHERE processed_at IS NULL;
CREATE INDEX idx_bwe_workspace ON bank_webhook_events (workspace_id);
ALTER TABLE bank_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY bwe_workspace_isolation ON bank_webhook_events
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
COMMIT;

-- DOWN
-- DROP TABLE bank_webhook_events;
```

### E.2 Handler `POST /api/banking/webhooks/pluggy`

- Rota pública (fora do `requireSession`).
- Rate limit: 100/min por IP (Redis bucket existente; chave
  `rl:webhook:pluggy:<ip>`).
- Feature flag `FEATURE_PLUGGY_WEBHOOKS=false` → 503.
- Body size limit: 64KB.
- **HMAC verify** (`pluggy.VerifyWebhookSignature`):
  - Header `X-Pluggy-Signature` formato `sha256=<hex>`.
  - Suporta dual secrets: `PLUGGY_WEBHOOK_SECRET` (primary) +
    `PLUGGY_WEBHOOK_SECRET_OLD` (opcional, grace period rotação).
  - Constant-time compare (`hmac.Equal`).
  - Falha → 401 + log warn + Sentry tag.
- **Clock guard**: se payload contém `timestamp` e delta > 15min →
  401 (replay protection). Se Pluggy não envia timestamp, skip.
- **Dedupe**:
  - Compute `payload_hash = sha256(raw_body)`.
  - Resolve `workspace_id` via lookup `bank_accounts.item_id` (JOIN).
  - `INSERT ... ON CONFLICT (item_id, event_type, payload_hash) DO NOTHING`.
- Response **202** sempre (idempotente).
- Metric `pluggy_webhook_received_total{event,outcome=accepted|dedupe|invalid}`.

### E.3 Worker

`laura-go/internal/banking/webhook_worker.go`:
- Inicia via `bootstrap/worker.go` → goroutine na app startup.
- Loop: ticker 30s.
- Query:
  ```sql
  SELECT id, workspace_id, event_type, payload, retry_count
  FROM bank_webhook_events
  WHERE processed_at IS NULL AND retry_count < 5
  ORDER BY received_at
  LIMIT 50
  FOR UPDATE SKIP LOCKED;
  ```
- Para cada row:
  - `SET LOCAL app.workspace_id = <ws>` (ativa RLS).
  - Dispatch por `event_type`:
    - `item/updated`, `transactions/created` → `pluggy.SyncWorkspace`.
    - `item/error` → log + Sentry capture.
    - default → marcar processed sem ação.
  - On success: `UPDATE SET processed_at = now()`.
  - On error: `UPDATE SET retry_count = retry_count + 1,
    error_message = $1` (mantém `processed_at = NULL`); depois de 5
    tentativas marca `processed_at = now(), error_message`.
- Advisory lock por `item_id`: `pg_try_advisory_xact_lock(hashtext(item_id))`
  → se false, skip (outro worker pegou).
- Metrics `pluggy_webhook_processed_total{event,outcome}`.
- Gauge `pluggy_webhook_queue_depth` (count rows WHERE processed_at IS NULL).
- Span OTel `pluggy.webhook.process`.
- Kill-switch: `FEATURE_PLUGGY_WEBHOOKS=false` → worker dorme.

### E.4 Runbook

`docs/ops/pluggy-webhooks.md`:
- Configurar URL no dashboard Pluggy.
- Rotação `PLUGGY_WEBHOOK_SECRET` (dual-secret grace period).
- SQL para inspecionar fila.
- Replay manual (`UPDATE ... SET processed_at = NULL, retry_count = 0`).
- Troubleshooting: HMAC failures, workspace não resolvido, queue depth alta.

### E.5 Testes

- Unit: `TestVerifySignature` valid/invalid/missing, dual-secret.
- Handler: httptest POST com HMAC válido/ruim/ausente, feature flag,
  dedupe, rate limit, body oversize.
- Worker: table-driven dispatch, retry backoff, advisory lock,
  RLS enforcement.
- E2E Playwright: mock do endpoint (1 smoke).

### E.6 Verificação

```bash
cd laura-go && go test ./internal/pluggy/... ./internal/banking/... -v
cd laura-go && go test ./internal/handlers/... -run TestWebhookPluggy -v
```

## Sprint F — CI gate + docs + tag

### F.1 CI gate
- `.github/workflows/go-ci.yml`: `COVERAGE_MIN=25` (de 15).

### F.2 Documentação
- `docs/HANDOFF.md` seção Fase 15.
- `_bmad-output/project-context.md` snapshot.
- `docs/adr/002-cache-pubsub-cross-instance.md`.
- `docs/ops/pluggy-webhooks.md`.
- `.env.example` com `PLUGGY_WEBHOOK_SECRET`, `FEATURE_PLUGGY_WEBHOOKS`,
  `CACHE_PUBSUB_DISABLED`.

### F.3 Memory
- `phase_15_complete.md` em `.claude/.../memory/`.
- Atualizar `session_state_2026_04_15_final.md`.

### F.4 Tag
- `git tag phase-15-prepared` + push.

## Observability resumo

| Metric | Tipo | Labels |
|-|-|-|
| cache_pubsub_publishes_total | counter | pattern_kind |
| cache_pubsub_receives_total | counter | outcome |
| pluggy_webhook_received_total | counter | event, outcome |
| pluggy_webhook_processed_total | counter | event, outcome |
| pluggy_webhook_queue_depth | gauge | — |

Spans OTel: `cache.pubsub.publish|apply`, `pluggy.webhook.receive|process`.

Sentry: HMAC failures (warn), worker errors (error), pub/sub
connection loss (warn após 5 retries).

## Riscos + mitigações

| Risco | Mitigação |
|-|-|
| Cobertura handlers exige DB | testcontainers já setup |
| Pub/sub loop | instance UUID marker |
| Pub/sub perde msg | at-least-once + TTL cache fallback |
| Webhook flood | rate-limit + dedupe DB |
| Worker silencioso | queue_depth gauge + alerta |
| HMAC rotation | dual-secret grace period |
| Replay attack | clock guard 15min |
| PWA regressões | CI gate `--max-warnings=0` |
| Coverage regression | CI gate Go 25% bloqueia |

## Critérios de aceite

- [ ] Go coverage ≥25% total (handlers ≥25%, services ≥35%).
- [ ] PWA: `eslint --max-warnings=0` verde.
- [ ] Migration 000037 aplicada local + rollback documentado.
- [ ] 2 instâncias locais: cache pub/sub cruzado <500ms (teste).
- [ ] Webhook: HMAC dual-secret OK, dedupe OK, feature flag OK.
- [ ] Worker: dispatch OK, retry 5x + kill, RLS OK, advisory lock OK.
- [ ] Metrics + spans novos expostos.
- [ ] ADR 002 + runbook pluggy-webhooks commitados.
- [ ] HANDOFF + project-context + memory atualizados.
- [ ] Tag `phase-15-prepared`.
- [ ] CI 4/4 core verde (go-ci@25%, pwa-ci, playwright, security).

## STANDBYs

- `PLUGGY_WEBHOOK_SECRET` — placeholder no `.env.example`.
- Nenhuma bloqueante.
</content>
</invoke>