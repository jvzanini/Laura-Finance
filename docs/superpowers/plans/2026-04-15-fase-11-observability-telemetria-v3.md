# Fase 11 — Observabilidade completa + Telemetria (Plan v3 — FINAL)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Steps em checkbox (`- [ ]`). Cada task bite-sized (≤10 min) termina com commit atômico PT-BR.

> Versão: v3 — FINAL (pós Review #2 pente fino)
> Data: 2026-04-15
> Antecessores: Plan v1, Plan v2
> Spec canônica: `docs/superpowers/specs/2026-04-15-fase-11-observability-telemetria-v3.md`

**Goal:** Adicionar observability stack completa (slog structured logs, Prometheus metrics, OpenTelemetry tracing, Sentry SDK, error response padronizado, /ready enriquecido, backup automation Fly, alertas Sentry+Slack) ao Laura Finance.

**Architecture:** Backend Go ganha `slog` (stdlib) com handler JSON em prod + middleware que lê `c.Locals("requestid")` (Fase 10) e injeta logger derivado em `c.UserContext()`. `fiberprometheus/v2` expõe `/metrics` em port `:9090` (Fiber secundário). OTel SDK exporta OTLP/HTTP (no-op se `OTEL_EXPORTER_OTLP_ENDPOINT` vazio). Sentry SDK Go + `getsentry/sentry-go/fiber` (oficial) captura errors + 10% traces. `SentryHandler` encadeia sobre `ContextHandler` e dispara `CaptureException` em `slog.Error`. Fiber global `ErrorHandler` centraliza `RespondError`. PWA Sentry via `@sentry/nextjs` com source maps via `SENTRY_AUTH_TOKEN` CI-only. Backup via **GitHub Action semanal** `backup-fly-pg.yml` chamando `flyctl postgres backup`. Restore drill quinzenal em DB ephemeral `laura-drill-<sha>`. PWA `lib/api/client.ts` parseia error shape canônico.

**Tech Stack:** Go 1.26 + `slog` + `ansrivas/fiberprometheus/v2 v2.10+` + `getsentry/sentry-go` + `getsentry/sentry-go/fiber` + `go.opentelemetry.io/otel` + `otelfiber` + `exaring/otelpgx v0.9+` + `go.opentelemetry.io/contrib/bridges/otelslog` + `golang.org/x/sync/errgroup`; Next.js 16 + `@sentry/nextjs`; Fly.io + GitHub Actions; Sentry + Grafana Cloud + Slack.

---

## Mudanças v2 → v3 (Review #2 pente fino)

1. **Backup automation simplificada:** task G.7 agora cria **GitHub Action workflow semanal `backup-fly-pg.yml`** chamando `flyctl postgres backup -a <pg-app>`, em vez de embutir script no Dockerfile principal ou criar imagem dedicada `laura-backup-runner`. Docker do app fica intocado.
2. **Handler chain slog formalizado (A.3 + C.3 + E.6):** ordem canônica `innerHandler(JSON) → ContextHandler → SentryHandler → [otelslog quando endpoint OTLP ≠ vazio]`. `NewLogger` recebe builder opcional para adicionar layers.
3. **Ordem prerequisite reconciliada (§14.2):** **A (slog) → B (errors) → C (Sentry)** confirmada; Sentry depende de slog (hooka via handler) e de errors (helper `RespondError` chama `sentry.CaptureException` para status 5xx).
4. **`respondError` código completo** incluído inline em B.2 (v2 só referenciava spec).
5. **`/ready` com errgroup** código completo em F.1 (timeout per-check 500ms + global 3s via `context.WithTimeout`).
6. **Restore drill destroy guard regex-strict:** G.4c usa `^laura-drill-[a-f0-9]{7,}$` em vez de glob `laura-drill-*`.
7. **PWA Sentry auth token em GitHub Actions:** C.8 muda para secret `SENTRY_AUTH_TOKEN` em `.github/workflows/deploy-pwa.yml`, não dashboard Vercel (alinha com esquema GitHub Actions do resto do projeto).
8. **Apêndice de comandos comuns** adicionado ao final (vet, test com cover, gitleaks, playwright, fly metrics).
9. **Self-review tabular 44 itens 1:1** com checklist §15 da spec (v2 tinha só cabeçalho por seção).
10. **Varredura substrings proibidas documentada** na Parte L.

**Total tasks Plan v3:** 63 (v2: 61; +2 para granularidade: C.8 split em C.8a/C.8b e G.7 split em G.7a/G.7b).

---

## Parte 0 — Pré-condições

- [ ] **0.1** Validar baseline.
  - Run: `cd laura-go && git status && git log --oneline -5 && go version && fly version`
  - Expected: tree limpa; Go ≥1.26.1; flyctl presente; arquivos `docs/superpowers/specs/2026-04-15-fase-11-observability-telemetria-v3.md` + `CLAUDE.md` existentes; Fase 10 mergeada (grep por `c.Locals("requestid")` em `internal/` retorna ≥1).
  - Nenhum commit.

---

## Parte A — slog structured logger (prerequisite de TUDO)

- [ ] **A.1** Criar `laura-go/internal/obs/context.go` com chaves tipadas + helpers.
  ```go
  package obs

  import (
      "context"
      "log/slog"
  )

  type ctxKey int

  const (
      RequestIDKey ctxKey = iota
      LoggerKey
  )

  func WithRequestID(ctx context.Context, id string) context.Context {
      return context.WithValue(ctx, RequestIDKey, id)
  }

  func RequestIDFromCtx(ctx context.Context) string {
      if v, ok := ctx.Value(RequestIDKey).(string); ok {
          return v
      }
      return ""
  }

  func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
      return context.WithValue(ctx, LoggerKey, l)
  }

  func FromCtx(ctx context.Context) *slog.Logger {
      if l, ok := ctx.Value(LoggerKey).(*slog.Logger); ok {
          return l
      }
      return slog.Default()
  }
  ```
  - Commit: `feat(observability): contexto tipado para request_id e logger`

- [ ] **A.2** Criar `laura-go/internal/obs/context_handler.go` (wrapper).
  ```go
  package obs

  import (
      "context"
      "log/slog"

      "go.opentelemetry.io/otel/trace"
  )

  type ContextHandler struct{ inner slog.Handler }

  func NewContextHandler(inner slog.Handler) *ContextHandler { return &ContextHandler{inner: inner} }

  func (h *ContextHandler) Enabled(ctx context.Context, lvl slog.Level) bool {
      return h.inner.Enabled(ctx, lvl)
  }

  func (h *ContextHandler) Handle(ctx context.Context, r slog.Record) error {
      if id := RequestIDFromCtx(ctx); id != "" {
          r.AddAttrs(slog.String("request_id", id))
      }
      if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
          r.AddAttrs(
              slog.String("trace_id", sc.TraceID().String()),
              slog.String("span_id", sc.SpanID().String()),
          )
      }
      return h.inner.Handle(ctx, r)
  }

  func (h *ContextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
      return &ContextHandler{inner: h.inner.WithAttrs(attrs)}
  }

  func (h *ContextHandler) WithGroup(name string) slog.Handler {
      return &ContextHandler{inner: h.inner.WithGroup(name)}
  }
  ```
  - Commit: `feat(observability): ContextHandler anexa request_id/trace_id/span_id`

- [ ] **A.3** Criar `laura-go/internal/obs/logger.go` — ponto de entrada do builder.
  ```go
  package obs

  import (
      "log/slog"
      "os"
      "strings"
  )

  func levelFromEnv(env string) slog.Level {
      switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
      case "debug":
          return slog.LevelDebug
      case "warn":
          return slog.LevelWarn
      case "error":
          return slog.LevelError
      }
      if env == "production" {
          return slog.LevelInfo
      }
      return slog.LevelDebug
  }

  // NewLogger monta chain base: inner (JSON prod / Text dev) → ContextHandler.
  // SentryHandler e otelslog são aplicados em wrappers separados quando habilitados.
  func NewLogger(env string) *slog.Logger {
      opts := &slog.HandlerOptions{Level: levelFromEnv(env)}
      var inner slog.Handler
      if env == "production" {
          inner = slog.NewJSONHandler(os.Stdout, opts)
      } else {
          inner = slog.NewTextHandler(os.Stdout, opts)
      }
      return slog.New(NewContextHandler(inner))
  }
  ```
  - Commit: `feat(observability): NewLogger JSON prod / text dev com ContextHandler`

- [ ] **A.4** TDD `laura-go/internal/obs/logger_test.go`: cobre JSON válido com `level`/`msg`/`time`; text dev; `ContextHandler` injeta `request_id` quando presente; não injeta quando ausente. Usar `bytes.Buffer` + `json.Decoder`.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: `ok` verde.
  - Commit: `test(observability): logger JSON + ContextHandler injection`

- [ ] **A.5** Criar `laura-go/internal/obs/middleware.go`.
  ```go
  package obs

  import (
      "log/slog"

      "github.com/gofiber/fiber/v2"
  )

  func LoggerMiddleware(base *slog.Logger) fiber.Handler {
      return func(c *fiber.Ctx) error {
          id, _ := c.Locals("requestid").(string)
          logger := base.With("request_id", id)
          ctx := c.UserContext()
          ctx = WithRequestID(ctx, id)
          ctx = WithLogger(ctx, logger)
          c.SetUserContext(ctx)
          c.Locals("logger", logger)
          return c.Next()
      }
  }
  ```
  - Commit: `feat(observability): middleware Fiber injeta slog logger em Locals + UserContext`

- [ ] **A.6** Integrar em `laura-go/cmd/api/main.go`: `logger := obs.NewLogger(os.Getenv("APP_ENV"))`, `slog.SetDefault(logger)`, `app.Use(obs.LoggerMiddleware(logger))`. Remover logger Fiber JSON antigo da Fase 10 (commit atômico).
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `feat(observability): instala slog no app Fiber principal`

- [ ] **A.7** Retrofit 5 arquivos críticos substituindo `log.Printf`/`log.Println`: `cmd/api/main.go`, `internal/repo/db.go`, `internal/whatsapp/client.go`, `internal/llm/call.go`, `internal/app/handlers/auth.go`. Usar `obs.FromCtx(ctx).InfoContext(ctx, ...)` quando ctx disponível, `slog.Info(...)` senão.
  - Run: `cd laura-go && go build ./... && go vet ./...`
  - Expected: success.
  - Commit: `refactor(observability): migra 5 arquivos críticos para slog`

- [ ] **A.8** Varredura exaustiva remanescentes.
  - Run: `cd laura-go && grep -rn "log\.Printf\|log\.Println" internal/ cmd/ | tee /tmp/logprintf_remaining.txt`
  - Expected: lista. Para cada arquivo listado, substituir por `obs.FromCtx(ctx).InfoContext(...)` ou `slog.Info(...)`. Apagar imports `"log"` não usados.
  - Run final: `cd laura-go && grep -rn "log\.Printf\|log\.Println" internal/ cmd/ || echo ZERO`
  - Expected: `ZERO`.
  - Commit: `refactor(observability): zero log.Printf em internal/ e cmd/`

- [ ] **A.9** Doc — criar `docs/ops/observability.md` com seção "Logger" (formato JSON, campos canônicos, níveis, como filtrar por `request_id` em prod via `fly logs -a laura-api | jq 'select(.request_id=="...")'`).
  - Commit: `docs(observability): seção Logger no observability.md`

---

## Parte B — Error response padronizado (depende de A)

- [ ] **B.1** Criar `laura-go/internal/obs/error_codes.go`.
  ```go
  package obs

  const (
      CodeValidationFailed       = "VALIDATION_FAILED"
      CodeAuthInvalidCredentials = "AUTH_INVALID_CREDENTIALS"
      CodeAuthTokenExpired       = "AUTH_TOKEN_EXPIRED"
      CodeForbidden              = "FORBIDDEN"
      CodeNotFound               = "NOT_FOUND"
      CodeConflict               = "CONFLICT"
      CodeRateLimited            = "RATE_LIMITED"
      CodeInternal               = "INTERNAL"
      CodeDBTimeout              = "DB_TIMEOUT"
      CodeLLMProviderDown        = "LLM_PROVIDER_DOWN"
      CodeDependencyDown         = "DEPENDENCY_DOWN"
  )

  var defaultMessages = map[string]string{
      CodeValidationFailed:       "Dados inválidos",
      CodeAuthInvalidCredentials: "Credenciais inválidas",
      CodeAuthTokenExpired:       "Sessão expirada",
      CodeForbidden:              "Acesso negado",
      CodeNotFound:               "Recurso não encontrado",
      CodeConflict:               "Conflito de estado",
      CodeRateLimited:            "Limite de requisições atingido",
      CodeInternal:               "Erro interno",
      CodeDBTimeout:              "Timeout de banco de dados",
      CodeLLMProviderDown:        "Provedor de IA indisponível",
      CodeDependencyDown:         "Dependência externa indisponível",
  }

  func messageFor(code string, err error) string {
      if err != nil {
          if msg, ok := defaultMessages[code]; ok {
              return msg
          }
          return err.Error()
      }
      if msg, ok := defaultMessages[code]; ok {
          return msg
      }
      return "Erro desconhecido"
  }
  ```
  - Commit: `feat(observability): 11 códigos de erro canônicos`

- [ ] **B.2** Criar `laura-go/internal/obs/errors.go` com helper.
  ```go
  package obs

  import (
      "time"

      "github.com/getsentry/sentry-go"
      "github.com/gofiber/fiber/v2"
  )

  type ErrorBody struct {
      Code      string `json:"code"`
      Message   string `json:"message"`
      RequestID string `json:"request_id,omitempty"`
      Timestamp string `json:"timestamp"`
  }

  func RespondError(c *fiber.Ctx, code string, status int, err error) error {
      reqID, _ := c.Locals("requestid").(string)
      body := fiber.Map{"error": ErrorBody{
          Code:      code,
          Message:   messageFor(code, err),
          RequestID: reqID,
          Timestamp: time.Now().UTC().Format(time.RFC3339),
      }}
      logger := FromCtx(c.UserContext())
      if status >= 500 {
          if err != nil {
              sentry.CaptureException(err)
          }
          logger.Error("server_error", "code", code, "err", err)
      } else {
          logger.Warn("client_error", "code", code, "err", err)
      }
      return c.Status(status).JSON(body)
  }
  ```
  - Commit: `feat(observability): helper RespondError com shape canônico`

- [ ] **B.3** TDD `laura-go/internal/obs/errors_test.go`: para cada 11 códigos, `RespondError` retorna JSON com shape correto; `timestamp` ISO-8601 UTC parseável (`time.Parse(time.RFC3339, ...)`); `request_id` vem do `c.Locals("requestid")`; log ERROR para 5xx, WARN para 4xx.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: verde.
  - Commit: `test(observability): shape error response + níveis log`

- [ ] **B.4** Retrofit 5 handlers críticos para usar `obs.RespondError`: `internal/app/handlers/auth.go`, `transactions.go`, `cards.go`, `dashboard.go`, `score.go`. Mapear: `pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DB_TIMEOUT`, `validator.ValidationErrors` → `VALIDATION_FAILED`.
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `refactor(observability): 5 handlers críticos usam RespondError`

- [ ] **B.5** Integration test `laura-go/test/integration/error_shape_test.go`: Fiber test server com handlers stub por código; asserta shape canônico em cada response + `request_id` presente.
  - Run: `cd laura-go && go test ./test/integration/... -run ErrorShape`
  - Expected: verde.
  - Commit: `test(observability): integration error_shape cobre 11 códigos`

---

## Parte C — Sentry SDK (depende de A, B) — STANDBY `[SENTRY-DSN-API]`, `[SENTRY-DSN-PWA]`, `[SENTRY-AUTH-TOKEN]`

- [ ] **C.1** Adicionar deps Sentry.
  - Run: `cd laura-go && go get github.com/getsentry/sentry-go@latest github.com/getsentry/sentry-go/fiber@latest && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados.
  - Commit: `build(sentry): adiciona sentry-go + fiber adapter oficial`

- [ ] **C.2** Criar `laura-go/internal/obs/sentry.go`. STANDBY `[SENTRY-DSN-API]`.
  ```go
  package obs

  import (
      "os"
      "strconv"
      "time"

      "github.com/getsentry/sentry-go"
  )

  func parseFloatEnv(key string, def float64) float64 {
      if v := os.Getenv(key); v != "" {
          if f, err := strconv.ParseFloat(v, 64); err == nil {
              return f
          }
      }
      return def
  }

  func InitSentry(version string) func() {
      dsn := os.Getenv("SENTRY_DSN_API")
      _ = sentry.Init(sentry.ClientOptions{
          Dsn:              dsn, // vazio → NoOp
          Environment:      os.Getenv("APP_ENV"),
          Release:          version,
          EnableTracing:    dsn != "",
          TracesSampleRate: parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 0.1),
      })
      return func() { sentry.Flush(2 * time.Second) }
  }
  ```
  - Commit: `feat(sentry): init SDK gated por DSN com sampling 0.1 default`

- [ ] **C.3** Criar `laura-go/internal/obs/sentry_slog_hook.go`.
  ```go
  package obs

  import (
      "context"
      "errors"
      "log/slog"

      "github.com/getsentry/sentry-go"
  )

  type SentryHandler struct{ inner slog.Handler }

  func NewSentryHandler(inner slog.Handler) *SentryHandler { return &SentryHandler{inner: inner} }

  func (h *SentryHandler) Enabled(ctx context.Context, lvl slog.Level) bool {
      return h.inner.Enabled(ctx, lvl)
  }

  func (h *SentryHandler) Handle(ctx context.Context, r slog.Record) error {
      if err := h.inner.Handle(ctx, r); err != nil {
          return err
      }
      if r.Level < slog.LevelWarn {
          return nil
      }
      hub := sentry.GetHubFromContext(ctx)
      if hub == nil {
          hub = sentry.CurrentHub()
      }
      if hub == nil {
          return nil
      }
      var extractedErr error
      r.Attrs(func(a slog.Attr) bool {
          if a.Key == "err" {
              if e, ok := a.Value.Any().(error); ok {
                  extractedErr = e
                  return false
              }
          }
          return true
      })
      if r.Level >= slog.LevelError {
          if extractedErr == nil {
              extractedErr = errors.New(r.Message)
          }
          hub.CaptureException(extractedErr)
      } else {
          hub.CaptureMessage(r.Message)
      }
      return nil
  }

  func (h *SentryHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
      return &SentryHandler{inner: h.inner.WithAttrs(attrs)}
  }

  func (h *SentryHandler) WithGroup(name string) slog.Handler {
      return &SentryHandler{inner: h.inner.WithGroup(name)}
  }
  ```
  - Commit: `feat(sentry): hook slog.Error/Warn dispara CaptureException/Message`

- [ ] **C.4** Extender `NewLogger` em `logger.go` para aceitar flag de Sentry. Adicionar `NewLoggerWithSentry(env) *slog.Logger` que encadeia `inner (JSON) → ContextHandler → SentryHandler` se `SENTRY_DSN_API` não-vazio; caso contrário cai em `NewLogger`.
  ```go
  func NewLoggerWithSentry(env string) *slog.Logger {
      base := NewLogger(env)
      if os.Getenv("SENTRY_DSN_API") == "" {
          return base
      }
      opts := &slog.HandlerOptions{Level: levelFromEnv(env)}
      var inner slog.Handler
      if env == "production" {
          inner = slog.NewJSONHandler(os.Stdout, opts)
      } else {
          inner = slog.NewTextHandler(os.Stdout, opts)
      }
      return slog.New(NewSentryHandler(NewContextHandler(inner)))
  }
  ```
  - Commit: `feat(sentry): NewLoggerWithSentry encadeia SentryHandler sobre ContextHandler`

- [ ] **C.5** Integrar em `cmd/api/main.go`: `flush := obs.InitSentry(buildVersion)` antes de montar logger; `logger := obs.NewLoggerWithSentry(os.Getenv("APP_ENV"))`; `defer flush()`. Adicionar `app.Use(sentryfiber.New(sentryfiber.Options{Repanic: true, WaitForDelivery: false, Timeout: 2 * time.Second}))` antes dos demais middlewares.
  - Import: `sentryfiber "github.com/getsentry/sentry-go/fiber"`.
  - Commit: `feat(sentry): middleware Fiber + flush no shutdown`

- [ ] **C.6** Scope enrichment — editar `internal/obs/middleware.go` ou criar `scope_middleware.go` para, após `LoggerMiddleware`, gravar `request_id`/`workspace_id`/`user_id` no `sentry.Hub`:
  ```go
  if hub := sentryfiber.GetHubFromContext(c); hub != nil {
      hub.Scope().SetTag("request_id", id)
      if ws, ok := c.Locals("workspace_id").(string); ok && ws != "" {
          hub.Scope().SetTag("workspace_id", ws)
      }
      if uid, ok := c.Locals("user_id").(string); ok && uid != "" {
          hub.Scope().SetUser(sentry.User{ID: uid})
      }
  }
  ```
  - Commit: `feat(sentry): scope enrichment request_id/workspace_id/user_id`

- [ ] **C.7** Unit test `laura-go/internal/obs/sentry_test.go`: com DSN vazio `InitSentry` é NoOp e não explode; `SentryHandler.Handle` em nível INFO não dispara capture (usar mock transport via `sentry.ClientOptions.Transport`); em ERROR enfileira event.
  - Run: `cd laura-go && go test ./internal/obs/...`
  - Expected: verde.
  - Commit: `test(sentry): NoOp vazio + capture com mock transport`

- [ ] **C.8a** PWA — rodar wizard Sentry.
  - Run: `cd laura-pwa && npx @sentry/wizard@latest -i nextjs --skip-telemetry`
  - Expected: arquivos `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts` criados; `next.config.ts` editado. STANDBY `[SENTRY-DSN-PWA]`.
  - Commit: `feat(sentry): wizard Sentry Next.js no PWA`

- [ ] **C.8b** Editar `laura-pwa/sentry.{client,server,edge}.config.ts`:
  ```ts
  import * as Sentry from "@sentry/nextjs";

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_PWA,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  });
  ```
  - Commit: `feat(sentry): configs client/server/edge sampling 0.1 + NoOp quando DSN vazio`

- [ ] **C.9** `laura-pwa/next.config.ts` com `withSentryConfig`.
  ```ts
  import { withSentryConfig } from "@sentry/nextjs";
  const nextConfig = { /* ... */ };
  export default withSentryConfig(nextConfig, {
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
  ```
  - `SENTRY_AUTH_TOKEN` como **GitHub Actions secret** (não Vercel dashboard). Editar `.github/workflows/deploy-pwa.yml` passando `env: { SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }} }` no step `build`.
  - Run: `cd laura-pwa && pnpm build`
  - Expected: build success; sem token upload pulado silenciosamente.
  - Commit: `feat(sentry): withSentryConfig + upload source maps via CI secret`

- [ ] **C.10** Adicionar rota dev-only `POST /api/_debug/panic` em `internal/app/router.go` gated `if os.Getenv("APP_ENV") != "production"` que faz `panic("smoke sentry")`.
  - Commit: `feat(sentry): endpoint _debug/panic para smoke (não-prod)`

- [ ] **C.11** Criar `laura-pwa/src/lib/api/types.ts` + `client.ts`.
  ```ts
  // types.ts
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
    ) { super(message); this.name = "ApiError"; }
  }
  ```
  ```ts
  // client.ts
  import { ApiError, type ApiErrorPayload } from "./types";

  export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, init);
    if (!res.ok) {
      let body: ApiErrorPayload | null = null;
      try { body = await res.json(); } catch {}
      if (body?.error) {
        throw new ApiError(body.error.code, body.error.message, body.error.request_id, body.error.timestamp, res.status);
      }
      throw new Error(`HTTP ${res.status} (request_id=${res.headers.get("x-request-id") ?? "?"})`);
    }
    return res.json() as Promise<T>;
  }
  ```
  - Commit: `feat(sentry): PWA api client parseia error shape canônico`

---

## Parte D — Prometheus metrics (depende de A)

- [ ] **D.1** Adicionar dep fiberprometheus.
  - Run: `cd laura-go && go get github.com/ansrivas/fiberprometheus/v2@v2.10.0 && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados.
  - Commit: `build(metrics): adiciona fiberprometheus v2.10`

