# Fase 12 — Refactoring + Performance + Dívida Técnica (Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Goal:** Eliminar dívida técnica acumulada (87 lint warnings PWA, 13 gosec G104, main.go 200+ linhas, e2e tests com auth quebrada, queries sem cache, docs incompletos) sem depender de credenciais externas (STANDBY único: `[REDIS-INSTANCE]` Upstash — fallback InMemory cobre).

**Architecture:** Refator `main.go` em pacote `internal/bootstrap/` (6 arquivos: db, logger, sentry, otel, metrics, cache). Cache via interface `Cache` (Redis Upstash + fallback InMemory LRU) com helper `GetOrCompute[T]` + singleflight global + TTL (60/300/600/1800s). Coverage >= 30% via testcontainers-go pgvector compartilhado em `test/testmain.go`. Lint cleanup: 13 gosec G104 corrigidos por arquivo (3-4 commits), 87 `no-explicit-any` zerados em dirs críticos (`--max-warnings=0`). Stack E2E full Playwright via `docker-compose.ci.yml`. Documentação: `architecture.md` PT-BR com 5 mermaid diagrams + cross-link runbooks.

**Tech Stack:** Go 1.26 + slog + `golang.org/x/sync/singleflight` + `redis/go-redis/v9` + `testcontainers-go`; Next.js 16 + Playwright + docker-compose; Postgres 16 + pgvector.

---

## Mudanças vs Plan v1 (Review #1)

1. **Tag canônica fixada** — `phase-12-prepared` em H.2, alinhado com Fases 10/11 (auto-review §15 item 37 atualizado).
2. **Runbook WhatsApp consolidado** — removida redundância D.6 vs F.11. Mantido apenas D.6 (`docs/runbooks/whatsapp.md` cobrindo reconnect + troubleshooting). F.11 eliminado.
3. **Testes adicionados para extrações sem cobertura** — novas tasks **A.5b** (sentry NoOp), **A.6b** (otel NoOp), **A.7b** (metrics smoke) garantindo teste mínimo por extração.
4. **Baseline warnings PWA medido antes de estimar** — task **0.2** expandida com `npm run lint 2>&1 | grep -E 'react-hooks|no-unescaped' | tee /tmp/pwa-warnings.txt`; B.4.3 pode ser quebrada conforme contagem real.
5. **C.15 bench pool** — path corrigido para `laura-go/internal/bootstrap/db_bench_test.go` (pool mora em bootstrap/db.go, não internal/db/).
6. **B.5 fixar HMAC fixture** — pacote canônico definido como `internal/testutil/session.go` (função `SignedSession`). Package `internal/auth` do handler legacy é consumidor, não produtor do helper.
7. **C.5 quebrado em 4 sub-tasks TDD** — C.5 original virou C.5.a (dashboard), C.5.b (score), C.5.c (reports×3), C.5.d (categories), cada uma com teste antes da integração. Numeração de C.9–C.14 ajustada.
8. **F.1 docker-compose detalhado** — serviços `postgres` (pgvector/pgvector:pg16 + healthcheck `pg_isready`), `redis` (redis:7-alpine + `redis-cli ping`), `api-go` (build `laura-go/Dockerfile`), `pwa` (build `apps/web/Dockerfile`).
9. **F.2 workflow `playwright-full.yml` detalhado** — `concurrency: group: e2e-${{ github.ref }} cancel-in-progress: true`, `timeout-minutes: 30`, cleanup `if: always()`.
10. **F.3 (antigo F.5–F.9) diagramas `architecture.md`** — 5 arquivos `.mmd` dedicados em `docs/architecture/diagrams/` (`request-flow.mmd`, `persistence.mmd`, `observability.mmd`, `deploy.mmd`, `multi-tenant.mmd`), embarcados via `{{< mermaid-include >}}` ou inline no `architecture.md`.
11. **STANDBY `[REDIS-INSTANCE]` anotado em tasks C.***  — calls Upstash ficam opcionais; fallback InMemory é caminho default em dev/CI.

**Total Plan v2: ~78 tasks** (v1 tinha ~60 contando sub-numeradas).

---

## Parte 0 — Pré-condições

- [ ] **0.1** Rodar baseline Go: `cd laura-go && go vet ./... && go test ./... && gosec ./... 2>&1 | grep -c G104`.
  - Expected: contagem G104 ≈ 13. Anotar em `/tmp/baseline-g104.txt`.
- [ ] **0.2** Rodar baseline PWA: `cd apps/web && npm run lint 2>&1 | tee /tmp/pwa-lint-baseline.txt && grep -cE 'react-hooks/exhaustive-deps' /tmp/pwa-lint-baseline.txt && grep -cE 'react/no-unescaped-entities' /tmp/pwa-lint-baseline.txt`.
  - Expected: contagem react-hooks ≈ 6, unescaped ≈ 8. Se divergir >50%, quebrar B.4.3 em sub-tasks por arquivo.
