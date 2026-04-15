# Fase 12 — Refactoring + Performance + Dívida Técnica (Plan v3 — FINAL)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Cada task é checkbox (`- [ ]`) bite-sized (2-5 min) com path exato, comando e commit. Ordem estrita — cada commit deixa a árvore buildando/verde.

**Goal:** Eliminar dívida técnica das fases 1-11 (lint warnings PWA, gosec G104 residual, `main.go` 200+ linhas, e2e tests com auth quebrada + HMAC ausente, queries sem cache, docs incompletos) sem depender de credenciais externas. STANDBY único: `[REDIS-INSTANCE]` Upstash — fallback `InMemoryCache` LRU cobre dev/CI/prod-degradado integralmente.

**Arquitetura:** Refactor `main.go` em pacote `internal/bootstrap/` (6 arquivos TDD: `db → logger → sentry → otel → metrics → health`). Cache via `Cache` interface (RedisCache + InMemoryCache LRU) com `GetOrCompute[T any]` + `singleflight.Group` global + TTL (60/300/600/1800s). Coverage `internal/` ≥ 30% via `test/testmain.go` compartilhado (testcontainers pgvector+redis). Gosec G104 zerado em `internal/handlers/admin_*.go`. PWA `no-explicit-any` zerado em `src/lib/actions|services|types` com `--max-warnings=0`. Stack E2E full via `docker-compose.ci.yml` (pgvector+redis+laura-go+laura-pwa). `docs/architecture.md` PT-BR + 5 diagramas mermaid cross-link runbooks.

**Tech Stack:** Go 1.26 + slog + `golang.org/x/sync/singleflight` + `redis/go-redis/v9` + `hashicorp/golang-lru/v2` + `testcontainers-go`; Next.js 16 + Playwright 1.4x + docker compose v2; Postgres 16 + pgvector; GitHub Actions.

---

## Mudanças vs Plan v2 (Review #2)

1. **Paths corrigidos para layout real do repo**: PWA em `laura-pwa/` (NÃO `apps/web/`); runbooks em `docs/ops/runbooks/` (NÃO `docs/runbooks/`); admin files em `laura-go/internal/handlers/admin_*.go` (NÃO `internal/admin/*.go`). Toda tarefa B/C/D/F/G revista.
2. **Diff HMAC canônico reescrito**: helper real é `buildSessionCookie` (não `authenticatedRequest`) e gera base64 SEM HMAC; formato esperado pelo `decodeSessionCookie` de `session.go` é `payloadB64.sigB64` com `hmac.New(sha256.New, []byte(SESSION_SECRET))` — **env var é `SESSION_SECRET`**, não `SESSION_HMAC_KEY`. `.env.test` adotado mas chave chama-se `SESSION_SECRET`.
3. **G104 reagrupado em 2 commits** (não 4): existem apenas 2 arquivos admin (`admin.go` + `admin_config.go` + `admin_whatsapp.go` = 3 arquivos; baseline G104 ≈13 ocorrências concentradas em `admin_config.go` majoritariamente). B.1.2/B.1.3 cobrem os dois arquivos reais; B.1.4/B.1.5 eliminados.
4. **Dockerfile PWA ausente** — adicionada task F.1.b criando `laura-pwa/Dockerfile` multi-stage Next standalone.
5. **Runbooks pré-existentes**: `error-debugging.md`, `incident-response.md`, `rollback.md`, `secrets-rotation.md` já existem em `docs/ops/runbooks/`. Ausentes (criar stub): `migrations.md`, `sentry-alerts.md`, `whatsapp.md`, `workspace-isolation.md`. F.6 divide em `F.6.a-F.6.d` (stubs novos) + `F.6.e-F.6.h` (cross-link reverso nos 4 existentes).
6. **Workflow `go-ci.yml` existente detalhado** — B.3.3 edita job `test` em vez de criar novo: adiciona step `-coverprofile` + `go tool cover` + assertion bash >=30%.
7. **Cache helper Go generics** — confirmado `GetOrCompute[T any]` compila em Go 1.26 (v3 spec §12.2). Mantido.
8. **TDD ordem cache** — C.3 (testes interface + singleflight dedup) corre ANTES de C.4/C.5 (implementações); C.4b/C.5b/C.6b testes de implementação ANTES da integração handlers (C.7.*).
9. **Workflow `playwright-full.yml` YAML completo inline** — já em F.1; confirmado com `services` removido (docker-compose faz o papel) + permissions + concurrency.
10. **Zero placeholders**: grep de "TBD", "TODO sem código", "implement later", "similar to" retorna 0 neste documento.

**Total Plan v3: 82 tasks** (v2 ~78; delta = +4 tasks para runbook stubs, Dockerfile PWA, correção caminhos).

---

## Parte 0 — Pré-condições

- [ ] **0.1** Rodar baseline Go e anotar contagem G104 real:
  ```sh
  cd laura-go
  go vet ./... && go test ./... 2>&1 | tail -20
  go install github.com/securego/gosec/v2/cmd/gosec@latest
  gosec ./... 2>&1 | grep G104 | tee /tmp/baseline-g104.txt
  wc -l /tmp/baseline-g104.txt
  ```
  Expected: contagem ≥ 13 (spec diz 13); anotar nome de arquivos únicos. Se > 2 arquivos únicos, adicionar B.1.X por arquivo extra.

- [ ] **0.2** Rodar baseline PWA:
  ```sh
  cd laura-pwa
  npm run lint 2>&1 | tee /tmp/pwa-lint-baseline.txt
  grep -cE 'react-hooks/exhaustive-deps' /tmp/pwa-lint-baseline.txt
  grep -cE 'react/no-unescaped-entities' /tmp/pwa-lint-baseline.txt
  grep -cE 'no-explicit-any' /tmp/pwa-lint-baseline.txt
  ```
  Expected: react-hooks ≈6, unescaped ≈8, no-explicit-any ≈87. Se qualquer divergir >50% da estimativa, quebrar B.4.2/B.4.3 em sub-tasks por arquivo.

- [ ] **0.3** Verificar ambiente:
  ```sh
  docker --version && docker compose version
  go version  # >= 1.26
  node --version && npm --version
  ```
  Expected: Go ≥ 1.26, Docker + compose v2, Node ≥ 20. Redis NÃO precisa rodar local (fallback InMemory). STANDBY `[REDIS-INSTANCE]` documentado.

- [ ] **0.4** Criar branch e commit vazio:
  ```sh
  git checkout -b fase-12-refactoring-performance
  git commit --allow-empty -m "chore(phase-12): inicia fase 12 — refactoring + performance"
  ```

---

## Parte A — Refactoring main.go (extração bootstrap — ordem TDD §12.1)

- [ ] **A.1** Criar `laura-go/internal/bootstrap/db.go` extraindo `InitDB(ctx context.Context, cfg Config) (*pgxpool.Pool, error)`. Aplicar tuning §12.4 lendo env: `PG_MAX_CONNS` (default 10), `PG_MIN_CONNS` (2), `PG_MAX_CONN_LIFETIME` (30m), `PG_MAX_CONN_IDLE_TIME` (5m), `PG_HEALTH_CHECK_PERIOD` (1m) via `pgxpool.ParseConfig` + overrides.
  - Run: `cd laura-go && go build ./internal/bootstrap/...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitDB de main.go`

