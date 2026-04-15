# Fase 12 — Refactoring + Performance + Dívida Técnica (Spec v2)

> Versão: v2 (pós Review #1)
> Data: 2026-04-15
> Autor: arquiteto sênior (review)
> Status: canônica — substitui v1
> Baseline: v1 (2026-04-15)

---

## 0. Mudanças vs v1

1. Resolvidas 10 questões abertas do Self-review v1 (decisões definitivas em §11).
2. Redis fixado como **Upstash managed** (TLS + REST + binary) com fallback in-memory LRU para graceful degradation.
3. `no-explicit-any`: mantido como `warn` globalmente; novos arquivos `src/lib/actions/*` passam a rodar com `--max-warnings=0` via ESLint overrides + filtro de path no CI (lint-staged-style).
4. Migrations: adotado **`go:embed` canônico**. Fonte única passa a ser `laura-go/internal/migrations/*.sql`. `infrastructure/migrations/` deletada. Dockerfile sem `COPY` de SQLs.
5. Decomposição `main.go` detalhada em 7 arquivos novos (§12.1) com responsabilidades isoladas.
6. Cache helper genérico `cache.GetOrCompute[T]` definido em pseudocódigo (§12.2), com TTLs canônicos por domínio (§12.3).
7. Pool pgx tunado para **Fly small machine 512MB** (valores em §12.4) — substitui números da v1 (25 conns era alto demais para 512MB).
8. Testcontainers-go centralizado via `TestMain` reusável entre suítes (§12.5).
9. Fixture HMAC do `api_e2e_test.go` detalhada com diff esperado (§12.6).
10. 13 ocorrências gosec G104 enumeradas + plano de 1 commit por handler (§12.7).
11. 5 diagramas mermaid definidos para `docs/architecture.md` (§12.8).
12. Kill-switch `CACHE_DISABLED=true` adicionado como env var desde D1.
13. Coverage Go mantido em 30% nesta fase; 50% empurrado para Fase 13 (evita escopo-creep).
14. Big-bang em `ChatCompletion(ctx, ...)` com flag `LLM_LEGACY_NOCONTEXT=true` de rollback.
15. Playwright CI via `docker-compose.ci.yml` (mais flexível que GH Services, reusa em dev).

---

## 1. Objetivo

Eliminar dívida técnica acumulada nas fases 1–11 do Laura Finance, reorganizar o backend Go em módulos coesos, zerar warnings de lint em código novo no PWA, introduzir camada de cache Redis (Upstash) para endpoints quentes, consolidar migrations e publicar documentação de arquitetura — sem depender das credenciais externas bloqueadas (STANDBYs das fases 10–11, exceto `[REDIS-INSTANCE]`).

Metas quantitativas (inalteradas vs v1):

- `laura-go/main.go` < 100 linhas.
- PWA `npm run lint` em `src/lib/actions/*` novos: **0 errors, 0 warnings** (`--max-warnings=0`).
- PWA global: errors 0; warnings podem persistir (backlog controlado).
- Coverage Go `internal/` > **30%** (Fase 13 eleva a 50%).
- Cache-hit ratio em `/dashboard`, `/score/snapshot`, `/reports/*` > **80%** pós warm-up.
- E2E Playwright full-suite em CI < 10min.
- `docs/architecture.md` publicado com 5 diagramas mermaid.

## 2. Contexto e motivação

(Mesmo de v1 — omitido por brevidade; válido integralmente.)

## 3. Escopo

### 3.1. Dentro do escopo (22 itens)

Idêntico ao v1 — 7 blocos, 22 itens. Ver v1 §3.1.

### 3.2. Fora do escopo

- i18n (Fase 13).
- Open Finance real (Fase 14+).
- PWA RUM Sentry (Fase 13).
- Promoção `no-explicit-any` a `error` global (Fase 13 após zerar backlog).
- Event-driven cache invalidation cross-instance (Fase 13 via pub/sub).
- Sentry IaC via Terraform (Fase 13+).
- Coverage > 30% (Fase 13 visa 50%).

## 4. Pendências detalhadas agrupadas

Conteúdo da v1 §4.1–§4.7 válido integralmente, com os seguintes ajustes:

### 4.1. (refactoring backend) — Item 1

Substitui a lista genérica por §12.1 (7 arquivos nominados).

### 4.2. (correção testes + lint) — Item 8

`no-explicit-any` global permanece `warn`. Em `src/lib/actions/*`, `src/lib/services/*` e `src/types/*` adicionar override ESLint:

```json
{
  "overrides": [{
    "files": ["src/lib/actions/**/*.ts", "src/lib/services/**/*.ts", "src/types/**/*.ts"],
    "rules": { "@typescript-eslint/no-explicit-any": "error" }
  }]
}
```

CI roda `npx eslint src/lib/actions src/lib/services src/types --max-warnings=0` como gate adicional. Resto do código não-novo continua com warn até Fase 13.

Detalhes da fixture (item 2) em §12.6; gosec G104 (item 4) em §12.7.

### 4.3. (cache + performance)

Item 12 fixa **Upstash managed** em produção. `REDIS_URL` vem de secret Fly. Fallback in-memory LRU (`hashicorp/golang-lru/v2`) ativa automaticamente quando:
- `REDIS_URL` ausente/vazio.
- `cache.Redis.Ping()` falha por mais de 5s em boot.
- Env `CACHE_DISABLED=true` (kill-switch).

Item 11: TTLs canônicos em §12.3. Invalidação: **apenas TTL nesta fase**. Event-driven fica para Fase 13.

Item 13: pool tuning definitivo em §12.4.

### 4.4. (infraestrutura) — Item 14

**Decisão final:** `go:embed` canônico. Passos:

1. Mover todos os SQLs de `infrastructure/migrations/*.sql` para `laura-go/internal/migrations/` (merge + resolver duplicatas).
2. Adicionar `//go:embed *.sql` em `laura-go/internal/migrations/migrations.go`.
3. Remover `COPY infrastructure/migrations/` do `laura-go/Dockerfile`.
4. Deletar diretório `infrastructure/migrations/` (git rm).
5. Atualizar README principal apontando nova fonte canônica.

### 4.5. / 4.6. / 4.7.

Sem mudanças materiais; seguem v1. Detalhes de `architecture.md` em §12.8.

## 5. Decisões de arquitetura

Mesmas 5 decisões da v1, reforçadas por §11.

## 6. Pré-requisitos / dependências externas (STANDBY)

- **`[REDIS-INSTANCE]`** — URL Upstash (formato `rediss://default:<token>@<host>:6379`) — único STANDBY. Solicitar ao usuário antes da subfase 4.3 (cache). Subfases 4.1/4.2/4.4/4.5/4.6/4.7 independem dele (fallback in-memory LRU cobre dev/CI).

## 7. Critérios de aceite (DoD)

(Idênticos à v1 + 3 adicionais:)

- [ ] `CACHE_DISABLED=true` em runtime retorna `X-Cache: DISABLED` em 100% das requests (teste manual + automatizado em `cache_test.go`).
- [ ] `REDIS_URL` vazio em boot → log `slog.Warn("redis unreachable, falling back to in-memory LRU")` + app continua funcional (teste integrado).
- [ ] `docs/architecture.md` com 5 diagramas mermaid renderizando no GitHub (não 3).

## 8. Riscos

Tabela da v1 válida + 2 novos:

| # | Risco | Prob | Impacto | Mitigação |
|---|-------|------|---------|-----------|
| R9 | Upstash free tier exceder 10k cmds/day em dev compartilhado | Média | Baixo | Fallback LRU automático; métricas de hits/day expostas em `/metrics`. |
| R10 | `LLM_LEGACY_NOCONTEXT` rollback mascarar regressão real | Baixa | Médio | Flag com TTL (documentar remoção na Fase 13); alerta Sentry se flag=true em prod. |

## 9. Métricas de sucesso

Tabela da v1 válida. Adicionar: `lint warnings em src/lib/actions/*`: T0=? / T1=0.

## 10. Plano de testes

Idem v1 + §12.5 (testcontainers setup).

---

## 11. Resolução de questões abertas v1 → decisão final

| # | Questão v1 | Decisão final | Justificativa |
|---|-----------|---------------|---------------|
| 1 | Redis managed vs self-hosted | **Upstash managed** | Free tier cobre dev+smoke; TLS+REST nativos; zero ops; atach via Fly. Self-hosted = +1 VM para manter sem ganho. |
| 2 | Promover `no-explicit-any` a error | **Manter warn global, error em arquivos novos** (`src/lib/actions/*`, `services/*`, `types/*`) via ESLint overrides + `--max-warnings=0` gate CI | Evita regressão em PRs concorrentes; força type-safety em código novo; promoção global Fase 13. |
| 3 | Migrations: go:embed vs COPY Dockerfile | **go:embed canônico**, SQLs em `laura-go/internal/migrations/`, `infrastructure/migrations/` deletada | Binário self-contained; hotfix = 1 lugar; remove risco de drift; elimina etapa do Dockerfile. |
| 4 | Coverage 30% vs 50% | **30% na Fase 12, 50% Fase 13** | Salto de 8.6%→30% já é big jump; 50% requer testcontainers extensivo que infla escopo. |
| 5 | Playwright docker-compose vs GH Services | **docker-compose (`docker-compose.ci.yml`)** | Reusável localmente; controle fino de healthchecks; GH Services duplica config. |
| 6 | ChatCompletion big-bang vs gradual | **Big-bang com flag `LLM_LEGACY_NOCONTEXT=true`** | Gradual dobra trabalho sem ganho; flag permite rollback emergencial. |
| 7 | Event-driven cache invalidation Fase 12 | **Não — apenas TTL** | TTLs 60–600s são aceitáveis no MVP; event-driven requer pub/sub Redis = complexidade de Fase 13. |
| 8 | `architecture.md` single vs multi-file | **Single-page** com 5 mermaid; quebrar quando >1000 linhas | Fácil de linkar/Ctrl-F; multi-file prematuro para MVP. |
| 9 | Sentry IaC | **Não — manual via UI na Fase 12**; Terraform `sentry/sentry` na Fase 13+ | 3 regras só = custo de setup IaC > benefício atual. |
| 10 | Kill-switch `CACHE_DISABLED` | **Sim — env var desde D1, default `false`** | +5min de trabalho para ganhar ferramenta crítica de debug em prod. |

---

## 12. Detalhes técnicos novos

### 12.1. Decomposição de `main.go` — 7 arquivos nomeados

Objetivo: `main.go` passa a ter apenas wiring + `ListenAndServe`. Cada responsabilidade migra para arquivo próprio:

| Arquivo novo | Responsabilidade | Export principal |
|--------------|------------------|------------------|
| `laura-go/internal/bootstrap/sentry.go` | Init Sentry + NoOp fallback | `InitSentry(cfg) (flush func(), err error)` |
| `laura-go/internal/bootstrap/otel.go` | Tracer + meter providers + shutdown | `InitOTel(ctx, cfg) (shutdown func(context.Context) error, err error)` |
| `laura-go/internal/bootstrap/logger.go` | slog com handler + sampler | `InitLogger(cfg) *slog.Logger` |
| `laura-go/internal/bootstrap/db.go` | pgxpool com pool tuning §12.4 | `InitDB(ctx, cfg) (*pgxpool.Pool, error)` |
| `laura-go/internal/bootstrap/metrics.go` | Registry Prometheus + middleware factory | `InitMetrics() *MetricsRegistry` |
| `laura-go/internal/health/handler.go` | `/health` (liveness) + `/ready` (com whatsmeow + LLM ping + DB ping + Redis ping) | `HealthHandler`, `ReadyHandler` |
| `laura-go/internal/health/handler_test.go` | Testes unit + fake deps | — |

`laura-go/internal/bootstrap/bootstrap.go` (arquivo coordenador, não novo) orquestra a chamada das 5 funções acima e monta o `App` struct.

**Meta:** `main.go` ≤ 60 linhas, apenas `ctx`, `bootstrap.Init`, `defer app.Shutdown`, `app.ListenAndServe`.

### 12.2. Cache helper `GetOrCompute` — pseudocódigo

```go
// laura-go/internal/cache/cache.go
package cache

type Cache interface {
    Get(ctx context.Context, key string) ([]byte, bool, error)
    Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
    Invalidate(ctx context.Context, pattern string) error
}

// GetOrCompute: get-or-compute com singleflight para evitar thundering herd.
// T deve ser JSON-serializable.
func GetOrCompute[T any](
    ctx context.Context,
    c Cache,
    key string,
    ttl time.Duration,
    compute func(context.Context) (T, error),
) (T, bool /*hit*/, error) {
    var zero T
    if os.Getenv("CACHE_DISABLED") == "true" {
        v, err := compute(ctx)
        return v, false, err
    }
    if raw, ok, err := c.Get(ctx, key); err == nil && ok {
        var out T
        if jsonErr := json.Unmarshal(raw, &out); jsonErr == nil {
            return out, true, nil
        }
        // cache corrupto: log + segue para compute
        slog.WarnContext(ctx, "cache unmarshal failed", "key", key)
    }
    // singleflight: só 1 goroutine computa por chave concorrente
    v, err, _ := sfGroup.Do(key, func() (any, error) {
        return compute(ctx)
    })
    if err != nil {
        return zero, false, err
    }
    typed := v.(T)
    if raw, mErr := json.Marshal(typed); mErr == nil {
        _ = c.Set(ctx, key, raw, ttl) // fire-and-forget
    }
    return typed, false, nil
}
```

Handlers plumbam `X-Cache: HIT|MISS|DISABLED` com base no bool retornado.

### 12.3. TTLs canônicos por domínio

| Endpoint | Key pattern | TTL | Racional |
|----------|-------------|-----|----------|
| `/api/v1/dashboard` | `ws:{id}:dashboard:{paramsHash}:{YYYYMM}` | **60s** | Dados do mês corrente mudam com transações novas; 60s é o maior aceitável sem parecer stale. |
| `/api/v1/score/snapshot` | `ws:{id}:score:{userId}` | **300s** | Score recalcula com job assíncrono; 5min cobre latência. |
| `/api/v1/reports/monthly` | `ws:{id}:reports:monthly:{YYYYMM}` | **600s** | Mês fechado = imutável; 10min é conservador. |
| `/api/v1/reports/categorical` | `ws:{id}:reports:cat:{paramsHash}` | **600s** | Idem. |
| `/api/v1/reports/cashflow` | `ws:{id}:reports:cash:{paramsHash}` | **600s** | Idem. |
| `/api/v1/categories` (lista) | `ws:{id}:categories:v1` | **1800s** | Raramente muda; invalidar no create/update/delete. |

### 12.4. pgxpool tuning — Fly small machine 512MB

Postgres co-locado em VM pequena suporta ~20 conns server-side. App roda 1–2 réplicas. Valores calibrados:

```env
PG_MAX_CONNS=10
PG_MIN_CONNS=2
PG_MAX_CONN_LIFETIME=30m
PG_MAX_CONN_IDLE_TIME=5m
PG_HEALTH_CHECK_PERIOD=1m
```

Racional: 10 × 2 réplicas = 20 conns, deixa margem para migrations/admin. v1 sugeria 25 — ajuste.

### 12.5. Testcontainers-go setup compartilhado

```go
// laura-go/internal/testutil/containers.go
//go:build integration

package testutil

var (
    pgContainer    testcontainers.Container
    pgDSN          string
    redisContainer testcontainers.Container
    redisURL       string
)

func TestMain(m *testing.M) {
    ctx := context.Background()
    pgContainer, pgDSN = startPostgresWithPgvector(ctx)
    redisContainer, redisURL = startRedis(ctx)
    applyMigrations(pgDSN) // usa go:embed FS
    code := m.Run()
    _ = pgContainer.Terminate(ctx)
    _ = redisContainer.Terminate(ctx)
    os.Exit(code)
}
```

Suítes downstream (`transactions_test.go`, `dashboard_test.go`, etc.) importam `testutil.PGDSN` e `testutil.RedisURL`. Reuso elimina ~30s por suíte.

Build tag `integration` separa de unit. CI roda em job dedicado com cache de imagens Docker.

### 12.6. Fixture HMAC — diff esperado em `api_e2e_test.go`

Função helper nova em `laura-go/internal/testutil/session.go`:

```go
func SignedSession(t *testing.T, userID, workspaceID string) (cookieName, cookieValue string) {
    t.Helper()
    secret := []byte(os.Getenv("SESSION_HMAC_KEY")) // mesmo segredo de prod-like test env
    payload := fmt.Sprintf("%s:%s:%d", userID, workspaceID, time.Now().Unix())
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(payload))
    sig := hex.EncodeToString(mac.Sum(nil))
    return "laura_session", payload + "." + sig
}
```

Diff esperado em `api_e2e_test.go`:

```diff
-func authenticatedRequest(t *testing.T, method, path string, body io.Reader) *http.Request {
-    req := httptest.NewRequest(method, path, body)
-    req.Header.Set("Authorization", "Bearer "+legacyJWT(t))
-    return req
-}
+func authenticatedRequest(t *testing.T, method, path string, body io.Reader) *http.Request {
+    req := httptest.NewRequest(method, path, body)
+    name, val := testutil.SignedSession(t, testUserID, testWorkspaceID)
+    req.AddCookie(&http.Cookie{Name: name, Value: val})
+    return req
+}
```

Build tag `//go:build e2e` removida — testes passam a rodar em `go test -tags=integration ./...`.

### 12.7. gosec G104 — 13 ocorrências enumeradas

Plano: **1 commit por handler**, mensagem `fix(admin): trata erro <func> (gosec G104)`.

| # | Arquivo | Função/linha aproximada | Call ignorado |
|---|---------|-------------------------|---------------|
| 1 | `internal/admin/instances.go` | `CreateInstance` | `mgr.CreateInstance(ctx, id)` |
| 2 | `internal/admin/instances.go` | `DeleteInstance` | `mgr.DeleteInstance(ctx, id)` |
| 3 | `internal/admin/instances.go` | `RestartInstance` | `mgr.Restart(ctx, id)` |
| 4 | `internal/admin/workspaces.go` | `CreateWorkspace` | `pool.Exec(ctx, ...)` |
| 5 | `internal/admin/workspaces.go` | `DeleteWorkspace` | `pool.Exec(ctx, ...)` |
| 6 | `internal/admin/users.go` | `PromoteUser` | `pool.Exec(ctx, ...)` |
| 7 | `internal/admin/users.go` | `DeactivateUser` | `pool.Exec(ctx, ...)` |
| 8 | `internal/admin/audit.go` | `ExportAudit` | `writer.Write(...)` |
| 9 | `internal/admin/billing.go` | `SetPlan` | `pool.Exec(ctx, ...)` |
| 10 | `internal/admin/billing.go` | `CancelPlan` | `pool.Exec(ctx, ...)` |
| 11 | `internal/admin/feature_flags.go` | `ToggleFlag` | `redisClient.Set(ctx, ...)` |
| 12 | `internal/admin/llm_config.go` | `RotateKey` | `secretsStore.Put(ctx, ...)` |
| 13 | `internal/admin/llm_config.go` | `DeleteKey` | `secretsStore.Delete(ctx, ...)` |

Padrão de remediação:

```go
if err := mgr.CreateInstance(ctx, id); err != nil {
    slog.ErrorContext(ctx, "create instance failed", "err", err, "instance_id", id)
    return fiber.NewError(fiber.StatusInternalServerError, "create failed")
}
```

Após correção: `gosec -quiet ./...` zera em `internal/admin/`.

### 12.8. `docs/architecture.md` — 5 diagramas mermaid

1. **Request flow** (`flowchart LR`): Browser → Vercel PWA → Cloudflare → Fly LB → Go API (Fiber) → {Postgres, Redis, LLM, WhatsApp}.
2. **Data persistence** (`erDiagram`): Workspace 1-N Transaction; Workspace 1-N Score; Workspace 1-N WhatsmeowDevice; User N-N Workspace via Membership.
3. **Observability stack** (`flowchart TB`): App → {slog→stdout→Fly, Sentry SDK→Sentry UI, OTel SDK→Collector→backend, Prometheus→/metrics→scraper}.
4. **Deploy pipeline** (`flowchart LR`): PR → GH Actions (lint+test+gosec+staticcheck+Playwright) → merge main → GHA build+push GHCR → Fly deploy (Go) + Vercel deploy (PWA) → health gate.
5. **Multi-tenant model** (`flowchart TB`): request → auth middleware extrai `workspace_id` de session HMAC → injeta em ctx → todos repos aplicam `WHERE workspace_id = $1` → cache key prefixed `ws:{id}:*`.

### 12.9. Kill-switch cache

Env var `CACHE_DISABLED` lida em `cache.GetOrCompute` (ver §12.2). Quando `true`:
- Skip do `c.Get`.
- Skip do `c.Set`.
- Header resposta: `X-Cache: DISABLED`.
- Log `slog.DebugContext(ctx, "cache disabled via env")` amostrado 1:1000.

Uso: debug de prod quando cache suspeito de stale/corrupção. Set via `fly secrets set CACHE_DISABLED=true`; TTL manual (remover em ≤24h para evitar carga).

---

## Self-review — questões abertas para review #2

1. **SESSION_HMAC_KEY em test env** — usar key fixa em `.env.test` commitada ou gerar per-run? (segurança vs repro).
2. **singleflight groups** — um global ou um por Cache instance? Global é mais simples; per-instance evita cross-talk em testes paralelos.
3. **Upstash REST vs binary protocol** — binary (via `go-redis`) é mais rápido, REST funciona em edge. Fase 12 usa binary; Fase 13 avaliar REST para eventual edge runtime.
4. **Flag `LLM_LEGACY_NOCONTEXT`** — TTL de remoção? Sugerir "remover na Fase 13" via issue.
5. **Arquitetura.md — inglês ou PT-BR?** Laura é produto BR mas doc técnico interno. Propor PT-BR consistente com specs.
6. **Invalidação de `ws:{id}:categories:v1`** — TTL 1800s é longo; adicionar invalidação event-driven apenas para categorias (contradição com decisão 7)? Avaliar.
7. **Pool tuning em réplicas múltiplas** — se escalarmos a 3 réplicas, 10×3=30 conns estoura limite do Postgres 512MB. Adicionar nota/alerta.
8. **Playwright docker-compose — onde hospedar volume de pgvector weights?** Cache de imagem vs volume nomeado.
9. **gosec G104 — 1 commit por handler = 13 commits** pode poluir histórico. Agrupar em 3–4 commits lógicos (instances, workspaces+users, billing+flags+llm)?
10. **`architecture.md` e `docs/runbooks/*`** — cross-link mútuo? Definir convenção antes de publicar.

---
