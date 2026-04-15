# Fase 14 — Quality Maturation + Pluggy Integration Real + PWA Typing (Spec v2)

> Versão: v2 (pós review #1)
> Data: 2026-04-15
> Autor: arquiteto sênior
> Status: aprovada para plan v1
> Substitui: v1 (`2026-04-15-fase-14-quality-pluggy-v1.md`)

---

## Mudanças vs v1 (delta review #1)

1. **DoD endurecido:** coverage Go **≥ 30% hard gate** (não mais "aceitamos 25%"); build falha abaixo.
2. **CI split com retry explícito:** `nick-fields/retry@v3` 3x + timeout 10min; `test-integration` required em main, opcional em PR.
3. **Smoke Pluggy:** workflow `.github/workflows/pluggy-smoke.yml` cron diário (02:00 UTC) após secrets chegarem; manual nesta fase via doc.
4. **LLM_LEGACY_NOCONTEXT:** janela fixada em T+30d = **2026-05-15** (hoje 2026-04-15 é D0 do prod Fase 13).
5. **tRPC/hono descartado** desta fase — backlog Fase 15+. PWA mantém Server Actions + zod inline.
6. **ProcessMessageFlow deadline:** **30s hard** (cobre p99 WA ~8s + margem LLM lento até 18s p99 observado).
7. **golangci-lint v2:** critério objetivo — local zero issues ⇒ reabilita CI; senão mantém v1 + ADR.
8. **Migration 000036:** **NÃO** aplica em prod nesta fase (depende STANDBY FLY-PG-CREATE); apenas runbook.
9. **Fixture isolation:** transaction-per-test (BEGIN/ROLLBACK defer) para Postgres; miniredis-dedicado ou tc-redis por suite Redis.
10. **Taxonomia Pluggy:** 4 sentinelas exportadas (`ErrRateLimited`, `ErrAuthFailed`, `ErrNotFound`, `ErrInternal`); retry 3x com backoff exponencial **dentro do client**, caller recebe erro final tipado.

---

## 1. Objetivo

Fechar os 8 concerns residuais da Fase 13, convertendo "fundação preparada" em **fundação testada com integração Pluggy real**. Três eixos paralelos:

1. **Quality maturation** — coverage Go 30% (hard gate), testcontainers Redis real, CI split unit/integration com retry, lint v2 reavaliação.
2. **Pluggy integration real** — HTTP client completo (`POST /auth` → cache token → `POST /connect_tokens` + `GET /items/{id}/transactions`) com taxonomia de erros + retry interno.
3. **PWA typing sprint 1 real** — 27 `any` em `adminConfig.ts` + 4 arquivos complementares; zod em endpoints de borda.

Entregável: tag **`phase-14-prepared`** com CI verde, coverage Go ≥ 30%, `no-explicit-any` zero nos 5 arquivos PWA, Pluggy sandbox funcional em dev (ou httptest mock + `blocked:creds` se credenciais atrasarem).

## 2. Contexto e motivação

(Inalterado em relação a v1.) Fases 10–13 entregaram ~190 commits e 4 tags `phase-*-prepared`, com 8 concerns deliberadamente postergados. Fase 14 fecha o ciclo.

## 3. Escopo

### 3.1. Dentro

1. PWA typing sprint 1 real — `adminConfig.ts` (27 `any`) + 4 arquivos (`settings-sync.ts`, `useAdminForm.ts`, `ConfigTable.tsx`, `adminSchemas.ts`).
2. Testcontainers Redis singleflight + CI split `test-unit` / `test-integration` com retry v3 3x.
3. Coverage Go ≥ 30% via integration tests em handlers/services (pgxpool real + tc-postgres).
4. Pluggy HTTP client real (auth + connect_tokens + transactions) com cache + retry + taxonomia.
5. ProcessMessageFlow ctx cascade — `context.WithoutCancel` + deadline 30s.
6. golangci-lint v2 reavaliação com critério objetivo.
7. `LLM_LEGACY_NOCONTEXT` PR draft + ADR data-alvo 2026-05-15.
8. Migration 000036 — runbook documentado (NÃO aplica em prod nesta fase).

### 3.2. Fora (Fase 15+)

Pub/sub Redis cross-instance, mobile nativo, multi-region DB, Pluggy webhooks, LLM context advanced, SLO alertas paginados, tRPC/hono.

## 4. Pendências detalhadas

### 4.1. PWA typing sprint 1 real

(Mantida spec v1. Arquivos + estratégia + critério iguais.)

### 4.2. Testcontainers Redis + CI split

**Mudança v2:** retry policy explicitada via `nick-fields/retry@v3` 3x, timeout 10min, `test-integration` required em main apenas (PR opcional).

### 4.3. Coverage Go 30% (hard gate)

**Mudança v2:** gate CI fail-hard abaixo de 30% (não "aceita 25%"). Sem escape hatch — se não atingir, release bloqueado e tasks adicionais de teste entram no plan.

### 4.4. Pluggy HTTP client real

**Mudança v2:** taxonomia formalizada com 4 sentinelas `errors.Is`-compatíveis; retry interno 3x com backoff exponencial (100ms, 400ms, 1600ms) em 5xx/429/timeout; auth flow documentado em código (seção 12.3).

### 4.5. ProcessMessageFlow ctx cascade

**Mudança v2:** deadline confirmada em 30s (cobre p99 18s + margem). Detalhamento de implementação em seção 12.4.

### 4.6. golangci-lint v2

**Mudança v2:** critério objetivo: `golangci-lint --version` >= v2.0 + `golangci-lint run ./...` zero issues ⇒ job reabilitado; senão mantém v1 + ADR.

### 4.7. LLM_LEGACY_NOCONTEXT flag removal

**Mudança v2:** data-alvo fixada **2026-05-15** (T+30d do deploy Fase 13 em 2026-04-15).

### 4.8. Migration 000036

**Mudança v2:** **NÃO aplica em prod nesta fase**. Depende de STANDBY `FLY-PG-CREATE` (provisionamento DB). Apenas runbook + procedimento.

## 5. Decisões de arquitetura

(5.1–5.6 mantidas de v1; 5.4 detalhada com retry/taxonomia; 5.5 detalhada com snippet.)

## 6. STANDBYs

**Bloqueantes para item 4.4 (Pluggy):**
- `[PLUGGY-CLIENT-ID]`
- `[PLUGGY-CLIENT-SECRET]`

Se não chegarem: item 4.4 entregue como **"client pronto + httptest smoke + label `blocked:creds`"**. Tag `phase-14-prepared` sai mesmo assim.

**Não bloqueantes:** `[REDIS-INSTANCE]` Upstash (tc-redis cobre dev/CI), Sentry DSN, UptimeRobot, FLY-PG-CREATE (impacta só 4.8 — runbook-only).

## 7. DoD (Definition of Done)

- [ ] `pnpm lint` zero `no-explicit-any` em 5 arquivos alvo.
- [ ] `pnpm typecheck` verde.
- [ ] `go test ./... -tags=integration -covermode=atomic -coverprofile=coverage.out` verde.
- [ ] **Coverage Go ≥ 30% (hard gate, CI falha abaixo).**
- [ ] Testcontainers Redis singleflight + ≥ 8 integration tests.
- [ ] CI split `test-unit` + `test-integration`; retry@v3 3x; timeout 10min.
- [ ] `test-integration` required em main; PR opcional.
- [ ] Pluggy auth flow funcional em sandbox (httptest mock se creds ausentes).
- [ ] Pluggy `CreateConnectToken` + `FetchTransactions` com taxonomia erros.
- [ ] ProcessMessageFlow: ctx propagado com `WithoutCancel` + deadline 30s; teste assert `request_id` no log.
- [ ] golangci-lint: v2 migrado OU ADR documentando adiamento.
- [ ] PR draft `LLM_LEGACY_NOCONTEXT` removal + ADR data-alvo 2026-05-15.
- [ ] Runbook `docs/operations/prod-migration-apply.md` existe (apply NÃO executado).
- [ ] `.github/workflows/pluggy-smoke.yml` cron diário criado (disabled até secrets).
- [ ] Tag `phase-14-prepared` + push.

## 8. Riscos

(Mantidos v1, com mitigação adicional em #3: retry@v3 3x + timeout 10min concretamente endereçam DinD flakiness.)

## 9. Métricas de sucesso

Coverage Go ≥ 30%, `no-explicit-any` ≤ 5 total PWA, 1 connect_token + ≥1 tx real sandbox, CI unit ≤3min / integration ≤10min, 100% correlação `request_id` WA.

## 10. Plano de testes

(Mantido v1: unit adminConfig + client Pluggy httptest; integration handlers/services/redis; E2E smoke manual ou automatizado se secrets.)

---

## 11. Resolução questões v1 → decisão final

| # | Questão v1 | Decisão v2 |
|---|---|---|
| 1 | Coverage 30% viável? | **SIM — hard gate.** Integration tests via tc-postgres cobrem handlers/services; sem escape hatch. |
| 2 | Flakiness CI policy | `nick-fields/retry@v3` 3x + timeout 10min por job. |
| 3 | Pluggy smoke automatizado vs manual | **Manual nesta fase.** Workflow `pluggy-smoke.yml` cron diário criado disabled; ativa quando secrets chegarem. |
| 4 | LLM_LEGACY_NOCONTEXT janela | **30d = 2026-05-15** (T+30d do deploy Fase 13 em 2026-04-15). |
| 5 | tRPC/hono | **Não nesta fase.** Backlog Fase 15+. Mantém Server Actions + zod PWA-side. |
| 6 | Deadline ctx ProcessMessageFlow | **30s hard.** Cobre p99 WA (~8s) + LLM lento (p99 18s observado) + margem. |
| 7 | Critério corte golangci v2 | Local `--version` ≥ v2.0 + `run ./...` zero issues ⇒ reabilita CI; senão mantém v1 + ADR. |
| 8 | Migration 000036 apply | **NÃO aplica nesta fase.** Depende de STANDBY FLY-PG-CREATE. Apenas runbook. |
| 9 | Fixture isolation | **Transaction-per-test** (BEGIN/ROLLBACK defer) Postgres; miniredis ou tc-redis dedicado por suite Redis; httptest para Pluggy. |
| 10 | Taxonomia erros Pluggy | **Retry interno 3x backoff exp** no client (5xx/429/timeout); caller recebe `pluggy.ErrRateLimited`/`ErrAuthFailed`/`ErrNotFound`/`ErrInternal` tipado. |

---

## 12. Detalhes técnicos novos

### 12.1. PWA typing — script de identificação

```sh
cd laura-pwa

# Top 10 arquivos com any (actions)
grep -rln ": any\b\| any\[\]\|<any>" src/lib/actions/*.ts | head -10

# Count específico adminConfig (esperado 27)
grep -cE ": any\b| any\[\]|<any>" src/lib/actions/adminConfig.ts

# Full PWA sweep
grep -rnE ": any\b| any\[\]|<any>" src/ --include="*.ts" --include="*.tsx" | wc -l
```

**Fluxo:** extrair tipos canônicos em `src/types/admin.ts` → substituir `any` por tipos → adicionar zod em borda (server actions) → habilitar `@typescript-eslint/no-explicit-any: error` per-file override.

### 12.2. Testcontainers Redis — skeleton compartilhado

```go
//go:build integration

package testutil

import (
    "context"
    "sync"

    tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
)

var (
    sharedRedisOnce sync.Once
    SharedRedis     *tcredis.RedisContainer
    SharedRedisURL  string
    sharedRedisErr  error
)

func EnsureSharedRedis(ctx context.Context) (string, error) {
    sharedRedisOnce.Do(func() {
        SharedRedis, sharedRedisErr = tcredis.Run(ctx, "redis:7-alpine")
        if sharedRedisErr != nil {
            return
        }
        SharedRedisURL, sharedRedisErr = SharedRedis.ConnectionString(ctx)
    })
    return SharedRedisURL, sharedRedisErr
}
```

**Integração:** chamar `EnsureSharedRedis(ctx)` no `TestMain` da Fase 13 Parte G.1 (já existe TestMain com tc-postgres). Um container por package, reusado em todos os `TestXxx`.

### 12.3. Pluggy auth flow

```go
// internal/integrations/pluggy/auth.go
type authResp struct {
    APIKey string `json:"apiKey"`
}

func (c *Client) auth(ctx context.Context) (string, error) {
    body, _ := json.Marshal(map[string]string{
        "clientId":     c.clientID,
        "clientSecret": c.clientSecret,
    })
    req, err := http.NewRequestWithContext(ctx, http.MethodPost,
        c.baseURL+"/auth", bytes.NewReader(body))
    if err != nil {
        return "", fmt.Errorf("pluggy: build auth req: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.http.Do(req)
    if err != nil {
        return "", fmt.Errorf("%w: %v", ErrInternal, err)
    }
    defer resp.Body.Close()

    switch resp.StatusCode {
    case http.StatusOK:
        var a authResp
        if err := json.NewDecoder(resp.Body).Decode(&a); err != nil {
            return "", fmt.Errorf("%w: decode auth: %v", ErrInternal, err)
        }
        return a.APIKey, nil
    case http.StatusUnauthorized, http.StatusForbidden:
        return "", ErrAuthFailed
    case http.StatusTooManyRequests:
        return "", ErrRateLimited
    default:
        return "", fmt.Errorf("%w: status %d", ErrInternal, resp.StatusCode)
    }
}

// Taxonomia exportada
var (
    ErrRateLimited = errors.New("pluggy: rate limited")
    ErrAuthFailed  = errors.New("pluggy: auth failed")
    ErrNotFound    = errors.New("pluggy: not found")
    ErrInternal    = errors.New("pluggy: internal")
)
```

**Cache:** `authTokenCache` struct com `sync.Mutex` + `expiresAt time.Time`; refresh 5min antes do vencimento (TTL Pluggy 2h ⇒ cache válido 1h55).

**Retry:** wrapper `doWithRetry(req)` 3 tentativas, backoff 100ms/400ms/1600ms em 5xx/429/timeout.

### 12.4. ProcessMessageFlow ctx cascade

**Tasks granulares:**

1. Identificar caller no handler HTTP (`internal/handlers/wa_webhook.go`).
2. Alterar assinatura: `ProcessMessageFlow(ctx context.Context, msg Message) error`.
3. No handler, derivar ctx antes da goroutine:
```go
// handler retorna 200 imediatamente; goroutine continua com ctx desacoplado + valores preservados
go func() {
    msgCtx, cancel := context.WithTimeout(
        context.WithoutCancel(r.Context()), // preserva request_id/user_id
        30*time.Second,
    )
    defer cancel()

    if err := ProcessMessageFlow(msgCtx, msg); err != nil {
        logger.WarnContext(msgCtx, "wa process failed", "err", err)
    }
}()
w.WriteHeader(http.StatusOK)
```
4. Integration test: webhook POST → assert log line contém `request_id=<X>` e `user_id=<Y>` da goroutine.
5. Assert deadline: injetar `sleep(31s)` mockado e verificar log `deadline exceeded`.

### 12.5. golangci-lint v2 check

```sh
# Check local
golangci-lint --version

# Se >= v2.0, tentar run
golangci-lint run ./... --timeout=5m

# Decisão:
# - zero issues ⇒ atualizar .github/workflows/go-ci.yml (reabilita job lint)
# - N > 0 issues ⇒ manter v1, documentar em docs/decisions/2026-04-XX-golangci-v2.md
```

---

**Fim do Spec v2 Fase 14** — pronto para `writing-plans`.
