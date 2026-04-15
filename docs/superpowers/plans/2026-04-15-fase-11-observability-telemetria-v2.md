# Fase 11 — Observabilidade completa + Telemetria (Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Goal:** Adicionar observability stack completa (slog structured logs, Prometheus metrics, OpenTelemetry tracing, Sentry SDK, error response padronizado, /ready enriquecido, backup automation Fly Machines, alertas Sentry+Slack) ao Laura Finance.

**Architecture:** Backend Go ganha slog (stdlib) com handler JSON em prod + middleware extraindo request_id do Fiber Locals e propagando para `context.Context`; fiberprometheus/v2 expõe /metrics em port :9090 (interno); OTel SDK exporta traces para OTLP HTTP collector (no-op se `OTEL_EXPORTER_OTLP_ENDPOINT` vazio); Sentry SDK Go + Fiber adapter captura errors + 10% transactions; slog hook customizado encaminha `slog.Error`/`Warn` para `sentry.CaptureException`; Fiber global `ErrorHandler` centraliza respostas via `RespondError`; PWA Sentry via `@sentry/nextjs` com source maps upload feito pelo Vercel build (authToken no dashboard do Vercel); backup automation via Fly Machines schedule diário; restore drill quinzenal via workflow GitHub em DB ephemeral `laura-drill-<sha>`; PWA ganha api client wrapper que parseia error shape canônico.

**Tech Stack:** Go 1.26 + slog + log/slog/handlers/json + fiberprometheus/v2 + getsentry/sentry-go + getsentry/sentry-go/fiber + go.opentelemetry.io/otel + otelfiber + otelpgx + otelslog + golang.org/x/sync/errgroup; Next.js 16 + @sentry/nextjs; Fly.io + GitHub Actions; Sentry + Grafana Cloud + Slack.

---

## Mudanças principais vs Plan v1 (Review #1)

1. **A.8 (novo antes da doc):** varredura exaustiva `grep -r "log\.Printf\|log\.Println" laura-go/internal/` + retrofit exhaustivo dos arquivos restantes (garante item §15 "zero `log.Printf`").
2. **C.11 (novo):** PWA `laura-pwa/src/lib/api/client.ts` fetch wrapper parseia `error.{code,message,request_id,timestamp}` + tipos TS (antes DEFERRED no v1).
3. **E.8 (novo):** Fiber global `ErrorHandler` (catch-all) chama `RespondError` central — compat com `sentryfiber.Repanic`.
4. **G.5 (novo):** span OTel manual no backup handler/worker (`backup.run`) com attrs `backup.size_bytes`, `backup.duration_ms`.
5. **K.X1 + K.X2 (novos):** E2E Playwright `observability.spec.ts` (X-Request-Id presente em todas respostas) + `error-shape.spec.ts` (força 4xx via UI e valida JSON canônico).
6. **A.2 detalhado:** `LoggerMiddleware` agora injeta no `c.Locals("logger")` **E** em `c.UserContext()` via `WithRequestID`+`WithLogger` (item §15 confirmado).
7. **D.4 ampliado:** gauges pgxpool + **histograma** `laura_pgxpool_query_duration_seconds` + **counter** `laura_pgxpool_errors_total{type}`.
8. **C.4 (otelpgx) com versão pinada:** `github.com/exaring/otelpgx v0.9.0+` compatível com pgx/v5.
9. **D.4 (sentry slog hook) detalhado:** `SentryHandler` wrap do `ContextHandler`; em `LevelError`+`LevelWarn` extrai attr `err` se presente ou faz `errors.New(record.Message)` e chama `hub.CaptureException`.
10. **G.1 retention + G.2 restore drill:** retention policy 30d daily + 12 weekly; restore drill usa `fly postgres create laura-drill-<shortsha>` em DB scratch, smoke 6 tabelas, destroy com guard prefixo.
11. **STANDBYs anotados:** cada task afetada marcada `STANDBY [<ID>]` explicitamente.
12. **Granularidade:** G.2 do v1 (backup-drill workflow) quebrado em 3 sub-tasks (≤5 min cada); outras renumeradas.

Total tasks Plan v2: **61** (v1 tinha 52; +6 novos gaps; +3 quebras de granularidade).

---

## Parte 0 — Pré-condições

- [ ] **0.1** Validar baseline.
  - Run: `cd laura-go && git status && git log --oneline -5 && go version && fly version`
  - Expected: tree limpa; Go ≥1.26.1; flyctl presente; arquivos `docs/superpowers/specs/2026-04-15-fase-11-observability-telemetria-v3.md` e `CLAUDE.md` existentes.
  - Nenhum commit.

---

## Parte A — slog structured logger (prerequisite de tudo)

- [ ] **A.1** Criar `laura-go/internal/obs/context.go` com chaves tipadas `ctxKey int` (`RequestIDKey`, `LoggerKey`) + helpers `WithRequestID(ctx, id) context.Context`, `RequestIDFromCtx(ctx) string`, `WithLogger(ctx, l *slog.Logger) context.Context`, `FromCtx(ctx) *slog.Logger` (fallback `slog.Default()`). Sem dep externa.
  - Commit: `feat(observability): contexto tipado para request_id e logger`

- [ ] **A.2** Criar `laura-go/internal/obs/context_handler.go` com `ContextHandler` wrapping `slog.Handler` inner. `Handle(ctx, record)` extrai `request_id`/`trace_id`/`span_id` de `ctx` (usa `trace.SpanFromContext` se OTel disponível) e anexa como attrs antes de delegar. Implementar `WithAttrs` e `WithGroup` repassando ao inner.
  - Commit: `feat(observability): ContextHandler anexa request_id/trace_id em records`

