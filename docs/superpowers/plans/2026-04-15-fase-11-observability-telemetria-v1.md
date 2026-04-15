# Fase 11 — Observabilidade completa + Telemetria (Plan v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Goal:** Adicionar observability stack completa (slog structured logs, Prometheus metrics, OpenTelemetry tracing, Sentry SDK, error response padronizado, /ready enriquecido, backup automation Fly Machines, alertas Sentry+Slack) ao Laura Finance.

**Architecture:** Backend Go ganha slog (stdlib) com handler JSON em prod + middleware extraindo request_id do Fiber Locals; fiberprometheus/v2 expõe /metrics em port :9090 (interno); OTel SDK exporta traces para OTLP HTTP collector (no-op se OTEL_EXPORTER_OTLP_ENDPOINT vazio); Sentry SDK Go + Fiber adapter captura errors + 10% transactions; PWA Sentry via @sentry/nextjs com source maps no Vercel; backup automation via Fly Machines schedule diário; restore drill semanal via workflow GitHub. Sem mudanças de migration.

**Tech Stack:** Go 1.26 + slog + log/slog/handlers/json + fiberprometheus/v2 + getsentry/sentry-go + getsentry/sentry-go/fiber + go.opentelemetry.io/otel + otelfiber + otelpgx + golang.org/x/sync/errgroup; Next.js 16 + @sentry/nextjs; Fly.io + GitHub Actions; Sentry + Grafana Cloud + Slack.

---

## Parte 0 — Pré-condições

- [ ] **0.1** Validar baseline: `cd laura-go && git status` deve estar limpa; `git log --oneline -5` exibido; conferir presença de `docs/superpowers/specs/2026-04-15-fase-11-observability-telemetria-v3.md` e `CLAUDE.md` na raiz. Conferir `go version` (≥1.26.1) e `fly version`. Nenhum commit.

---

## Parte A — slog structured logger (prerequisite de tudo)

- [ ] **A.1** Criar `laura-go/internal/obs/context.go` com chaves tipadas `ctxKey int` (`RequestIDKey`, `LoggerKey`) + helpers `WithRequestID(ctx, id) context.Context`, `RequestIDFromCtx(ctx) string`, `WithLogger(ctx, l *slog.Logger) context.Context`, `FromCtx(ctx) *slog.Logger` (fallback `slog.Default()`). Sem dep externa.
  - Commit: `feat(observability): contexto tipado para request_id e logger`

- [ ] **A.2** Criar `laura-go/internal/obs/context_handler.go` com `ContextHandler` wrapping `slog.Handler` inner. `Handle(ctx, record)` extrai `request_id`/`trace_id`/`span_id` de `ctx` e anexa como attrs antes de delegar. Implementar também `WithAttrs` e `WithGroup` repassando ao inner.
  - Commit: `feat(observability): ContextHandler anexa request_id/trace_id em records`

- [ ] **A.3** Criar `laura-go/internal/obs/logger.go` com `NewLogger(env string) *slog.Logger`: handler JSON em `production`, text em `dev`, wrapping via `ContextHandler`. Nível via `levelFromEnv` (DEBUG/INFO/WARN/ERROR). Retornar `slog.New(&ContextHandler{inner: h})`.
  - Commit: `feat(observability): slog logger JSON em prod / text em dev`

- [ ] **A.4** TDD — criar `laura-go/internal/obs/logger_test.go` cobrindo: `NewLogger("production")` emite JSON válido com `level`, `msg`, `time`; `NewLogger("dev")` emite text; `ContextHandler` injeta `request_id` quando presente no ctx; não injeta quando ausente. Usar `bytes.Buffer` como writer e `json.Decoder`. Rodar `go test ./internal/obs/...` verde.
  - Commit: `test(observability): logger JSON + ContextHandler injection`

- [ ] **A.5** Criar `laura-go/internal/obs/middleware.go` com `LoggerMiddleware(base *slog.Logger) fiber.Handler`: lê `c.Locals("requestid")` (chave Fase 10), cria `logger := base.With("request_id", id)`, injeta em `c.UserContext()` via `WithRequestID` + `WithLogger`, grava `c.Locals("logger", logger)`, chama `c.Next()`.
  - Commit: `feat(observability): middleware Fiber injeta slog logger com request_id`