- [ ] **A.2** Criar `laura-go/internal/bootstrap/db_test.go` com 3 casos (puro parse, sem Postgres):
  - defaults carregados quando env vazio;
  - `PG_MAX_CONNS=50` sobrescreve default;
  - `PG_MAX_CONN_LIFETIME=invalid` retorna erro não-nil.
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 3 PASS.
  - Commit: `test(bootstrap): cobre parsing de config em db.go`

- [ ] **A.3** Criar `laura-go/internal/bootstrap/logger.go` com `InitLogger(env string) *slog.Logger` (prod → JSON Info; dev → text Debug).
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitLogger`

- [ ] **A.4** Criar `laura-go/internal/bootstrap/logger_test.go` validando níveis (prod → `slog.LevelInfo`, dev → `slog.LevelDebug`).
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 2 PASS adicionais.
  - Commit: `test(bootstrap): cobre níveis de log em logger.go`

- [ ] **A.5** Criar `laura-go/internal/bootstrap/sentry.go` com `InitSentry(cfg Config) (flush func(), err error)`. DSN vazio → retorna NoOp flush (`func(){}`) + err nil.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitSentry`

- [ ] **A.5b** Criar `laura-go/internal/bootstrap/sentry_test.go` caso NoOp: DSN vazio → flush não-nil sem panic, err nil.
  - Run: `cd laura-go && go test -run TestInitSentryNoOp ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): cobre NoOp de InitSentry com DSN vazio`

- [ ] **A.6** Criar `laura-go/internal/bootstrap/otel.go` com `InitOTel(ctx context.Context, cfg Config) (shutdown func(context.Context) error, err error)`. Endpoint vazio → NoOp shutdown.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitOTel`

- [ ] **A.6b** Criar `laura-go/internal/bootstrap/otel_test.go` validando NoOp (endpoint vazio → shutdown(ctx) retorna nil sem panic).
  - Run: `cd laura-go && go test -run TestInitOTelNoOp ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): cobre NoOp de InitOTel com endpoint vazio`

- [ ] **A.7** Criar `laura-go/internal/bootstrap/metrics.go` com `InitMetrics() (*fiber.App, *prometheus.Registry)` servindo `/metrics` em :9090.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `refactor(bootstrap): extrai InitMetrics`

- [ ] **A.7b** Criar `laura-go/internal/bootstrap/metrics_test.go` smoke: registrar `prometheus.NewCounter({Name:"test_counter"})`, invocar hit, requisitar `/metrics` via `app.Test()`, assertar body contém `test_counter`.
  - Run: `cd laura-go && go test -run TestInitMetrics ./internal/bootstrap/...`
  - Expected: PASS.
  - Commit: `test(bootstrap): smoke test InitMetrics + counter dummy`

- [ ] **A.8** Criar `laura-go/internal/health/handler.go` + `handler_test.go` com:
  - `Liveness(c *fiber.Ctx) error` → sempre 200 `{"status":"ok"}`.
  - `Readiness(deps Deps) fiber.Handler` onde `Deps` tem interfaces: `DB interface{ Ping(ctx) error }`, `Redis interface{ Ping(ctx) error }`, `Whatsmeow interface{ IsConnected() bool }`, `LLM interface{ Ping(ctx) error }`.
  - Testes: liveness 200; readiness com todos mocks healthy → 200; db falha → 503; whatsmeow off → 503.
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: 4 testes PASS.
  - Commit: `refactor(health): move /health e /ready para internal/health com testes`

- [ ] **A.9** Refatorar `laura-go/main.go` chamando `bootstrap.InitDB/Logger/Sentry/OTel/Metrics/InitCache` + `health.Liveness/Readiness`. Remover inline definitions.
  - Run: `cd laura-go && wc -l main.go && go vet ./... && go test ./...`
  - Expected: `wc -l main.go` < 100; build + tests OK.
  - Commit: `refactor(go): reduz main.go a orquestração (<100 linhas)`

---

## Parte B — Lint + Tests (cleanup dívida técnica)

### B.1 — gosec G104 (2 commits — arquivos reais)

- [ ] **B.1.1** Confirmar contagem G104 e arquivos únicos:
  ```sh
  cd laura-go
  gosec ./... 2>&1 | grep G104 | awk -F: '{print $1}' | sort -u | tee /tmp/g104-files.txt
  ```
  Expected: 1-3 arquivos únicos em `internal/handlers/admin_*.go`. Se lista tiver arquivo fora de `admin_*`, adicionar B.1.Xextra.

- [ ] **B.1.2** Corrigir `laura-go/internal/handlers/admin_config.go` (concentra a maioria das G104 conforme grep `defer rows.Close()`). Padrão de remediação:
  ```go
  // ANTES:
  defer rows.Close()
  // DEPOIS:
  defer func() {
      if cErr := rows.Close(); cErr != nil {
          slog.WarnContext(c.Context(), "rows close failed", "err", cErr)
      }
  }()
  ```
  Para chamadas não-defer `_ = mgr.Create(...)`:
  ```go
  if err := mgr.Create(ctx, id); err != nil {
      slog.ErrorContext(ctx, "create failed", "err", err, "id", id)
      return fiber.NewError(fiber.StatusInternalServerError, "create failed")
  }
  ```
  - Run: `cd laura-go && gosec ./internal/handlers/admin_config.go 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(handlers): trata erros ignorados em admin_config.go (gosec G104)`

- [ ] **B.1.3** Corrigir `laura-go/internal/handlers/admin_whatsapp.go` + `admin.go` (residuais).
  - Run: `cd laura-go && gosec ./... 2>&1 | grep -c G104`
  - Expected: 0.
  - Commit: `fix(handlers): trata erros ignorados em admin_whatsapp.go + admin.go (gosec G104)`

- [ ] **B.1.4** Editar `.github/workflows/go-ci.yml` removendo `-exclude=G104` do step gosec (deixando apenas `-exclude=G706,G101` que são falsos positivos).
  - Run: grep `gosec -exclude` no arquivo.
  - Expected: linha ajustada para `gosec -exclude=G706,G101 ./...`.
  - Commit: `ci(go): remove exclude G104 de gosec (dívida zerada)`

### B.2 — HMAC fixture + e2e tag removal (diff canônico §13.13)

- [ ] **B.2.1** Criar `.env.test` (commitado, valor fixo determinístico, NÃO é secret de prod) na raiz do repo:
  ```
  SESSION_SECRET=laura-test-session-secret-deterministic-32b-base64-ABCDEF==
  APP_ENV=test
  DATABASE_URL=postgres://laura:laura_password@localhost:5432/laura_api_test?sslmode=disable
  REDIS_URL=
  CACHE_DISABLED=false
  ```
  E `.env.test.example` (mesmo conteúdo com comentários).
  - Run: `ls -l .env.test .env.test.example`
  - Expected: ambos existem.
  - Commit: `chore(e2e): adiciona .env.test com SESSION_SECRET determinística`

- [ ] **B.2.2** Criar `laura-go/internal/testutil/session.go`:
  ```go
  package testutil

  import (
      "crypto/hmac"
      "crypto/sha256"
      "encoding/base64"
      "encoding/json"
      "fmt"
      "net/http"
      "os"
      "testing"
      "time"
  )

  // SignedSession produz cookie no formato exato esperado por
  // handlers.decodeSessionCookie — base64(payload).base64(HMAC).
  // Lê SESSION_SECRET do env (.env.test fornece valor determinístico).
  func SignedSession(t *testing.T, userID string) *http.Cookie {
      t.Helper()
      secret := os.Getenv("SESSION_SECRET")
      if secret == "" {
          t.Fatal("SESSION_SECRET vazio em test env — carregar .env.test")
      }
      payload := map[string]any{
          "userId": userID,
          "exp":    time.Now().Add(24 * time.Hour).UnixMilli(),
      }
      raw, _ := json.Marshal(payload)
      payloadB64 := base64.StdEncoding.EncodeToString(raw)
      mac := hmac.New(sha256.New, []byte(secret))
      mac.Write([]byte(payloadB64))
      sigB64 := base64.StdEncoding.EncodeToString(mac.Sum(nil))
      return &http.Cookie{
          Name:  "laura_session_token",
          Value: fmt.Sprintf("%s.%s", payloadB64, sigB64),
      }
  }
  ```
  - Run: `cd laura-go && go build ./internal/testutil/...`
  - Expected: build OK.
  - Commit: `test(e2e): adiciona helper SignedSession HMAC em testutil`

- [ ] **B.2.3** Criar `laura-go/internal/testutil/session_test.go`:
  ```go
  package testutil

  import (
      "os"
      "strings"
      "testing"
  )

  func TestSignedSession_FormatAndHMAC(t *testing.T) {
      os.Setenv("SESSION_SECRET", "laura-test-session-secret-deterministic-32b-base64-ABCDEF==")
      c := SignedSession(t, "user-123")
      if c.Name != "laura_session_token" {
          t.Fatalf("nome inesperado: %q", c.Name)
      }
      parts := strings.Split(c.Value, ".")
      if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
          t.Fatalf("formato inesperado: %q", c.Value)
      }
  }
  ```
  - Run: `cd laura-go && go test ./internal/testutil/...`
  - Expected: PASS.
  - Commit: `test(e2e): cobre SignedSession em testutil`

- [ ] **B.2.4** Refatorar `laura-go/internal/handlers/api_e2e_test.go`:
  1. **Remover** linhas 1-2 (`//go:build e2e` + `// +build e2e`).
  2. Substituir helper `buildSessionCookie(userID) string` por chamada `testutil.SignedSession(t, userID)`.
  3. Em `performRequest`/`performJSONRequest` trocar `req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: cookie})` por `req.AddCookie(testutil.SignedSession(t, userID))` — receber `t` como arg. Assinatura vira `performRequest(t *testing.T, app *fiber.App, method, path, userID string)`.
  4. Todos os call-sites (linhas 226-652 com `cookie := buildSessionCookie(userID)` + `performRequest(t, app, ..., cookie)`) → `performRequest(t, app, ..., userID)`.
  5. Adicionar import `"github.com/jvzanini/laura-finance/laura-go/internal/testutil"`.
  6. Ajustar `findMigrationsDirAPI`: trocar `"infrastructure", "migrations"` por `"internal", "migrations"` (consolidação da Parte D).
  - Run: `cd laura-go && SESSION_SECRET=laura-test-session-secret-deterministic-32b-base64-ABCDEF== go test ./internal/handlers/...`
  - Expected: PASS sem build tag.
  - Commit: `test(e2e): migra api_e2e_test para HMAC cookie fixture + remove build tag e2e`