- [ ] **0.3** Verificar ambiente: `docker --version && docker compose version && go version`.
  - Expected: Go >= 1.26, Docker + compose v2. Redis NÃO precisa estar rodando (fallback InMemory cobre). STANDBY `[REDIS-INSTANCE]`.
- [ ] **0.4** Criar branch: `git checkout -b fase-12-refactoring-performance && git commit --allow-empty -m "chore(phase-12): inicia fase 12 — refactoring + performance"`.
  - Expected: branch criada, commit vazio registrado.

---

## Parte A — Refactoring main.go (extração de bootstrap — ordem TDD §12.1)

- [ ] **A.1** Criar `laura-go/internal/bootstrap/db.go` extraindo `InitDB(cfg Config) (*pgxpool.Pool, error)` de `main.go`. Aplicar tuning §12.4 via env vars (`PG_MAX_CONNS=10`, `PG_MIN_CONNS=2`, `PG_MAX_CONN_LIFETIME=30m`, `PG_MAX_CONN_IDLE_TIME=5m`, `PG_HEALTH_CHECK_PERIOD=1m`).
  - Run: `cd laura-go && go build ./internal/bootstrap/...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitDB de main.go`
- [ ] **A.2** Criar `laura-go/internal/bootstrap/db_test.go` com teste de parsing de env (sem Postgres real). Casos: defaults, override de `PG_MAX_CONNS`, valor inválido retorna erro.
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 3 testes PASS.
  - Commit: `test(bootstrap): cobre parsing de config em bootstrap/db.go`
- [ ] **A.3** Criar `laura-go/internal/bootstrap/logger.go` com `InitLogger(env string) *slog.Logger`.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitLogger`
- [ ] **A.4** Criar `laura-go/internal/bootstrap/logger_test.go` validando níveis (prod=Info, dev=Debug).
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 2 testes PASS adicionais.
  - Commit: `test(bootstrap): cobre níveis de log em logger.go`
- [ ] **A.5** Criar `laura-go/internal/bootstrap/sentry.go` com `InitSentry(cfg Config) (flush func(), err error)`. Quando DSN vazio, retornar `NoOp` flush (`func(){}`).
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitSentry`
- [ ] **A.5b** Criar `laura-go/internal/bootstrap/sentry_test.go` testando caminho NoOp com DSN vazio (flush não-nil, sem panic).
  - Run: `cd laura-go && go test -run TestInitSentryNoOp ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): cobre NoOp de InitSentry com DSN vazio`
- [ ] **A.6** Criar `laura-go/internal/bootstrap/otel.go` com `InitOTel(ctx context.Context, cfg Config) (shutdown func(context.Context) error, err error)`. Quando endpoint vazio, retornar NoOp shutdown.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitOTel`
- [ ] **A.6b** Criar `laura-go/internal/bootstrap/otel_test.go` testando NoOp (endpoint vazio) — shutdown retorna nil sem panic.
  - Run: `cd laura-go && go test -run TestInitOTelNoOp ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): cobre NoOp de InitOTel com endpoint vazio`
- [ ] **A.7** Criar `laura-go/internal/bootstrap/metrics.go` com `InitMetrics() (*fiber.App, *prometheus.Registry)` (servidor :9090).
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitMetrics`
- [ ] **A.7b** Criar `laura-go/internal/bootstrap/metrics_test.go` com smoke test: InitMetrics retorna app+registry não-nil; registrar counter dummy e verificar via `/metrics` handler que aparece.
  - Run: `cd laura-go && go test -run TestInitMetrics ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): smoke test InitMetrics + counter dummy`
- [ ] **A.8** Criar `laura-go/internal/health/handler.go` + `laura-go/internal/health/handler_test.go` com `Liveness(c *fiber.Ctx) error` e `Readiness(deps Deps) fiber.Handler` (Deps: db, redis, whatsmeow, llm — com mocks no teste).
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: testes liveness OK, readiness com mocks OK.
  - Commit: `refactor(health): move /health e /ready para internal/health com testes`
- [ ] **A.9** Refatorar `laura-go/main.go` chamando `bootstrap.InitDB/Logger/Sentry/OTel/Metrics` + `health.*`. Alvo: < 100 linhas.
  - Run: `cd laura-go && wc -l main.go && go vet ./... && go test ./...`
  - Expected: `wc -l` < 100; build + tests OK.
  - Commit: `refactor(go): reduz main.go a orquestração (<100 linhas)`