- [ ] **A.6** Integração — editar `laura-go/cmd/api/main.go` para instanciar `logger := obs.NewLogger(os.Getenv("APP_ENV"))`, `slog.SetDefault(logger)` e `app.Use(obs.LoggerMiddleware(logger))`. Remover logger Fiber JSON antigo (Fase 10). Buildar `go build ./...`.
  - Commit: `feat(observability): instala slog no app Fiber principal`

- [ ] **A.7** Retrofit 5 arquivos críticos substituindo `log.Printf`/`log.Println` por `obs.FromCtx(ctx).InfoContext(ctx, ...)` ou `slog.Info` (quando sem ctx): `cmd/api/main.go`, `internal/repo/db.go`, `internal/whatsapp/client.go`, `internal/llm/call.go`, `internal/app/handlers/auth.go`. Buildar e rodar `go vet ./...`.
  - Commit: `refactor(observability): migra 5 arquivos críticos para slog`

- [ ] **A.8** Doc — criar `docs/ops/observability.md` com seção "Logger" (formato JSON, campos canônicos, níveis, como filtrar por `request_id` em prod).
  - Commit: `docs(observability): seção Logger no observability.md`

---

## Parte B — Error response padronizado (depende de A)

- [ ] **B.1** Criar `laura-go/internal/obs/error_codes.go` com constantes das 11 códigos canônicos: `VALIDATION_FAILED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`, `DB_TIMEOUT`, `LLM_PROVIDER_DOWN`, `DEPENDENCY_DOWN`. Cada uma com mensagem default PT-BR via `messageFor(code, err) string`.
  - Commit: `feat(observability): 11 códigos de erro canônicos`

- [ ] **B.2** Criar `laura-go/internal/obs/errors.go` com helper `RespondError(c *fiber.Ctx, code string, status int, err error) error`. Monta payload `{error:{code,message,request_id,timestamp}}` (RFC3339 UTC). Para `status >= 500` chama `FromCtx(c.UserContext()).Error(...)`; para <500 chama `Warn`.
  - Commit: `feat(observability): helper RespondError com shape canônico`

- [ ] **B.3** TDD — `laura-go/internal/obs/errors_test.go`: para cada um dos 11 códigos, `RespondError` retorna JSON com shape correto; `timestamp` é ISO-8601 UTC parseável; `request_id` vem do `c.Locals("requestid")`; níveis de log corretos (ERROR para 500+, WARN para <500). Mocks com `httptest` + `fiber.New()`.
  - Commit: `test(observability): shape error response + níveis log`

- [ ] **B.4** Retrofit handlers críticos (5 arquivos) usando `obs.RespondError`: `internal/app/handlers/auth.go`, `transactions.go`, `cards.go`, `dashboard.go`, `score.go`. Mapear erros: `pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DB_TIMEOUT`, `validator.ValidationErrors` → `VALIDATION_FAILED`. Buildar.
  - Commit: `refactor(observability): 5 handlers críticos usam RespondError`

- [ ] **B.5** Integration test `laura-go/test/integration/error_shape_test.go`: spin up Fiber test server com handlers stubbed retornando cada código; asserta shape de cada response.
  - Commit: `test(observability): integration error_shape cobre 11 códigos`

---

## Parte C — Sentry SDK (depende de A, B)

- [ ] **C.1** `cd laura-go && go get github.com/getsentry/sentry-go@latest github.com/getsentry/sentry-go/fiber@latest`. Commitar `go.mod`/`go.sum`.
  - Commit: `build(sentry): adiciona sentry-go + fiber adapter`

- [ ] **C.2** Criar `laura-go/internal/obs/sentry.go` com `InitSentry(version string) (flush func())`. Gated por `SENTRY_DSN_API` vazio (NoOp). Config: `Environment=APP_ENV`, `Release=version`, `EnableTracing=true`, `TracesSampleRate=parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 0.1)`. Retorna `sentry.Flush` bound to `2*time.Second`.
  - Commit: `feat(sentry): init SDK gated por DSN com sampling 0.1 default`