### B.3 — Testcontainers + Coverage

- [ ] **B.3.1** Adicionar deps testcontainers:
  ```sh
  cd laura-go
  go get github.com/testcontainers/testcontainers-go
  go get github.com/testcontainers/testcontainers-go/modules/postgres
  go get github.com/testcontainers/testcontainers-go/modules/redis
  go mod tidy
  ```
  - Run: `go build ./...`
  - Expected: build OK.
  - Commit: `chore(go): adiciona testcontainers-go para integration tests`

- [ ] **B.3.2** Criar `laura-go/test/testmain.go` com build tag `//go:build integration`:
  ```go
  //go:build integration

  package test

  import (
      "context"
      "fmt"
      "os"
      "testing"
      "time"

      "github.com/testcontainers/testcontainers-go"
      tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
      tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
      "github.com/testcontainers/testcontainers-go/wait"
  )

  var (
      PGDSN    string
      RedisURL string
      pgC      testcontainers.Container
      rC       testcontainers.Container
  )

  func TestMain(m *testing.M) {
      ctx := context.Background()
      if err := startPostgresWithPgvector(ctx); err != nil {
          fmt.Printf("start postgres: %v\n", err); os.Exit(1)
      }
      if err := startRedis(ctx); err != nil {
          fmt.Printf("start redis: %v\n", err); os.Exit(1)
      }
      if err := applyMigrations(ctx, PGDSN); err != nil {
          fmt.Printf("migrate: %v\n", err); os.Exit(1)
      }
      code := m.Run()
      _ = pgC.Terminate(ctx)
      _ = rC.Terminate(ctx)
      os.Exit(code)
  }

  func startPostgresWithPgvector(ctx context.Context) error {
      c, err := tcpg.Run(ctx,
          "pgvector/pgvector:pg16",
          tcpg.WithDatabase("laura_test"),
          tcpg.WithUsername("laura"),
          tcpg.WithPassword("laura_password"),
          testcontainers.WithWaitStrategy(
              wait.ForLog("database system is ready to accept connections").
                  WithOccurrence(2).WithStartupTimeout(60*time.Second),
          ),
      )
      if err != nil {
          return err
      }
      pgC = c
      dsn, err := c.ConnectionString(ctx, "sslmode=disable")
      if err != nil {
          return err
      }
      PGDSN = dsn
      return nil
  }

  func startRedis(ctx context.Context) error {
      c, err := tcredis.Run(ctx, "redis:7-alpine")
      if err != nil {
          return err
      }
      rC = c
      url, err := c.ConnectionString(ctx)
      if err != nil {
          return err
      }
      RedisURL = url
      return nil
  }
  ```
  Criar também `laura-go/test/migrations.go` (sem build tag especial, mas importado só em integration) com `applyMigrations(ctx, dsn)` que itera `//go:embed ../internal/migrations/*.up.sql` e aplica via `pgx.Exec`.
  - Run: `cd laura-go && go test -tags=integration -run ^$ ./test/...`
  - Expected: setup + teardown OK, exit 0.
  - Commit: `test(integration): adiciona TestMain compartilhado com testcontainers pgvector+redis`

