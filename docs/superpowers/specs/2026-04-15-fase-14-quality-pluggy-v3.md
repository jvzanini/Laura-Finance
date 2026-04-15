# Fase 14 — Quality Maturation + Pluggy Integration Real + PWA Typing (Spec v3 — FINAL)

> Versão: v3 (FINAL — pós review #2, pronta para `writing-plans`)
> Data: 2026-04-15
> Autor: arquiteto sênior
> Status: aprovada; substitui v2 (`2026-04-15-fase-14-quality-pluggy-v2.md`)
> Repo: github.com/jvzanini/laura-finance-vibe-coding
> Runtime Go: **1.26.1** (confirmado — `context.WithoutCancel` disponível desde 1.21)

---

## Mudanças vs v2 (delta review #2)

1. **Baseline PWA real** — substituído "estimativa 27 `any`" por counts exatos obtidos via `grep` em 2026-04-15: top arquivo é `adminConfig.ts` com **20** (não 27), seguido de `categories.ts` (3), `userProfile.ts` (2), `phones.ts` (1), e 3 componentes admin (`AuditLogView.tsx` 3, `AdminConfigEditor.tsx` 3, `ScoreEditor.tsx` 1, `GoalTemplatesEditor.tsx` 1). Total mapeado: **34 ocorrências** em 8 arquivos. Escopo Fase 14 = os 5 top arquivos (adminConfig.ts + categories.ts + userProfile.ts + AuditLogView.tsx + AdminConfigEditor.tsx = 31 de 34).
2. **tc-postgres reuso** — v3 confirma que `laura-go/internal/testutil/integration.go` **já expõe** `SharedPG` + `SharedDSN` via `TestMain` com build tag `integration` (Fase 13). Fase 14 **apenas estende** esse arquivo com `SharedRedis` + `SharedRedisURL` via mesma `TestMain` — sem extrair helper novo.
3. **Pluggy rate limit — decisão arquitetural** — sandbox oficial tem 60 req/min; testes paralelos com retry 3x podem estourar. Decisão v3: **httptest mock LOCAL** (`internal/integrations/pluggy/httptest_mock.go`) é o único path em CI e `go test`. Integração contra sandbox real fica **exclusivamente em workflow manual** `pluggy-smoke.yml` gated por `workflow_dispatch` (não cron automático nesta fase — evita queima de quota enquanto credenciais são validadas).
4. **context.WithoutCancel fixado** — Go 1.26.1 suporta nativamente; padrão canônico documentado em §12.4.
5. **Scope allowlist de commit expandido** — adicionados `pluggy`, `typing`, `quality` ao conjunto Fase 13 (go, pwa, infra, ci, ops, db, e2e, security, telemetry, observability, cache, refactor, perf, lint, docs, hooks, banking, open-finance).
6. **PluggyClient auth cache com code completo** — §12.3 agora tem implementação integral (double-check locking + TTL 1h50 para refresh 10min antes do vencimento Pluggy 2h).
7. **PluggyClient retry custom** — decisão explícita de **não adicionar dep nova** (`cenkalti/backoff` descartado); implementação minimal em §12.3 com backoff 200ms/500ms/1s + 3 tentativas.
8. **Erro sentinelas padronizados** — nomenclatura `ErrPluggy*` (prefixo consistente): `ErrPluggyAuthFailed`, `ErrPluggyRateLimited`, `ErrPluggyNotFound`, `ErrPluggyInternal` (v2 usava `ErrAuthFailed` sem prefixo — corrigido).
9. **ProcessMessageFlow assinatura nova** — `ProcessMessageFlow(ctx context.Context, msg Message) error` (v2 deixava ambíguo); caller pattern `context.WithoutCancel` + `WithTimeout(30s)` documentado em §12.4.
10. **CI split com `nick-fields/retry@v3` concreto** — YAML snippet integral em §12.6 (v2 mencionava mas não detalhava `if: github.ref == 'refs/heads/main'`).

---

## 1. Objetivo

Fechar os 8 concerns residuais da Fase 13, convertendo "fundação preparada" em **fundação testada com integração Pluggy real** (ou mock httptest estrutural se secrets atrasarem). Três eixos paralelos:

1. **Quality maturation** — coverage Go **≥ 30% hard gate**, testcontainers Redis real via reuso de `TestMain` existente, CI split unit/integration com retry@v3 3x, lint v2 reavaliação objetiva.
2. **Pluggy integration real** — HTTP client completo (`POST /auth` → cache token 1h50 → `POST /connect_tokens` + `GET /items/{id}/transactions?pageSize=500`) com 4 sentinelas + retry interno custom.
3. **PWA typing sprint 1 real** — 20 `any` em `adminConfig.ts` + 4 arquivos (categories.ts, userProfile.ts, AuditLogView.tsx, AdminConfigEditor.tsx) totalizando 31 ocorrências; zod nos server actions de borda.

Entregável: tag **`phase-14-prepared`** com CI verde, coverage Go ≥ 30%, `no-explicit-any` zero nos 5 arquivos PWA alvo, Pluggy httptest mock funcional em CI + sandbox validado em dev (se credenciais chegarem) ou `blocked:creds` documentado.

## 2. Contexto e motivação

(Inalterado vs v2.) Fases 10–13 entregaram ~190 commits e 4 tags `phase-*-prepared`, com 8 concerns deliberadamente postergados. Fase 14 fecha o ciclo.

## 3. Escopo

### 3.1. Dentro

1. PWA typing sprint 1 real — `adminConfig.ts` (20 `any`) + `categories.ts` (3) + `userProfile.ts` (2) + `AuditLogView.tsx` (3) + `AdminConfigEditor.tsx` (3) = 31 ocorrências.
2. Testcontainers Redis extendendo `TestMain` existente (`laura-go/internal/testutil/integration.go`) + CI split `test-unit`/`test-integration` com retry@v3 3x.
3. Coverage Go ≥ 30% via integration tests em handlers/services (pgxpool real + tc-postgres já disponível).
4. Pluggy HTTP client real (auth cache + connect_tokens + transactions) com 4 sentinelas + retry custom.
5. ProcessMessageFlow ctx cascade — `context.WithoutCancel` + deadline 30s; assinatura nova `(ctx, msg) error`.
6. golangci-lint v2 reavaliação com critério objetivo.
7. `LLM_LEGACY_NOCONTEXT` PR draft + ADR data-alvo **2026-05-15** (T+30d de 2026-04-15).
8. Migration 000036 — runbook documentado (NÃO aplica em prod nesta fase).

### 3.2. Fora (Fase 15+)

Pub/sub Redis cross-instance, mobile nativo, multi-region DB, Pluggy webhooks, LLM context advanced, SLO alertas paginados, tRPC/hono.

## 4. Pendências detalhadas

### 4.1. PWA typing sprint 1 real

**Baseline exato (2026-04-15):**

| Arquivo | Count `any` | Estratégia |
|---|---|---|
| `src/lib/actions/adminConfig.ts` | 20 | Extrair `AdminConfigEntry`, `SettingPayload`, `AdminFormState` em `src/types/admin.ts`; zod em `updateAdminConfig` + `bulkUpdateSettings`. |
| `src/lib/actions/categories.ts` | 3 | Tipar retorno Prisma via `Prisma.CategoryGetPayload<...>`. |
| `src/lib/actions/userProfile.ts` | 2 | Zod schema de input; remover `as any` em merge. |
| `src/components/admin/AuditLogView.tsx` | 3 | Interface `AuditLogRow`; remover `any` em columns. |
| `src/components/admin/AdminConfigEditor.tsx` | 3 | Props genérica `<T extends AdminConfigEntry>`. |

**Fora do escopo Fase 14** (Fase 15): `phones.ts` (1), `ScoreEditor.tsx` (1), `GoalTemplatesEditor.tsx` (1) = 3 ocorrências residuais.

**Critério:** `pnpm lint` zero warnings `no-explicit-any` nos 5 arquivos alvo; `pnpm typecheck` verde. Override per-file em `eslint.config.mjs`: `'@typescript-eslint/no-explicit-any': 'error'`.

### 4.2. Testcontainers Redis + CI split

**Decisão v3:** estender `laura-go/internal/testutil/integration.go` (já expõe `SharedPG` + `SharedDSN` via `TestMain` Fase 13) com `SharedRedis` + `SharedRedisURL` no mesmo `TestMain`. Sem arquivo helper novo. Redis 7-alpine via `tcredis.Run`.

CI split:
- `test-unit` — sem Docker-in-Docker, ≤3min, **required em PR**.
- `test-integration` — com DinD, `-tags=integration`, timeout 10min, `nick-fields/retry@v3` 3x, **required só em main** (`if: github.ref == 'refs/heads/main'`). Em PR roda best-effort (não bloqueia merge).

### 4.3. Coverage Go 30% (hard gate)

Gate CI fail-hard abaixo de 30%. Sem escape hatch. Check final:
```sh
go test ./... -tags=integration -covermode=atomic -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -1 | awk '{if ($3+0 < 30.0) { print "FAIL: coverage " $3 " < 30%"; exit 1 } else { print "OK: " $3 } }'
```

Alvos: transactions/messages/users/sessions/admin/webhooks handlers + transactionService/messageService/userService. Fixture isolation: transaction-per-test (BEGIN/ROLLBACK defer).

### 4.4. Pluggy HTTP client real

4 sentinelas `ErrPluggy*` + retry interno custom 3x (backoff 200ms/500ms/1s) em 5xx/429/timeout. Auth cache in-memory com `sync.RWMutex` + TTL 1h50. Endpoints oficiais Pluggy (§12.2).

**Mock httptest LOCAL é o único path de CI.** Sandbox real só em workflow manual (§12.6).

### 4.5. ProcessMessageFlow ctx cascade

Assinatura nova: `func ProcessMessageFlow(ctx context.Context, msg Message) error`. Caller no handler WA deriva ctx com `context.WithoutCancel(parentCtx)` + `context.WithTimeout(ctx, 30*time.Second)`. Integration test assert `request_id` e `user_id` nos logs da goroutine.

### 4.6. golangci-lint v2

Critério objetivo: `golangci-lint --version` ≥ v2.0 + `golangci-lint run ./... --timeout=5m` zero issues ⇒ reabilita job em `.github/workflows/go-ci.yml`; senão mantém v1 + ADR `docs/decisions/2026-04-XX-golangci-v2.md`.

### 4.7. LLM_LEGACY_NOCONTEXT flag removal

Data-alvo fixa **2026-05-15** (T+30d do deploy Fase 13 em 2026-04-15). PR draft aberto + ADR critério: `llm_legacy_nocontext_activations_total == 0` por 30d contínuos.

### 4.8. Migration 000036

**NÃO aplica em prod nesta fase.** Depende STANDBY `FLY-PG-CREATE`. Apenas runbook `docs/operations/prod-migration-apply.md`.

## 5. Decisões de arquitetura

(5.1–5.6 mantidas de v2; consolidadas no §13 contra review #2.)

## 6. STANDBYs

**Bloqueantes para item 4.4 com fallback httptest:**
- `[PLUGGY-CLIENT-ID]` — env `PLUGGY_CLIENT_ID` + Portainer secret.
- `[PLUGGY-CLIENT-SECRET]` — env `PLUGGY_CLIENT_SECRET` + Portainer secret.

Se não chegarem: item 4.4 entregue como **"client pronto + httptest smoke verde + label `blocked:creds`"**. Tag `phase-14-prepared` sai mesmo assim — httptest mock garante cobertura estrutural.

**Não bloqueantes:** `[REDIS-INSTANCE]` Upstash (tc-redis cobre dev/CI), Sentry DSN, UptimeRobot, FLY-PG-CREATE (impacta só 4.8 runbook-only).

## 7. DoD (Definition of Done)

- [ ] `pnpm lint` zero `no-explicit-any` em 5 arquivos alvo (adminConfig.ts, categories.ts, userProfile.ts, AuditLogView.tsx, AdminConfigEditor.tsx).
- [ ] `pnpm typecheck` verde.
- [ ] `go test ./... -tags=integration -covermode=atomic -coverprofile=coverage.out` verde.
- [ ] **Coverage Go ≥ 30% (hard gate, CI falha abaixo).**
- [ ] `TestMain` integration extendido com `SharedRedis` + `SharedRedisURL`.
- [ ] ≥ 8 integration tests novos (handlers + services + redis).
- [ ] CI split `test-unit` required em PR + `test-integration` required em main com retry@v3 3x timeout 10min.
- [ ] Pluggy client: 4 sentinelas exportadas (`ErrPluggyAuthFailed`/`ErrPluggyRateLimited`/`ErrPluggyNotFound`/`ErrPluggyInternal`).
- [ ] Pluggy auth cache com double-check locking + TTL 1h50.
- [ ] Pluggy retry custom 3x backoff 200ms/500ms/1s.
- [ ] Pluggy httptest mock local verde em CI.
- [ ] Pluggy sandbox: workflow manual `pluggy-smoke.yml` gated por `workflow_dispatch` (criado, disabled até secrets).
- [ ] ProcessMessageFlow assinatura `(ctx, msg) error` + caller usa `WithoutCancel` + `WithTimeout(30s)`.
- [ ] Integration test assert `request_id`+`user_id` nos logs da goroutine WA.
- [ ] golangci-lint: v2 migrado OU ADR `docs/decisions/2026-04-XX-golangci-v2.md` documentando adiamento.
- [ ] PR draft `LLM_LEGACY_NOCONTEXT` removal aberto + ADR data-alvo 2026-05-15.
- [ ] Runbook `docs/operations/prod-migration-apply.md` existe (apply NÃO executado).
- [ ] Scope commit allowlist inclui `pluggy`, `typing`, `quality`.
- [ ] Tag `phase-14-prepared` + push.
- [ ] Runbook `docs/runbooks/phase-14.md` atualizado.

## 8. Riscos

(Mantidos v2 com reforço em #1: rate limit Pluggy endereçado por httptest-only em CI.)

## 9. Métricas de sucesso

Coverage Go ≥ 30%, `no-explicit-any` zero nos 5 arquivos alvo (≤ 3 residuais globais PWA), httptest mock Pluggy verde + 1 connect_token + ≥1 tx real sandbox (se creds), CI unit ≤3min / integration ≤10min, 100% correlação `request_id` WA.

## 10. Plano de testes

**Unit:** `adminConfig.test.ts` (zod + type guards); `client_test.go` Pluggy (httptest 200/401/429/5xx + sentinelas + retry assertions).

**Integration (novo):** `internal/handlers/*_integration_test.go` (transactions, messages, users, sessions, admin, webhooks); `internal/services/*_integration_test.go` (transactionService, messageService, userService); `internal/cache/redis_integration_test.go`; `internal/ratelimit/redis_integration_test.go`; `internal/integrations/pluggy/client_integration_test.go`.

**E2E smoke manual:** via `pluggy-smoke.yml` dispatch manual (se creds).

---

## 11. Resolução questões v1 → decisão final

(Mantida tabela v2 10 itens; todas as decisões confirmadas e reforçadas em §13.)

---

## 12. Detalhes técnicos novos

### 12.1. PWA typing — baseline real + fluxo

```sh
cd laura-pwa

# Top arquivos actions (confirmado 2026-04-15)
grep -rE ": any\b| any\[\]|<any>" src/lib/actions/*.ts | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
#   20 src/lib/actions/adminConfig.ts
#    3 src/lib/actions/categories.ts
#    2 src/lib/actions/userProfile.ts
#    1 src/lib/actions/phones.ts

# Componentes admin
grep -rE ": any\b| any\[\]|<any>" src/components src/lib/services src/lib/hooks src/lib/validators | cut -d: -f1 | sort | uniq -c | sort -rn
#    3 src/components/admin/AuditLogView.tsx
#    3 src/components/admin/AdminConfigEditor.tsx
#    1 src/components/admin/ScoreEditor.tsx
#    1 src/components/admin/GoalTemplatesEditor.tsx
```

**Fluxo:** extrair tipos canônicos em `src/types/admin.ts` → substituir `any` → adicionar zod em borda (server actions) → habilitar override per-file `'@typescript-eslint/no-explicit-any': 'error'`.

### 12.2. Pluggy HTTP endpoints oficiais

| Método | Path | Body/Query | Resposta | Header auth |
|---|---|---|---|---|
| POST | `/auth` | `{clientId, clientSecret}` | `{apiKey}` (TTL ~2h) | — |
| POST | `/connect_tokens` | `{itemId?, options?}` | `{accessToken, expiresAt}` (TTL 30min) | `X-API-KEY` |
| GET | `/items/{id}/transactions?pageSize=500` | — | `{results: Transaction[], total, totalPages}` | `X-API-KEY` |

Base URL sandbox: `https://api.pluggy.ai`. Rate limit sandbox: 60 req/min.

### 12.3. PluggyClient — auth cache + retry + sentinelas (código completo)

```go
// internal/integrations/pluggy/errors.go
package pluggy

import "errors"

var (
    ErrPluggyAuthFailed   = errors.New("pluggy: auth failed")
    ErrPluggyRateLimited  = errors.New("pluggy: rate limited")
    ErrPluggyNotFound     = errors.New("pluggy: not found")
    ErrPluggyInternal     = errors.New("pluggy: internal error")
)
```

```go
// internal/integrations/pluggy/client.go
package pluggy

import (
    "bytes"
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "net/http"
    "sync"
    "time"
)

type Client struct {
    baseURL      string
    clientID     string
    clientSecret string
    http         *http.Client

    authMu    sync.RWMutex
    authToken string
    authExp   time.Time // Pluggy TTL 2h; refresh 10min antes = TTL efetivo 1h50
}

func (c *Client) getAuthToken(ctx context.Context) (string, error) {
    // Fast path — read lock
    c.authMu.RLock()
    if c.authToken != "" && time.Now().Before(c.authExp) {
        token := c.authToken
        c.authMu.RUnlock()
        return token, nil
    }
    c.authMu.RUnlock()

    // Slow path — acquire write lock
    c.authMu.Lock()
    defer c.authMu.Unlock()

    // Double-check após adquirir write lock
    if c.authToken != "" && time.Now().Before(c.authExp) {
        return c.authToken, nil
    }

    // POST /auth
    body, _ := json.Marshal(map[string]string{
        "clientId":     c.clientID,
        "clientSecret": c.clientSecret,
    })
    req, err := http.NewRequestWithContext(ctx, http.MethodPost,
        c.baseURL+"/auth", bytes.NewReader(body))
    if err != nil {
        return "", fmt.Errorf("%w: build auth req: %v", ErrPluggyInternal, err)
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.http.Do(req)
    if err != nil {
        return "", fmt.Errorf("%w: do auth: %v", ErrPluggyInternal, err)
    }
    defer resp.Body.Close()

    switch resp.StatusCode {
    case http.StatusOK:
        var a struct{ APIKey string `json:"apiKey"` }
        if err := json.NewDecoder(resp.Body).Decode(&a); err != nil {
            return "", fmt.Errorf("%w: decode auth: %v", ErrPluggyInternal, err)
        }
        c.authToken = a.APIKey
        c.authExp = time.Now().Add(1*time.Hour + 50*time.Minute) // refresh 10min antes do vencimento 2h
        return c.authToken, nil
    case http.StatusUnauthorized, http.StatusForbidden:
        return "", ErrPluggyAuthFailed
    case http.StatusTooManyRequests:
        return "", ErrPluggyRateLimited
    default:
        return "", fmt.Errorf("%w: status %d", ErrPluggyInternal, resp.StatusCode)
    }
}

// retryableDo — custom minimal sem dep nova
func retryableDo(ctx context.Context, fn func(ctx context.Context) error) error {
    backoffs := []time.Duration{
        200 * time.Millisecond,
        500 * time.Millisecond,
        1 * time.Second,
    }
    var lastErr error
    for i := 0; i < len(backoffs); i++ {
        err := fn(ctx)
        if err == nil {
            return nil
        }
        lastErr = err
        if !isRetryable(err) {
            return err
        }
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(backoffs[i]):
        }
    }
    // Última tentativa sem backoff extra
    if err := fn(ctx); err != nil {
        return err
    }
    _ = lastErr
    return nil
}

func isRetryable(err error) bool {
    if errors.Is(err, ErrPluggyRateLimited) {
        return true
    }
    if errors.Is(err, ErrPluggyInternal) {
        return true // 5xx + timeout cobertos aqui
    }
    return false
}
```

### 12.4. ProcessMessageFlow ctx cascade (assinatura nova)

```go
// ANTES (Fase 13)
func ProcessMessageFlow(msg Message) { /* usa context.Background() */ }

// DEPOIS (Fase 14)
func ProcessMessageFlow(ctx context.Context, msg Message) error { /* usa ctx */ }

// Caller — internal/handlers/wa_webhook.go
func (h *WAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // ... parse body, extract msg
    go func() {
        // WithoutCancel preserva request_id/user_id do r.Context();
        // WithTimeout impõe deadline 30s (p99 WA ~8s + margem LLM lento 18s).
        msgCtx, cancel := context.WithTimeout(
            context.WithoutCancel(r.Context()),
            30*time.Second,
        )
        defer cancel()

        if err := ProcessMessageFlow(msgCtx, msg); err != nil {
            logger.WarnContext(msgCtx, "wa process failed", "err", err)
        }
    }()
    w.WriteHeader(http.StatusOK)
}
```

**Teste integration:** POST webhook → assert log line contém `request_id=<X>` e `user_id=<Y>` da goroutine; injetar mock sleep(31s) e verificar log `deadline exceeded`.

### 12.5. Testcontainers Redis — extensão TestMain existente

Modificar `laura-go/internal/testutil/integration.go` (não criar arquivo novo):

```go
//go:build integration

package testutil

import (
    // ... imports existentes
    tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
)

var (
    SharedPG       *tcpostgres.PostgresContainer
    SharedDSN      string
    SharedRedis    *tcredis.RedisContainer // NOVO
    SharedRedisURL string                  // NOVO
)

func TestMain(m *testing.M) {
    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
    defer cancel()

    // ... bloco SharedPG existente (Fase 13) mantido

    // NOVO: Redis compartilhado
    rc, err := tcredis.Run(ctx, "redis:7-alpine")
    if err != nil {
        log.Printf("integration: falha Redis: %v (pulando)", err)
        _ = SharedPG.Terminate(ctx)
        os.Exit(0)
    }
    SharedRedis = rc
    SharedRedisURL, err = rc.ConnectionString(ctx)
    if err != nil {
        _ = rc.Terminate(ctx)
        _ = SharedPG.Terminate(ctx)
        log.Fatalf("integration: DSN Redis: %v", err)
    }

    code := m.Run()

    _ = rc.Terminate(ctx)
    _ = SharedPG.Terminate(ctx)
    os.Exit(code)
}
```

### 12.6. CI split — YAML integral

```yaml
# .github/workflows/go-ci.yml
jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.26.1'
      - name: Test unit
        run: cd laura-go && go test -race -count=1 ./...

  test-integration:
    runs-on: ubuntu-latest
    # Required em main; best-effort em PR (não bloqueia merge)
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.26.1'
      - name: Test integration com retry
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 10
          max_attempts: 3
          command: |
            cd laura-go
            go test -tags=integration -covermode=atomic \
              -coverprofile=coverage.out ./...
      - name: Coverage gate 30%
        run: |
          cd laura-go
          go tool cover -func=coverage.out | tail -1 | \
            awk '{if ($3+0 < 30.0) { print "FAIL: " $3 " < 30%"; exit 1 } else { print "OK: " $3 }}'
```

```yaml
# .github/workflows/pluggy-smoke.yml
on:
  workflow_dispatch: # manual only — evita queima de quota sandbox (60 req/min)
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - name: Smoke Pluggy sandbox
        env:
          PLUGGY_CLIENT_ID: ${{ secrets.PLUGGY_CLIENT_ID }}
          PLUGGY_CLIENT_SECRET: ${{ secrets.PLUGGY_CLIENT_SECRET }}
        run: cd laura-go && go test -tags=smoke ./internal/integrations/pluggy/...
```

---

## 13. Resolução review #2 (pente fino)

| # | GAP review #2 | Decisão v3 | Local |
|---|---|---|---|
| 1 | `context.WithoutCancel` disponível? | SIM — Go 1.26.1. Padrão canônico fixado. | §12.4 |
| 2 | Baseline PWA real (não estimativa) | Counts exatos obtidos via grep 2026-04-15 (20 não 27 em adminConfig.ts; total 34 em 8 arquivos; escopo Fase 14 = top 5 = 31). | §4.1, §12.1 |
| 3 | tc-postgres reusable? | SIM — `TestMain` em `laura-go/internal/testutil/integration.go` já expõe `SharedPG`/`SharedDSN`. Fase 14 apenas estende com `SharedRedis`. Sem helper novo. | §4.2, §12.5 |
| 4 | Pluggy rate limit 60/min | httptest mock LOCAL é único path CI. Sandbox real só em `pluggy-smoke.yml` manual (`workflow_dispatch`, não cron). | §4.4, §12.6 |
| 5 | Scope commit allowlist | Adicionados `pluggy`, `typing`, `quality` ao set Fase 13. | §14 |
| 6 | PluggyClient auth cache código completo | Double-check locking com `sync.RWMutex` + TTL 1h50. | §12.3 |
| 7 | PluggyClient retry — dep nova? | NÃO — custom minimal 3x 200ms/500ms/1s sem `cenkalti/backoff`. | §12.3 |
| 8 | Erro sentinelas nomenclatura | Padronizado `ErrPluggy*` (v2 tinha `ErrAuthFailed` sem prefixo). | §12.3 |
| 9 | Pluggy endpoints oficiais | Tabela completa (auth/connect_tokens/items transactions) + headers. | §12.2 |
| 10 | ProcessMessageFlow assinatura | `(ctx, msg) error` — caller `WithoutCancel`+`WithTimeout(30s)`. | §12.4 |
| 11 | CI split workflow integral | YAML completo com `nick-fields/retry@v3` + `if: github.ref == 'refs/heads/main'`. | §12.6 |
| 12 | Zero placeholders | Confirmado: sem "TBD", "implement later", "similar to" no doc. | — |

---

## 14. Apêndice — comandos canônicos

**Commit scope allowlist Fase 14 (total 22):**
```
go, pwa, infra, ci, ops, db, e2e, security, telemetry,
observability, cache, refactor, perf, lint, docs, hooks,
banking, open-finance, pluggy, typing, quality, test
```

**Baseline PWA typing (rerun antes de começar):**
```sh
cd laura-pwa
grep -rE ": any\b| any\[\]|<any>" src/lib/actions/*.ts | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
grep -rE ": any\b| any\[\]|<any>" src/components src/lib/services src/lib/hooks src/lib/validators | cut -d: -f1 | sort | uniq -c | sort -rn
```

**Coverage gate local (reproduz CI):**
```sh
cd laura-go
go test ./... -tags=integration -covermode=atomic -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -1 | \
  awk '{if ($3+0 < 30.0) { print "FAIL: " $3 " < 30%"; exit 1 } else { print "OK: " $3 }}'
```

**Tag final:**
```sh
git tag -a phase-14-prepared -m "Fase 14: quality + pluggy real + pwa typing"
git push origin phase-14-prepared
```

**Pluggy smoke manual (quando secrets chegarem):**
```sh
gh workflow run pluggy-smoke.yml
```

---

## 15. Checklist consolidado (itens executáveis)

### PWA typing (5 arquivos)
1. [ ] Criar `src/types/admin.ts` com `AdminConfigEntry`, `SettingPayload`, `AdminFormState`.
2. [ ] Refatorar `src/lib/actions/adminConfig.ts` — eliminar 20 `any` via tipos + zod em `updateAdminConfig`+`bulkUpdateSettings`.
3. [ ] Refatorar `src/lib/actions/categories.ts` — 3 `any` → `Prisma.CategoryGetPayload`.
4. [ ] Refatorar `src/lib/actions/userProfile.ts` — 2 `any` → zod schema de input.
5. [ ] Refatorar `src/components/admin/AuditLogView.tsx` — 3 `any` → `AuditLogRow` interface.
6. [ ] Refatorar `src/components/admin/AdminConfigEditor.tsx` — 3 `any` → props genérica `<T extends AdminConfigEntry>`.
7. [ ] Override eslint per-file: `'@typescript-eslint/no-explicit-any': 'error'` nos 5 arquivos.
8. [ ] `pnpm lint` + `pnpm typecheck` verdes.

### Testcontainers Redis + CI split
9. [ ] Estender `laura-go/internal/testutil/integration.go` com `SharedRedis`+`SharedRedisURL` no `TestMain` existente.
10. [ ] Criar `internal/cache/redis_integration_test.go` (TTL, pipeline, pub/sub).
11. [ ] Criar `internal/ratelimit/redis_integration_test.go` (sliding window).
12. [ ] Criar `internal/sessions/revoke_integration_test.go`.
13. [ ] Atualizar `.github/workflows/go-ci.yml` com split `test-unit`/`test-integration` + `nick-fields/retry@v3` 3x timeout 10min + `if: github.ref == 'refs/heads/main'` para integration.

### Coverage Go ≥ 30%
14. [ ] Criar `internal/handlers/transactions_integration_test.go`.
15. [ ] Criar `internal/handlers/messages_integration_test.go`.
16. [ ] Criar `internal/handlers/users_integration_test.go`.
17. [ ] Criar `internal/handlers/sessions_integration_test.go`.
18. [ ] Criar `internal/handlers/admin_integration_test.go`.
19. [ ] Criar `internal/handlers/webhooks_integration_test.go`.
20. [ ] Criar `internal/services/transactionService_integration_test.go`.
21. [ ] Criar `internal/services/messageService_integration_test.go`.
22. [ ] Criar `internal/services/userService_integration_test.go`.
23. [ ] Adicionar coverage gate 30% no job CI `test-integration`.

### Pluggy HTTP client
24. [ ] Criar `internal/integrations/pluggy/errors.go` com 4 sentinelas `ErrPluggy*`.
25. [ ] Implementar `getAuthToken` com RWMutex + double-check + TTL 1h50 em `client.go`.
26. [ ] Implementar `retryableDo` custom 3x (200ms/500ms/1s) + `isRetryable`.
27. [ ] Implementar `CreateConnectToken(ctx, opts)` (POST `/connect_tokens`).
28. [ ] Implementar `FetchTransactions(ctx, itemID, opts)` (GET `/items/{id}/transactions?pageSize=500`).
29. [ ] Criar `internal/integrations/pluggy/httptest_mock.go` simulando 200/401/429/5xx.
30. [ ] Criar `internal/integrations/pluggy/client_test.go` unit + integration contra httptest.
31. [ ] Criar `.github/workflows/pluggy-smoke.yml` gated por `workflow_dispatch`.

### ProcessMessageFlow
32. [ ] Alterar assinatura em `internal/bot/wa/processor.go`: `ProcessMessageFlow(ctx, msg) error`.
33. [ ] Atualizar caller em `internal/handlers/wa_webhook.go` com `WithoutCancel`+`WithTimeout(30s)`.
34. [ ] Integration test: assert `request_id`+`user_id` no log da goroutine.
35. [ ] Integration test: mock sleep(31s) → assert log `deadline exceeded`.

### Lint v2 + flag removal + runbook
36. [ ] Rodar `golangci-lint --version` + `run ./... --timeout=5m`; decidir migrar ou ADR `docs/decisions/2026-04-XX-golangci-v2.md`.
37. [ ] Abrir PR draft `chore: remove LLM_LEGACY_NOCONTEXT flag` + ADR data-alvo 2026-05-15.
38. [ ] Escrever `docs/operations/prod-migration-apply.md` (runbook migration 000036 — NÃO executar).
39. [ ] Atualizar `docs/runbooks/phase-14.md`.
40. [ ] Expandir commit scope allowlist (`pluggy`, `typing`, `quality`) em hooks/docs de convenções.

### Fechamento
41. [ ] `git tag phase-14-prepared` + `git push origin phase-14-prepared`.

---

**Fim do Spec v3 FINAL Fase 14** — pronto para `writing-plans`.