- [ ] **C.3** Criar `laura-go/internal/obs/sentry_slog_hook.go` — handler wrapper que, no nível `slog.LevelError`, chama `sentry.CaptureException(errors.New(record.Message))` (ou extrai attr `err` se presente). Encadear no `ContextHandler` via construtor opcional `NewLoggerWithSentry`.
  - Commit: `feat(sentry): hook slog.Error dispara CaptureException`

- [ ] **C.4** Integrar em `cmd/api/main.go`: chamar `flush := obs.InitSentry(buildVersion)` + `defer flush()`; `app.Use(sentryfiber.New(sentryfiber.Options{Repanic: true}))` **antes** dos demais middlewares para capturar panic. Scope enrichment middleware grava `request_id`, `workspace_id`, `user_id` no `sentry.Hub`.
  - Commit: `feat(sentry): middleware Fiber + scope enrichment`

- [ ] **C.5** Unit test `laura-go/internal/obs/sentry_test.go`: com DSN vazio `InitSentry` é NoOp e não explode; com DSN mock (via transport fake) `CaptureException` enfileira event. Usar `sentry.ClientOptions.Transport` com fake.
  - Commit: `test(sentry): NoOp quando DSN vazio + capture com mock transport`

- [ ] **C.6** PWA — `cd laura-pwa && npx @sentry/wizard@latest -i nextjs --skip-telemetry`. Aceitar edits automáticos, revisar diff.
  - Commit: `feat(sentry): wizard Sentry Next.js no PWA`

- [ ] **C.7** Editar `laura-pwa/sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` setando `tracesSampleRate: 0.1` e `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_PWA`. Garantir `enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN_PWA` para NoOp.
  - Commit: `feat(sentry): configs client/server/edge com sampling 0.1`

- [ ] **C.8** `laura-pwa/next.config.ts` wrapping com `withSentryConfig(config, {authToken: process.env.SENTRY_AUTH_TOKEN, silent: !process.env.CI})`. Buildar `pnpm build` localmente sem token para validar NoOp.
  - Commit: `feat(sentry): withSentryConfig + upload source maps via authToken`

- [ ] **C.9** Editar `.github/workflows/deploy-pwa.yml` adicionando step `Sentry sourcemaps` com `env.SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}` gated `if: ${{ secrets.SENTRY_AUTH_TOKEN != '' }}`. Chama `npx @sentry/cli sourcemaps upload --release=${{ github.sha }} .next`.
  - Commit: `ci(sentry): upload source maps PWA gated por secret`

- [ ] **C.10** Adicionar rota dev-only `POST /api/_debug/panic` em `internal/app/router.go` gated `if os.Getenv("APP_ENV") != "production"` que faz `panic("smoke sentry")`. Smoke manual documentado em `docs/ops/observability.md`.
  - Commit: `feat(sentry): endpoint _debug/panic para smoke (não-prod)`

---

## Parte D — Prometheus metrics (depende de A)

- [ ] **D.1** `cd laura-go && go get github.com/ansrivas/fiberprometheus/v2@v2.10.0`. Commitar `go.mod`/`go.sum`.
  - Commit: `build(metrics): adiciona fiberprometheus v2.10`

- [ ] **D.2** Criar `laura-go/internal/obs/metrics.go` com construtor `NewMetricsApp() *fiber.App` — Fiber secundário `DisableStartupMessage: true`. Registrar `prom := fiberprometheus.New("laura_api")` + `prom.RegisterAt(app, "/metrics")`. Retornar tupla `(metricsApp, prom)`.
  - Commit: `feat(metrics): construtor metricsApp em Fiber separado`

- [ ] **D.3** Integrar em `cmd/api/main.go`: `metricsApp, prom := obs.NewMetricsApp()`; `app.Use(prom.Middleware)`; `go func(){ metricsApp.Listen(":9090") }()`. Graceful shutdown no SIGTERM junto com app principal.
  - Commit: `feat(metrics): sobe /metrics em :9090 com shutdown graceful`