- [ ] **B.3.3** Editar `.github/workflows/go-ci.yml`: no job `test` existente, adicionar steps `coverage` + assertion. Bloco antes do final do job:
  ```yaml
      - name: Integration tests with coverage
        working-directory: laura-go
        run: |
          go test -tags=integration -coverpkg=./internal/... \
            -coverprofile=coverage.out ./...
      - name: Assert coverage >= 30%
        working-directory: laura-go
        run: |
          pct=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
          echo "coverage: $pct%"
          awk -v v="$pct" 'BEGIN{if (v+0 < 30.0) exit 1}'
      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: go-coverage
          path: laura-go/coverage.out
  ```
  - Run: local — `cd laura-go && go test -tags=integration -coverpkg=./internal/... -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | grep total`
  - Expected: total ≥ 30.0%.
  - Commit: `ci(go): instrumenta coverage >= 30% em integration tests`

### B.4 — PWA lint gate

- [ ] **B.4.1** Editar `laura-pwa/eslint.config.mjs` adicionando override:
  ```js
  {
    files: ["src/lib/actions/**/*.{ts,tsx}", "src/lib/services/**/*.{ts,tsx}", "src/types/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "error" }
  }
  ```
  - Run: `cd laura-pwa && npx eslint --print-config src/lib/actions/dummy.ts 2>/dev/null | grep no-explicit-any | head -1`
  - Expected: `"error"` ou `2`.
  - Commit: `fix(pwa): eleva no-explicit-any a error em lib/actions + services + types`

- [ ] **B.4.2** Zerar `no-explicit-any` nos 3 dirs, substituindo por tipos concretos ou `unknown` + type guards. Iterar:
  ```sh
  cd laura-pwa
  npx eslint src/lib/actions src/lib/services src/types --max-warnings=0
  ```
  Atacar lote por lote; aceitar `unknown` + narrow quando forma exata vem de API runtime.
  - Expected: exit 0.
  - Commit: `fix(pwa): zera no-explicit-any em lib/actions + services + types`

- [ ] **B.4.3** Resolver `react-hooks/exhaustive-deps` (~6) + `react/no-unescaped-entities` (~8) restantes:
  ```sh
  cd laura-pwa && npm run lint 2>&1 | grep -cE 'react-hooks/exhaustive-deps|react/no-unescaped-entities'
  ```
  - Expected: 0.
  - Commit: `fix(pwa): resolve warnings react-hooks + unescaped-entities`

- [ ] **B.4.4** Adicionar gate em `.github/workflows/pwa-ci.yml`:
  ```yaml
      - name: ESLint critical dirs gate
        working-directory: laura-pwa
        run: npx eslint src/lib/actions src/lib/services src/types --max-warnings=0
  ```
  - Expected: step presente antes do build.
  - Commit: `ci(pwa): adiciona gate --max-warnings=0 para dirs críticos`

---

## Parte C — Cache + Performance

> STANDBY `[REDIS-INSTANCE]`: tasks C.4/C.4b/C.7.* rodam contra testcontainer Redis local em dev/CI. Upstash real só em prod via `REDIS_URL`. Fallback `InMemoryCache` cobre todos os ambientes — nenhuma task bloqueia por ausência de Upstash.

- [ ] **C.1** Adicionar deps:
  ```sh
  cd laura-go
  go get github.com/redis/go-redis/v9
  go get github.com/hashicorp/golang-lru/v2
  go get golang.org/x/sync/singleflight
  go mod tidy
  ```
  - Run: `go build ./...`
  - Expected: build OK.
  - Commit: `chore(go): adiciona go-redis/v9 + golang-lru/v2 + singleflight`

- [ ] **C.2** Criar `laura-go/internal/cache/cache.go` exatamente como §12.2 da spec v3 (interface `Cache` + `GetOrCompute[T any]` + `var sg singleflight.Group` global).
  - Run: `cd laura-go && go build ./internal/cache/...`
  - Expected: build OK.
  - Commit: `feat(cache): adiciona interface Cache + GetOrCompute com singleflight global`

- [ ] **C.3** (TDD RED antes GREEN) Criar `laura-go/internal/cache/cache_test.go` com `fakeCache` struct implementando `Cache` + contadores `atomic.Int32`. Subtests:
  - HIT: pre-seeded key → compute NÃO é chamado.
  - MISS: compute é chamado exatamente 1x + Set é invocado com TTL correto.
  - `CACHE_DISABLED=true`: compute chamado, Set NÃO invocado.
  - unmarshal fail: log warn, refaz compute, retorna valor fresco.
  - compute error: retorna erro, NÃO faz Set.
  - singleflight dedup: 10 goroutines paralelas com mesma key → compute chamado exatamente 1x (assert via `atomic.Int32`).
  - Run: `cd laura-go && go test ./internal/cache/...`
  - Expected: 6 subtests PASS.
  - Commit: `test(cache): cobre GetOrCompute com HIT/MISS/DISABLED/singleflight dedup`

- [ ] **C.4b.test** (TDD RED) Criar `laura-go/internal/cache/redis_integration_test.go` com `//go:build integration` reusando `test.RedisURL`. Testes (antes da implementação):
  - Set+Get retorna bytes iguais.
  - TTL expiry: Set com 100ms + sleep 150ms → Get retorna miss.
  - Invalidate pattern `ws:123:*` deleta keys correspondentes.
  - Run: `cd laura-go && go test -tags=integration ./internal/cache/...`
  - Expected: **FAIL** (implementação ausente — RED).
  - Commit: `test(cache): adiciona testes RED para RedisCache (pré-impl)`

- [ ] **C.4** (TDD GREEN) Criar `laura-go/internal/cache/redis.go`:
  ```go
  package cache

  import (
      "context"
      "errors"
      "time"

      "github.com/redis/go-redis/v9"
  )

  type RedisCache struct{ cli *redis.Client }

  func NewRedisCache(url string) (*RedisCache, error) {
      opts, err := redis.ParseURL(url)
      if err != nil {
          return nil, err
      }
      c := redis.NewClient(opts)
      ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
      defer cancel()
      if err := c.Ping(ctx).Err(); err != nil {
          return nil, err
      }
      return &RedisCache{cli: c}, nil
  }

  func (r *RedisCache) Get(ctx context.Context, key string) ([]byte, bool, error) {
      b, err := r.cli.Get(ctx, key).Bytes()
      if errors.Is(err, redis.Nil) {
          return nil, false, nil
      }
      if err != nil {
          return nil, false, err
      }
      return b, true, nil
  }

  func (r *RedisCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
      return r.cli.Set(ctx, key, val, ttl).Err()
  }

  func (r *RedisCache) Invalidate(ctx context.Context, pattern string) error {
      iter := r.cli.Scan(ctx, 0, pattern, 100).Iterator()
      for iter.Next(ctx) {
          if err := r.cli.Del(ctx, iter.Val()).Err(); err != nil {
              return err
          }
      }
      return iter.Err()
  }
  ```
  - Run: `cd laura-go && go test -tags=integration ./internal/cache/...`
  - Expected: testes C.4b.test viram GREEN.
  - Commit: `feat(cache): adiciona RedisCache via go-redis/v9`