---

## Parte B — Lint + Tests (cleanup dívida técnica)

### B.1 — gosec G104 (3-4 commits §12.7)

- [ ] **B.1.1** Rodar `cd laura-go && gosec ./... 2>&1 | grep G104 | tee /tmp/g104.txt`.
  - Expected: lista exata por arquivo (esperado 4 arquivos `admin_*.go`).
- [ ] **B.1.2** Corrigir `laura-go/internal/admin/admin_whatsapp.go` (padrão §12.7 remediação: `slog.ErrorContext + return fiber.NewError`).
  - Run: `cd laura-go && gosec ./internal/admin/admin_whatsapp.go 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(admin): trata erros ignorados em admin_whatsapp.go (gosec G104)`
- [ ] **B.1.3** Corrigir `laura-go/internal/admin/admin_categories.go`.
  - Run: `cd laura-go && gosec ./internal/admin/admin_categories.go 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(admin): trata erros ignorados em admin_categories.go (gosec G104)`
- [ ] **B.1.4** Corrigir `laura-go/internal/admin/admin_users.go`.
  - Run: `cd laura-go && gosec ./internal/admin/admin_users.go 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(admin): trata erros ignorados em admin_users.go (gosec G104)`
- [ ] **B.1.5** Corrigir `laura-go/internal/admin/admin_stats.go` + resíduos.
  - Run: `cd laura-go && gosec ./... 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(admin): trata erros ignorados em admin_stats.go (gosec G104)`

### B.2 — HMAC fixture + e2e tag removal (§13.13)

- [ ] **B.2.1** Criar `.env.test` (commitado — valor de teste, não secret) com `SESSION_HMAC_KEY=<openssl rand -base64 32>` fixo + `.env.test.example`.
  - Run: `cat .env.test && cat .env.test.example`
  - Expected: ambos arquivos com linha `SESSION_HMAC_KEY=...`.
  - Commit: `chore(e2e): adiciona .env.test com SESSION_HMAC_KEY determinística`
- [ ] **B.2.2** Criar `laura-go/internal/testutil/session.go` com helper `SignedSession(t *testing.T, userID, workspaceID string) *http.Cookie` (código canônico §13.13). Pacote `testutil` é novo — sem conflito com `internal/auth` (que consome, não produz).
  - Run: `cd laura-go && go build ./internal/testutil/...`
  - Expected: build OK.
  - Commit: `test(e2e): adiciona helper SignedSession HMAC em testutil`
- [ ] **B.2.3** Criar `laura-go/internal/testutil/session_test.go` validando que `SignedSession` gera cookie com formato `payload.sig` e `len(Value) > 0`.
  - Run: `cd laura-go && SESSION_HMAC_KEY=$(grep SESSION_HMAC_KEY .env.test | cut -d= -f2) go test ./internal/testutil/...`
  - Expected: PASS.
  - Commit: `test(e2e): cobre SignedSession em testutil`
- [ ] **B.2.4** Refatorar `laura-go/internal/handlers/api_e2e_test.go`: trocar `authenticatedRequest` pelo helper, **remover** `//go:build e2e`.
  - Run: `cd laura-go && SESSION_HMAC_KEY=$(grep SESSION_HMAC_KEY .env.test | cut -d= -f2) go test ./internal/handlers/...`
  - Expected: PASS sem build tag.
  - Commit: `test(e2e): migra api_e2e_test para HMAC cookie fixture + remove build tag e2e`

### B.3 — Testcontainers + Coverage

- [ ] **B.3.1** `cd laura-go && go get github.com/testcontainers/testcontainers-go github.com/testcontainers/testcontainers-go/modules/postgres github.com/testcontainers/testcontainers-go/modules/redis`.
  - Run: `cd laura-go && go mod tidy && go build ./...`
  - Expected: build OK.
  - Commit: `chore(go): adiciona testcontainers-go para integration tests`
- [ ] **B.3.2** Criar `laura-go/test/testmain.go` com `//go:build integration` + `TestMain` exportando `PGDSN` e `RedisURL` (§13.15). Funções internas: `startPostgresWithPgvector`, `startRedis`, `applyMigrations`, `stopAll`.
  - Run: `cd laura-go && go test -tags=integration -run TestMain ./test/...`
  - Expected: setup sobe containers, tears down, exit 0.
  - Commit: `test(integration): adiciona TestMain compartilhado com testcontainers pgvector+redis`
- [ ] **B.3.3** Adicionar job `coverage` em `.github/workflows/go-ci.yml` rodando `go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./...` + assertion `>= 30%` via `go tool cover -func=coverage.out | grep total | awk '{if ($3+0 < 30.0) exit 1}'`.
  - Run: local — `cd laura-go && go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | grep total`
  - Expected: total >= 30.0%.
  - Commit: `ci(go): instrumenta coverage >= 30% em integration tests`