- [ ] **D.4** Criar `laura-go/internal/obs/metrics_custom.go` com collectors: `laura_pgxpool_idle_conns`, `laura_pgxpool_total_conns`, `laura_pgxpool_acquire_count` (gauges lidos de `pool.Stat()` em goroutine tick 15s); `laura_llm_call_duration_seconds{provider,model}` histogram; `laura_llm_call_errors_total{provider,reason}` counter; `laura_cron_job_duration_seconds{job}` histogram; `laura_backup_last_success_timestamp_seconds` gauge; `laura_backup_last_size_bytes` gauge.
  - Commit: `feat(metrics): collectors custom pgxpool/llm/cron/backup`

- [ ] **D.5** Cardinalidade — criar `laura-go/internal/obs/metrics_workspace.go` com middleware `WorkspaceLabelMiddleware` que, **apenas nos 5 endpoints canônicos** (`/api/v1/transactions`, `/api/v1/dashboard`, `/api/v1/score`, `/api/v1/reports`, `/api/v1/auth/login`), observa um histogram `laura_http_workspace_request_duration_seconds{workspace_id,route,status}`. Demais rotas não recebem o label.
  - Commit: `feat(metrics): workspace_id label nos 5 endpoints críticos`

- [ ] **D.6** Editar `laura-go/fly.toml` adicionando seção `[metrics]` com `port = 9090` e `path = "/metrics"`. Garantir que `[[services]]` público não exponha 9090.
  - Commit: `chore(infra): fly.toml [metrics] section aponta para :9090`

- [ ] **D.7** Integration test `laura-go/test/integration/metrics_test.go`: sobe app + metricsApp; `curl :9090/metrics` retorna corpo contendo `laura_api_requests_total` e `laura_pgxpool_idle_conns`; `curl :8080/metrics` retorna 404 (não exposto no app público).
  - Commit: `test(metrics): /metrics em :9090 + 404 no :8080`

- [ ] **D.8** Doc — seção "Metrics" em `docs/ops/observability.md` listando collectors canônicos, cardinalidade, comandos de consulta via `fly ssh`.
  - Commit: `docs(metrics): seção Metrics no observability.md`

---

## Parte E — OpenTelemetry tracing (depende de A)

- [ ] **E.1** `cd laura-go && go get go.opentelemetry.io/otel go.opentelemetry.io/otel/sdk go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp go.opentelemetry.io/contrib/instrumentation/github.com/gofiber/fiber/v2/otelfiber github.com/exaring/otelpgx go.opentelemetry.io/contrib/bridges/otelslog`.
  - Commit: `build(tracing): adiciona OTel SDK + otelfiber + otelpgx + otelslog`

- [ ] **E.2** Criar `laura-go/internal/obs/tracer.go` com `NewTracerProvider(ctx context.Context, version string) (trace.TracerProvider, func(context.Context) error, error)`. Se `OTEL_EXPORTER_OTLP_ENDPOINT` vazio retorna `noop.NewTracerProvider()` + shutdown no-op. Senão cria `otlptracehttp.New(...)` + `sdktrace.NewBatchSpanProcessor` + resource (`service.name=laura-api`, `service.version=version`, `deployment.environment=APP_ENV`) + `ParentBased(TraceIDRatioBased(parseFloatEnv("OTEL_TRACES_SAMPLE_RATE", 0.1)))`.
  - Commit: `feat(tracing): TracerProvider com NoOp graceful quando endpoint vazio`

- [ ] **E.3** Integrar em `cmd/api/main.go`: `tp, shutdown, _ := obs.NewTracerProvider(ctx, buildVersion)`; `otel.SetTracerProvider(tp)`; `app.Use(otelfiber.Middleware())` antes do slog middleware; `defer shutdown(ctx)`.
  - Commit: `feat(tracing): otelfiber middleware + shutdown hook`

- [ ] **E.4** Instrumentar pgx — editar `laura-go/internal/repo/db.go` adicionando `otelpgx.NewTracer()` ao `pgx.ParseConfig`/`pgxpool.Config.ConnConfig.Tracer`. Verificar build.
  - Commit: `feat(tracing): otelpgx wrap no pool Postgres`