- [ ] **D.2** Criar `laura-go/internal/obs/metrics.go`.
  ```go
  package obs

  import (
      "github.com/ansrivas/fiberprometheus/v2"
      "github.com/gofiber/fiber/v2"
  )

  func NewMetricsApp() (*fiber.App, *fiberprometheus.FiberPrometheus) {
      metricsApp := fiber.New(fiber.Config{DisableStartupMessage: true})
      prom := fiberprometheus.New("laura_api")
      prom.RegisterAt(metricsApp, "/metrics")
      return metricsApp, prom
  }
  ```
  - Commit: `feat(metrics): construtor metricsApp em Fiber separado`

- [ ] **D.3** Integrar em `cmd/api/main.go`.
  ```go
  metricsApp, prom := obs.NewMetricsApp()
  app.Use(prom.Middleware)
  go func() {
      if err := metricsApp.Listen(":9090"); err != nil {
          slog.Error("metrics_app_listen", "err", err)
      }
  }()
  ```
  - Graceful shutdown: no handler SIGTERM, `metricsApp.ShutdownWithTimeout(2*time.Second)` antes do app principal.
  - Commit: `feat(metrics): sobe /metrics em :9090 com shutdown graceful`

- [ ] **D.4** Criar `laura-go/internal/obs/metrics_custom.go` com collectors:
  - **pgxpool gauges** (`laura_pgxpool_idle_conns`, `laura_pgxpool_total_conns`, `laura_pgxpool_acquire_count`) atualizados em goroutine tick 15s lendo `pool.Stat()`.
  - **pgxpool histograma** `laura_pgxpool_query_duration_seconds` (via hook pgx tracer chain com otelpgx).
  - **pgxpool counter** `laura_pgxpool_errors_total{type}` (`type ∈ {acquire, query, tx}`).
  - **LLM** `laura_llm_call_duration_seconds{provider,model}` histograma + `laura_llm_call_errors_total{provider,reason}` counter + `laura_llm_timeouts_total{provider}` counter.
  - **Cron** `laura_cron_job_duration_seconds{job}` histograma.
  - **Backup** `laura_backup_last_success_timestamp_seconds` e `laura_backup_last_size_bytes` gauges.
  - Expor função `StartPgxStatsCollector(ctx context.Context, pool *pgxpool.Pool)` que roda o tick.
  - Commit: `feat(metrics): collectors custom pgxpool/llm/cron/backup`

