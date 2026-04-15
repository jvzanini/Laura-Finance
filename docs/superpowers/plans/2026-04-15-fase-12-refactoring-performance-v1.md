# Fase 12 — Refactoring + Performance + Dívida Técnica (Plan v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Goal:** Eliminar dívida técnica acumulada (87 lint warnings PWA, 13 gosec G104, main.go 200+ linhas, e2e tests com auth quebrada, queries sem cache, docs incompletos) sem depender de credenciais externas.

**Architecture:** Refator main.go em pacote `internal/bootstrap/` (6 arquivos: db, logger, sentry, otel, metrics, health). Cache via interface `Cache` (Redis Upstash + fallback InMemory) com helper `GetOrCompute[T]` + singleflight + TTL (60/300/600/1800s). Coverage 30% via testcontainers-go pgvector compartilhado em TestMain. Lint cleanup: 13 gosec G104 corrigidos por arquivo (3-4 commits), 87 PWA `no-explicit-any` mantidos como warn (novos arquivos `--max-warnings=0`). Stack E2E full Playwright via `docker-compose.ci.yml`. Documentação: `architecture.md` PT-BR com 5 mermaid diagrams.

**Tech Stack:** Go 1.26 + slog + golang.org/x/sync/singleflight + redis/go-redis/v9 + testcontainers-go; Next.js 16 + Playwright + docker-compose; Postgres 16 + pgvector.

---

## Parte 0 — Pré-condições

- [ ] **0.1** Rodar baseline: `cd laura-go && go vet ./... && go test ./... && gosec ./... 2>&1 | grep -c G104` — anotar contagem inicial G104 (esperado ~13). Rodar `cd apps/web && npm run lint 2>&1 | tee /tmp/lint-baseline.txt` — anotar warnings totais.
- [ ] **0.2** Verificar ambiente: `docker --version`, `docker compose version`, `go version` (>=1.26). Redis NÃO precisa estar rodando (fallback InMemory cobre). `[REDIS-INSTANCE]` em STANDBY — seguir com InMemory.
- [ ] **0.3** Criar branch `fase-12-refactoring-performance`, commit inicial vazio `chore(phase-12): inicia fase 12 — refactoring + performance`.

---

## Parte A — Refactoring main.go (extração de bootstrap — ordem TDD §12.1)

- [ ] **A.1** Criar `laura-go/internal/bootstrap/db.go` extraindo `InitDB(cfg Config) (*pgxpool.Pool, error)` de `main.go`. Aplicar tuning §12.4 via env vars (`PG_MAX_CONNS`, `PG_MIN_CONNS`, `PG_MAX_CONN_LIFETIME`, `PG_MAX_CONN_IDLE_TIME`, `PG_HEALTH_CHECK_PERIOD`). Commit: `refactor(go): extrai InitDB de main.go para bootstrap/db.go`.
- [ ] **A.2** Criar `laura-go/internal/bootstrap/db_test.go` com teste mínimo de defaults de config (sem Postgres — apenas valida parsing de env). Commit: `test(go): cobre parsing de config em bootstrap/db.go`.
- [ ] **A.3** Criar `laura-go/internal/bootstrap/logger.go` extraindo `InitLogger(env string) *slog.Logger`. Commit: `refactor(go): extrai InitLogger para bootstrap/logger.go`.
- [ ] **A.4** Criar `laura-go/internal/bootstrap/logger_test.go` validando níveis (prod=Info, dev=Debug). Commit: `test(go): cobre níveis de log em bootstrap/logger.go`.
- [ ] **A.5** Criar `laura-go/internal/bootstrap/sentry.go` extraindo `InitSentry(cfg Config) (flush func(), err error)`. Commit: `refactor(go): extrai InitSentry para bootstrap/sentry.go`.
- [ ] **A.6** Criar `laura-go/internal/bootstrap/otel.go` extraindo `InitOTel(ctx context.Context, cfg Config) (shutdown func(context.Context) error, err error)`. Commit: `refactor(go): extrai InitOTel para bootstrap/otel.go`.
- [ ] **A.7** Criar `laura-go/internal/bootstrap/metrics.go` extraindo `InitMetrics() (*fiber.App, *prometheus.Registry)`. Commit: `refactor(go): extrai InitMetrics para bootstrap/metrics.go`.
- [ ] **A.8** Criar `laura-go/internal/health/handler.go` + `handler_test.go` com `Liveness(c *fiber.Ctx) error` e `Readiness(deps Deps) fiber.Handler` (Deps: db, redis, whatsmeow, llm). Commit: `refactor(go): move /health e /ready para internal/health`.
- [ ] **A.9** Refatorar `laura-go/main.go` chamando as 5 funções `bootstrap.*` + `health.*` — reduzir para <100 linhas (orquestração apenas). Rodar `wc -l main.go` e confirmar. Commit: `refactor(go): reduz main.go a orquestração (<100 linhas)`.
- [ ] **A.10** Rodar `go vet ./... && go test ./...`. Commit: `test(go): valida build pós-refactor bootstrap`.