- [ ] **E.5** Spans manuais — em `internal/llm/call.go` adicionar `ctx, span := otel.Tracer("laura/llm").Start(ctx, "llm.call", trace.WithAttributes(attribute.String("llm.provider", provider), attribute.String("llm.model", model)))` + `defer span.End()`. Mesma coisa em `internal/whatsapp/client.go` (`wa.onmessage` com attrs `wa.jid`, `wa.msg_type`) e `internal/cron/*.go` (`cron.<job>`).
  - Commit: `feat(tracing): spans manuais em llm/whatsapp/cron`

- [ ] **E.6** Bridge otelslog — atualizar `internal/obs/logger.go` para encadear `otelslog.NewHandler` sobre `ContextHandler` quando `OTEL_EXPORTER_OTLP_ENDPOINT` presente. Assim `trace_id`/`span_id` entram automaticamente nos logs dentro de span.
  - Commit: `feat(tracing): bridge otelslog injeta trace_id/span_id nos logs`

- [ ] **E.7** Test `laura-go/internal/obs/tracer_test.go` — com env vazia `NewTracerProvider` retorna tipo `noop`. Test integration `test/integration/tracing_test.go` — sobe listener TCP fake OTLP, provoca request, asserta span pgx e LLM recebidos.
  - Commit: `test(tracing): NoOp vazio + span export via mock OTLP`

---

## Parte F — Health enriquecido /ready (paralelo com C,D)

- [ ] **F.1** Editar `laura-go/internal/app/handlers/health.go` (ou criar) — `/ready` retorna JSON `{status, version, checks:{db,whatsmeow,llm_provider}}`. Usa `golang.org/x/sync/errgroup` para rodar 3 checks em paralelo. Timeout per-check 500ms + timeout global 3s (`context.WithTimeout(ctx, 3*time.Second)`).
  - Commit: `feat(observability): /ready JSON com errgroup + timeout 3s`

- [ ] **F.2** Regras de status: `db` fail → HTTP 503 `status:"fail"`; `whatsmeow` down → HTTP 200 `status:"degraded"`; `llm_provider` down → HTTP 200 `status:"degraded"`. `/health` retorna `{status:"ok", version, build_time, uptime_seconds}`.
  - Commit: `feat(observability): /health expõe version/build_time/uptime`

- [ ] **F.3** `-ldflags` — editar `laura-go/Dockerfile` build stage: `RUN go build -ldflags "-X main.version=${BUILD_SHA} -X main.buildTime=${BUILD_TIME}" -o /app/api ./cmd/api`. Passar args via `ARG BUILD_SHA` + `ARG BUILD_TIME`. Editar `.github/workflows/deploy-api.yml` passando `--build-arg BUILD_SHA=$(git rev-parse --short HEAD) --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)`.
  - Commit: `ci(observability): ldflags injeta version+build_time no Dockerfile`

- [ ] **F.4** Integration test `laura-go/test/integration/health_test.go`: `/health` contém `version` não-vazia; `/ready` com db down retorna 503; com whatsmeow down retorna 200 degraded; timeout global respeitado (simular check dormindo 10s → corta em 3s).
  - Commit: `test(observability): health + ready + timeout 3s`

---

## Parte G — Backup automation Fly Machines (depende de D)

- [ ] **G.1** Criar `laura-go/internal/app/handlers/ops_backup.go` — `POST /api/ops/backup` autenticado via header `X-Ops-Token` (compara com `BACKUP_OPS_TOKEN`). Executa `exec.Command("flyctl", "postgres", "backup", "create", "-a", dbCluster)`; ao sucesso atualiza gauges `laura_backup_last_success_timestamp_seconds` e `laura_backup_last_size_bytes`. Usa `RespondError` em erros.
  - Commit: `feat(backup): handler /api/ops/backup com X-Ops-Token`

- [ ] **G.2** Registrar rota em `internal/app/router.go` (agrupada sob `/api/ops` com middleware de ops token).
  - Commit: `feat(backup): registra /api/ops/backup no router`