- [ ] **D.5** Cardinalidade — criar `laura-go/internal/obs/metrics_workspace.go`.
  ```go
  var criticalRoutes = map[string]bool{
      "/api/v1/transactions": true,
      "/api/v1/dashboard":    true,
      "/api/v1/score":        true,
      "/api/v1/reports":      true,
      "/api/v1/auth/login":   true,
  }

  var workspaceHTTP = promauto.NewHistogramVec(prometheus.HistogramOpts{
      Name:    "laura_http_workspace_request_duration_seconds",
      Help:    "HTTP request duration per workspace in 5 critical routes.",
      Buckets: prometheus.DefBuckets,
  }, []string{"workspace_id", "route", "status"})

  func WorkspaceLabelMiddleware() fiber.Handler {
      return func(c *fiber.Ctx) error {
          if !criticalRoutes[c.Path()] {
              return c.Next()
          }
          start := time.Now()
          err := c.Next()
          ws, _ := c.Locals("workspace_id").(string)
          if ws == "" { ws = "unknown" }
          workspaceHTTP.WithLabelValues(ws, c.Path(), strconv.Itoa(c.Response().StatusCode())).Observe(time.Since(start).Seconds())
          return err
      }
  }
  ```
  - Commit: `feat(metrics): workspace_id label nos 5 endpoints críticos canônicos`