### B.4 — PWA lint gate

- [ ] **B.4.1** Editar `apps/web/.eslintrc.cjs` (ou equivalente) adicionando override para `src/lib/actions/**`, `src/lib/services/**`, `src/types/**` com `no-explicit-any: error`. Warnings globais permanecem `warn`.
  - Run: `cd apps/web && npx eslint --print-config src/lib/actions/foo.ts | grep no-explicit-any`
  - Expected: `"error"`.
  - Commit: `fix(pwa): eleva no-explicit-any a error em lib/actions + services + types`
- [ ] **B.4.2** Zerar `no-explicit-any` em `src/lib/actions/**`, `src/lib/services/**`, `src/types/**` substituindo por tipos concretos ou `unknown` + type guards.
  - Run: `cd apps/web && npx eslint src/lib/actions src/lib/services src/types --max-warnings=0`
  - Expected: exit 0, 0 errors.
  - Commit: `fix(pwa): zera no-explicit-any em lib/actions + services + types`
- [ ] **B.4.3** Resolver warnings `react-hooks/exhaustive-deps` (~6) + `react/no-unescaped-entities` (~8). Se baseline 0.2 mostrar > 20 warnings combinados, quebrar em sub-tasks por arquivo.
  - Run: `cd apps/web && npm run lint 2>&1 | grep -cE 'react-hooks/exhaustive-deps|react/no-unescaped-entities'`
  - Expected: 0.
  - Commit: `fix(pwa): resolve warnings react-hooks + unescaped-entities`
- [ ] **B.4.4** Adicionar gate em `.github/workflows/pwa-ci.yml`:
    ```yaml
    - name: ESLint critical dirs gate
      run: cd apps/web && npx eslint src/lib/actions src/lib/services src/types --max-warnings=0
    ```
  - Run: revisar YAML localmente.
  - Expected: step adicionado.
  - Commit: `ci(pwa): adiciona gate --max-warnings=0 para dirs críticos`

---

## Parte C — Cache + Performance

> Nota STANDBY `[REDIS-INSTANCE]`: tasks C.4/C.5/C.9–C.14 rodam contra testcontainer Redis local em dev/CI. Upstash real só em prod via `REDIS_URL`. Fallback InMemory cobre todos os ambientes.

- [ ] **C.1** `cd laura-go && go get github.com/redis/go-redis/v9 github.com/hashicorp/golang-lru/v2 golang.org/x/sync/singleflight && go mod tidy`.
  - Run: `go build ./...`
  - Expected: build OK.
  - Commit: `chore(go): adiciona go-redis/v9 + golang-lru/v2 + singleflight`
- [ ] **C.2** Criar `laura-go/internal/cache/cache.go` com interface `Cache` + `GetOrCompute[T]` + `var sg singleflight.Group` global (código canônico §12.2).
  - Run: `cd laura-go && go build ./internal/cache/...`
  - Expected: build OK.
  - Commit: `feat(cache): adiciona interface Cache + GetOrCompute com singleflight global`
- [ ] **C.3** Criar `laura-go/internal/cache/cache_test.go` com fake Cache cobrindo: HIT, MISS, CACHE_DISABLED, unmarshal fail, compute error, singleflight dedup (2 goroutines mesma key → 1 compute — assert via `atomic.Int32`).
  - Run: `cd laura-go && go test ./internal/cache/...`
  - Expected: 6 subtests PASS.
  - Commit: `test(cache): cobre GetOrCompute com HIT/MISS/DISABLED/singleflight`
- [ ] **C.4** Criar `laura-go/internal/cache/redis.go` com `RedisCache` (`Get`, `Set`, `Invalidate` via SCAN+DEL).
  - Run: `cd laura-go && go build ./internal/cache/...`
  - Expected: build OK.
  - Commit: `feat(cache): adiciona RedisCache via go-redis/v9`
- [ ] **C.4b** Criar `laura-go/internal/cache/redis_integration_test.go` com `//go:build integration` reusando `test.RedisURL`. Casos: Get/Set, Invalidate pattern, TTL expiry.
  - Run: `cd laura-go && go test -tags=integration ./internal/cache/...`
  - Expected: PASS.
  - Commit: `test(cache): cobre RedisCache via testcontainer`
- [ ] **C.5** Criar `laura-go/internal/cache/memory.go` com `InMemoryCache` via `golang-lru/v2` + TTL por entry (`{value []byte, expiresAt time.Time}`). `Invalidate` aceita glob simples (`ws:123:*`).
  - Run: `cd laura-go && go build ./internal/cache/...`
  - Expected: build OK.
  - Commit: `feat(cache): adiciona InMemoryCache LRU com TTL`