- [ ] **G.3** Criar `scripts/backup-prune.sh` — shell script que lista `fly postgres backups list` e aplica retention 30 diários + 12 semanais (sábado) + 6 mensais (dia 1). Usa `date` + `awk`. Dry-run com `--dry-run`.
  - Commit: `feat(backup): script backup-prune com retention 30d/12w/6m`

- [ ] **G.4** Criar `.github/workflows/backup-drill.yml` — cron `0 4 */14 * *`. Steps: checkout, setup-flyctl, create ephemeral `laura-drill-<timestamp>`, restore `--latest`, smoke `SELECT count(*)` em 6 tabelas (`users`, `workspaces`, `transactions`, `messages`, `llm_calls`, `audit_log`), destroy com guard `case $EPH_NAME in laura-drill-*) ;; *) exit 1 ;; esac`, notify Slack. Env `FLY_API_TOKEN_BACKUP`.
  - Commit: `ci(backup): workflow backup-drill quinzenal com restore ephemeral`

- [ ] **G.5** Criar `scripts/backup-restore-drill.sh` — versão local do workflow para smoke manual. Suporta `--dry-run`.
  - Commit: `feat(backup): script local backup-restore-drill`

- [ ] **G.6** Doc `docs/ops/backup.md` — comando `fly machine run --schedule daily ...` canônico (§A.1 da spec), cadência retention, procedimento rollback, STANDBY `[FLY-API-TOKEN-BACKUP]`.
  - Commit: `docs(backup): docs/ops/backup.md com schedule + drill + rollback`

- [ ] **G.7** Integration test `laura-go/test/integration/backup_test.go` — `POST /api/ops/backup` sem header retorna 401; com token inválido 403; com token válido (modo dry via env `BACKUP_DRY=1`) retorna 200 e atualiza métricas.
  - Commit: `test(backup): auth X-Ops-Token + métricas atualizadas`

---

## Parte H — Alertas Sentry + Slack (depende de C, D)

- [ ] **H.1** Editar `.github/workflows/deploy-api.yml` adicionando step `notify-slack` com `slackapi/slack-github-action@v1` gated `if: failure()` usando secret `SLACK_WEBHOOK`. Mesmo em `deploy-pwa.yml`.
  - Commit: `ci(alerts): notifica Slack em failure nos deploys`

- [ ] **H.2** Criar `docs/ops/alerts.md` documentando 3 regras Sentry UI: (1) `rate(errors) > 5/5min` → email+Slack; (2) `new issue in production` → Slack; (3) `performance regression p95 > 2s` → email. STANDBY `[SENTRY-DSN-API]`, `[SLACK-WEBHOOK]`.
  - Commit: `docs(alerts): 3 regras Sentry + configuração Slack`

- [ ] **H.3** Adicionar em `internal/obs/metrics_custom.go` goroutine tick 30s que checa `pgxpool.Stat().AcquireCount() / TotalConns()`; se > 0.9 chama `slog.Warn` + `sentry.CaptureMessage("pgxpool near exhaustion", sentry.LevelWarning)`.
  - Commit: `feat(alerts): pool exhaustion warn + Sentry capture`

- [ ] **H.4** Em `internal/llm/call.go` medir duração; se > 10s `slog.Warn` + increment `laura_llm_timeouts_total{provider}` counter.
  - Commit: `feat(alerts): LLM timeout >10s warn + métrica`

---

## Parte I — Dashboards Grafana (depende de D)

- [ ] **I.1** Criar `docs/ops/grafana-dashboards/go-runtime.json` (base dashboard ID 10826). Criar `postgres.json` (base 9628), `http-laura.json` (custom com métricas `laura_api_*`), `whatsmeow-llm.json` (custom com `laura_whatsmeow_*` + `laura_llm_*`). Arquivos JSON completos.
  - Commit: `docs(metrics): 4 dashboards Grafana JSON`