- [ ] **D.6** Editar `laura-go/fly.toml`.
  ```toml
  [metrics]
    port = 9090
    path = "/metrics"
  ```
  Garantir que `[[services]]` público não exponha `9090`.
  - Commit: `chore(infra): fly.toml [metrics] section aponta para :9090`

- [ ] **D.7** Integration test `laura-go/test/integration/metrics_test.go`: sobe app + metricsApp; `GET :9090/metrics` contém `laura_api_requests_total` + `laura_pgxpool_idle_conns`; `GET :8080/metrics` → 404.
  - Run: `cd laura-go && go test ./test/integration/... -run Metrics`
  - Expected: verde.
  - Commit: `test(metrics): /metrics em :9090 + 404 no :8080`

- [ ] **D.8** Doc — seção "Metrics" em `docs/ops/observability.md` listando collectors canônicos, cardinalidade, comandos de consulta (`fly ssh console -a laura-api -C "curl -s 127.0.0.1:9090/metrics | head -40"`).
  - Commit: `docs(metrics): seção Metrics no observability.md`

---

## Parte E — OpenTelemetry tracing (depende de A)

- [ ] **E.1** Adicionar deps OTel.
  - Run: `cd laura-go && go get go.opentelemetry.io/otel go.opentelemetry.io/otel/sdk go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp go.opentelemetry.io/contrib/instrumentation/github.com/gofiber/fiber/v2/otelfiber github.com/exaring/otelpgx@v0.9.0 go.opentelemetry.io/contrib/bridges/otelslog && go mod tidy`
  - Expected: `go.mod`/`go.sum` atualizados.
  - Commit: `build(tracing): adiciona OTel SDK + otelfiber + otelpgx + otelslog`