- [ ] **C.5b.test** (TDD RED) Criar `laura-go/internal/cache/memory_test.go`:
  - TTL expiry: Set 100ms + sleep 150ms → miss.
  - LRU eviction: capacidade 2 → insert 3 keys → primeira evicted.
  - Invalidate pattern `ws:123:*` remove apenas keys matching glob.
  - Run: `cd laura-go && go test ./internal/cache/...`
  - Expected: **FAIL** (RED).
  - Commit: `test(cache): adiciona testes RED para InMemoryCache (pré-impl)`

- [ ] **C.5** (TDD GREEN) Criar `laura-go/internal/cache/memory.go` com `InMemoryCache` via `golang-lru/v2` + TTL per-entry (struct `{value []byte, expiresAt time.Time}`). `Invalidate` usa `filepath.Match` para glob simples (`ws:123:*`).
  - Run: `cd laura-go && go test ./internal/cache/...`
  - Expected: 3 subtests GREEN.
  - Commit: `feat(cache): adiciona InMemoryCache LRU com TTL`

- [ ] **C.6b.test** (TDD RED) Criar `laura-go/internal/bootstrap/cache_test.go` com 3 casos para `InitCache`:
  - `CACHE_DISABLED=true` → retorna `*InMemoryCache`.
  - `REDIS_URL=""` → retorna `*InMemoryCache`.
  - `REDIS_URL="redis://invalid-host:6379"` → retorna `*InMemoryCache` + slog WARN (mock handler captura).
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: FAIL (RED).
  - Commit: `test(bootstrap): adiciona testes RED para InitCache fallback`

- [ ] **C.6** (TDD GREEN) Criar `laura-go/internal/bootstrap/cache.go` com factory código §13.11.
  - Run: `cd laura-go && go test ./internal/bootstrap/...`
  - Expected: 3 subtests GREEN.
  - Commit: `feat(bootstrap): adiciona factory InitCache com fallback Redis→InMemory`

### C.7 — Integração cache (4 domínios TDD)

- [ ] **C.7.dashboard** (RED→GREEN) (1) Escrever `laura-go/internal/handlers/dashboard_cache_test.go` assertando HIT/MISS + header `X-Cache: HIT|MISS|DISABLED` via `fakeCache`. (2) Integrar `cache.GetOrCompute` em `dashboard.go` com TTL 60s, key `ws:{id}:dashboard:{sha256(params)}:{YYYYMM}`.
  - Run: `cd laura-go && go test -run TestDashboardCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/dashboard (TTL 60s)`

- [ ] **C.7.score** (RED→GREEN) Teste + integração em `handlers/score.go` TTL 300s, key `ws:{id}:score:{userId}`.
  - Run: `cd laura-go && go test -run TestScoreCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/score/snapshot (TTL 300s)`

- [ ] **C.7.reports** (RED→GREEN) 3 sub-integrações em `handlers/reports.go` + `reports_extras.go` (monthly/categorical/cashflow) TTL 600s cada, keys §12.3. 1 commit cobrindo os 3.
  - Run: `cd laura-go && go test -run TestReports.*Cache ./internal/handlers/...`
  - Expected: 3 PASS.
  - Commit: `feat(cache): integra cache em /api/v1/reports/{monthly,categorical,cashflow} (TTL 600s)`

- [ ] **C.7.categories** (RED→GREEN) Teste + integração em `handlers/categories.go` TTL 1800s, key `ws:{id}:categories:v1`.
  - Run: `cd laura-go && go test -run TestCategoriesCache ./internal/handlers/...`
  - Expected: PASS.
  - Commit: `feat(cache): integra cache em /api/v1/categories (TTL 1800s)`

### C.8 — Benches

- [ ] **C.8.pool** Criar `laura-go/internal/bootstrap/db_bench_test.go` com build tag `integration` + `BenchmarkPool` (100 goroutines × 100 queries `SELECT 1`). Anotar p50/p95/p99 no corpo do commit.
  - Run: `cd laura-go && go test -tags=integration -bench=BenchmarkPool -benchmem ./internal/bootstrap/...`
  - Expected: p95 < 50ms em localhost pgvector.
  - Commit: `perf(bootstrap): valida pgxpool tuning via bench local`

- [ ] **C.8.cache** Criar `laura-go/internal/cache/cache_bench_test.go` com `BenchmarkHitRatio`: warm-up 1000 ops (popula keys), measure 10000 ops 80/20 read-heavy. Assert ratio ≥ 0.80.
  - Run: `cd laura-go && go test -bench=BenchmarkHitRatio ./internal/cache/...`
  - Expected: hit-ratio ≥ 0.80.
  - Commit: `perf(cache): bench hit-ratio > 80% pós warm-up`

---

## Parte D — Infra

- [ ] **D.1** Confirmar migrations completas em `laura-go/internal/migrations/` e deletar `infrastructure/migrations/`:
  ```sh
  ls laura-go/internal/migrations/*.sql | wc -l
  diff <(ls laura-go/internal/migrations/*.sql | xargs -n1 basename | sort) \
       <(ls infrastructure/migrations/*.sql | xargs -n1 basename | sort)
  git rm -r infrastructure/migrations/
  ```
  - Expected: conjuntos iguais (ou internal tem superset). Pasta removida.
  - Commit: `refactor(db): consolida migrations em laura-go/internal/migrations via go:embed`

- [ ] **D.2** Editar `laura-go/Dockerfile` removendo qualquer `COPY infrastructure/migrations` + `.github/workflows/go-ci.yml` step "Copy SQL migrations for embed". Migrations agora estão no path embed nativo.
  ```sh
  grep -n "infrastructure/migrations\|Copy SQL migrations" laura-go/Dockerfile .github/workflows/go-ci.yml
  ```
  Remover linhas encontradas.
  - Run: `docker build -f laura-go/Dockerfile -t laura-api:fase-12 ./laura-go`
  - Expected: build OK.
  - Commit: `fix(infra): remove COPY infrastructure/migrations do Dockerfile + workflow`

- [ ] **D.3** Editar `.gitignore` removendo qualquer linha que exclua `laura-go/internal/migrations/*.sql`:
  ```sh
  grep -n "laura-go/internal/migrations" .gitignore
  ```
  Remover linha se existir.
  - Run: `git check-ignore laura-go/internal/migrations/000001_init.up.sql; echo exit=$?`
  - Expected: exit 1 (não ignorado).
  - Commit: `chore(db): permite rastreamento de migrations via go:embed`