- [ ] **C.5b** Criar `laura-go/internal/cache/memory_test.go` — TTL expiry (sleep + Get retorna miss), LRU eviction (capacidade 2, 3 inserts → primeiro evicted), Invalidate pattern.
  - Run: `cd laura-go && go test ./internal/cache/...`
  - Expected: 3 subtests PASS.
  - Commit: `test(cache): cobre InMemoryCache TTL + LRU + invalidate pattern`
- [ ] **C.6** Criar `laura-go/internal/bootstrap/cache.go` com factory `InitCache(cfg Config) Cache` (fallback Redis→InMemory). Código §13.11.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `feat(bootstrap): adiciona factory InitCache com fallback Redis→InMemory`
- [ ] **C.6b** Criar `laura-go/internal/bootstrap/cache_test.go` validando 3 caminhos: `CACHE_DISABLED=true` → InMemory, `REDIS_URL=""` → InMemory, `REDIS_URL=inválido` → InMemory com warn log (caça via `slog` handler mock).
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 3 subtests PASS.
  - Commit: `test(bootstrap): cobre fallback de InitCache em 3 caminhos`

### C.7 — Integração cache em 6 handlers (4 domínios, TDD — task por domínio)

- [ ] **C.7.dashboard** TDD: (1) escrever teste em `laura-go/internal/handlers/dashboard_cache_test.go` validando HIT/MISS e header `X-Cache` usando fake Cache; (2) integrar cache em `dashboard.go` com TTL 60s, key `ws:{id}:dashboard:{paramsHash}:{YYYYMM}`.
  - Run: `cd laura-go && go test -run TestDashboardCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/dashboard (TTL 60s)`
- [ ] **C.7.score** TDD: teste + integração em `score.go` TTL 300s, key `ws:{id}:score:{userId}`.
  - Run: `cd laura-go && go test -run TestScoreCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/score/snapshot (TTL 300s)`
- [ ] **C.7.reports** TDD: 3 sub-integrações (`reports_monthly.go`, `reports_categorical.go`, `reports_cashflow.go`) TTL 600s cada, keys §12.3. Um único commit cobrindo os 3 arquivos para atomicidade.
  - Run: `cd laura-go && go test -run TestReports.*Cache ./internal/handlers/...`
  - Expected: 3 testes PASS.
  - Commit: `feat(cache): integra cache em /api/v1/reports/{monthly,categorical,cashflow} (TTL 600s)`
- [ ] **C.7.categories** TDD: teste + integração em `categories.go` TTL 1800s, key `ws:{id}:categories:v1`.
  - Run: `cd laura-go && go test -run TestCategoriesCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/categories (TTL 1800s)`

### C.8 — Benches

- [ ] **C.8.pool** Criar `laura-go/internal/bootstrap/db_bench_test.go` com `BenchmarkPool` validando tuning §12.4 (100 goroutines × 100 queries). Anotar resultado no body do commit.
  - Run: `cd laura-go && go test -tags=integration -bench=BenchmarkPool -benchmem ./internal/bootstrap/...`
  - Expected: bench roda; p95 latência < 50ms.
  - Commit: `perf(bootstrap): valida pgxpool tuning via bench local`
- [ ] **C.8.cache** Criar `laura-go/internal/cache/cache_bench_test.go` simulando hit-ratio. Warm-up 1000 ops + measure 10000. Assert hit-ratio > 80%.
  - Run: `cd laura-go && go test -bench=BenchmarkHitRatio ./internal/cache/...`
  - Expected: hit-ratio >= 0.80.
  - Commit: `perf(cache): bench hit-ratio > 80% pós warm-up`

---

## Parte D — Infra

- [ ] **D.1** Confirmar `laura-go/internal/migrations/*.sql` completas. Deletar `infrastructure/migrations/`.
  - Run: `ls laura-go/internal/migrations && git rm -r infrastructure/migrations/`
  - Expected: migrations listadas; pasta removida.
  - Commit: `refactor(db): consolida migrations em laura-go/internal/migrations via go:embed`
- [ ] **D.2** Editar `laura-go/Dockerfile` removendo `COPY infrastructure/migrations` se presente. Rebuild local.
  - Run: `docker build -f laura-go/Dockerfile -t laura-api:fase-12 .`
  - Expected: build OK.
  - Commit: `fix(infra): remove COPY infrastructure/migrations do Dockerfile`