- [ ] **I.2** Criar `docs/ops/grafana-dashboards/README.md` com instruções de import manual via Grafana Cloud UI + STANDBY `[GRAFANA-CLOUD]`.
  - Commit: `docs(metrics): README dashboards Grafana`

- [ ] **I.3** Adicionar seção "Grafana" em `docs/ops/observability.md` apontando para pasta de dashboards.
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

## Parte K — fly.toml ajustes finais

- [ ] **K.1** Validar que `laura-go/fly.toml` contém `[metrics] port=9090 path="/metrics"` (pode já ter sido feito em D.6 — skip se idempotente).

- [ ] **K.2** Adicionar bloco `[env]` (ou documentar em `docs/ops/observability.md` + `fly secrets set` canônicos) declarando `OTEL_EXPORTER_OTLP_ENDPOINT=""`, `SENTRY_DSN_API=""`, `SENTRY_TRACES_SAMPLE_RATE="0.1"`, `OTEL_TRACES_SAMPLE_RATE="0.1"` (defaults vazios = NoOp). Registrar secrets necessários no README.
  - Commit: `chore(infra): fly.toml env defaults para observabilidade NoOp`

---

## Parte L — Validação final + tag

- [ ] **L.1** Rodar `cd laura-go && go build ./... && go test ./... -coverprofile=coverage.out`. Garantir cobertura ≥70% em `internal/obs/*` via `go tool cover -func=coverage.out | grep internal/obs`. Rodar `pnpm -C laura-pwa build && pnpm -C laura-pwa test`. Rodar `docker build -f laura-go/Dockerfile laura-go/`. Nada é commitado — apenas validação.

- [ ] **L.2** Criar tag `phase-11-prepared` apontando HEAD da branch. `git tag -a phase-11-prepared -m "Fase 11 observabilidade completa + telemetria pronta para deploy"`.
  - Commit: (tag, não é commit) — push `git push origin phase-11-prepared`.

---

## Self-review — Cobertura dos 44 itens do checklist v3 §15