---

## Parte B — Lint + Tests (cleanup dívida técnica)

### B.1 — gosec G104 (3-4 commits §12.7)

- [ ] **B.1.1** Rodar `cd laura-go && gosec ./... 2>&1 | grep G104 | tee /tmp/g104.txt` para lista exata por arquivo.
- [ ] **B.1.2** Corrigir `internal/admin/admin_whatsapp.go` (padrão §12.7 remediação). Commit: `fix(security): trata erros ignorados em admin_whatsapp.go (gosec G104)`.
- [ ] **B.1.3** Corrigir `internal/admin/admin_categories.go`. Commit: `fix(security): trata erros ignorados em admin_categories.go (gosec G104)`.
- [ ] **B.1.4** Corrigir `internal/admin/admin_users.go`. Commit: `fix(security): trata erros ignorados em admin_users.go (gosec G104)`.
- [ ] **B.1.5** Corrigir `internal/admin/admin_stats.go` + resto. Validar `gosec ./... 2>&1 | grep -c G104` == 0. Commit: `fix(security): trata erros ignorados em admin_stats.go (gosec G104)`.

### B.2 — HMAC fixture + e2e tag removal (§13.13)

- [ ] **B.2.1** Criar `.env.test` com `SESSION_HMAC_KEY=<32-bytes-base64-determinístico>` (gerar via `openssl rand -base64 32`). Criar `.env.test.example` documentando formato. Adicionar `.env.test` ao `.gitignore`? **NÃO** — commitar (valor de teste, não secret). Commit: `chore(e2e): adiciona .env.test com SESSION_HMAC_KEY determinística`.
- [ ] **B.2.2** Criar `laura-go/internal/testutil/session.go` com `SignedSession(t, userID, workspaceID) *http.Cookie` (código canônico §13.13). Commit: `test(e2e): adiciona helper SignedSession HMAC em testutil`.
- [ ] **B.2.3** Refatorar `laura-go/internal/handlers/api_e2e_test.go`: substituir `authenticatedRequest` por versão com `testutil.SignedSession`; remover `//go:build e2e`. Commit: `test(e2e): migra api_e2e_test para HMAC cookie fixture + remove build tag`.
- [ ] **B.2.4** Rodar `go test ./internal/handlers/...` e validar passing. Commit: `test(e2e): valida api_e2e_test pós-migração HMAC`.

### B.3 — Testcontainers + Coverage

- [ ] **B.3.1** Adicionar deps: `go get github.com/testcontainers/testcontainers-go github.com/testcontainers/testcontainers-go/modules/postgres`. Commit: `chore(go): adiciona testcontainers-go para integration tests`.
- [ ] **B.3.2** Criar `laura-go/test/testmain.go` com `//go:build integration`, exportando `PGDSN` e `RedisURL`, com `startPostgresWithPgvector`, `startRedis`, `applyMigrations`, `stopAll` (§13.15). Commit: `test(go): adiciona TestMain compartilhado com testcontainers pgvector`.
- [ ] **B.3.3** Adicionar job `coverage` ao `.github/workflows/go-ci.yml` rodando `go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./...` + asserção `>= 30%` via `go tool cover -func=coverage.out | grep total | awk '{if ($3+0 < 30.0) exit 1}'`. Commit: `ci(go): instrumenta coverage >= 30% em integration tests`.

### B.4 — PWA lint gate