- [ ] **D.3** Editar `.gitignore` removendo exclusão `laura-go/internal/migrations/*.sql`.
  - Run: `git check-ignore laura-go/internal/migrations/*.sql`
  - Expected: exit 1 (não ignorado).
  - Commit: `chore(db): permite rastreamento de migrations via go:embed`
- [ ] **D.4** Criar `docker-compose.ci.yml` na raiz com:
    - `postgres`: `pgvector/pgvector:pg16`, volume nomeado `pgdata`, healthcheck `pg_isready -U postgres`.
    - `redis`: `redis:7-alpine`, healthcheck `redis-cli ping | grep PONG`.
    - `api-go`: build `context: ./laura-go`, depends_on postgres+redis (healthy), env vars `DATABASE_URL`, `REDIS_URL`, `SESSION_HMAC_KEY`.
    - `pwa`: build `context: ./apps/web`, depends_on api-go, env `NEXT_PUBLIC_API_URL`.
  - Run: `docker compose -f docker-compose.ci.yml config`
  - Expected: YAML válido.
  - Commit: `infra(ci): adiciona docker-compose.ci.yml com postgres+redis+api+pwa`
- [ ] **D.5** Criar/atualizar `docs/ops/deployment.md` documentando `BUILD_SHA` (`VERCEL_GIT_COMMIT_SHA` / `--build-arg BUILD_SHA`) + `BUILD_TIME` (`date -u +%FT%TZ` em CI).
  - Expected: doc criada.
  - Commit: `docs(ops): documenta BUILD_SHA/BUILD_TIME em Vercel + Fly`
- [ ] **D.6** Criar `docs/runbooks/whatsapp.md` consolidado — seções: (a) rescan QR pós-restart Fly, (b) troubleshooting reconnect, (c) validação `whatsmeow.IsConnected()`, (d) cross-link `architecture.md#observability`.
  - Expected: doc criada com 4 seções.
  - Commit: `docs(ops): adiciona runbook whatsapp consolidado (reconnect + troubleshooting)`

---

## Parte E — Observability follow-up

- [ ] **E.1** Adicionar label `workspace_id` em métricas Prometheus nos 3 handlers `reports/*`. Editar `internal/handlers/reports_*.go`.
  - Run: `cd laura-go && go test ./internal/handlers/...`
  - Expected: tests PASS.
  - Commit: `feat(telemetry): adiciona workspace_id label em métricas reports/*`
- [ ] **E.2** Criar `laura-go/internal/middleware/sentry.go` (se ausente) propagando `scope.SetTag("tenant_id", workspaceID)` por request.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `feat(observability): propaga tenant_id em scope Sentry via middleware`
- [ ] **E.3** Atualizar `docs/ops/alerts.md` com 3 regras Sentry (`rate-limit 1/30min` + `environment:production`).
  - Expected: doc com tabela de regras.
  - Commit: `docs(ops): documenta rate-limit Sentry por regra em alerts.md`
- [ ] **E.4** Adicionar em `docs/ops/alerts.md` alerta para `LLM_LEGACY_NOCONTEXT=true` em prod pós T+30d.
  - Expected: seção "LLM legacy context" adicionada.
  - Commit: `docs(ops): adiciona alerta LLM_LEGACY_NOCONTEXT TTL 30d`

---

## Parte F — DX (Playwright full + arquitetura + health real)

- [ ] **F.1** Criar `.github/workflows/playwright-full.yml`:
    ```yaml
    name: Playwright Full
    on: [pull_request, push]
    concurrency:
      group: e2e-${{ github.ref }}
      cancel-in-progress: true
    jobs:
      e2e:
        runs-on: ubuntu-latest
        timeout-minutes: 30
        steps:
          - uses: actions/checkout@v4
          - run: docker compose -f docker-compose.ci.yml up -d --wait
          - run: cd apps/web && npx playwright install --with-deps chromium
          - run: cd apps/web && npx playwright test
          - if: always()
            run: docker compose -f docker-compose.ci.yml down -v
    ```
  - Run: `yamllint .github/workflows/playwright-full.yml`
  - Expected: YAML válido.
  - Commit: `ci(e2e): adiciona workflow playwright-full via docker-compose`
- [ ] **F.2** Propagar `ctx context.Context` em `ChatCompletion(ctx, ...)` — big-bang em `internal/llm/*.go`.
  - Run: `cd laura-go && go build ./... && go test ./internal/llm/...`
  - Expected: build + tests OK.
  - Commit: `refactor(llm): propaga context em ChatCompletion (big-bang)`
- [ ] **F.3** Adicionar check real whatsmeow (`client.IsConnected()`) em `internal/health/handler.go` Readiness.
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: test com mock IsConnected=true → 200; false → 503.
  - Commit: `feat(observability): adiciona whatsmeow check real em /ready`