- [ ] **A.3** Criar `laura-go/internal/obs/logger.go` com `NewLogger(env string) *slog.Logger`: handler JSON em `production`, text em `dev`, wrapping via `ContextHandler`. Nível via `levelFromEnv` (DEBUG/INFO/WARN/ERROR). Retornar `slog.New(&ContextHandler{inner: h})`.
  - Commit: `feat(observability): slog logger JSON em prod / text em dev`

- [ ] **A.4** TDD — criar `laura-go/internal/obs/logger_test.go` cobrindo: `NewLogger("production")` emite JSON válido com `level`, `msg`, `time`; `NewLogger("dev")` emite text; `ContextHandler` injeta `request_id` quando presente no ctx; não injeta quando ausente. Usar `bytes.Buffer` como writer e `json.Decoder`.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: `ok` verde.
  - Commit: `test(observability): logger JSON + ContextHandler injection`

- [ ] **A.5** Criar `laura-go/internal/obs/middleware.go` com `LoggerMiddleware(base *slog.Logger) fiber.Handler`. Pseudo-código:
  ```go
  return func(c *fiber.Ctx) error {
      id, _ := c.Locals("requestid").(string)
      logger := base.With("request_id", id)
      ctx := c.UserContext()
      ctx = obs.WithRequestID(ctx, id)
      ctx = obs.WithLogger(ctx, logger)
      c.SetUserContext(ctx)           // handlers descendentes recebem via ctx
      c.Locals("logger", logger)      // handlers Fiber-only leem direto
      return c.Next()
  }
  ```
  - Commit: `feat(observability): middleware Fiber injeta slog logger em Locals + UserContext`

- [ ] **A.6** Integração — editar `laura-go/cmd/api/main.go` para instanciar `logger := obs.NewLogger(os.Getenv("APP_ENV"))`, `slog.SetDefault(logger)` e `app.Use(obs.LoggerMiddleware(logger))`. Remover logger Fiber JSON antigo (Fase 10).
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `feat(observability): instala slog no app Fiber principal`

- [ ] **A.7** Retrofit 5 arquivos críticos substituindo `log.Printf`/`log.Println` por `obs.FromCtx(ctx).InfoContext(ctx, ...)` ou `slog.Info` (sem ctx): `cmd/api/main.go`, `internal/repo/db.go`, `internal/whatsapp/client.go`, `internal/llm/call.go`, `internal/app/handlers/auth.go`.
  - Run: `cd laura-go && go build ./... && go vet ./...`
  - Expected: success.
  - Commit: `refactor(observability): migra 5 arquivos críticos para slog`

- [ ] **A.8** (NOVO — GAP 1) Varredura exaustiva de `log.Printf`/`log.Println` remanescentes.
  - Run: `cd laura-go && grep -rn "log\.Printf\|log\.Println" internal/ cmd/ | tee /tmp/logprintf_remaining.txt`
  - Expected: lista de ocorrências; para cada arquivo listado, substituir por `obs.FromCtx(ctx).InfoContext(...)` / `slog.Info(...)` conforme disponibilidade de `ctx`. Apagar imports `"log"` não usados.
  - Run final: `cd laura-go && grep -rn "log\.Printf\|log\.Println" internal/ cmd/ || echo ZERO`
  - Expected: `ZERO`.
  - Commit: `refactor(observability): zero log.Printf em internal/ e cmd/`

- [ ] **A.9** Doc — criar `docs/ops/observability.md` com seção "Logger" (formato JSON, campos canônicos, níveis, como filtrar por `request_id` em prod).
  - Commit: `docs(observability): seção Logger no observability.md`

---

## Parte B — Error response padronizado (depende de A)

- [ ] **B.1** Criar `laura-go/internal/obs/error_codes.go` com 11 constantes canônicas: `VALIDATION_FAILED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`, `DB_TIMEOUT`, `LLM_PROVIDER_DOWN`, `DEPENDENCY_DOWN`. Cada uma com mensagem default PT-BR via `messageFor(code, err) string`.
  - Commit: `feat(observability): 11 códigos de erro canônicos`

- [ ] **B.2** Criar `laura-go/internal/obs/errors.go` com helper `RespondError(c *fiber.Ctx, code string, status int, err error) error`. Monta payload `{error:{code,message,request_id,timestamp}}` (RFC3339 UTC). Para `status >= 500` chama `FromCtx(c.UserContext()).Error(...)`; para <500 chama `Warn`.
  - Commit: `feat(observability): helper RespondError com shape canônico`

- [ ] **B.3** TDD — `laura-go/internal/obs/errors_test.go`: para cada 11 códigos, `RespondError` retorna JSON com shape correto; `timestamp` ISO-8601 UTC parseável; `request_id` vem do `c.Locals("requestid")`; níveis de log corretos.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: verde.
  - Commit: `test(observability): shape error response + níveis log`

- [ ] **B.4** Retrofit 5 handlers críticos usando `obs.RespondError`: `internal/app/handlers/auth.go`, `transactions.go`, `cards.go`, `dashboard.go`, `score.go`. Mapear erros: `pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DB_TIMEOUT`, `validator.ValidationErrors` → `VALIDATION_FAILED`.
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `refactor(observability): 5 handlers críticos usam RespondError`

- [ ] **B.5** Integration test `laura-go/test/integration/error_shape_test.go`: Fiber test server com handlers stubbed retornando cada código; asserta shape canônico de cada response.
  - Run: `cd laura-go && go test ./test/integration/... -run ErrorShape`
  - Expected: verde.
  - Commit: `test(observability): integration error_shape cobre 11 códigos`

---

## Parte C — Sentry SDK (depende de A, B) — STANDBY `[SENTRY-DSN-API]`, `[SENTRY-DSN-PWA]`, `[SENTRY-AUTH-TOKEN]`