- [ ] **B.4.1** Editar `apps/web/.eslintrc.*` adicionando override para `src/lib/actions/**`, `src/lib/services/**`, `src/types/**` com `no-explicit-any: error`. Warnings globais seguem como warn. Commit: `fix(pwa): eleva no-explicit-any a error em lib/actions + services + types`.
- [ ] **B.4.2** Zerar `no-explicit-any` nos 3 diretórios (substituir por tipos concretos ou `unknown` + type guards). Rodar `npx eslint src/lib/actions src/lib/services src/types --max-warnings=0` até verde. Commit: `fix(pwa): zera no-explicit-any em lib/actions + services + types`.
- [ ] **B.4.3** Resolver 6 warnings `react-hooks/exhaustive-deps` + 8 `react/no-unescaped-entities` (arquivos variados). Commit: `fix(pwa): resolve 14 warnings react-hooks + unescaped-entities`.
- [ ] **B.4.4** Adicionar gate ao CI `.github/workflows/pwa-ci.yml`: `npx eslint src/lib/actions src/lib/services src/types --max-warnings=0`. Commit: `ci(pwa): adiciona gate --max-warnings=0 para dirs críticos`.

---

## Parte C — Cache + Performance

- [ ] **C.1** Adicionar deps: `go get github.com/redis/go-redis/v9 github.com/hashicorp/golang-lru/v2 golang.org/x/sync/singleflight`. Commit: `chore(go): adiciona go-redis/v9 + golang-lru/v2 + singleflight`.
- [ ] **C.2** Criar `laura-go/internal/cache/cache.go` com interface `Cache` + `GetOrCompute[T]` + `var sg singleflight.Group` global (código canônico §12.2). Commit: `feat(cache): adiciona interface Cache + GetOrCompute com singleflight global`.
- [ ] **C.3** Criar `laura-go/internal/cache/cache_test.go` com casos: HIT, MISS, DISABLED, unmarshal fail, compute error, singleflight dedup (2 goroutines mesma key → 1 compute). Commit: `test(cache): cobre GetOrCompute com HIT/MISS/DISABLED/singleflight`.
- [ ] **C.4** Criar `laura-go/internal/cache/redis.go` com `RedisCache` impl via `go-redis/v9`. Métodos: `Get`, `Set`, `Invalidate` (SCAN+DEL pattern). Commit: `feat(cache): adiciona RedisCache via go-redis/v9`.
- [ ] **C.5** Criar `laura-go/internal/cache/redis_test.go` com testcontainer Redis (reutiliza `test.RedisURL`). Commit: `test(cache): cobre RedisCache via testcontainer`.
- [ ] **C.6** Criar `laura-go/internal/cache/memory.go` com `InMemoryCache` via `golang-lru/v2` + TTL por entry (struct `{value, expiresAt}`). Invalidate aceita pattern glob simples. Commit: `feat(cache): adiciona InMemoryCache LRU com TTL`.
- [ ] **C.7** Criar `laura-go/internal/cache/memory_test.go` — TTL expiry, LRU eviction, Invalidate pattern. Commit: `test(cache): cobre InMemoryCache TTL + LRU`.
- [ ] **C.8** Criar `laura-go/internal/bootstrap/cache.go` com factory `InitCache(cfg)` (código §13.11). Fallback Redis→InMemory automático. Commit: `feat(cache): adiciona factory InitCache com fallback Redis→InMemory`.
- [ ] **C.9** Integrar cache em `internal/handlers/dashboard.go` com TTL 60s, key `ws:{id}:dashboard:{paramsHash}:{YYYYMM}`, header `X-Cache: HIT|MISS|DISABLED`. Commit: `feat(cache): integra cache em /api/v1/dashboard (TTL 60s)`.
- [ ] **C.10** Integrar cache em `internal/handlers/score.go` com TTL 300s, key `ws:{id}:score:{userId}`. Commit: `feat(cache): integra cache em /api/v1/score/snapshot (TTL 300s)`.
- [ ] **C.11** Integrar cache em `internal/handlers/reports_monthly.go` com TTL 600s. Commit: `feat(cache): integra cache em /api/v1/reports/monthly (TTL 600s)`.
- [ ] **C.12** Integrar cache em `internal/handlers/reports_categorical.go` com TTL 600s. Commit: `feat(cache): integra cache em /api/v1/reports/categorical (TTL 600s)`.
- [ ] **C.13** Integrar cache em `internal/handlers/reports_cashflow.go` com TTL 600s. Commit: `feat(cache): integra cache em /api/v1/reports/cashflow (TTL 600s)`.
- [ ] **C.14** Integrar cache em `internal/handlers/categories.go` com TTL 1800s. Commit: `feat(cache): integra cache em /api/v1/categories (TTL 1800s)`.
- [ ] **C.15** Criar `laura-go/internal/db/pool_bench_test.go` com `BenchmarkPool` para validar pool tuning §12.4. Rodar `go test -bench=BenchmarkPool -benchmem ./internal/db/...` e anotar resultado no commit body. Commit: `perf(go): valida pgxpool tuning via bench local`.
- [ ] **C.16** Criar `laura-go/internal/cache/cache_bench_test.go` simulando hit-ratio. Assert >80% após warm-up. Commit: `perf(cache): bench hit-ratio > 80% pós warm-up`.