- [ ] **E.2** Criar `laura-go/internal/obs/tracer.go`. STANDBY `[OTEL-COLLECTOR-URL]`.
  ```go
  package obs

  import (
      "context"
      "os"

      "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
      "go.opentelemetry.io/otel/sdk/resource"
      sdktrace "go.opentelemetry.io/otel/sdk/trace"
      "go.opentelemetry.io/otel/trace"
      "go.opentelemetry.io/otel/trace/noop"
      semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
      "go.opentelemetry.io/otel/attribute"
  )

  func NewTracerProvider(ctx context.Context, version string) (trace.TracerProvider, func(context.Context) error, error) {
      endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
      if endpoint == "" {
          return noop.NewTracerProvider(), func(context.Context) error { return nil }, nil
      }
      exp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(endpoint))
      if err != nil {
          return nil, nil, err
      }
      res, _ := resource.New(ctx,
          resource.WithAttributes(
              semconv.ServiceName("laura-api"),
              semconv.ServiceVersion(version),
              attribute.String("deployment.environment", os.Getenv("APP_ENV")),
          ),
      )
      tp := sdktrace.NewTracerProvider(
          sdktrace.WithBatcher(exp),
          sdktrace.WithResource(res),
          sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(parseFloatEnv("OTEL_TRACES_SAMPLE_RATE", 0.1)))),
      )
      return tp, tp.Shutdown, nil
  }
  ```
  - Commit: `feat(tracing): TracerProvider com NoOp graceful quando endpoint vazio`

- [ ] **E.3** Integrar em `cmd/api/main.go`: `tp, shutdown, _ := obs.NewTracerProvider(ctx, buildVersion)`; `otel.SetTracerProvider(tp)`; `app.Use(otelfiber.Middleware())` antes do slog middleware; `defer shutdown(ctx)`.
  - Commit: `feat(tracing): otelfiber middleware + shutdown hook`

- [ ] **E.4** Instrumentar pgx — editar `laura-go/internal/repo/db.go`.
  ```go
  cfg, err := pgxpool.ParseConfig(dsn)
  if err != nil { return nil, err }
  cfg.ConnConfig.Tracer = otelpgx.NewTracer()
  pool, err := pgxpool.NewWithConfig(ctx, cfg)
  ```
  - Run: `cd laura-go && go build ./...`
  - Expected: build success.
  - Commit: `feat(tracing): otelpgx wrap no pool Postgres`

- [ ] **E.5** Spans manuais em `internal/llm/call.go`, `internal/whatsapp/client.go`, `internal/cron/*.go`.
  ```go
  ctx, span := otel.Tracer("laura/llm").Start(ctx, "llm.call",
      trace.WithAttributes(
          attribute.String("llm.provider", provider),
          attribute.String("llm.model", model),
      ))
  defer span.End()
  // ... após retorno:
  span.SetAttributes(attribute.Int("llm.tokens_in", tokensIn), attribute.Int("llm.tokens_out", tokensOut))
  ```
  - Commit: `feat(tracing): spans manuais em llm/whatsapp/cron`

- [ ] **E.6** Bridge `otelslog` — editar `logger.go` para, quando `OTEL_EXPORTER_OTLP_ENDPOINT` não vazio, usar `otelslog.NewHandler("laura-api", otelslog.WithSource(true))` sobre `ContextHandler`. Chain: `inner → ContextHandler → otelslog → (SentryHandler opcional)`.
  - Commit: `feat(tracing): bridge otelslog injeta trace_id/span_id nos logs`

- [ ] **E.7** Tests `internal/obs/tracer_test.go` (NoOp com env vazia) + `test/integration/tracing_test.go` (listener TCP fake OTLP receber spans pgx + LLM).
  - Run: `cd laura-go && go test ./internal/obs/... ./test/integration/... -run Tracing`
  - Expected: verde.
  - Commit: `test(tracing): NoOp vazio + span export via mock OTLP`

- [ ] **E.8** Fiber global `ErrorHandler` catch-all — criar `laura-go/internal/obs/error_handler.go`.
  ```go
  package obs

  import (
      "context"
      "errors"

      "github.com/gofiber/fiber/v2"
      "github.com/jackc/pgx/v5"
  )

  func GlobalErrorHandler(c *fiber.Ctx, err error) error {
      code, status := classifyError(err)
      return RespondError(c, code, status, err)
  }

  func classifyError(err error) (string, int) {
      var fe *fiber.Error
      if errors.As(err, &fe) {
          switch fe.Code {
          case 400: return CodeValidationFailed, 400
          case 401: return CodeAuthInvalidCredentials, 401
          case 403: return CodeForbidden, 403
          case 404: return CodeNotFound, 404
          case 409: return CodeConflict, 409
          case 429: return CodeRateLimited, 429
          }
          return CodeInternal, fe.Code
      }
      if errors.Is(err, context.DeadlineExceeded) { return CodeDBTimeout, 504 }
      if errors.Is(err, pgx.ErrNoRows)             { return CodeNotFound, 404 }
      return CodeInternal, 500
  }
  ```
  - Editar `cmd/api/main.go`: `app := fiber.New(fiber.Config{ErrorHandler: obs.GlobalErrorHandler})`.
  - Commit: `feat(observability): Fiber global ErrorHandler centraliza RespondError`

---

## Parte F — Health enriquecido /ready (paralelo com C,D)

- [ ] **F.1** Editar `laura-go/internal/app/handlers/health.go`.
  ```go
  func Ready(pool *pgxpool.Pool, waClient *whatsmeow.Client, llm llm.Provider) fiber.Handler {
      return func(c *fiber.Ctx) error {
          ctx, cancel := context.WithTimeout(c.UserContext(), 3*time.Second)
          defer cancel()

          type checkResult struct {
              Status    string `json:"status"`
              LatencyMs int64  `json:"latency_ms,omitempty"`
          }
          checks := map[string]checkResult{}
          var mu sync.Mutex
          g, gctx := errgroup.WithContext(ctx)

          g.Go(func() error {
              cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
              defer ccancel()
              start := time.Now()
              if err := pool.Ping(cctx); err != nil {
                  mu.Lock(); checks["db"] = checkResult{Status: "fail"}; mu.Unlock()
                  return err
              }
              mu.Lock(); checks["db"] = checkResult{Status: "ok", LatencyMs: time.Since(start).Milliseconds()}; mu.Unlock()
              return nil
          })
          g.Go(func() error {
              if waClient != nil && waClient.IsConnected() {
                  mu.Lock(); checks["whatsmeow"] = checkResult{Status: "connected"}; mu.Unlock()
              } else {
                  mu.Lock(); checks["whatsmeow"] = checkResult{Status: "disconnected"}; mu.Unlock()
              }
              return nil
          })
          g.Go(func() error {
              cctx, ccancel := context.WithTimeout(gctx, 500*time.Millisecond)
              defer ccancel()
              start := time.Now()
              if err := llm.Ping(cctx); err != nil {
                  mu.Lock(); checks["llm_provider"] = checkResult{Status: "unreachable"}; mu.Unlock()
                  return nil // não bloqueia 503
              }
              mu.Lock(); checks["llm_provider"] = checkResult{Status: "reachable", LatencyMs: time.Since(start).Milliseconds()}; mu.Unlock()
              return nil
          })

          dbErr := g.Wait()
          status := "ready"
          httpStatus := 200
          if dbErr != nil {
              status = "fail"; httpStatus = 503
          } else if checks["whatsmeow"].Status != "connected" || checks["llm_provider"].Status != "reachable" {
              status = "degraded"
          }
          return c.Status(httpStatus).JSON(fiber.Map{"status": status, "version": buildVersion, "checks": checks})
      }
  }
  ```
  - Commit: `feat(observability): /ready JSON com errgroup + timeout 3s`