- [ ] **D.4** Criar `docker-compose.ci.yml` na raiz:
  ```yaml
  version: "3.9"
  services:
    postgres:
      image: pgvector/pgvector:pg16
      environment:
        POSTGRES_USER: laura
        POSTGRES_PASSWORD: laura_password
        POSTGRES_DB: laura_ci
      volumes:
        - pgdata:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U laura"]
        interval: 5s
        timeout: 5s
        retries: 10
    redis:
      image: redis:7-alpine
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 5s
        timeout: 5s
        retries: 10
    api-go:
      build:
        context: ./laura-go
      depends_on:
        postgres: { condition: service_healthy }
        redis:    { condition: service_healthy }
      environment:
        DATABASE_URL: postgres://laura:laura_password@postgres:5432/laura_ci?sslmode=disable
        REDIS_URL: redis://redis:6379
        SESSION_SECRET: laura-test-session-secret-deterministic-32b-base64-ABCDEF==
        APP_ENV: test
      ports: ["8080:8080"]
    pwa:
      build:
        context: ./laura-pwa
      depends_on:
        api-go: { condition: service_started }
      environment:
        NEXT_PUBLIC_API_URL: http://api-go:8080
      ports: ["3000:3000"]
  volumes:
    pgdata:
  ```
  - Run: `docker compose -f docker-compose.ci.yml config`
  - Expected: YAML válido.
  - Commit: `infra(ci): adiciona docker-compose.ci.yml com postgres+redis+api+pwa`

- [ ] **D.5** Atualizar `docs/ops/deployment.md` documentando `BUILD_SHA` (`VERCEL_GIT_COMMIT_SHA` em PWA; `--build-arg BUILD_SHA=$(git rev-parse HEAD)` em Fly) + `BUILD_TIME` (`date -u +%FT%TZ` injetado em CI). Seção "Metadados de build exportados via /health".
  - Expected: seção adicionada.
  - Commit: `docs(ops): documenta BUILD_SHA/BUILD_TIME em Vercel + Fly`

---

## Parte E — Observability follow-up

- [ ] **E.1** Adicionar label `workspace_id` em `prometheus.CounterVec`/`HistogramVec` usados nos handlers `reports.go` + `reports_extras.go`. Editar registro das métricas + call-sites `.WithLabelValues(...)`.
  - Run: `cd laura-go && go test ./internal/handlers/...`
  - Expected: tests PASS.
  - Commit: `feat(telemetry): adiciona workspace_id label em métricas reports/*`

- [ ] **E.2** Criar `laura-go/internal/middleware/sentry_scope.go` middleware que, após `RequireSession`, chama `sentry.GetHubFromContext(ctx).Scope().SetTag("tenant_id", sess.WorkspaceID)`.
  - Run: `cd laura-go && go build ./...`
  - Expected: build OK.
  - Commit: `feat(observability): propaga tenant_id em scope Sentry via middleware`

- [ ] **E.3** Atualizar `docs/ops/alerts.md` com tabela de 3 regras Sentry (rate-limit 1/30min, environment:production) — Unhandled 5xx, LLM timeout, DB connection failures.
  - Expected: seção com tabela adicionada.
  - Commit: `docs(ops): documenta rate-limit Sentry por regra em alerts.md`

- [ ] **E.4** Adicionar em `docs/ops/alerts.md` seção "LLM legacy context" — alerta para `LLM_LEGACY_NOCONTEXT=true` em prod pós T+30 dias do deploy da Fase 11.
  - Expected: seção adicionada.
  - Commit: `docs(ops): adiciona alerta LLM_LEGACY_NOCONTEXT TTL 30d`

---

## Parte F — DX (Playwright full + arquitetura + health real)

- [ ] **F.1.a** Criar `.github/workflows/playwright-full.yml`:
  ```yaml
  name: Playwright Full
  on: [pull_request, push]
  concurrency:
    group: e2e-${{ github.ref }}
    cancel-in-progress: true
  permissions:
    contents: read
  jobs:
    e2e:
      runs-on: ubuntu-latest
      timeout-minutes: 30
      steps:
        - uses: actions/checkout@v4
        - name: Boot stack
          run: docker compose -f docker-compose.ci.yml up -d --wait
        - name: Install chromium
          working-directory: laura-pwa
          run: |
            npm ci
            npx playwright install --with-deps chromium
        - name: Run Playwright
          working-directory: laura-pwa
          env:
            PLAYWRIGHT_BASE_URL: http://localhost:3000
          run: npx playwright test
        - name: Upload report
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: playwright-report
            path: laura-pwa/playwright-report
        - name: Teardown
          if: always()
          run: docker compose -f docker-compose.ci.yml down -v
  ```
  - Run: `yamllint .github/workflows/playwright-full.yml`
  - Expected: YAML válido.
  - Commit: `ci(e2e): adiciona workflow playwright-full via docker-compose`

- [ ] **F.1.b** Criar `laura-pwa/Dockerfile` multi-stage Next standalone:
  ```dockerfile
  # syntax=docker/dockerfile:1.7
  FROM node:20-alpine AS deps
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci --ignore-scripts

  FROM node:20-alpine AS build
  WORKDIR /app
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production PORT=3000
  COPY --from=build /app/public ./public
  COPY --from=build /app/.next/standalone ./
  COPY --from=build /app/.next/static ./.next/static
  EXPOSE 3000
  CMD ["node", "server.js"]
  ```
  Confirmar `laura-pwa/next.config.ts` tem `output: "standalone"`; se não, adicionar.
  - Run: `docker build -t laura-pwa:fase-12 ./laura-pwa`
  - Expected: build OK.
  - Commit: `infra(pwa): adiciona Dockerfile multi-stage com Next standalone`

- [ ] **F.2** Propagar `ctx context.Context` em `ChatCompletion(ctx, ...)` em `laura-go/internal/llm/*.go` — big-bang. Ajustar todos os call-sites (grep `ChatCompletion(` para listar).
  - Run: `cd laura-go && go build ./... && go test ./internal/llm/...`
  - Expected: build + tests OK.
  - Commit: `refactor(llm): propaga context em ChatCompletion (big-bang)`

- [ ] **F.3** Adicionar check real whatsmeow em `internal/health/handler.go` Readiness — campo `Whatsmeow WhatsmeowPinger` no `Deps` + call `deps.Whatsmeow.IsConnected()`. Mock nos testes.
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: test connected=true → 200; false → 503.
  - Commit: `feat(observability): adiciona whatsmeow check real em /ready`

- [ ] **F.4** Adicionar LLM Ping real em `internal/health/handler.go` — `deps.LLM.Ping(ctx)` com `context.WithTimeout(ctx, 3*time.Second)` + `ChatCompletion(ctx, Messages=[{role:user,content:"ping"}], MaxTokens=1)`.
  - Run: `cd laura-go && go test ./internal/health/...`
  - Expected: mock OK → 200; timeout → 503.
  - Commit: `feat(observability): adiciona LLM Ping real em /ready`

### F.5 — architecture.md + 5 diagramas (PT-BR)