---

## Parte D — Infra

- [ ] **D.1** Verificar que `laura-go/internal/migrations/` tem todas as migrations. Deletar `infrastructure/migrations/` (`git rm -r infrastructure/migrations/`). Commit: `refactor(db): consolida migrations em laura-go/internal/migrations via go:embed`.
- [ ] **D.2** Atualizar `laura-go/Dockerfile` removendo `COPY infrastructure/migrations` se presente. Validar `docker build -f laura-go/Dockerfile .` localmente. Commit: `fix(infra): remove COPY infrastructure/migrations do Dockerfile`.
- [ ] **D.3** Atualizar `.gitignore` removendo exclusão `laura-go/internal/migrations/*.sql`. Commit: `chore(db): permite rastreamento de migrations via go:embed`.
- [ ] **D.4** Criar `docker-compose.ci.yml` na raiz com services `postgres` (pgvector/pgvector:pg16 + volume nomeado `pgdata`), `redis` (redis:7-alpine), `api` (build laura-go), `pwa` (build apps/web). Commit: `infra(ci): adiciona docker-compose.ci.yml com postgres+redis+api+pwa`.
- [ ] **D.5** Criar/atualizar `docs/ops/deployment.md` documentando `BUILD_SHA`/`BUILD_TIME` via Vercel (`process.env.VERCEL_GIT_COMMIT_SHA`) e Fly (`--build-arg`). Commit: `docs(ops): documenta BUILD_SHA/BUILD_TIME em Vercel + Fly`.
- [ ] **D.6** Criar `docs/ops/runbooks/whatsapp-reconnect.md` com passos de rescan QR pós-restart Fly. Commit: `docs(ops): adiciona runbook whatsapp-reconnect`.

---

## Parte E — Observability follow-up

- [ ] **E.1** Adicionar label `workspace_id` às métricas Prometheus em `/api/v1/reports/monthly`, `/categorical`, `/cashflow`. Commit: `feat(telemetry): adiciona workspace_id label em métricas reports/*`.
- [ ] **E.2** Estender Sentry scope global com `scope.SetTag("tenant_id", workspaceID)` via middleware em `internal/middleware/sentry.go`. Commit: `feat(observability): propaga tenant_id em scope Sentry`.
- [ ] **E.3** Criar/atualizar `docs/ops/alerts.md` documentando 3 regras Sentry com `rate-limit 1/30min` + `environment:production`. Commit: `docs(ops): documenta rate-limit Sentry por regra em alerts.md`.
- [ ] **E.4** Adicionar alerta Sentry para `LLM_LEGACY_NOCONTEXT=true` em prod após T+30d (documentar em `docs/ops/alerts.md`). Commit: `docs(ops): adiciona alerta LLM_LEGACY_NOCONTEXT TTL 30d`.

---

## Parte F — DX (Playwright full + arquitetura)