- [ ] **F.2** `/health` retorna `{status:"ok", version, build_time, uptime_seconds}`. Variáveis `buildVersion`/`buildTime` injetadas via `-ldflags`; `startTime := time.Now()` no `main()`.
  - Commit: `feat(observability): /health expõe version/build_time/uptime`

- [ ] **F.3** `-ldflags` no `Dockerfile` e `deploy-api.yml`.
  ```dockerfile
  ARG BUILD_SHA
  ARG BUILD_TIME
  RUN go build -ldflags "-X main.version=${BUILD_SHA} -X main.buildTime=${BUILD_TIME}" -o /app/api ./cmd/api
  ```
  ```yaml
  # .github/workflows/deploy-api.yml
  - name: Build image
    run: |
      docker build \
        --build-arg BUILD_SHA=$(git rev-parse --short HEAD) \
        --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
        -t laura-api .
  ```
  - Commit: `ci(observability): ldflags injeta version+build_time`

- [ ] **F.4** Integration test `laura-go/test/integration/health_test.go`: `/health.version` não-vazia; `/ready` com db down → 503; whatsmeow down → 200 degraded; timeout global respeitado (simular check dormindo 10s → corta em 3s).
  - Run: `cd laura-go && go test ./test/integration/... -run Health`
  - Expected: verde.
  - Commit: `test(observability): health + ready + timeout 3s`

---

## Parte G — Backup automation via GitHub Actions (depende de D) — STANDBY `[FLY-API-TOKEN-BACKUP]`, `[SLACK-WEBHOOK]`

- [ ] **G.1** Criar `laura-go/internal/app/handlers/ops_backup.go` — `POST /api/ops/backup` autenticado via header `X-Ops-Token` (compara com `BACKUP_OPS_TOKEN`). Atualiza gauges `laura_backup_last_success_timestamp_seconds`/`laura_backup_last_size_bytes`. Usa `RespondError` em falha. Span OTel manual `backup.run`.
  ```go
  ctx, span := otel.Tracer("laura/backup").Start(c.UserContext(), "backup.run",
      trace.WithAttributes(attribute.String("db.cluster", dbCluster)))
  defer span.End()
  ```
  - Commit: `feat(backup): handler /api/ops/backup com X-Ops-Token + span OTel`

- [ ] **G.2** Registrar rota em `internal/app/router.go` sob grupo `/api/ops` com middleware ops token.
  - Commit: `feat(backup): registra /api/ops/backup no router`

- [ ] **G.3** Criar `scripts/backup-prune.sh` — retention 30d daily + 12 weekly (sábado) + 6 monthly (dia 1), via `fly postgres backups list` + `date` + `awk`. Suporta `--dry-run`.
  - Run: `bash scripts/backup-prune.sh --dry-run`
  - Expected: lista + ações dry-run; exit 0.
  - Commit: `feat(backup): script backup-prune com retention 30d/12w/6m`

- [ ] **G.4** Criar `.github/workflows/backup-drill.yml` esqueleto — cron `0 4 */14 * *`, `concurrency: drill`, `timeout-minutes: 30`. Steps: checkout, setup-flyctl. Env `FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_BACKUP }}`.
  ```yaml
  name: backup-drill
  on:
    schedule:
      - cron: "0 4 */14 * *"
    workflow_dispatch:
  concurrency:
    group: drill
    cancel-in-progress: false
  jobs:
    drill:
      runs-on: ubuntu-latest
      timeout-minutes: 30
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_BACKUP }}
      steps:
        - uses: actions/checkout@v4
        - uses: superfly/flyctl-actions/setup-flyctl@master
  ```
  - Commit: `ci(backup): esqueleto workflow backup-drill quinzenal`

- [ ] **G.4b** Adicionar steps provisionamento em `backup-drill.yml`.
  ```yaml
  - name: Create ephemeral DB
    run: |
      SHA=$(git rev-parse --short HEAD)
      EPH="laura-drill-${SHA}"
      echo "EPH_NAME=$EPH" >> $GITHUB_ENV
      flyctl postgres create --name "$EPH" --region gru --vm-size shared-cpu-1x --volume-size 10 --initial-cluster-size 1 --yes
  - name: Restore latest backup
    run: flyctl postgres backup restore --latest -a "$EPH_NAME"
  ```
  - Commit: `ci(backup): steps create + restore em DB ephemeral laura-drill-<sha>`

- [ ] **G.4c** Adicionar smoke + destroy guard regex-strict + Slack notify.
  ```yaml
  - name: Smoke SELECT count
    run: |
      for tbl in users workspaces transactions messages llm_calls audit_log; do
        flyctl postgres connect -a "$EPH_NAME" -c "SELECT count(*) FROM ${tbl};" || exit 1
      done
  - name: Destroy ephemeral (regex guard)
    if: always()
    run: |
      if [[ "$EPH_NAME" =~ ^laura-drill-[a-f0-9]{7,}$ ]]; then
        flyctl apps destroy "$EPH_NAME" --yes
      else
        echo "REFUSED: app name does not match laura-drill-* pattern: $EPH_NAME"
        exit 1
      fi
  - name: Notify Slack
    if: always()
    uses: slackapi/slack-github-action@v1
    env:
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
    with:
      payload: |
        {"text": "backup drill ${{ job.status }} — $EPH_NAME"}
  ```
  - Commit: `ci(backup): smoke 6 tabelas + destroy regex guard + Slack notify`

- [ ] **G.5** Span OTel manual já coberto em G.1; verificação.
  - Run: `cd laura-go && grep -n 'Tracer("laura/backup")' internal/app/handlers/ops_backup.go`
  - Expected: match.
  - Nenhum commit adicional.

- [ ] **G.6** Criar `scripts/backup-restore-drill.sh` — versão local do workflow para smoke manual. Suporta `--dry-run`.
  - Run: `bash scripts/backup-restore-drill.sh --dry-run`
  - Expected: exit 0.
  - Commit: `feat(backup): script local backup-restore-drill`

- [ ] **G.7a** Criar `.github/workflows/backup-fly-pg.yml` — **GitHub Action semanal** (substitui decisão v2 de Fly Machines schedule + imagem dedicada).
  ```yaml
  name: backup-fly-pg
  on:
    schedule:
      - cron: "0 3 * * 0"  # domingo 03:00 UTC
    workflow_dispatch:
  jobs:
    backup:
      runs-on: ubuntu-latest
      timeout-minutes: 15
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_BACKUP }}
      steps:
        - uses: superfly/flyctl-actions/setup-flyctl@master
        - name: Create backup
          run: flyctl postgres backup create -a laura-api-db
        - name: Prune retention
          run: |
            curl -sSfL -o prune.sh https://raw.githubusercontent.com/${{ github.repository }}/main/scripts/backup-prune.sh
            bash prune.sh
  ```
  - Commit: `ci(backup): workflow semanal backup-fly-pg chama flyctl backup create`