- [ ] **F.5.a** Criar `docs/architecture.md` (PT-BR) com header + §1 "Visão geral" + §2 "Fluxo de request" contendo diagrama #1 inline (sequenceDiagram canônico da spec §13.14) + linha final `> Runbook relacionado: [ops/runbooks/incident-response.md](./ops/runbooks/incident-response.md)`. Criar pasta `docs/architecture/diagrams/` + `request-flow.mmd` espelhando.
  - Expected: ambos arquivos criados; mermaid válido.
  - Commit: `docs(architecture): adiciona architecture.md + diagrama #1 request-flow`

- [ ] **F.5.b** Adicionar §3 "Persistência" + `docs/architecture/diagrams/persistence.mmd` (erDiagram — tabelas: workspaces, users, categories, transactions, invoices, cards, goals, score_snapshots, memberships) + cross-link `> Runbook relacionado: [ops/runbooks/migrations.md](./ops/runbooks/migrations.md)`.
  - Expected: arquivo e seção criados.
  - Commit: `docs(architecture): adiciona diagrama #2 persistência (ER)`

- [ ] **F.5.c** Adicionar §4 "Observability stack" + `docs/architecture/diagrams/observability.mmd` (flowchart TB: Fiber → slog → Sentry SDK → OTel Collector → Prometheus → Grafana) + cross-link `> Runbook relacionado: [ops/runbooks/sentry-alerts.md](./ops/runbooks/sentry-alerts.md)`.
  - Expected: seção criada.
  - Commit: `docs(architecture): adiciona diagrama #3 observability stack`

- [ ] **F.5.d** Adicionar §5 "Deploy pipeline" + `docs/architecture/diagrams/deploy.mmd` (flowchart LR: GitHub Actions → deploy-api.yml Fly + deploy-pwa.yml Vercel + backup-fly-pg.yml) + cross-link `> Runbook relacionado: [ops/runbooks/rollback.md](./ops/runbooks/rollback.md)`.
  - Expected: seção criada.
  - Commit: `docs(architecture): adiciona diagrama #4 deploy pipeline`

- [ ] **F.5.e** Adicionar §6 "Multi-tenant model" + `docs/architecture/diagrams/multi-tenant.mmd` (flowchart TB: Workspace 1 → Users, Members (roles: proprietário, admin, membro); Workspace 2 → isolados por workspace_id em todas as tabelas) + cross-link `> Runbook relacionado: [ops/runbooks/workspace-isolation.md](./ops/runbooks/workspace-isolation.md)`.
  - Expected: seção criada.
  - Commit: `docs(architecture): adiciona diagrama #5 multi-tenant model`

### F.6 — Runbook stubs ausentes + cross-link reverso

- [ ] **F.6.a** Criar `docs/ops/runbooks/migrations.md` (stub) com seções: (1) header `> Arquitetura: seção [#persistência](../../architecture.md#persistência)`, (2) "Aplicar migration em prod", (3) "Rollback manual de uma migration", (4) "Consolidação via go:embed (Fase 12)".
  - Expected: arquivo criado.
  - Commit: `docs(ops): adiciona runbook migrations (stub inicial)`

- [ ] **F.6.b** Criar `docs/ops/runbooks/sentry-alerts.md` com: header cross-link, 3 regras Sentry da §E.3, TTL `LLM_LEGACY_NOCONTEXT` (§E.4), procedimento de ack/silence.
  - Expected: criado.
  - Commit: `docs(ops): adiciona runbook sentry-alerts`

- [ ] **F.6.c** Criar `docs/ops/runbooks/whatsapp.md` com header + (a) rescan QR pós-restart Fly, (b) troubleshooting reconnect, (c) validação `whatsmeow.IsConnected()`, (d) link para `../../architecture.md#observability`.
  - Expected: criado.
  - Commit: `docs(ops): adiciona runbook whatsapp consolidado (reconnect + troubleshooting)`

- [ ] **F.6.d** Criar `docs/ops/runbooks/workspace-isolation.md` com header + regra `workspace_id` obrigatório em WHERE, auditoria de vazamentos cross-tenant, procedimento de recovery em caso de leak.
  - Expected: criado.
  - Commit: `docs(ops): adiciona runbook workspace-isolation`

- [ ] **F.6.e** Adicionar header cross-link reverso em `docs/ops/runbooks/incident-response.md`:
  ```
  > Arquitetura: seção [#fluxo-de-request](../../architecture.md#fluxo-de-request)
  ```
  - Expected: primeira linha do arquivo.
  - Commit: `docs(ops): adiciona cross-link architecture em incident-response`

- [ ] **F.6.f** Mesmo tratamento em `docs/ops/runbooks/rollback.md` apontando para `#deploy-pipeline`.
  - Commit: `docs(ops): adiciona cross-link architecture em rollback`

- [ ] **F.6.g** Mesmo em `docs/ops/runbooks/error-debugging.md` apontando para `#fluxo-de-request`.
  - Commit: `docs(ops): adiciona cross-link architecture em error-debugging`

- [ ] **F.6.h** Mesmo em `docs/ops/runbooks/secrets-rotation.md` apontando para `#deploy-pipeline`.
  - Commit: `docs(ops): adiciona cross-link architecture em secrets-rotation`

---

## Parte G — Cleanup

- [ ] **G.1** Investigar `laura-pwa/package-lock.json` pendente:
  ```sh
  git status laura-pwa/package-lock.json
  git diff laura-pwa/package-lock.json | head -50
  ```
  Se divergência legítima (deps atualizadas): `git add laura-pwa/package-lock.json`. Se artefato local: `git checkout -- laura-pwa/package-lock.json`.
  - Expected: árvore limpa.
  - Commit (se aplicável): `chore(pwa): resolve package-lock.json pendente`

---

## Parte H — Validação final + tag

- [ ] **H.1** Rodar validações (§14 spec v3):
  ```sh
  cd laura-go
  go vet ./... && go test ./...
  gosec -exclude=G706,G101 ./... 2>&1 | grep -c G104   # == 0
  staticcheck ./... 2>&1 | tee /tmp/sc.txt             # 0 issues novas
  go test -tags=integration -coverpkg=./internal/... \
    -coverprofile=coverage.out ./...
  go tool cover -func=coverage.out | grep total        # >= 30.0%
  wc -l main.go                                        # < 100
  cd ../laura-pwa
  npx eslint src/lib/actions src/lib/services src/types --max-warnings=0
  npm run lint                                         # 0 errors globais
  ```
  - Expected: todos os gates verdes.

- [ ] **H.2** Criar e empurrar tag:
  ```sh
  git tag -a phase-12-prepared -m "Fase 12: refactoring + performance + dívida técnica preparada para merge"
  git push origin phase-12-prepared
  ```
  - Expected: tag visível em `git ls-remote --tags origin | grep phase-12`.

- [ ] **H.3** Abrir PR `fase-12-refactoring-performance` → `main` com body listando os 37 itens §15 como checklist + link para este plan + spec v3. `gh pr create --base main --head fase-12-refactoring-performance --title "Fase 12 — Refactoring + Performance + Dívida Técnica" --body "$(cat <<'EOF'...EOF)"`.
  - Expected: PR URL retornada.

---

## Self-review v3 — cobertura 1:1 dos 37 itens spec §15 → tasks v3