- [ ] **F.1** Criar `.github/workflows/playwright-full.yml` orquestrando `docker compose -f docker-compose.ci.yml up -d`, `npx playwright install --with-deps chromium`, `npx playwright test`, `docker compose ... down -v` (cleanup obrigatório §13.7). Target < 10min. Commit: `ci(e2e): adiciona workflow playwright-full via docker-compose`.
- [ ] **F.2** Propagar `ctx` em `ChatCompletion(ctx, ...)` nas camadas `internal/llm/*.go` (big-bang). Commit: `refactor(go): propaga context em ChatCompletion (big-bang)`.
- [ ] **F.3** Adicionar check real whatsmeow (ping via `client.IsConnected()`) em `internal/health/handler.go` Readiness. Commit: `feat(observability): adiciona whatsmeow check real em /ready`.
- [ ] **F.4** Adicionar LLM Ping real (completion curta com `max_tokens=1` + timeout 3s) em `internal/health/handler.go`. Commit: `feat(observability): adiciona LLM Ping real em /ready`.
- [ ] **F.5** Criar `docs/architecture.md` em PT-BR com header + seção diagrama #1 completo (§13.14) + cross-link runbook incident-response. Commit: `docs(docs): adiciona architecture.md com diagrama #1 fluxo de request`.
- [ ] **F.6** Adicionar diagrama #2 (erDiagram persistência) em `docs/architecture.md` + cross-link runbooks/migrations.md. Commit: `docs(docs): adiciona diagrama #2 persistência (ER)`.
- [ ] **F.7** Adicionar diagrama #3 (flowchart TB observability stack) + cross-link sentry-alerts.md. Commit: `docs(docs): adiciona diagrama #3 observability stack`.
- [ ] **F.8** Adicionar diagrama #4 (flowchart LR deploy pipeline) + cross-link rollback.md. Commit: `docs(docs): adiciona diagrama #4 deploy pipeline`.
- [ ] **F.9** Adicionar diagrama #5 (flowchart TB multi-tenant model) + cross-link workspace-isolation.md. Commit: `docs(docs): adiciona diagrama #5 multi-tenant model`.
- [ ] **F.10** Adicionar cross-link reverso em cada `docs/runbooks/*.md` referenciado (5 arquivos, header `> Arquitetura: seção [#<slug>](../architecture.md#<slug>)`). Commit: `docs(docs): adiciona cross-link reverso runbooks → architecture`.
- [ ] **F.11** Criar `docs/runbooks/whatsmeow.md` (rescan QR pós-restart Fly) — se ainda não criado em D.6 equivalente. Commit: `docs(ops): adiciona runbook whatsmeow QR rescan`.
- [ ] **F.12** Criar `docs/runbooks/sentry-alerts.md` se ausente. Commit: `docs(ops): adiciona runbook sentry-alerts`.

---

## Parte G — Cleanup

- [ ] **G.1** Investigar `apps/web/package-lock.json` modificado pre-existente (`git diff apps/web/package-lock.json`). Se divergência legítima (nova dep), commitar. Se artefato, `git checkout --`. Commit: `chore(pwa): resolve package-lock.json pendente` (se aplicável).

---

## Parte H — Tag final

- [ ] **H.1** Rodar validações finais (§14):
  - `cd laura-go && go vet ./... && go test ./...`
  - `gosec ./... 2>&1 | grep -c G104` == 0
  - `staticcheck ./...`
  - `go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | grep total` >= 30%
  - `wc -l laura-go/main.go` < 100
  - `cd apps/web && npx eslint src/lib/actions src/lib/services src/types --max-warnings=0`
- [ ] **H.2** Criar tag `phase-12-prepared`: `git tag -a phase-12-prepared -m "Fase 12: refactoring + performance + dívida técnica preparada para merge"`. Push tag.
- [ ] **H.3** Abrir PR `fase-12-refactoring-performance` → `main` com checklist dos 37 itens §15.

---

## Self-review — cobertura dos 37 itens do checklist v3 §15 → tasks v1

### Refactoring (6/6 IN_PLAN)

| # | Item v3 §15 | Task v1 | Status |
|---|-------------|---------|--------|
| 1 | `internal/bootstrap/db.go` + teste | A.1, A.2 | IN_PLAN |
| 2 | `internal/bootstrap/logger.go` + teste | A.3, A.4 | IN_PLAN |
| 3 | `internal/bootstrap/sentry.go` + teste | A.5 | IN_PLAN (teste implícito em A.10) |
| 4 | `internal/bootstrap/otel.go` + teste | A.6 | IN_PLAN (teste implícito em A.10) |
| 5 | `internal/bootstrap/metrics.go` + teste | A.7 | IN_PLAN (teste implícito em A.10) |
| 6 | `internal/health/handler.go` + teste | A.8 | IN_PLAN |