| # | Item checklist v3 | Task plan v1 | Status |
|---|---|---|---|
| **Logger (6)** | | | |
| 1 | `internal/obs/logger.go` com handler JSON prod / texto dev | A.3 | IN_PLAN |
| 2 | `internal/obs/context.go` (keys tipadas + helpers) | A.1 | IN_PLAN |
| 3 | `internal/obs/context_handler.go` extrai req_id/trace_id/span_id | A.2 | IN_PLAN |
| 4 | Bridge `otelslog` integrado | E.6 | IN_PLAN |
| 5 | Middleware Fiber lê `c.Locals("requestid")` e injeta em UserContext | A.5 | IN_PLAN |
| 6 | Zero `log.Printf` em `internal/` | A.7 | IN_PLAN (retrofit parcial — 5 arquivos críticos; GAP: varredura exaustiva pode exigir task extra após A.7) |
| **Metrics (6)** | | | |
| 7 | `internal/obs/metrics.go` com collectors custom | D.2, D.4 | IN_PLAN |
| 8 | Middleware `fiberprometheus/v2` v2.10+ registrado | D.1, D.3 | IN_PLAN |
| 9 | `/metrics` em `:9090` goroutine paralela | D.3 | IN_PLAN |
| 10 | `fly.toml` seção `[metrics]` | D.6 / K.1 | IN_PLAN |
| 11 | `workspace_id` nos 5 endpoints críticos | D.5 | IN_PLAN |
| 12 | Métricas `laura_backup_last_*` populadas | D.4, G.1 | IN_PLAN |
| **Tracing (4)** | | | |
| 13 | `internal/obs/tracer.go` OTLP/HTTP + NoOp | E.2 | IN_PLAN |
| 14 | `otelpgx` wrap no pool Postgres | E.4 | IN_PLAN |
| 15 | Spans manuais em LLM, whatsmeow, cron, backup | E.5 | IN_PLAN (backup span pendente — GAP leve) |
| 16 | `trace_id`/`span_id` em logs via bridge | E.6 | IN_PLAN |
| **Errors + Sentry (7)** | | | |
| 17 | `internal/obs/sentry.go` init + sentryfiber oficial + panic | C.2, C.4 | IN_PLAN |
| 18 | `SENTRY_TRACES_SAMPLE_RATE` parametrizado default 0.1 | C.2 | IN_PLAN |
| 19 | `internal/obs/errors.go` + `error_codes.go` (11 códigos) | B.1, B.2 | IN_PLAN |
| 20 | Shape `{error:{code,message,request_id,timestamp}}` | B.2 | IN_PLAN |
| 21 | Catch-all ErrorHandler Fiber | C.4 | IN_PLAN (via sentryfiber Repanic + RespondError em handlers; GAP: ErrorHandler global do Fiber merece task dedicada) |
| 22 | PWA `@sentry/nextjs` + `withSentryConfig` + source maps | C.6, C.7, C.8, C.9 | IN_PLAN |
| 23 | PWA `lib/api/client.ts` parseia `error.code` + `error.timestamp` | — | DEFERRED (GAP — não coberto; recomendo task `obs-pwa-api-client`) |
| **Health (4)** | | | |
| 24 | `/health` retorna `version`/`build_time`/`uptime_seconds` | F.2 | IN_PLAN |
| 25 | `-ldflags` injeta `main.version`/`main.buildTime` | F.3 | IN_PLAN |
| 26 | `/ready` JSON per-check com `latency_ms` | F.1 | IN_PLAN |
| 27 | Timeout 500ms per-check + global 3s via `errgroup` | F.1 | IN_PLAN |
| **Backup (5)** | | | |
| 28 | Handler `POST /api/ops/backup` autenticado | G.1, G.2 | IN_PLAN |
| 29 | Fly Machines schedule `--schedule daily` documentado | G.6 | STANDBY `[FLY-PG-CREATE]` / STANDBY `[FLY-API-TOKEN-BACKUP]` |
| 30 | `scripts/backup-prune.sh` retention 30d+12w+6m | G.3 | IN_PLAN |
| 31 | Workflow `backup-drill.yml` cron quinzenal | G.4 | IN_PLAN |
| 32 | Guard prefixo `laura-drill-*` antes de destroy | G.4 | IN_PLAN |
| **Alertas (4)** | | | |
| 33 | Sentry 3 regras UI + `alerts.md` | H.2 | STANDBY `[SENTRY-DSN-API]` |
| 34 | `notify-slack` em `deploy-api.yml` + `deploy-pwa.yml` | H.1 | STANDBY `[SLACK-WEBHOOK]` |
| 35 | Pool exhaustion WARN + `CaptureMessage` | H.3 | IN_PLAN |
| 36 | LLM timeout >10s métrica + warn | H.4 | IN_PLAN |
| **Dashboards (2)** | | | |
| 37 | 4 JSONs Grafana | I.1 | STANDBY `[GRAFANA-CLOUD]` |
| 38 | README import manual | I.2 | IN_PLAN |
| **Docs (5)** | | | |
| 39 | `observability.md` expandido | A.8, D.8, I.3, J.1 | IN_PLAN |
| 40 | `runbooks/incident-response.md` | J.2 | IN_PLAN |
| 41 | `runbooks/error-debugging.md` | J.3 | IN_PLAN |
| 42 | `alerts.md` | H.2 | IN_PLAN |
| 43 | `backup.md` com schedule Fly Machines | G.6 | IN_PLAN |
| **Tests (1 agregado)** | | | |
| 44 | Unit + Integration + E2E + cobertura ≥70% | A.4, B.3, B.5, C.5, D.7, E.7, F.4, G.7, L.1 | IN_PLAN (GAP: E2E Playwright `observability.spec.ts` + `error-shape.spec.ts` não têm tasks dedicadas — recomendo adicionar no review #1) |

**Resumo:** 44 itens → **39 IN_PLAN**, **4 STANDBY** (`[FLY-API-TOKEN-BACKUP]`, `[SLACK-WEBHOOK]`, `[SENTRY-DSN-API]`, `[GRAFANA-CLOUD]` — funcionais no runtime com NoOp), **1 DEFERRED** (PWA `api/client.ts` parser — GAP a atacar no review #1).