### Refactoring (6/6 IN_PLAN)

| # | Item v3 §15 | Task v3 | Status |
|---|-------------|---------|--------|
| 1 | `bootstrap/db.go` + teste | A.1, A.2 | IN_PLAN |
| 2 | `bootstrap/logger.go` + teste | A.3, A.4 | IN_PLAN |
| 3 | `bootstrap/sentry.go` + teste | A.5, A.5b | IN_PLAN |
| 4 | `bootstrap/otel.go` + teste | A.6, A.6b | IN_PLAN |
| 5 | `bootstrap/metrics.go` + teste | A.7, A.7b | IN_PLAN |
| 6 | `health/handler.go` + teste (liveness + readiness whatsmeow/llm/db/redis) | A.8 (+ F.3, F.4 reforçam readiness) | IN_PLAN |

### Lint + Tests (7/7 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 7 | `api_e2e_test.go` HMAC + remove build tag | B.2.1-B.2.4 | IN_PLAN (diff canônico novo p/ `buildSessionCookie` + `SESSION_SECRET`) |
| 8 | gosec G104 zerado em `internal/handlers/admin_*` | B.1.1-B.1.4 | IN_PLAN (reagrupado em 2 fixes + 1 ci) |
| 9 | 87 `no-explicit-any` zerados em dirs críticos | B.4.2 | IN_PLAN |
| 10 | ESLint override + gate CI `--max-warnings=0` | B.4.1, B.4.4 | IN_PLAN |
| 11 | 6 react-hooks + 8 unescaped-entities | B.4.3 | IN_PLAN (baseline em 0.2) |
| 12 | `test/testmain.go` testcontainers compartilhado | B.3.2 | IN_PLAN |
| 13 | Coverage Go > 30% | B.3.3 | IN_PLAN |

### Cache (6/6 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 14 | `cache.go` interface + GetOrCompute + singleflight | C.2, C.3 | IN_PLAN |
| 15 | `cache/redis.go` | C.4b.test, C.4 | IN_PLAN (TDD RED→GREEN) |
| 16 | `cache/memory.go` LRU | C.5b.test, C.5 | IN_PLAN (TDD RED→GREEN) |
| 17 | `bootstrap/cache.go` factory | C.6b.test, C.6 | IN_PLAN (TDD RED→GREEN) |
| 18 | Integração 4 domínios handlers + TTLs | C.7.dashboard, C.7.score, C.7.reports, C.7.categories | IN_PLAN |
| 19 | CACHE_DISABLED + header X-Cache | C.2 + C.7.* | IN_PLAN |

### Infra (5/5 IN_PLAN + 1 STANDBY)

| # | Item | Task | Status |
|---|------|------|--------|
| 20 | Migrations consolidadas + Dockerfile limpo | D.1, D.2, D.3 | IN_PLAN |
| 21 | `docker-compose.ci.yml` + volume pgdata + down -v | D.4, F.1.a (teardown) | IN_PLAN |
| 22 | `.env.test` + `.env.test.example` | B.2.1 | IN_PLAN |
| 23 | pgx pool tuning + bench | A.1 (tuning) + C.8.pool (bench) | IN_PLAN |
| 24 | BUILD_SHA/BUILD_TIME Vercel+Fly | D.5 | IN_PLAN |
| — | Redis real Upstash (prod) | — | STANDBY `[REDIS-INSTANCE]` (fallback InMemory cobre integralmente) |

### Observability (4/4 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 25 | workspace_id em métricas reports/* | E.1 | IN_PLAN |
| 26 | Sentry scope tenant_id em 100% requests | E.2 | IN_PLAN |
| 27 | 3 regras Sentry rate-limit 1/30min | E.3 | IN_PLAN |
| 28 | LLM_LEGACY_NOCONTEXT TTL 30d + alerta | E.4 | IN_PLAN |

### DX (4/4 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 29 | Playwright full < 10min | F.1.a, F.1.b | IN_PLAN (timeout 30min guard-rail; target <10min) |
| 30 | Ctx em ChatCompletion (big-bang) | F.2 | IN_PLAN |
| 31 | Whatsmeow check real /ready | F.3 | IN_PLAN |
| 32 | LLM Ping real /ready | F.4 | IN_PLAN |

### Docs + Cleanup (5/5 IN_PLAN)

| # | Item | Task | Status |
|---|------|------|--------|
| 33 | `docs/architecture.md` PT-BR 5 diagramas + cross-link | F.5.a-e + F.6.e-h | IN_PLAN |
| 34 | `runbooks/whatsapp.md` consolidado | F.6.c | IN_PLAN |
| 35 | `runbooks/sentry-alerts.md` | F.6.b | IN_PLAN |
| 36 | package-lock.json resolvido | G.1 | IN_PLAN |
| 37 | Tag `phase-12-prepared` | H.2 | IN_PLAN |

**Totais:** 37/37 IN_PLAN, 1 dependência STANDBY `[REDIS-INSTANCE]` (não bloqueia).

---

## Apêndice — Comandos canônicos (referência rápida)

### Lint + estático Go
```sh
cd laura-go
go vet ./...
gosec -exclude=G706,G101 ./...
staticcheck ./...
gosec ./... 2>&1 | grep -c G104    # == 0 após B.1
```

### Testes + coverage Go
```sh
cd laura-go
go test ./...                                                     # unit
go test -tags=integration -coverpkg=./internal/... \
  -coverprofile=coverage.out ./...                                # integration
go tool cover -func=coverage.out | grep total                     # >= 30%
```

### Bench
```sh
cd laura-go
go test -tags=integration -bench=BenchmarkPool -benchmem ./internal/bootstrap/...
go test -bench=BenchmarkHitRatio ./internal/cache/...
```

### PWA lint gate
```sh
cd laura-pwa
npm run lint                                                            # global
npx eslint src/lib/actions src/lib/services src/types --max-warnings=0  # gate
```

### Redis local + kill-switch
```sh
docker compose -f docker-compose.ci.yml up -d redis
redis-cli -u "$REDIS_URL" KEYS 'ws:*' | head
redis-cli -u "$REDIS_URL" TTL 'ws:abc:dashboard:...'
fly secrets set CACHE_DISABLED=true --app laura-finance-api
fly secrets unset CACHE_DISABLED --app laura-finance-api
```

### docker-compose CI
```sh
docker compose -f docker-compose.ci.yml up -d --wait
docker compose -f docker-compose.ci.yml ps
docker compose -f docker-compose.ci.yml logs postgres
docker compose -f docker-compose.ci.yml down -v
```

### Playwright
```sh
cd laura-pwa
npx playwright install --with-deps chromium
npx playwright test
npx playwright show-report
```

### Migrations (go:embed)
```sh
cd laura-go
go build ./...                 # valida embed
go run ./cmd/migrate up        # aplica via embed FS
```

### Build Docker local
```sh
docker build -f laura-go/Dockerfile -t laura-api:fase-12 ./laura-go
docker build -t laura-pwa:fase-12 ./laura-pwa
```