- [ ] **G.7b** Doc `docs/ops/backup.md` — cadência retention 30d/12w/6m, procedimento rollback, STANDBY `[FLY-API-TOKEN-BACKUP]`. Seções padronizadas: Quando usar / Pré-requisitos / Procedimento / Validação / Rollback.
  - Commit: `docs(backup): runbook backup.md com workflow semanal`

- [ ] **G.8** Integration test `laura-go/test/integration/backup_test.go` — `POST /api/ops/backup` sem header → 401; token inválido → 403; token válido em `BACKUP_DRY=1` → 200 + métricas atualizadas.
  - Run: `cd laura-go && go test ./test/integration/... -run Backup`
  - Expected: verde.
  - Commit: `test(backup): auth X-Ops-Token + métricas atualizadas`

---

## Parte H — Alertas Sentry + Slack (depende de C, D) — STANDBY `[SLACK-WEBHOOK]`, `[SENTRY-DSN-API]`

- [ ] **H.1** Editar `.github/workflows/deploy-api.yml` + `deploy-pwa.yml` adicionando step `notify-slack` via `slackapi/slack-github-action@v1` gated `if: failure()` com `SLACK_WEBHOOK_URL`.
  - Commit: `ci(alerts): notifica Slack em failure nos deploys`

- [ ] **H.2** Criar `docs/ops/alerts.md` documentando 3 regras Sentry UI: (1) `rate(errors) > 5/5min` → email+Slack; (2) `new issue in production` → Slack; (3) `performance regression p95 > 2s` → email. Seções padronizadas: Quando usar / Pré-requisitos / Procedimento / Validação / Rollback.
  - Commit: `docs(alerts): 3 regras Sentry + configuração Slack`

- [ ] **H.3** Em `internal/obs/metrics_custom.go` goroutine tick 30s: checa `stat := pool.Stat(); ratio := float64(stat.AcquiredConns())/float64(stat.TotalConns())`; se > 0.9 → `slog.Warn("pgxpool_near_exhaustion", "ratio", ratio)` + `sentry.CaptureMessage("pgxpool near exhaustion", sentry.LevelWarning)`.
  - Commit: `feat(alerts): pool exhaustion warn + Sentry capture`

- [ ] **H.4** Em `internal/llm/call.go` medir duração; se > 10s `slog.Warn("llm_timeout_slow", "provider", p, "duration_ms", dur)` + increment `laura_llm_timeouts_total{provider}`.
  - Commit: `feat(alerts): LLM timeout >10s warn + métrica`

---

## Parte I — Dashboards Grafana (depende de D) — STANDBY `[GRAFANA-CLOUD]`

- [ ] **I.1** Criar `docs/ops/grafana-dashboards/go-runtime.json` (base dashboard ID 10826).
  - Commit: `docs(metrics): dashboard Grafana go-runtime`

- [ ] **I.2** Criar `docs/ops/grafana-dashboards/postgres.json` (base 9628).
  - Commit: `docs(metrics): dashboard Grafana postgres`

- [ ] **I.3** Criar `docs/ops/grafana-dashboards/http-laura.json` (custom `laura_api_*`) + `whatsmeow-llm.json` (custom `laura_whatsmeow_*` + `laura_llm_*`).
  - Commit: `docs(metrics): dashboards Grafana http-laura + whatsmeow-llm`

- [ ] **I.4** Criar `docs/ops/grafana-dashboards/README.md` com instruções import manual + STANDBY `[GRAFANA-CLOUD]`.
  - Commit: `docs(metrics): README dashboards Grafana`

- [ ] **I.5** Seção "Grafana" em `docs/ops/observability.md` apontando para pasta.
  - Commit: `docs(observability): seção Grafana`

---

## Parte J — Documentação operacional final

- [ ] **J.1** Expandir `docs/ops/observability.md` com seções completas: Logger, Metrics, Tracing, Sentry, Grafana, Correlação `request_id` → logs → Sentry → trace → Grafana, tabela completa dos 11 códigos de erro. Append sobre a base criada em A.9/D.8/I.5.
  - Commit: `docs(observability): expansão completa de observability.md`

- [ ] **J.2** Criar `docs/ops/runbooks/incident-response.md` — SEV1/2/3 definições, primeiros 5min (Sentry → logs → Grafana → rollback), template post-mortem. Seções padronizadas: Quando usar / Pré-requisitos / Procedimento / Validação / Rollback.
  - Commit: `docs(ops): runbook incident-response`

- [ ] **J.3** Criar `docs/ops/runbooks/error-debugging.md` — workflow: `error.code` do cliente → grep `request_id` em stdout → issue Sentry → trace OTel → métrica Grafana → fix. Seções padronizadas: Quando usar / Pré-requisitos / Procedimento / Validação / Rollback.
  - Commit: `docs(ops): runbook error-debugging com request_id lookup`

---

## Parte K — fly.toml + E2E observability

- [ ] **K.1** Validar que `laura-go/fly.toml` contém `[metrics]` (feito em D.6 — skip se idempotente). Nenhum commit.

- [ ] **K.2** Documentar em `docs/ops/observability.md` + `fly secrets set` canônicos: `OTEL_EXPORTER_OTLP_ENDPOINT=""`, `SENTRY_DSN_API=""`, `SENTRY_TRACES_SAMPLE_RATE="0.1"`, `OTEL_TRACES_SAMPLE_RATE="0.1"`, `BACKUP_OPS_TOKEN=<gerado>`. STANDBYs.
  - Commit: `chore(infra): fly secrets defaults para observabilidade NoOp`

- [ ] **K.3** Criar `laura-pwa/e2e/observability.spec.ts`. Usar `data-testid` estável + storage state da fixture (`SKIP_E2E_AUTH=1` pula globalSetup quando necessário).
  ```ts
  import { test, expect } from "@playwright/test";

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

- [ ] **K.4** Criar `laura-pwa/e2e/error-shape.spec.ts`.
  ```ts
  import { test, expect } from "@playwright/test";

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

- [ ] **L.1** Varredura substrings proibidas.
  - Run: `cd laura-go && grep -rn "TBD\|TODO sem código\|implement later" internal/ cmd/ docs/ || echo ZERO`
  - Expected: `ZERO`.
  - Run: `cd /Users/joaovitorzanini/Developer/Claude\ Code/Laura\ Finance\ \(Vibe\ Coding\) && grep -rn "TBD\|implement later" docs/ops/ || echo ZERO`
  - Expected: `ZERO`.
  - Nenhum commit.

- [ ] **L.2** Validação integral Go.
  - Run: `cd laura-go && go build ./... && go vet ./... && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | grep internal/obs`
  - Expected: cobertura ≥70% em `internal/obs/*`.
  - Run: `cd laura-go && docker build -f Dockerfile .`
  - Expected: build success.
  - Nenhum commit.

- [ ] **L.3** Validação integral PWA.
  - Run: `cd laura-pwa && pnpm build && pnpm test && pnpm exec playwright test e2e/observability.spec.ts e2e/error-shape.spec.ts`
  - Expected: verde.
  - Nenhum commit.

- [ ] **L.4** Tag `phase-11-prepared`.
  - Run: `git tag -a phase-11-prepared -m "Fase 11 observabilidade completa + telemetria pronta para deploy" && git push origin phase-11-prepared`
  - Expected: tag criada e pushada.

---

## Self-review — Cobertura 1:1 dos 44 itens do checklist v3 §15