### Lint + Tests (7/7 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 7 | `api_e2e_test.go` HMAC + remove tag | B.2.1-B.2.4 | IN_PLAN |
| 8 | gosec G104 zerado admin/* | B.1.1-B.1.5 | IN_PLAN |
| 9 | 87 `no-explicit-any` zerados | B.4.2 | IN_PLAN |
| 10 | ESLint override + gate CI | B.4.1, B.4.4 | IN_PLAN |
| 11 | 6 react-hooks + 8 unescaped-entities | B.4.3 | IN_PLAN |
| 12 | `test/testmain.go` testcontainers | B.3.2 | IN_PLAN |
| 13 | Coverage Go > 30% | B.3.3 | IN_PLAN |

### Cache (6/6 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 14 | `cache.go` interface + GetOrCompute + singleflight | C.2 | IN_PLAN |
| 15 | `cache/redis.go` | C.4 | IN_PLAN |
| 16 | `cache/memory.go` LRU | C.6 | IN_PLAN |
| 17 | `bootstrap/cache.go` factory | C.8 | IN_PLAN |
| 18 | Integração 4 handlers + TTLs | C.9-C.14 | IN_PLAN |
| 19 | CACHE_DISABLED + X-Cache header | C.2, C.9 | IN_PLAN |

### Infra (5/5 IN_PLAN + 1 STANDBY)

| # | Item | Task | Status |
|---|------|------|--------|
| 20 | Migrations consolidadas + Dockerfile | D.1, D.2, D.3 | IN_PLAN |
| 21 | `docker-compose.ci.yml` + volume + down -v | D.4 | IN_PLAN |
| 22 | `.env.test` + `.env.test.example` | B.2.1 | IN_PLAN |
| 23 | pgx pool tuning + bench | A.1 (tuning) + C.15 (bench) | IN_PLAN |
| 24 | BUILD_SHA/BUILD_TIME Vercel+Fly | D.5 | IN_PLAN |
| — | Redis real Upstash | — | STANDBY [REDIS-INSTANCE] (fallback InMemory cobre) |

### Observability (4/4 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 25 | workspace_id em reports/* | E.1 | IN_PLAN |
| 26 | Sentry scope tenant_id | E.2 | IN_PLAN |
| 27 | 3 regras Sentry rate-limit | E.3 | IN_PLAN |
| 28 | LLM_LEGACY_NOCONTEXT TTL 30d | E.4 | IN_PLAN |

### DX (4/4 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 29 | Playwright full < 10min | F.1 | IN_PLAN |
| 30 | Ctx em ChatCompletion | F.2 | IN_PLAN |
| 31 | Whatsmeow check real /ready | F.3 | IN_PLAN |
| 32 | LLM Ping real | F.4 | IN_PLAN |

### Docs + Cleanup (5/5 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 33 | `architecture.md` PT-BR 5 diagramas | F.5-F.10 | IN_PLAN |
| 34 | `runbooks/whatsmeow.md` | F.11 (ou D.6) | IN_PLAN |
| 35 | `runbooks/sentry-alerts.md` | F.12 | IN_PLAN |
| 36 | package-lock.json | G.1 | IN_PLAN |
| 37 | Tag `phase-12-complete` | H.2 (como `phase-12-prepared`) | IN_PLAN (ajustar nome em H se preferir `complete`) |

**Totais:** 37/37 IN_PLAN, 1 dependência STANDBY (`[REDIS-INSTANCE]`) — não bloqueia nenhuma task (fallback InMemory ativo).

### GAPs conhecidos para review #1

1. **Nome da tag final** — H.2 usa `phase-12-prepared`, checklist §15 item 37 usa `phase-12-complete`. Confirmar qual é canônico (sugestão: `phase-12-complete` só após merge em main).
2. **D.6 vs F.11 redundância** — `runbooks/whatsapp-reconnect.md` (D.6) vs `runbooks/whatsmeow.md` (F.11). Consolidar em 1 arquivo? Decidir em review #1.
3. **Testes A.4/A.5/A.7** — apenas A.2, A.4 e A.8 têm teste explícito. Sentry/OTel/Metrics dependem de externals; teste unitário real exigiria mocks extensos. Tratados como "valida build" em A.10 — confirmar se suficiente ou expandir.
4. **B.4.3** volume real — contagem "6 react-hooks + 8 unescaped-entities" vem do spec; verificar contagem real em Parte 0 baseline e possivelmente quebrar em sub-tasks se > 15 warnings.
5. **C.15 bench** — assumindo `internal/db/` existe; se pool estiver apenas em `bootstrap/db.go`, mover bench para `internal/bootstrap/db_bench_test.go`.