- [ ] **F.4** Adicionar LLM Ping real em `internal/health/handler.go` (completion curta `max_tokens=1` + timeout 3s via `context.WithTimeout`).
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: test com LLM mock → OK; timeout → 503.
  - Commit: `feat(observability): adiciona LLM Ping real em /ready`

### F.5 — architecture.md + 5 diagramas (PT-BR)

- [ ] **F.5.a** Criar `docs/architecture.md` (PT-BR) com header + seção §1 + diagrama #1 inline (sequenceDiagram canônico §13.14) + cross-link `runbooks/incident-response.md`. Criar pasta `docs/architecture/diagrams/` e arquivo `request-flow.mmd` espelhando o inline.
  - Expected: ambos arquivos criados; mermaid renderiza em preview.
  - Commit: `docs(docs): adiciona architecture.md + diagrama #1 request-flow`
- [ ] **F.5.b** Adicionar diagrama #2 `persistence.mmd` (erDiagram) em `docs/architecture/diagrams/persistence.mmd` + seção em `architecture.md` + cross-link `runbooks/migrations.md`.
  - Expected: seção + arquivo criados.
  - Commit: `docs(docs): adiciona diagrama #2 persistência (ER)`
- [ ] **F.5.c** Adicionar diagrama #3 `observability.mmd` (flowchart TB: slog → Sentry → OTel → Prometheus → Grafana) + seção + cross-link `runbooks/sentry-alerts.md`.
  - Expected: OK.
  - Commit: `docs(docs): adiciona diagrama #3 observability stack`
- [ ] **F.5.d** Adicionar diagrama #4 `deploy.mmd` (flowchart LR: GH Actions → Vercel + Fly + Postgres backup) + seção + cross-link `runbooks/rollback.md`.
  - Expected: OK.
  - Commit: `docs(docs): adiciona diagrama #4 deploy pipeline`
- [ ] **F.5.e** Adicionar diagrama #5 `multi-tenant.mmd` (flowchart TB: workspaces + members + roles) + seção + cross-link `runbooks/workspace-isolation.md`.
  - Expected: OK.
  - Commit: `docs(docs): adiciona diagrama #5 multi-tenant model`
- [ ] **F.6** Adicionar cross-link reverso em cada `docs/runbooks/*.md` citado (incident-response, migrations, sentry-alerts, rollback, workspace-isolation, whatsapp): header `> Arquitetura: seção [#<slug>](../architecture.md#<slug>)`.
  - Expected: 6 runbooks atualizados.
  - Commit: `docs(docs): adiciona cross-link reverso runbooks → architecture`
- [ ] **F.7** Criar `docs/runbooks/sentry-alerts.md` se ausente.
  - Expected: doc com 3 regras + TTL LLM_LEGACY_NOCONTEXT.
  - Commit: `docs(ops): adiciona runbook sentry-alerts`

---

## Parte G — Cleanup

- [ ] **G.1** Investigar `apps/web/package-lock.json` modificado pré-existente.
  - Run: `git diff apps/web/package-lock.json | head -50`
  - Se divergência legítima: `git add apps/web/package-lock.json`. Se artefato: `git checkout -- apps/web/package-lock.json`.
  - Expected: árvore limpa.
  - Commit (se aplicável): `chore(pwa): resolve package-lock.json pendente`

---

## Parte H — Tag final

- [ ] **H.1** Rodar validações finais (§14):
  - `cd laura-go && go vet ./... && go test ./...`
  - `cd laura-go && gosec ./... 2>&1 | grep -c G104` — Expected: 0
  - `cd laura-go && staticcheck ./...`
  - `cd laura-go && go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | grep total` — Expected: >= 30%
  - `wc -l laura-go/main.go` — Expected: < 100
  - `cd apps/web && npx eslint src/lib/actions src/lib/services src/types --max-warnings=0`
- [ ] **H.2** Criar tag `phase-12-prepared`: `git tag -a phase-12-prepared -m "Fase 12: refactoring + performance + dívida técnica preparada para merge" && git push origin phase-12-prepared`.
  - Expected: tag criada e empurrada.
- [ ] **H.3** Abrir PR `fase-12-refactoring-performance` → `main` com checklist dos 37 itens §15.
  - Expected: PR URL retornada.

---

## Self-review — cobertura 1:1 dos 37 itens §15 → tasks v2

### Refactoring (6/6 IN_PLAN)