| # | Item spec v3 §15 | Task plan v3 | Estado |
|---|------------------|--------------|--------|
| **Logger (6)** | | | |
| 1 | `internal/obs/logger.go` handler JSON prod / texto dev | A.3 | IN_PLAN |
| 2 | `internal/obs/context.go` keys tipadas + helpers | A.1 | IN_PLAN |
| 3 | `internal/obs/context_handler.go` extrai req_id/trace_id/span_id | A.2 | IN_PLAN |
| 4 | Bridge `otelslog` integrado | E.6 | IN_PLAN |
| 5 | Middleware Fiber lê `c.Locals("requestid")` e injeta em `c.UserContext` + `c.Locals("logger")` | A.5 | IN_PLAN |
| 6 | Zero `log.Printf` em `internal/` | A.7 + A.8 | IN_PLAN |
| **Metrics (6)** | | | |
| 7 | `internal/obs/metrics.go` com collectors custom | D.2 + D.4 | IN_PLAN |
| 8 | Middleware `fiberprometheus/v2` v2.10+ | D.1 + D.3 | IN_PLAN |
| 9 | `/metrics` em `:9090` goroutine paralela | D.3 | IN_PLAN |
| 10 | `fly.toml` seção `[metrics]` | D.6 | IN_PLAN |
| 11 | `workspace_id` nos 5 endpoints canônicos | D.5 | IN_PLAN |
| 12 | Métricas `laura_backup_last_*` populadas | D.4 + G.1 | IN_PLAN |
| **Tracing (4)** | | | |
| 13 | `internal/obs/tracer.go` OTLP/HTTP + NoOp | E.2 | IN_PLAN |
| 14 | `otelpgx` wrap no pool | E.4 | IN_PLAN |
| 15 | Spans manuais LLM/whatsmeow/cron/backup | E.5 + G.1 | IN_PLAN |
| 16 | `trace_id`/`span_id` em logs via bridge | E.6 | IN_PLAN |
| **Errors + Sentry (7)** | | | |
| 17 | `internal/obs/sentry.go` init + sentryfiber + panic | C.2 + C.5 | STANDBY `[SENTRY-DSN-API]` |
| 18 | `SENTRY_TRACES_SAMPLE_RATE` default 0.1 | C.2 | IN_PLAN |
| 19 | `internal/obs/errors.go` + `error_codes.go` 11 códigos | B.1 + B.2 | IN_PLAN |
| 20 | Shape `{error:{code,message,request_id,timestamp}}` | B.2 | IN_PLAN |
| 21 | Catch-all ErrorHandler Fiber | E.8 | IN_PLAN |
| 22 | PWA `@sentry/nextjs` + `withSentryConfig` + source maps | C.8a + C.8b + C.9 | STANDBY `[SENTRY-DSN-PWA]` + `[SENTRY-AUTH-TOKEN]` |
| 23 | PWA `lib/api/client.ts` parseia `error.code`/`timestamp` | C.11 | IN_PLAN |
| **Health (4)** | | | |
| 24 | `/health` version/build_time/uptime | F.2 | IN_PLAN |
| 25 | `-ldflags` main.version/buildTime | F.3 | IN_PLAN |
| 26 | `/ready` JSON per-check `latency_ms` | F.1 | IN_PLAN |
| 27 | Timeout 500ms per-check + global 3s errgroup | F.1 | IN_PLAN |
| **Backup (5)** | | | |
| 28 | Handler `POST /api/ops/backup` autenticado | G.1 + G.2 | IN_PLAN |
| 29 | Fly backup automation documentado | G.7a + G.7b | STANDBY `[FLY-API-TOKEN-BACKUP]` |
| 30 | `backup-prune.sh` retention 30d+12w+6m | G.3 | IN_PLAN |
| 31 | Workflow `backup-drill.yml` quinzenal | G.4 + G.4b + G.4c | IN_PLAN |
| 32 | Guard regex `^laura-drill-[a-f0-9]{7,}$` antes de destroy | G.4c | IN_PLAN |
| **Alertas (4)** | | | |
| 33 | Sentry 3 regras UI + `alerts.md` | H.2 | STANDBY `[SENTRY-DSN-API]` |
| 34 | `notify-slack` em deploy workflows | H.1 | STANDBY `[SLACK-WEBHOOK]` |
| 35 | Pool exhaustion WARN + CaptureMessage | H.3 | IN_PLAN |
| 36 | LLM timeout >10s métrica + warn | H.4 | IN_PLAN |
| **Dashboards (2)** | | | |
| 37 | 4 JSONs Grafana | I.1 + I.2 + I.3 | STANDBY `[GRAFANA-CLOUD]` |
| 38 | README import manual | I.4 | IN_PLAN |
| **Docs (5)** | | | |
| 39 | `observability.md` expandido | A.9 + D.8 + I.5 + J.1 | IN_PLAN |
| 40 | `runbooks/incident-response.md` | J.2 | IN_PLAN |
| 41 | `runbooks/error-debugging.md` | J.3 | IN_PLAN |
| 42 | `alerts.md` | H.2 | IN_PLAN |
| 43 | `backup.md` com automação Fly | G.7b | IN_PLAN |
| **Tests (1 agregado)** | | | |
| 44 | Unit + Integration + E2E + cobertura ≥70% | A.4 + B.3 + B.5 + C.7 + D.7 + E.7 + F.4 + G.8 + K.3 + K.4 + L.2 + L.3 | IN_PLAN |

**Resumo:** 44 itens → **38 IN_PLAN** + **6 STANDBY** (funcionais no runtime via NoOp: `[SENTRY-DSN-API]`, `[SENTRY-DSN-PWA]`, `[SENTRY-AUTH-TOKEN]`, `[FLY-API-TOKEN-BACKUP]`, `[SLACK-WEBHOOK]`, `[GRAFANA-CLOUD]`) + **0 DEFERRED**.

**Total tasks Plan v3:** 63 (v1: 52, v2: 61).

---

## Apêndice A — Comandos operacionais comuns

### A.1. Build + vet + test Go
```sh
cd laura-go && go build ./... && go vet ./... && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | grep internal/obs
```

### A.2. Build + test PWA + Playwright
```sh
cd laura-pwa && pnpm build && pnpm test && pnpm exec playwright test e2e/observability.spec.ts e2e/error-shape.spec.ts
```

### A.3. Varredura substrings proibidas
```sh
grep -rn "TBD\|TODO sem código\|implement later" laura-go/internal/ laura-go/cmd/ docs/ops/ || echo ZERO
```

### A.4. Gitleaks (secrets scan antes de push)
```sh
gitleaks detect --source . --redact --no-git -v
```

### A.5. Consultar `/metrics` local via fly ssh
```sh
fly ssh console -a laura-api -C "curl -s http://127.0.0.1:9090/metrics | head -40"
```

### A.6. Smoke panic Sentry em staging
```sh
curl -X POST https://staging.laura-api.fly.dev/api/_debug/panic \
  -H "X-Request-Id: smoke-$(date +%s)"
```

### A.7. Reduzir Sentry sampling sem rebuild
```sh
fly secrets set SENTRY_TRACES_SAMPLE_RATE=0.05 -a laura-api
```

### A.8. Verificar scraping Fly interno
```sh
fly metrics show -a laura-api
```

### A.9. Drill backup manual local
```sh
bash scripts/backup-restore-drill.sh --dry-run
```

---

**Fim Plan v3 — FINAL.** Próximo passo: execução via `superpowers:subagent-driven-development` começando em 0.1.