- [ ] **C.1** Adicionar dependências Sentry.
  - Run: `cd laura-go && go get github.com/getsentry/sentry-go@latest github.com/getsentry/sentry-go/fiber@latest && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados.
  - Commit: `build(sentry): adiciona sentry-go + fiber adapter`

- [ ] **C.2** Criar `laura-go/internal/obs/sentry.go` com `InitSentry(version string) (flush func())`. Gated por `SENTRY_DSN_API` vazio (NoOp). Config: `Environment=APP_ENV`, `Release=version`, `EnableTracing=true`, `TracesSampleRate=parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 0.1)`. Retorna `sentry.Flush` bound a `2*time.Second`. STANDBY `[SENTRY-DSN-API]`.
  - Commit: `feat(sentry): init SDK gated por DSN com sampling 0.1 default`

- [ ] **C.3** Criar `laura-go/internal/obs/sentry_slog_hook.go`.
  - `SentryHandler` wrap do `slog.Handler` (chain: inner → sentry). No método `Handle`, após delegar ao inner:
    - Se `record.Level >= slog.LevelWarn`: extrair attr `err` se presente (via `record.Attrs(func(a slog.Attr) bool {...})`); caso ausente, `errors.New(record.Message)`.
    - `LevelWarn` → `hub.CaptureMessage(msg, sentry.LevelWarning)`.
    - `LevelError` → `hub.CaptureException(err)`.
    - Hub obtido via `sentry.GetHubFromContext(ctx)` com fallback `sentry.CurrentHub()`.
  - Adicionar construtor opcional `NewLoggerWithSentry(env, version string) *slog.Logger` que encadeia `SentryHandler(ContextHandler(innerJSON))`.
  - Commit: `feat(sentry): hook slog.Error/Warn dispara CaptureException/Message`

- [ ] **C.4** Integrar em `cmd/api/main.go`: chamar `flush := obs.InitSentry(buildVersion)` + `defer flush()`; `app.Use(sentryfiber.New(sentryfiber.Options{Repanic: true}))` **antes** dos demais middlewares para capturar panic. Scope enrichment middleware grava `request_id`, `workspace_id`, `user_id` no `sentry.Hub` via `sentry.GetHubFromContext`.
  - Commit: `feat(sentry): middleware Fiber + scope enrichment`

- [ ] **C.5** Unit test `laura-go/internal/obs/sentry_test.go`: com DSN vazio `InitSentry` é NoOp e não explode; com DSN mock (via `sentry.ClientOptions.Transport` fake) `CaptureException` enfileira event.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: verde.
  - Commit: `test(sentry): NoOp quando DSN vazio + capture com mock transport`

- [ ] **C.6** PWA — rodar wizard Sentry.
  - Run: `cd laura-pwa && npx @sentry/wizard@latest -i nextjs --skip-telemetry`
  - Expected: arquivos `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts` editado, `instrumentation.ts` criados. STANDBY `[SENTRY-DSN-PWA]`.
  - Commit: `feat(sentry): wizard Sentry Next.js no PWA`

- [ ] **C.7** Editar `laura-pwa/sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` setando `tracesSampleRate: 0.1` e `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_PWA`. Adicionar `enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_PWA` para NoOp quando vazio.
  - Commit: `feat(sentry): configs client/server/edge com sampling 0.1`

- [ ] **C.8** `laura-pwa/next.config.ts` wrapping com `withSentryConfig(config, {authToken: process.env.SENTRY_AUTH_TOKEN, silent: !process.env.CI})`.
  - Decisão: `SENTRY_AUTH_TOKEN` vive como env var no **dashboard do Vercel** (não em GitHub Actions); `withSentryConfig` faz upload de source maps durante `vercel build`. Documentar em `docs/ops/observability.md` seção PWA.
  - Run: `cd laura-pwa && pnpm build` (sem token → NoOp silencioso).
  - Expected: build success, warning silenciado.
  - Commit: `feat(sentry): withSentryConfig + upload source maps no Vercel build`

- [ ] **C.9** Editar `.github/workflows/deploy-pwa.yml` — **não** subir source maps via CI (decisão C.8). Step apenas valida `pnpm build` já com Sentry embutido. Remover se houver step legacy.
  - Commit: `ci(sentry): remove upload CI de source maps (Vercel cuida)`

- [ ] **C.10** Adicionar rota dev-only `POST /api/_debug/panic` em `internal/app/router.go` gated `if os.Getenv("APP_ENV") != "production"` que faz `panic("smoke sentry")`. Smoke manual documentado em `docs/ops/observability.md`.
  - Commit: `feat(sentry): endpoint _debug/panic para smoke (não-prod)`

- [ ] **C.11** (NOVO — GAP 5) Criar `laura-pwa/src/lib/api/client.ts` — fetch wrapper que parseia error shape canônico.
  - Tipos TS em `laura-pwa/src/lib/api/types.ts`:
    ```ts
    export type ApiErrorCode =
      | "VALIDATION_FAILED" | "AUTH_INVALID_CREDENTIALS" | "AUTH_TOKEN_EXPIRED"
      | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED"
      | "INTERNAL" | "DB_TIMEOUT" | "LLM_PROVIDER_DOWN" | "DEPENDENCY_DOWN";
    export interface ApiErrorPayload {
      error: { code: ApiErrorCode; message: string; request_id: string; timestamp: string };
    }
    export class ApiError extends Error {
      constructor(
        public code: ApiErrorCode,
        message: string,
        public requestId: string,
        public timestamp: string,
        public status: number,
      ) { super(message); }
    }
    ```
  - `client.ts` exporta `apiFetch<T>(path, init)`: se `!res.ok`, tenta parsear body; se shape válido lança `ApiError(...)`; senão lança `Error` genérico com `request_id` do header `X-Request-Id` (fallback).
  - Commit: `feat(sentry): PWA api client parseia error shape canônico`

---

## Parte D — Prometheus metrics (depende de A)

- [ ] **D.1** Adicionar dep fiberprometheus.
  - Run: `cd laura-go && go get github.com/ansrivas/fiberprometheus/v2@v2.10.0 && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados.
  - Commit: `build(metrics): adiciona fiberprometheus v2.10`