| # | Item v3 §15 | Task v2 | Status |
|---|-------------|---------|--------|
| 1 | `internal/bootstrap/db.go` + teste | A.1, A.2 | IN_PLAN |
| 2 | `internal/bootstrap/logger.go` + teste | A.3, A.4 | IN_PLAN |
| 3 | `internal/bootstrap/sentry.go` + teste | A.5, A.5b | IN_PLAN (teste NoOp explícito) |
| 4 | `internal/bootstrap/otel.go` + teste | A.6, A.6b | IN_PLAN (teste NoOp explícito) |
| 5 | `internal/bootstrap/metrics.go` + teste | A.7, A.7b | IN_PLAN (smoke test explícito) |
| 6 | `internal/health/handler.go` + teste | A.8 | IN_PLAN |

### Lint + Tests (7/7 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 7 | `api_e2e_test.go` HMAC + remove tag | B.2.1-B.2.4 | IN_PLAN |
| 8 | gosec G104 zerado admin/* | B.1.1-B.1.5 | IN_PLAN |
| 9 | 87 `no-explicit-any` zerados | B.4.2 | IN_PLAN |
| 10 | ESLint override + gate CI | B.4.1, B.4.4 | IN_PLAN |
| 11 | 6 react-hooks + 8 unescaped-entities | B.4.3 | IN_PLAN (baseline em 0.2) |
| 12 | `test/testmain.go` testcontainers | B.3.2 | IN_PLAN |
| 13 | Coverage Go > 30% | B.3.3 | IN_PLAN |

### Cache (6/6 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 14 | `cache.go` interface + GetOrCompute + singleflight | C.2, C.3 | IN_PLAN |
| 15 | `cache/redis.go` | C.4, C.4b | IN_PLAN |
| 16 | `cache/memory.go` LRU | C.5, C.5b | IN_PLAN |
| 17 | `bootstrap/cache.go` factory | C.6, C.6b | IN_PLAN |
| 18 | Integração 6 handlers + TTLs | C.7.dashboard, C.7.score, C.7.reports, C.7.categories | IN_PLAN (4 sub-tasks TDD) |
| 19 | CACHE_DISABLED + X-Cache header | C.2, C.7.* | IN_PLAN |

### Infra (5/5 IN_PLAN + 1 STANDBY)

| # | Item | Task | Status |
|---|------|------|--------|
| 20 | Migrations consolidadas + Dockerfile | D.1, D.2, D.3 | IN_PLAN |
| 21 | `docker-compose.ci.yml` + volume + down -v | D.4 | IN_PLAN |
| 22 | `.env.test` + `.env.test.example` | B.2.1 | IN_PLAN |
| 23 | pgx pool tuning + bench | A.1 (tuning) + C.8.pool (bench em `bootstrap/db_bench_test.go`) | IN_PLAN |
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
| 29 | Playwright full < 10min | F.1 | IN_PLAN (timeout 30min como guard-rail; target <10min) |
| 30 | Ctx em ChatCompletion | F.2 | IN_PLAN |
| 31 | Whatsmeow check real /ready | F.3 | IN_PLAN |
| 32 | LLM Ping real | F.4 | IN_PLAN |

### Docs + Cleanup (5/5 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 33 | `architecture.md` PT-BR 5 diagramas | F.5.a–F.5.e + F.6 | IN_PLAN |
| 34 | `runbooks/whatsapp.md` consolidado | D.6 (F.11 eliminado) | IN_PLAN |
| 35 | `runbooks/sentry-alerts.md` | F.7 | IN_PLAN |
| 36 | package-lock.json | G.1 | IN_PLAN |
| 37 | Tag `phase-12-prepared` | H.2 | IN_PLAN (tag canônica fixada) |

**Totais:** 37/37 IN_PLAN, 1 dependência STANDBY (`[REDIS-INSTANCE]`) — não bloqueia nenhuma task (fallback InMemory ativo em dev/CI).

### GAPs remanescentes para Review #2

1. **Diff exato `api_e2e_test.go`** — helper `authenticatedRequest` atual pode estar em arquivo diferente ou com assinatura diferente. Validar via `grep -n authenticatedRequest laura-go/internal/handlers/*.go` na task B.2.4 e ajustar diff se necessário.
2. **Quantidade real de arquivos `admin_*.go` com G104** — spec estima 4 (whatsapp, categories, users, stats). Se baseline 0.1 mostrar mais arquivos, adicionar B.1.6+.
3. **Dockerfile `apps/web`** — F.1 assume existência de `apps/web/Dockerfile`; confirmar ou adicionar task para criar se ausente.
4. **Workflow `go-ci.yml` existente** — B.3.3 assume arquivo existente; se ausente, criar do zero em sub-task.
5. **Runbooks citados pré-existentes** — F.6 adiciona cross-link reverso em `incident-response.md`, `migrations.md`, `rollback.md`, `workspace-isolation.md`. Validar existência ou criar stubs em Review #2.