- [ ] **D.2** Criar `laura-go/internal/obs/metrics.go` com construtor `NewMetricsApp() (*fiber.App, *fiberprometheus.FiberPrometheus)` — Fiber secundário `DisableStartupMessage: true`. Registrar `prom := fiberprometheus.New("laura_api")` + `prom.RegisterAt(app, "/metrics")`.
  - Commit: `feat(metrics): construtor metricsApp em Fiber separado`

- [ ] **D.3** Integrar em `cmd/api/main.go`: `metricsApp, prom := obs.NewMetricsApp()`; `app.Use(prom.Middleware)`; `go func(){ metricsApp.Listen(":9090") }()`. Graceful shutdown no SIGTERM junto com app principal.
  - Commit: `feat(metrics): sobe /metrics em :9090 com shutdown graceful`

- [ ] **D.4** Criar `laura-go/internal/obs/metrics_custom.go` com collectors:
  - **pgxpool (gauges + histograma + counter):**
    - `laura_pgxpool_idle_conns`, `laura_pgxpool_total_conns`, `laura_pgxpool_acquire_count` (gauges lidos de `pool.Stat()` em goroutine tick 15s).
    - `laura_pgxpool_query_duration_seconds` histograma (via `pgx.QueryTracer` hook no `otelpgx` chain).
    - `laura_pgxpool_errors_total{type}` counter (`type ∈ {acquire, query, tx}`).
  - **LLM:** `laura_llm_call_duration_seconds{provider,model}` histograma; `laura_llm_call_errors_total{provider,reason}` counter.
  - **Cron:** `laura_cron_job_duration_seconds{job}` histograma.
  - **Backup:** `laura_backup_last_success_timestamp_seconds` gauge; `laura_backup_last_size_bytes` gauge.
  - Commit: `feat(metrics): collectors custom pgxpool/llm/cron/backup`

- [ ] **D.5** Cardinalidade — criar `laura-go/internal/obs/metrics_workspace.go` com middleware `WorkspaceLabelMiddleware` que, **apenas nos 5 endpoints canônicos** (`/api/v1/transactions`, `/api/v1/dashboard`, `/api/v1/score`, `/api/v1/reports`, `/api/v1/auth/login`), observa um histogram `laura_http_workspace_request_duration_seconds{workspace_id,route,status}`. Demais rotas não recebem o label.
  - Commit: `feat(metrics): workspace_id label nos 5 endpoints críticos`

- [ ] **D.6** Editar `laura-go/fly.toml` adicionando `[metrics]` com `port = 9090` e `path = "/metrics"`. Garantir que `[[services]]` público não exponha 9090.
  - Commit: `chore(infra): fly.toml [metrics] section aponta para :9090`

- [ ] **D.7** Integration test `laura-go/test/integration/metrics_test.go`: sobe app + metricsApp; `GET :9090/metrics` retorna corpo contendo `laura_api_requests_total` e `laura_pgxpool_idle_conns`; `GET :8080/metrics` retorna 404.
  - Run: `cd laura-go && go test ./test/integration/... -run Metrics`
  - Expected: verde.
  - Commit: `test(metrics): /metrics em :9090 + 404 no :8080`

- [ ] **D.8** Doc — seção "Metrics" em `docs/ops/observability.md` listando collectors canônicos, cardinalidade, comandos de consulta via `fly ssh`.
  - Commit: `docs(metrics): seção Metrics no observability.md`

---

## Parte E — OpenTelemetry tracing (depende de A)

- [ ] **E.1** Adicionar deps OTel.
  - Run: `cd laura-go && go get go.opentelemetry.io/otel go.opentelemetry.io/otel/sdk go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp go.opentelemetry.io/contrib/instrumentation/github.com/gofiber/fiber/v2/otelfiber github.com/exaring/otelpgx@v0.9.0 go.opentelemetry.io/contrib/bridges/otelslog && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados. `otelpgx v0.9.0+` suporta pgx/v5 oficialmente.
  - Commit: `build(tracing): adiciona OTel SDK + otelfiber + otelpgx + otelslog`

- [ ] **E.2** Criar `laura-go/internal/obs/tracer.go` com `NewTracerProvider(ctx context.Context, version string) (trace.TracerProvider, func(context.Context) error, error)`. Se `OTEL_EXPORTER_OTLP_ENDPOINT` vazio retorna `noop.NewTracerProvider()` + shutdown no-op. Senão cria `otlptracehttp.New(...)` + `sdktrace.NewBatchSpanProcessor` + resource (`service.name=laura-api`, `service.version=version`, `deployment.environment=APP_ENV`) + `ParentBased(TraceIDRatioBased(parseFloatEnv("OTEL_TRACES_SAMPLE_RATE", 0.1)))`. STANDBY `[OTEL-COLLECTOR-URL]`.
  - Commit: `feat(tracing): TracerProvider com NoOp graceful quando endpoint vazio`

- [ ] **E.3** Integrar em `cmd/api/main.go`: `tp, shutdown, _ := obs.NewTracerProvider(ctx, buildVersion)`; `otel.SetTracerProvider(tp)`; `app.Use(otelfiber.Middleware())` antes do slog middleware; `defer shutdown(ctx)`.
  - Commit: `feat(tracing): otelfiber middleware + shutdown hook`

- [ ] **E.4** Instrumentar pgx — editar `laura-go/internal/repo/db.go` adicionando `otelpgx.NewTracer()` ao `pgxpool.Config.ConnConfig.Tracer`.
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `feat(tracing): otelpgx wrap no pool Postgres`

- [ ] **E.5** Spans manuais — `internal/llm/call.go`: `ctx, span := otel.Tracer("laura/llm").Start(ctx, "llm.call", trace.WithAttributes(attribute.String("llm.provider", provider), attribute.String("llm.model", model)))` + `defer span.End()`. Mesma coisa em `internal/whatsapp/client.go` (`wa.onmessage` com attrs `wa.jid`, `wa.msg_type`) e `internal/cron/*.go` (`cron.<job>`).
  - Commit: `feat(tracing): spans manuais em llm/whatsapp/cron`

- [ ] **E.6** Bridge otelslog — atualizar `internal/obs/logger.go` para encadear `otelslog.NewHandler` sobre `ContextHandler` quando `OTEL_EXPORTER_OTLP_ENDPOINT` presente. `trace_id`/`span_id` entram automaticamente nos logs dentro de span.
  - Commit: `feat(tracing): bridge otelslog injeta trace_id/span_id nos logs`

- [ ] **E.7** Test `laura-go/internal/obs/tracer_test.go` — com env vazia `NewTracerProvider` retorna tipo `noop`. Test integration `test/integration/tracing_test.go` — sobe listener TCP fake OTLP, provoca request, asserta span pgx e LLM recebidos.
  - Run: `cd laura-go && go test ./internal/obs/... ./test/integration/... -run Tracing`
  - Expected: verde.
  - Commit: `test(tracing): NoOp vazio + span export via mock OTLP`

- [ ] **E.8** (NOVO — GAP 3) Fiber global `ErrorHandler` catch-all.
  - Editar `cmd/api/main.go` adicionando `fiber.Config{ErrorHandler: obs.GlobalErrorHandler}`.
  - Criar `laura-go/internal/obs/error_handler.go`:
    ```go
    func GlobalErrorHandler(c *fiber.Ctx, err error) error {
        // Se já respondeu (handler chamou RespondError), pular.
        if c.Response().StatusCode() != 200 { return nil }
        // Classificar err → code + status.
        code, status := classifyError(err)
        return RespondError(c, code, status, err)
    }
    ```
  - `classifyError`: `fiber.Error` → usa `e.Code`; `context.DeadlineExceeded` → `DB_TIMEOUT`/504; `pgx.ErrNoRows` → `NOT_FOUND`/404; default → `INTERNAL`/500.
  - Compat com `sentryfiber.Repanic: true` — panic recovery acontece antes, errors não-panic caem no ErrorHandler.
  - Commit: `feat(observability): Fiber global ErrorHandler centraliza RespondError`

---

## Parte F — Health enriquecido /ready (paralelo com C,D)

- [ ] **F.1** Editar `laura-go/internal/app/handlers/health.go` (ou criar) — `/ready` retorna JSON `{status, version, checks:{db,whatsmeow,llm_provider}}`. Usa `golang.org/x/sync/errgroup` para rodar 3 checks em paralelo. Timeout per-check 500ms + timeout global 3s (`context.WithTimeout(ctx, 3*time.Second)`). Cada check retorna `{status, latency_ms}`.
  - Commit: `feat(observability): /ready JSON com errgroup + timeout 3s`

- [ ] **F.2** Regras de status: `db` fail → HTTP 503 `status:"fail"`; `whatsmeow` down → HTTP 200 `status:"degraded"`; `llm_provider` down → HTTP 200 `status:"degraded"`. `/health` retorna `{status:"ok", version, build_time, uptime_seconds}`.
  - Commit: `feat(observability): /health expõe version/build_time/uptime`

- [ ] **F.3** `-ldflags` — editar `laura-go/Dockerfile` build stage: `RUN go build -ldflags "-X main.version=${BUILD_SHA} -X main.buildTime=${BUILD_TIME}" -o /app/api ./cmd/api`. Passar args via `ARG BUILD_SHA` + `ARG BUILD_TIME`. Editar `.github/workflows/deploy-api.yml` passando `--build-arg BUILD_SHA=$(git rev-parse --short HEAD) --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)`.
  - Commit: `ci(observability): ldflags injeta version+build_time no Dockerfile`

- [ ] **F.4** Integration test `laura-go/test/integration/health_test.go`: `/health` contém `version` não-vazia; `/ready` com db down retorna 503; com whatsmeow down retorna 200 degraded; timeout global respeitado (simular check dormindo 10s → corta em 3s).
  - Run: `cd laura-go && go test ./test/integration/... -run Health`
  - Expected: verde.
  - Commit: `test(observability): health + ready + timeout 3s`

---

## Parte G — Backup automation Fly Machines (depende de D) — STANDBY `[FLY-API-TOKEN-BACKUP]`

- [ ] **G.1** Criar `laura-go/internal/app/handlers/ops_backup.go` — `POST /api/ops/backup` autenticado via header `X-Ops-Token` (compara com `BACKUP_OPS_TOKEN`). Executa `exec.Command("flyctl", "postgres", "backup", "create", "-a", dbCluster)`; ao sucesso atualiza gauges `laura_backup_last_success_timestamp_seconds` e `laura_backup_last_size_bytes`. Usa `RespondError` em erros.
  - Retention policy: **30d daily + 12 weekly + 6 monthly** (lista canônica). Implementação fica em `G.3`.
  - Commit: `feat(backup): handler /api/ops/backup com X-Ops-Token`

- [ ] **G.2** Registrar rota em `internal/app/router.go` (agrupada sob `/api/ops` com middleware de ops token).
  - Commit: `feat(backup): registra /api/ops/backup no router`

- [ ] **G.3** Criar `scripts/backup-prune.sh` — shell script que lista `fly postgres backups list` e aplica retention **30d daily + 12 weekly (sábado) + 6 monthly (dia 1)**. Usa `date` + `awk`. Suporta `--dry-run`.
  - Run: `bash scripts/backup-prune.sh --dry-run`
  - Expected: lista de backups + ações dry-run; exit 0.
  - Commit: `feat(backup): script backup-prune com retention 30d/12w/6m`

- [ ] **G.4** (QUEBRADO — GAP 13 granularidade) Criar `.github/workflows/backup-drill.yml` **esqueleto** — cron `0 4 */14 * *`. Steps: checkout, setup-flyctl. Env `FLY_API_TOKEN_BACKUP` STANDBY.
  - Commit: `ci(backup): esqueleto workflow backup-drill quinzenal`

- [ ] **G.4b** (NOVO — quebra de G.4 v1) Adicionar steps de provisionamento no `backup-drill.yml`:
  ```yaml
  - name: Create ephemeral DB
    run: |
      SHA=$(git rev-parse --short HEAD)
      EPH="laura-drill-${SHA}"
      echo "EPH_NAME=$EPH" >> $GITHUB_ENV
      fly postgres create --name "$EPH" --region gru --vm-size shared-cpu-1x --volume-size 10 --yes
  - name: Restore latest backup
    run: fly postgres backup restore --latest -a "$EPH_NAME"
  ```
  - Commit: `ci(backup): steps create + restore em DB ephemeral laura-drill-<sha>`

- [ ] **G.4c** (NOVO — quebra de G.4 v1) Adicionar smoke `SELECT count(*)` em 6 tabelas (`users`, `workspaces`, `transactions`, `messages`, `llm_calls`, `audit_log`) + destroy com guard + Slack notify. Guard:
  ```bash
  case "$EPH_NAME" in
    laura-drill-*) fly destroy "$EPH_NAME" --yes ;;
    *) echo "REFUSE destroy $EPH_NAME"; exit 1 ;;
  esac
  ```
  - Step `notify-slack` via `slackapi/slack-github-action@v1` STANDBY `[SLACK-WEBHOOK]`.
  - Commit: `ci(backup): smoke 6 tabelas + destroy guard + Slack notify`

- [ ] **G.5** (NOVO — GAP 2) Span OTel manual no backup handler.
  - Editar `internal/app/handlers/ops_backup.go`:
    ```go
    ctx, span := otel.Tracer("laura/backup").Start(c.UserContext(), "backup.run",
        trace.WithAttributes(attribute.String("db.cluster", dbCluster)))
    defer span.End()
    // ... exec flyctl ...
    span.SetAttributes(attribute.Int64("backup.size_bytes", size), attribute.Int64("backup.duration_ms", dur))
    if err != nil { span.RecordError(err); span.SetStatus(codes.Error, err.Error()) }
    ```
  - Se houver worker Go dedicado (Fly Machines schedule script), emitir span equivalente antes do exit.
  - Commit: `feat(tracing): span manual backup.run com size + duration`

- [ ] **G.6** Criar `scripts/backup-restore-drill.sh` — versão local do workflow para smoke manual. Suporta `--dry-run`.
  - Run: `bash scripts/backup-restore-drill.sh --dry-run`
  - Expected: exit 0.
  - Commit: `feat(backup): script local backup-restore-drill`

- [ ] **G.7** Doc `docs/ops/backup.md` — comando `fly machine run --schedule daily ...` canônico (§A.1 da spec), cadência retention (30d/12w/6m), procedimento rollback, STANDBY `[FLY-API-TOKEN-BACKUP]`.
  - Commit: `docs(backup): docs/ops/backup.md com schedule + drill + rollback`

- [ ] **G.8** Integration test `laura-go/test/integration/backup_test.go` — `POST /api/ops/backup` sem header retorna 401; com token inválido 403; com token válido (modo dry via env `BACKUP_DRY=1`) retorna 200 e atualiza métricas.
  - Run: `cd laura-go && go test ./test/integration/... -run Backup`
  - Expected: verde.
  - Commit: `test(backup): auth X-Ops-Token + métricas atualizadas`

---

## Parte H — Alertas Sentry + Slack (depende de C, D) — STANDBY `[SLACK-WEBHOOK]`, `[SENTRY-DSN-API]`, `[PAGERDUTY]` opc

- [ ] **H.1** Editar `.github/workflows/deploy-api.yml` adicionando step `notify-slack` com `slackapi/slack-github-action@v1` gated `if: failure()` usando secret `SLACK_WEBHOOK`. Mesmo em `deploy-pwa.yml`. STANDBY `[SLACK-WEBHOOK]`.
  - Commit: `ci(alerts): notifica Slack em failure nos deploys`

- [ ] **H.2** Criar `docs/ops/alerts.md` documentando 3 regras Sentry UI: (1) `rate(errors) > 5/5min` → email+Slack; (2) `new issue in production` → Slack; (3) `performance regression p95 > 2s` → email. STANDBY `[SENTRY-DSN-API]`, `[SLACK-WEBHOOK]`, opc `[PAGERDUTY]`.
  - Commit: `docs(alerts): 3 regras Sentry + configuração Slack`

- [ ] **H.3** Adicionar em `internal/obs/metrics_custom.go` goroutine tick 30s que checa `pgxpool.Stat().AcquireCount() / TotalConns()`; se > 0.9 chama `slog.Warn` + `sentry.CaptureMessage("pgxpool near exhaustion", sentry.LevelWarning)`.
  - Commit: `feat(alerts): pool exhaustion warn + Sentry capture`

- [ ] **H.4** Em `internal/llm/call.go` medir duração; se > 10s `slog.Warn` + increment `laura_llm_timeouts_total{provider}` counter.
  - Commit: `feat(alerts): LLM timeout >10s warn + métrica`

---

## Parte I — Dashboards Grafana (depende de D) — STANDBY `[GRAFANA-CLOUD]`

- [ ] **I.1** Criar `docs/ops/grafana-dashboards/go-runtime.json` (base dashboard ID 10826).
  - Commit: `docs(metrics): dashboard Grafana go-runtime`

- [ ] **I.2** Criar `docs/ops/grafana-dashboards/postgres.json` (base 9628).
  - Commit: `docs(metrics): dashboard Grafana postgres`

- [ ] **I.3** Criar `docs/ops/grafana-dashboards/http-laura.json` (custom `laura_api_*`) e `whatsmeow-llm.json` (custom `laura_whatsmeow_*` + `laura_llm_*`).
  - Commit: `docs(metrics): dashboards Grafana http-laura + whatsmeow-llm`

- [ ] **I.4** Criar `docs/ops/grafana-dashboards/README.md` com instruções de import manual via Grafana Cloud UI + STANDBY `[GRAFANA-CLOUD]`.
  - Commit: `docs(metrics): README dashboards Grafana`

- [ ] **I.5** Seção "Grafana" em `docs/ops/observability.md` apontando para pasta.
  - Commit: `docs(observability): seção Grafana`

---

## Parte J — Documentação operacional final

- [ ] **J.1** Expandir `docs/ops/observability.md` com seções completas: Logger, Metrics, Tracing, Sentry, Grafana, Correlação `request_id` → logs → Sentry → trace → Grafana, tabela completa dos 11 códigos de erro.
  - Commit: `docs(observability): expansão completa de observability.md`

- [ ] **J.2** Criar `docs/ops/runbooks/incident-response.md` — SEV1/2/3 definições, primeiros 5min (Sentry → logs → Grafana → rollback), template post-mortem.
  - Commit: `docs(ops): runbook incident-response`

- [ ] **J.3** Criar `docs/ops/runbooks/error-debugging.md` — workflow passo a passo: `error.code` do cliente → grep `request_id` em stdout → abrir issue Sentry → trace OTel → métrica Grafana → fix.
  - Commit: `docs(ops): runbook error-debugging com request_id lookup`

---

## Parte K — fly.toml + E2E observability

- [ ] **K.1** Validar que `laura-go/fly.toml` contém `[metrics] port=9090 path="/metrics"` (pode ter sido feito em D.6 — skip se idempotente). Sem commit extra.

- [ ] **K.2** Documentar em `docs/ops/observability.md` + `fly secrets set` canônicos: `OTEL_EXPORTER_OTLP_ENDPOINT=""`, `SENTRY_DSN_API=""`, `SENTRY_TRACES_SAMPLE_RATE="0.1"`, `OTEL_TRACES_SAMPLE_RATE="0.1"` (defaults vazios = NoOp). STANDBYs `[SENTRY-DSN-API]`, `[OTEL-COLLECTOR-URL]`.
  - Commit: `chore(infra): fly secrets defaults para observabilidade NoOp`

- [ ] **K.3** (NOVO — GAP 4) Criar `laura-pwa/e2e/observability.spec.ts` — Playwright valida que toda resposta HTTP do backend traz header `X-Request-Id` não-vazio + UUID-like.
  ```ts
  test("header X-Request-Id presente em responses do /api/v1", async ({ page }) => {
    const reqIds: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/")) {
        const h = res.headers()["x-request-id"];
        if (h) reqIds.push(h);
      }
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(reqIds.length).toBeGreaterThan(0);
    for (const id of reqIds) expect(id).toMatch(/^[0-9a-f-]{8,}$/i);
  });
  ```
  - Run: `cd laura-pwa && pnpm exec playwright test e2e/observability.spec.ts`
  - Expected: verde.
  - Commit: `test(observability): E2E Playwright X-Request-Id presente`

- [ ] **K.4** (NOVO — GAP 4) Criar `laura-pwa/e2e/error-shape.spec.ts` — força erro 4xx (ex: login com credencial inválida) e valida shape `{error:{code,message,request_id,timestamp}}`.
  ```ts
  test("login com credencial inválida retorna error shape canônico", async ({ request }) => {
    const res = await request.post("/api/v1/auth/login", { data: { email: "x@x", password: "bad" }});
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
    expect(body.error.request_id).toMatch(/^[0-9a-f-]{8,}$/i);
    expect(Date.parse(body.error.timestamp)).not.toBeNaN();
    expect(body.error.message).toBeTruthy();
  });
  ```
  - Run: `cd laura-pwa && pnpm exec playwright test e2e/error-shape.spec.ts`
  - Expected: verde.
  - Commit: `test(observability): E2E Playwright error shape canônico`

---

## Parte L — Validação final + tag

- [ ] **L.1** Validação integral.
  - Run: `cd laura-go && go build ./... && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | grep internal/obs`
  - Expected: cobertura ≥70% em `internal/obs/*`.
  - Run: `cd laura-pwa && pnpm build && pnpm test && pnpm exec playwright test e2e/observability.spec.ts e2e/error-shape.spec.ts`
  - Expected: verde.
  - Run: `cd laura-go && docker build -f Dockerfile .`
  - Expected: build success.
  - Nada é commitado.

- [ ] **L.2** Tag `phase-11-prepared`.
  - Run: `git tag -a phase-11-prepared -m "Fase 11 observabilidade completa + telemetria pronta para deploy" && git push origin phase-11-prepared`
  - Expected: tag criada e pushada.

---

## Self-review — Cobertura dos 44 itens do checklist v3 §15

| # | Item checklist v3 | Task plan v2 | Status |
|---|---|---|---|
| **Logger (6)** | | | |
| 1 | `internal/obs/logger.go` handler JSON prod / texto dev | A.3 | IN_PLAN |
| 2 | `internal/obs/context.go` keys tipadas + helpers | A.1 | IN_PLAN |
| 3 | `internal/obs/context_handler.go` extrai req_id/trace_id/span_id | A.2 | IN_PLAN |
| 4 | Bridge `otelslog` integrado | E.6 | IN_PLAN |
| 5 | Middleware Fiber lê `c.Locals("requestid")` e injeta em `c.UserContext` + `c.Locals("logger")` | A.5 | IN_PLAN (pseudo-código explícito) |
| 6 | Zero `log.Printf` em `internal/` | A.7 + **A.8** | IN_PLAN (A.8 varredura exaustiva) |
| **Metrics (6)** | | | |
| 7 | `internal/obs/metrics.go` com collectors custom | D.2, D.4 | IN_PLAN (D.4 inclui histograma + counter) |
| 8 | Middleware `fiberprometheus/v2` v2.10+ | D.1, D.3 | IN_PLAN |
| 9 | `/metrics` em `:9090` goroutine paralela | D.3 | IN_PLAN |
| 10 | `fly.toml` seção `[metrics]` | D.6 / K.1 | IN_PLAN |
| 11 | `workspace_id` nos 5 endpoints | D.5 | IN_PLAN |
| 12 | Métricas `laura_backup_last_*` populadas | D.4, G.1 | IN_PLAN |
| **Tracing (4)** | | | |
| 13 | `internal/obs/tracer.go` OTLP/HTTP + NoOp | E.2 | IN_PLAN |
| 14 | `otelpgx` wrap no pool | E.4 | IN_PLAN (v0.9.0+ pgx/v5) |
| 15 | Spans manuais LLM/whatsmeow/cron/**backup** | E.5 + **G.5** | IN_PLAN (backup coberto) |
| 16 | `trace_id`/`span_id` em logs via bridge | E.6 | IN_PLAN |
| **Errors + Sentry (7)** | | | |
| 17 | `internal/obs/sentry.go` init + sentryfiber + panic | C.2, C.4 | IN_PLAN |
| 18 | `SENTRY_TRACES_SAMPLE_RATE` default 0.1 | C.2 | IN_PLAN |
| 19 | `internal/obs/errors.go` + `error_codes.go` 11 códigos | B.1, B.2 | IN_PLAN |
| 20 | Shape `{error:{code,message,request_id,timestamp}}` | B.2 | IN_PLAN |
| 21 | Catch-all ErrorHandler Fiber | **E.8** | IN_PLAN (task dedicada) |
| 22 | PWA `@sentry/nextjs` + `withSentryConfig` + source maps | C.6, C.7, C.8 | IN_PLAN (Vercel build, não CI) |
| 23 | PWA `lib/api/client.ts` parseia `error.code`/`timestamp` | **C.11** | IN_PLAN |
| **Health (4)** | | | |
| 24 | `/health` version/build_time/uptime | F.2 | IN_PLAN |
| 25 | `-ldflags` main.version/buildTime | F.3 | IN_PLAN |
| 26 | `/ready` JSON per-check `latency_ms` | F.1 | IN_PLAN |
| 27 | Timeout 500ms per-check + global 3s errgroup | F.1 | IN_PLAN |
| **Backup (5)** | | | |
| 28 | Handler `POST /api/ops/backup` autenticado | G.1, G.2 | IN_PLAN |
| 29 | Fly Machines schedule daily documentado | G.7 | STANDBY `[FLY-API-TOKEN-BACKUP]` |
| 30 | `backup-prune.sh` retention 30d+12w+6m | G.3 | IN_PLAN |
| 31 | Workflow `backup-drill.yml` quinzenal | G.4, G.4b, G.4c | IN_PLAN (quebrado em 3 sub-tasks) |
| 32 | Guard `laura-drill-*` antes de destroy | G.4c | IN_PLAN |
| **Alertas (4)** | | | |
| 33 | Sentry 3 regras UI + `alerts.md` | H.2 | STANDBY `[SENTRY-DSN-API]` |
| 34 | `notify-slack` em deploy workflows | H.1 | STANDBY `[SLACK-WEBHOOK]` |
| 35 | Pool exhaustion WARN + CaptureMessage | H.3 | IN_PLAN |
| 36 | LLM timeout >10s métrica + warn | H.4 | IN_PLAN |
| **Dashboards (2)** | | | |
| 37 | 4 JSONs Grafana | I.1, I.2, I.3 | STANDBY `[GRAFANA-CLOUD]` |
| 38 | README import manual | I.4 | IN_PLAN |
| **Docs (5)** | | | |
| 39 | `observability.md` expandido | A.9, D.8, I.5, J.1 | IN_PLAN |
| 40 | `runbooks/incident-response.md` | J.2 | IN_PLAN |
| 41 | `runbooks/error-debugging.md` | J.3 | IN_PLAN |
| 42 | `alerts.md` | H.2 | IN_PLAN |
| 43 | `backup.md` com schedule Fly Machines | G.7 | IN_PLAN |
| **Tests (1 agregado)** | | | |
| 44 | Unit + Integration + **E2E** + cobertura ≥70% | A.4, B.3, B.5, C.5, D.7, E.7, F.4, G.8, **K.3**, **K.4**, L.1 | IN_PLAN (E2E Playwright coberto) |

**Resumo:** 44 itens → **40 IN_PLAN**, **4 STANDBY** (`[FLY-API-TOKEN-BACKUP]`, `[SLACK-WEBHOOK]`, `[SENTRY-DSN-API]`, `[GRAFANA-CLOUD]` — funcionais no runtime com NoOp). **0 DEFERRED**. **Gap 5 (PWA api client) promovido a IN_PLAN via C.11.**

**Total tasks Plan v2:** 61 (vs 52 no v1).
