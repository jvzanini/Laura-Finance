# Fase 11 — Observabilidade completa + Telemetria (Spec v3 — FINAL)

> Versão: v3 (pós Review #2 — FINAL, pronta para `superpowers:writing-plans`)
> Data: 2026-04-15
> Autor: arquiteto sênior (pente fino)
> Status: pronta para plan v1
> Antecessores: v1, v2

---

## 0. Mudanças vs v2 (pente fino Review #2)

1. **slog + context propagation detalhada** (4.1 + 5.7): pseudocódigo explícito de `LoggerMiddleware` lendo `c.Locals("requestid")` (chave do middleware da Fase 10) e criando `slog.Logger` derivado via `logger.With("request_id", id)`, injetado em `c.UserContext()`. Handler custom `obs.ContextHandler` fallback extrai `request_id`/`trace_id`/`span_id` do `context.Context` para toda chamada `slog.Log(ctx, ...)`.
2. **Prometheus middleware Fiber confirmado** (4.2): `github.com/ansrivas/fiberprometheus/v2` (maintained, ativo, versão pinada `v2.10.0+`). Setup exato documentado com imports + ordem de registro.
3. **OTel exporter HTTP graceful no-op** (4.3 + 5.10): boot lê `OTEL_EXPORTER_OTLP_ENDPOINT`; vazio → `noop.NewTracerProvider()` sem iniciar exporter nem batch processor; qualquer `tracer.Start` vira no-op sem overhead.
4. **Sentry Fiber adapter — lib oficial `getsentry/sentry-go/fiber`** (4.4): confirmado como pacote oficial do repo `getsentry/sentry-go` (módulo `github.com/getsentry/sentry-go/fiber`); nada de community wrapper.
5. **PWA Sentry source maps via `SENTRY_AUTH_TOKEN`** (4.4 + 6): documentado como GitHub Actions secret `STANDBY [SENTRY-AUTH-TOKEN]`, lido apenas no step `build` do workflow `deploy-pwa.yml`. Jamais em bundle client.
6. **Backup automation — Fly Machines schedule** (4.7 + apêndice A): decisão final por `fly machine run --schedule daily` isolado do app principal (imagem minimal). Comando exato documentado. Cron in-process Go descartado.
7. **Restore drill detalhado** (4.7): workflow `.github/workflows/backup-drill.yml` com pseudo-job completo (restore ephemeral → `pg_restore` → smoke `SELECT count(*)` em 6 tabelas canônicas → destroy).
8. **`/metrics` port `:9090` + `[metrics]` section no `fly.toml`** (5.4): bind `0.0.0.0:9090` interno mas **fly.toml `[metrics]`** aponta para `port=9090, path="/metrics"` para scraping Fly internal (não exposto via HTTP service público).
9. **Cardinalidade — 5 endpoints críticos listados canonicamente** (5.8): `/api/v1/transactions`, `/api/v1/dashboard`, `/api/v1/score`, `/api/v1/reports`, `/api/v1/auth/login`. Substitui lista v2 (que usava rotas legadas de outro projeto).
10. **Sentry `TracesSampleRate` revisto** (4.4 + 13.5): **default `0.1` (10%)** parametrizado via `SENTRY_TRACES_SAMPLE_RATE`; MVP prioriza sustentabilidade do free tier (5k events/mês). Adaptive sampling documentado.
11. **Error response shape expandido** (4.5): campos `code`, `message`, `request_id`, **`timestamp`** (ISO-8601 UTC) explicitados; 11 códigos canônicos listados + helper `respondError(c *fiber.Ctx, code string, status int, err error) error`.
12. **Health check enriquecido — shape JSON canônico + timeout global 3s** (4.6): especificado exatamente como no Review #2, com `errgroup` + timeout per-check 500ms + timeout global 3s.
13. **Ordem prerequisite ajustada** (14.2): confirmado **slog → error response → Sentry → Prometheus → OTel**. Sentry depende de slog (hooka handler ERROR).
14. **Custos Sentry recalculados** (5.6): com `TracesSampleRate=0.1` volume estimado cabe confortavelmente em 5k events/mês + 10k perf events.
15. **Compatibilidade Fase 10 confirmada** (5.11): middleware `requestid` grava em `c.Locals("requestid")`; Fase 11 adiciona wrapper que também injeta em `c.UserContext()`. Logger Fiber JSON existente é removido em favor de slog via middleware novo (substituição limpa, commit atômico).
16. **Seção nova §16 — Resolução do Review #2** com matriz dos 18 itens.
17. **Apêndice A — comandos operacionais** (Fly Machines, backup drill, consulta Prometheus, smoke Sentry).

---

## 1. Objetivo

Elevar o stack Laura Finance (backend Go `laura-go` + PWA Next.js `laura-pwa`) do nível atual de observabilidade "healthcheck + request-id" (Fase 10) para patamar production-grade com:

1. **Diagnosticar** qualquer incidente em <5min a partir do `request_id` (log → trace → Sentry → métrica).
2. **Medir** latência, throughput e saúde de dependências externas com granularidade por rota.
3. **Alertar** proativamente antes do usuário perceber degradação.
4. **Rastrear** request distribuídamente (PWA → Go API → pgx → LLM → retorno) com `trace_id` + `request_id` correlacionados.
5. **Recuperar** dados via backup automatizado + drill quinzenal validando restore.

---

## 2. Contexto e motivação

Idêntico a v2 §2. Fase 10 entregou requestid + logger Fiber JSON + `/health`/`/ready` binários. Gaps remanescentes (logs sem correlação em `internal/`, sem `/metrics`, sem OTel, sem Sentry, error responses inconsistentes, `/ready` binário, backup manual, sem alertas, sem dashboards, docs rasos) persistem como motor da Fase 11.

---

## 3. Escopo

### 3.1. Dentro do escopo

1. Logger `slog` substituindo `log.Printf` em `internal/`.
2. Propagação `request_id` via `context.Context` (chave tipada) até camadas profundas.
3. Prometheus via `prometheus/client_golang` + `ansrivas/fiberprometheus/v2` + `/metrics` em port `:9090`.
4. Métricas custom (pgxpool, whatsmeow, cron, LLM, backup).
5. OpenTelemetry SDK + exporter OTLP/HTTP.
6. Spans em camadas não-HTTP (pgx via `otelpgx`, LLM, whatsmeow, cron, backup).
7. Sentry backend (`getsentry/sentry-go` + `getsentry/sentry-go/fiber`) com `TracesSampleRate=0.1` parametrizado.
8. Sentry PWA (`@sentry/nextjs`) + source maps upload via `SENTRY_AUTH_TOKEN`.
9. Error response `{error:{code,message,request_id,timestamp}}` + helper `respondError`.
10. `/ready` enriquecido com checks detalhados + versão build em `/health` via `-ldflags`.
11. Backup via Fly Machines schedule + retention 30d/12s/6m + drill quinzenal ephemeral.
12. Alertas Sentry (UI MVP) + Slack deploy fail + pool exhaustion.
13. Dashboards Grafana JSON em `docs/ops/grafana-dashboards/`.
14. Docs: `observability.md`, `incident-response.md`, `error-debugging.md`, `alerts.md`.

### 3.2. Fora do escopo (Fase 12+)

PWA RUM / Web Vitals; log aggregation (Loki/Datadog); APM comercial; SLO formais; chaos engineering; dashboards per-workspace universais; distributed tracing WhatsApp Cloud API; PagerDuty automatizado; on-call rotation docs; Terraform Sentry provider; bridge OTel↔Sentry `trace_id`.

---

## 4. Pendências detalhadas

### 4.1. Logger application-level structured (`slog` + context)

- **Estado atual:** `log.Printf`/`log.Println` em `internal/{app,whatsapp,llm,cron,repo}`. Sem níveis, sem structured fields, sem correlação `request_id`.
- **Ação:**
  1. `internal/obs/logger.go`:
     ```go
     func NewLogger(env string) *slog.Logger {
       var h slog.Handler
       opts := &slog.HandlerOptions{Level: levelFromEnv(env)}
       if env == "production" {
         h = slog.NewJSONHandler(os.Stdout, opts)
       } else {
         h = slog.NewTextHandler(os.Stdout, opts)
       }
       return slog.New(&ContextHandler{inner: h})
     }
     ```
  2. `internal/obs/context_handler.go` — handler wrapper que, em cada `Handle(ctx, record)`, extrai `request_id`/`trace_id`/`span_id` do `ctx` e anexa como attrs antes de delegar.
  3. `internal/obs/context.go`:
     ```go
     type ctxKey int
     const (
       RequestIDKey ctxKey = iota
       LoggerKey
     )
     func WithRequestID(ctx context.Context, id string) context.Context
     func RequestIDFromCtx(ctx context.Context) string
     func WithLogger(ctx context.Context, l *slog.Logger) context.Context
     func FromCtx(ctx context.Context) *slog.Logger
     ```
  4. Middleware Fiber `obs.LoggerMiddleware()`:
     ```go
     func LoggerMiddleware(base *slog.Logger) fiber.Handler {
       return func(c *fiber.Ctx) error {
         id, _ := c.Locals("requestid").(string) // Fase 10 chave
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
  5. Níveis: `DEBUG` (dev), `INFO` (prod), `WARN`, `ERROR` (dispatch Sentry via handler custom).
  6. Bridge `otelslog` via `go.opentelemetry.io/contrib/bridges/otelslog` (opt-in): wraps `ContextHandler` para emitir log records correlacionados a spans ativos.
  7. Script `scripts/migrate-log-printf.sh` (sed + review manual) para ~40 call sites.
- **Arquivos:** `internal/obs/{logger,context,context_handler,otelslog_bridge}.go` (novos); `cmd/api/main.go`, `internal/app/router.go`, `internal/{app,whatsapp,llm,cron,repo}/*.go` (alterados).
- **STANDBY:** nenhum.
- **Tempo:** 5h.

### 4.2. Métricas Prometheus

- **Libs:** `github.com/prometheus/client_golang` + `github.com/ansrivas/fiberprometheus/v2` (versão `v2.10.0+`, maintained ativo).
- **Setup exato:**
  ```go
  import (
    "github.com/ansrivas/fiberprometheus/v2"
  )
  prom := fiberprometheus.New("laura_api")
  prom.RegisterAt(metricsApp, "/metrics") // metricsApp é segundo fiber.New() em :9090
  app.Use(prom.Middleware) // app é o Fiber principal :8080
  ```
- **Port separada:** goroutine paralela:
  ```go
  metricsApp := fiber.New(fiber.Config{DisableStartupMessage: true})
  prom.RegisterAt(metricsApp, "/metrics")
  go metricsApp.Listen(":9090")
  ```
- **Collectors custom** em `internal/obs/metrics.go`:
  - `laura_pgxpool_acquire_count`, `laura_pgxpool_idle_conns`, `laura_pgxpool_total_conns` (de `pool.Stat()`).
  - `laura_whatsmeow_connected{workspace_id}` gauge 0/1.
  - `laura_cron_job_duration_seconds{job}` histogram.
  - `laura_llm_call_duration_seconds{provider,model}` histogram + `laura_llm_call_errors_total{provider,reason}`.
  - `laura_backup_last_success_timestamp_seconds`, `laura_backup_last_size_bytes`.
- **Cardinalidade:** `workspace_id` apenas nos 5 endpoints críticos (§5.8).
- **Arquivos:** `internal/obs/metrics.go` (novo); `cmd/api/main.go`, `internal/cron/*.go`, `internal/llm/*.go`, `internal/whatsapp/client.go` (alterados); `fly.toml` (secção `[metrics]`, §5.4).
- **STANDBY:** `STANDBY [GRAFANA-CLOUD]`.
- **Tempo:** 3h.

### 4.3. Tracing OpenTelemetry (camadas não-HTTP) + graceful no-op

- **Estado atual:** zero spans.
- **Ação:**
  1. SDK `go.opentelemetry.io/otel` + exporter `otlptracehttp` (OTLP/HTTP).
  2. `internal/obs/tracer.go`:
     ```go
     func NewTracerProvider(ctx context.Context) (trace.TracerProvider, func(context.Context) error, error) {
       endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
       if endpoint == "" {
         return noop.NewTracerProvider(), func(context.Context) error { return nil }, nil
       }
       exp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(endpoint))
       ...
     }
     ```
     Endpoint vazio → **no-op provider**, sem exporter, sem batch processor, sem overhead.
  3. Resource: `OTEL_SERVICE_NAME=laura-api`, `service.version=<BUILD_SHA>`, `deployment.environment=<APP_ENV>`.
  4. `otelpgx` wrap no pgx pool (`pgx.ParseConfig` + `otelpgx.NewTracer()`).
  5. Spans manuais em `llm.Call` (`llm.provider`, `llm.model`, `llm.tokens_in/out`), `whatsmeow.OnMessage` (`wa.jid`, `wa.msg_type`), cron jobs, backup worker.
  6. Bridge `otelslog` injeta `trace_id`/`span_id` em logs emitidos dentro de span.
- **Arquivos:** `internal/obs/tracer.go` (novo); `cmd/api/main.go`, `internal/repo/db.go`, `internal/llm/*.go`, `internal/whatsapp/client.go`, `internal/cron/*.go` (alterados).
- **STANDBY:** `STANDBY [OTEL-COLLECTOR-URL]`.
- **Tempo:** 5h.

### 4.4. Sentry (errors + Performance HTTP) — backend Go + PWA

- **Libs confirmadas (oficial):**
  - Backend: `github.com/getsentry/sentry-go` + `github.com/getsentry/sentry-go/fiber` (pacote oficial do mesmo repo, maintained por getsentry).
  - PWA: `@sentry/nextjs`.
- **Ação backend:**
  1. Init em `cmd/api/main.go`:
     ```go
     sentry.Init(sentry.ClientOptions{
       Dsn:              os.Getenv("SENTRY_DSN_API"), // vazio → NoOp
       Environment:      os.Getenv("APP_ENV"),
       Release:          version,
       EnableTracing:    true,
       TracesSampleRate: parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 0.1), // default 10%
     })
     app.Use(sentryfiber.New(sentryfiber.Options{Repanic: true}))
     ```
  2. Custom slog handler emite `sentry.CaptureException` em nível `ERROR`.
  3. Middleware enriquece scope com `request_id`, `workspace_id`, `user_id`.
- **Ação PWA:**
  1. `@sentry/nextjs` via `npx @sentry/wizard@latest -i nextjs`.
  2. `sentry.{client,server,edge}.config.ts` com `tracesSampleRate: 0.1`.
  3. `next.config.ts` wrap com `withSentryConfig({authToken: process.env.SENTRY_AUTH_TOKEN})`.
  4. `NEXT_PUBLIC_SENTRY_DSN_PWA` runtime; `SENTRY_AUTH_TOKEN` build CI only (secret GitHub Actions).
  5. **RUM / Web Vitals desabilitado** (Fase 12).
- **Arquivos:** `internal/obs/sentry.go` (novo); `cmd/api/main.go`, `internal/app/router.go`, `internal/obs/logger.go` (alterados); PWA `sentry.{client,server,edge}.config.ts`, `.sentryclirc.example` (novos); `next.config.ts`, `package.json` (alterados).
- **STANDBY:** `STANDBY [SENTRY-DSN-API]`, `STANDBY [SENTRY-DSN-PWA]`, `STANDBY [SENTRY-AUTH-TOKEN]`.
- **Tempo:** 4h.

### 4.5. Error response padronizado

- **Shape canônico:**
  ```json
  {
    "error": {
      "code": "AUTH_INVALID_CREDENTIALS",
      "message": "Credenciais inválidas",
      "request_id": "uuid-v4",
      "timestamp": "2026-04-15T12:34:56Z"
    }
  }
  ```
- **Helper:**
  ```go
  func respondError(c *fiber.Ctx, code string, status int, err error) error {
    reqID, _ := c.Locals("requestid").(string)
    payload := fiber.Map{"error": fiber.Map{
      "code":       code,
      "message":    messageFor(code, err),
      "request_id": reqID,
      "timestamp":  time.Now().UTC().Format(time.RFC3339),
    }}
    if status >= 500 {
      sentry.CaptureException(err)
      obs.FromCtx(c.UserContext()).Error("server_error", "code", code, "err", err)
    } else {
      obs.FromCtx(c.UserContext()).Warn("client_error", "code", code, "err", err)
    }
    return c.Status(status).JSON(payload)
  }
  ```
- **10 códigos canônicos (+1 extra):**
  1. `VALIDATION_FAILED` (400)
  2. `AUTH_INVALID_CREDENTIALS` (401)
  3. `AUTH_TOKEN_EXPIRED` (401)
  4. `FORBIDDEN` (403)
  5. `NOT_FOUND` (404)
  6. `CONFLICT` (409)
  7. `RATE_LIMITED` (429)
  8. `INTERNAL` (500)
  9. `DB_TIMEOUT` (500)
  10. `LLM_PROVIDER_DOWN` (503)
  11. `DEPENDENCY_DOWN` (503)
- **Mapeamentos:** `pgx.ErrNoRows` → `NOT_FOUND`; `context.DeadlineExceeded` em pgx → `DB_TIMEOUT`; `validator.ValidationErrors` → `VALIDATION_FAILED`; erro de `llm.Call` timeout → `LLM_PROVIDER_DOWN`.
- **Arquivos:** `internal/obs/errors.go`, `internal/obs/error_codes.go` (novos); ~20 handlers em `internal/app/handlers/` (alterados); PWA `lib/api/client.ts` parseia `error.code` e `error.timestamp`.
- **STANDBY:** nenhum.
- **Tempo:** 4h.

### 4.6. Health check enriquecido + versão de build

- **`/health`** → `{"status":"ok","version":"<sha>","build_time":"<ISO>","uptime_seconds":N}`.
- **`/ready`** → shape canônico:
  ```json
  {
    "status": "ready",
    "version": "abc1234",
    "checks": {
      "db": {"status": "ok", "latency_ms": 5},
      "whatsmeow": {"status": "connected"},
      "llm_provider": {"status": "reachable", "latency_ms": 120}
    }
  }
  ```
- **Implementação:** `errgroup` com timeout per-check 500ms + **timeout global 3s** (`context.WithTimeout(ctx, 3*time.Second)`).
- **Regras:** `db` fail → `status: "fail"` HTTP 503; `whatsmeow` down → `status: "degraded"` HTTP 200; `llm_provider` down → `status: "degraded"` HTTP 200.
- **Versão via `-ldflags`:** `"-X main.version=$(git rev-parse --short HEAD) -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"` no Dockerfile + workflow.
- **Arquivos:** `cmd/api/main.go`, `internal/app/handlers/health.go`, `Dockerfile`, `.github/workflows/deploy-api.yml` (alterados).
- **Libs:** `golang.org/x/sync/errgroup`.
- **STANDBY:** nenhum.
- **Tempo:** 2h.

### 4.7. Backup automation — Fly Machines schedule + drill ephemeral

- **Decisão final:** **Fly Machines schedule** (isolado do app principal), não cron in-process Go.
- **Comando canônico de setup (documentar em `docs/ops/backup.md`):**
  ```sh
  fly machine run \
    --app laura-api \
    --schedule daily \
    --name laura-backup-cron \
    --env BACKUP_OPS_TOKEN=$BACKUP_OPS_TOKEN \
    --image ghcr.io/jvzanini/laura-backup-runner:latest \
    --region gru \
    --vm-size shared-cpu-1x \
    --vm-memory 256 \
    -- /app/run-backup.sh
  ```
- **Handler interno `POST /api/ops/backup`** autenticado via header `X-Ops-Token` (`BACKUP_OPS_TOKEN` secret). Executa `flyctl postgres backup create -a <cluster>` + atualiza métricas `laura_backup_last_success_timestamp_seconds`, `laura_backup_last_size_bytes`.
- **Retention:** 30 diários + 12 semanais (`sunday`) + 6 mensais (`first-of-month`), via `scripts/backup-prune.sh`.
- **Drill restore quinzenal** via `.github/workflows/backup-drill.yml` cron `0 4 */14 * *`:
  ```yaml
  jobs:
    drill:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: superfly/flyctl-actions/setup-flyctl@master
        - name: Create ephemeral DB
          run: |
            EPH_NAME="laura-drill-$(date +%Y%m%d%H%M%S)"
            echo "EPH_NAME=$EPH_NAME" >> $GITHUB_ENV
            fly postgres create --name "$EPH_NAME" --region gru --vm-size shared-cpu-1x --initial-cluster-size 1
        - name: Restore latest backup
          run: fly postgres restore --from-cluster laura-api-db --to-cluster "$EPH_NAME" --latest
        - name: Smoke SELECT count
          run: |
            fly postgres connect -a "$EPH_NAME" -c "SELECT count(*) FROM users; SELECT count(*) FROM workspaces; SELECT count(*) FROM transactions; SELECT count(*) FROM messages; SELECT count(*) FROM llm_calls; SELECT count(*) FROM audit_log;"
        - name: Destroy ephemeral (guard prefix)
          run: |
            case "$EPH_NAME" in
              laura-drill-*) fly postgres destroy "$EPH_NAME" -y ;;
              *) echo "GUARD: refusing to destroy $EPH_NAME"; exit 1 ;;
            esac
        - name: Notify Slack
          if: always()
          env: { SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }} }
          run: ...
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_BACKUP }}
  ```
- **Arquivos:** `internal/app/handlers/ops_backup.go`, `scripts/backup-prune.sh`, `scripts/backup-restore-drill.sh`, `.github/workflows/backup-drill.yml`, `docs/ops/backup.md` (novos); `internal/app/router.go` (alterado).
- **Libs:** `flyctl` CLI.
- **STANDBY:** `STANDBY [FLY-API-TOKEN-BACKUP]`, `STANDBY [SLACK-WEBHOOK]`.
- **Tempo:** 5h.

### 4.8. Alertas (UI no MVP)

- Sentry alert rules via UI + documentados em `docs/ops/alerts.md`:
  - `rate(errors) > 5/5min` → e-mail + Slack.
  - `new issue in production` → Slack.
  - `performance regression p95 > 2s` → e-mail.
- GitHub Actions `notify-slack` step em `deploy-api.yml` e `deploy-pwa.yml` (`slackapi/slack-github-action@v1`) em `failure()`.
- Pool exhaustion: `pgxpool.Stat().AcquireCount / TotalConns > 0.9` → `WARN` + `sentry.CaptureMessage`.
- LLM timeout > 10s → `WARN` + `laura_llm_timeouts_total++`.
- **STANDBY:** `SLACK-WEBHOOK`, `SENTRY-DSN-API`, `SENTRY-DSN-PWA`, `PAGERDUTY` (opcional).
- **Tempo:** 2h.

### 4.9. Dashboards Grafana

- JSONs em `docs/ops/grafana-dashboards/`: `go-runtime.json` (base 10826), `postgres.json` (base 9628), `http-laura.json` (custom), `whatsmeow-llm.json` (custom).
- `README.md` com instruções de import manual via Grafana Cloud.
- **STANDBY:** `GRAFANA-CLOUD`.
- **Tempo:** 3h.

### 4.10. Documentação operacional

- Expandir `docs/ops/observability.md` (diagrama + correlação `request_id`/`trace_id` + tabela códigos erro).
- Novos `docs/ops/runbooks/incident-response.md` (SEV1/2/3, primeiros 5min, template post-mortem) e `docs/ops/runbooks/error-debugging.md` (workflow `error.code` → logs → Sentry → trace → Grafana).
- **Tempo:** 3h.

---

## 5. Decisões de arquitetura

### 5.1. slog como padrão
stdlib, zero dep, handler JSON nativo, bridge `otelslog` oficial.

### 5.2. Prometheus para metrics, OTel para traces
OTel metrics SDK imaturo. Prometheus + Grafana prontos.

### 5.3. Sentry cobre HTTP; OTel cobre não-HTTP
Evita duplicação. Limitação: `trace_id` Sentry e OTel não correlacionados (Fase 12 bridge).

### 5.4. `/metrics` em port `:9090` + `[metrics]` no fly.toml
Goroutine paralela bind `0.0.0.0:9090`. Fly router público só expõe `:8080`. Para scraping interno Fly adiciona:
```toml
[metrics]
  port = 9090
  path = "/metrics"
```
Fly usa isso para scraping interno Prometheus-compatible sem expor publicamente.

### 5.5. Source maps PWA via `withSentryConfig`
Requer `SENTRY_AUTH_TOKEN` CI-only.

### 5.6. Custos detalhados (Sentry `TracesSampleRate=0.1`)

| Serviço | Plano free | Volume estimado | Custo |
|---------|-----------|-----------------|-------|
| Sentry Developer (errors) | 5k events/mês | ~1k errors + ~500 PWA | $0 |
| Sentry Performance | 10k perf events/mês | volume requests × 0.1 sampling — estimativa ~3k perf events/mês | $0 |
| Grafana Cloud Free | 10k series + 50GB logs/traces | ~2k series, ~5GB traces | $0 |
| Fly Postgres backups | incluso | 30d + 12s + 6m (~3GB) | $0 |
| Fly Machines schedule (backup cron) | free tier | 1 exec/dia ~30s | $0 |
| Fly Postgres drill ephemeral | free tier | <10min quinzenal | $0 |
| Slack webhook | Free | ilimitado | $0 |
| **Total** | | | **$0** |

Trigger de revisão: Sentry errors > 4k/mês OR perf > 8k/mês OR Grafana series > 8k.

### 5.7. Contrato requestid ↔ slog ↔ OTel
Fase 10 middleware grava `c.Locals("requestid")`. Fase 11 middleware extra:
1. Lê `c.Locals("requestid")` e injeta em `c.UserContext()` via `obs.WithRequestID`.
2. Cria logger derivado `base.With("request_id", id)` e injeta via `obs.WithLogger`.
3. `obs.FromCtx(ctx)` recupera logger; `obs.RequestIDFromCtx(ctx)` recupera ID puro.
4. OTel span root (Sentry Fiber middleware) lê `request_id` do context e adiciona como span attribute.
5. Bridge `otelslog` garante `trace_id`/`span_id` em logs dentro de span.

### 5.8. Cardinalidade Prometheus — `workspace_id` scoped a 5 endpoints críticos
- `/api/v1/transactions`
- `/api/v1/dashboard`
- `/api/v1/score`
- `/api/v1/reports`
- `/api/v1/auth/login`

Demais métricas HTTP usam `workspace_present="true|false"`. Métricas pgxpool/cron/backup sem workspace_id. Budget: 5 × 100 ws × 5 status = 2500 séries críticas.

### 5.9. LEI #5 confirmada
Moeda em centavos intocada. HMAC sessão intocado. Fase 11 é apenas observabilidade.

### 5.10. OTel exporter graceful no-op
Endpoint vazio → `noop.NewTracerProvider()`. Zero overhead. Qualquer `tracer.Start` vira no-op.

### 5.11. Compatibilidade Fase 10
- Middleware `requestid` (Fase 10) grava `c.Locals("requestid")` — chave preservada.
- Logger Fiber JSON da Fase 10 é **substituído** pelo middleware slog novo (commit atômico, reversível).
- `/health` e `/ready` existentes são **estendidos** (handler enriquecido substitui in-place).

---

## 6. Pré-requisitos / STANDBYs canônicos

| ID canônico | Onde usado | Bloqueia merge? |
|-------------|------------|-----------------|
| `STANDBY [SENTRY-DSN-API]` | Sentry Go init | não (NoOp) |
| `STANDBY [SENTRY-DSN-PWA]` | `sentry.client.config.ts` | não |
| `STANDBY [SENTRY-AUTH-TOKEN]` | CI upload source maps | não (pula upload) |
| `STANDBY [SLACK-WEBHOOK]` | deploy workflows + drill | não |
| `STANDBY [GRAFANA-CLOUD]` | scraper + dashboards | não |
| `STANDBY [OTEL-COLLECTOR-URL]` | tracer.go | não (NoOp) |
| `STANDBY [FLY-API-TOKEN-BACKUP]` | workflow drill | sim para drill em CI |
| `STANDBY [PAGERDUTY]` | opcional | nunca |

---

## 7. Critérios de aceite (DoD)

1. `go test ./...` verde; cobertura ≥70% em `internal/obs/*`.
2. `pnpm test` verde; build PWA gera source maps; sem token não falha.
3. `curl http://127.0.0.1:9090/metrics` retorna Prometheus válido.
4. `curl :8080/health` retorna JSON com `version`.
5. `curl :8080/ready` retorna JSON com `checks.db`, `checks.whatsmeow`, `checks.llm_provider`.
6. `/api/_debug/panic` (dev) dispara Sentry + log ERROR com `request_id` + span OTel.
7. Toda rota de erro retorna `{error:{code,message,request_id,timestamp}}`.
8. `grep -r "log.Printf\|log.Println" laura-go/internal/` retorna zero.
9. `scripts/backup-restore-drill.sh --dry-run` executa sem erro.
10. Docs completos sem `TBD`.
11. Dashboards JSON + README presentes.
12. CI existentes continuam verdes.
13. `trace_id` de log ERROR abre no backend OTel configurado (QA manual se URL presente).

---

## 8. Riscos

Idêntico a v2 §8 (R1–R12). R11 atenuado pela mudança para `TracesSampleRate=0.1` default.

---

## 9. Métricas de sucesso

1. MTTR diagnóstico <10min.
2. 100% requests com `request_id` em logs profundos.
3. 100% handlers HTTP com span Sentry; 100% pgx com span OTel.
4. 0% 5xx sem evento Sentry.
5. Backup drill 100% nos primeiros 30d.
6. Alert noise <20%.
7. Overhead p95 <5ms.
8. Cobertura ≥70%.

---

## 10. Plano de testes

### 10.1. Unit (≥70%)
- `obs/errors_test.go`, `logger_test.go`, `context_handler_test.go`, `metrics_test.go`, `tracer_test.go`, `sentry_test.go`, `context_test.go`.
- Cada teste cobre: shape de erro para cada code; mapeamentos (`pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DB_TIMEOUT`); `respondError` monta JSON correto; handler JSON produz linha válida; NoOp tracer quando env vazia; Sentry NoOp quando DSN vazio (DSN fake não explode).

### 10.2. Integration
- `test/integration/health_test.go`: `/health.version` preenchida; `/ready` db down → 503 detalhado; whatsmeow offline → 200 degraded; timeout global 3s honrado.
- `test/integration/metrics_test.go`: `:9090/metrics` corpo Prometheus válido; `workspace_id` label aparece só nos 5 endpoints; public :8080 não expõe /metrics.
- `test/integration/sentry_test.go`: DSN mock local; `/api/_debug/panic` envia evento com `request_id` no scope.
- `test/integration/error_shape_test.go`: rotas conhecidas retornam shape `{error:{code,message,request_id,timestamp}}`.
- `test/integration/tracing_test.go`: OTLP mock recebe spans pgx + LLM com `request_id` attribute.
- `test/integration/backup_test.go`: `/api/ops/backup` requer `X-Ops-Token` válido; métricas atualizadas.

### 10.3. E2E
- Playwright `e2e/observability.spec.ts`: PWA → `X-Request-Id` na response → mesmo ID em log stdout.
- Playwright `e2e/error-shape.spec.ts`: provocar 404/500 → PWA renderiza UI com `error.code`.

### 10.4. Smoke pós-deploy
- Disparar `/api/_debug/panic` em staging → Sentry issue.
- `fly ssh console` → `curl localhost:9090/metrics`.
- Drill backup manual 1× pré-agendamento.
- Validar trace no backend OTel.

### 10.5. Cobertura
- `go test -coverprofile=coverage.out ./...` gate CI ≥70% em `internal/obs/*`.
- PWA `pnpm test --coverage` ≥70% em novos arquivos Sentry.

---

## 11. Migrations DB
**Fase 11 não introduz migrations DB.** Apenas runtime/observabilidade. Confirmado.

## 12. Glossário

Idêntico a v2 §12 + adições:
- **Adaptive sampling:** Sentry permite subir/baixar `TracesSampleRate` via env reload sem rebuild; reduzir para 0.05 se quota ameaçar, subir para 0.3 em incidente.
- **`[metrics]` section (fly.toml):** configuração Fly para scraping interno Prometheus sem expor port publicamente.

## 13. Resolução das 10 questões abertas do v1

Idêntico a v2 §13, com atualizações:
- **13.5 `TracesSampleRate`:** decisão final `0.1` (revisada de `1.0` após Review #2 — sustentável no free tier 5k events).
- Demais inalteradas.

## 14. Pré-condições + ordem de implementação

### 14.1. Pré-condições
- Go 1.26.1 (slog stdlib ≥1.21).
- Fiber v2.52+ (`c.UserContext()` estável).
- `pgx` v5 (requerido por `otelpgx`).
- Node 20+ / pnpm para PWA.
- `flyctl` no runner CI.
- Fase 10 merged.

### 14.2. Ordem de implementação (prerequisite chain — CONFIRMADA Review #2)

1. **slog foundation** (4.1) — base para tudo.
2. **Error response padronizado** (4.5) — usa slog.
3. **Sentry SDK** (4.4) — hooka em slog handler ERROR.
4. **Prometheus metrics** (4.2) — independente; `workspace_id` usa context do slog.
5. **OpenTelemetry tracing** (4.3) — bridge `otelslog` precisa logger pronto.
6. **Health check enriquecido** (4.6) — paralelo a 4.4-4.5.
7. **Backup automation** (4.7) — depende de métricas (4.2).
8. **Alertas** (4.8) — depende de Sentry (4.4).
9. **Dashboards Grafana** (4.9) — depende de métricas (4.2).
10. **Docs ops** (4.10) — última.

Sentry vem depois de slog (não antes): Sentry hooka via handler custom emitido por slog no nível ERROR.

### 14.3. Checkpoints
- A: itens 1-3 → smoke `_debug/panic`.
- B: itens 4-6 → `/metrics`, `/ready`, trace pgx.
- C: itens 7-10 → PR final DoD global.

---

## 15. Checklist consolidado de entregas

### Logger (slog + context)
- [ ] `internal/obs/logger.go` com handler JSON prod / texto dev
- [ ] `internal/obs/context.go` (keys tipadas + helpers)
- [ ] `internal/obs/context_handler.go` extrai req_id/trace_id/span_id do ctx
- [ ] Bridge `otelslog` integrado
- [ ] Middleware Fiber lê `c.Locals("requestid")` e injeta em `c.UserContext` + `c.Locals("logger")`
- [ ] Zero `log.Printf` em `internal/`

### Metrics (Prometheus)
- [ ] `internal/obs/metrics.go` com collectors custom
- [ ] Middleware `fiberprometheus/v2` v2.10+ registrado
- [ ] Endpoint `/metrics` em `:9090` goroutine paralela
- [ ] `fly.toml` seção `[metrics]` configurada
- [ ] `workspace_id` label nos 5 endpoints críticos canônicos (`/api/v1/{transactions,dashboard,score,reports,auth/login}`)
- [ ] Métricas `laura_backup_last_*` populadas

### Tracing (OpenTelemetry)
- [ ] `internal/obs/tracer.go` com OTLP/HTTP + NoOp graceful
- [ ] `otelpgx` wrap no pool Postgres
- [ ] Spans manuais em LLM, whatsmeow, cron, backup
- [ ] `trace_id`/`span_id` em logs via bridge

### Errors (Sentry + error response)
- [ ] `internal/obs/sentry.go` init + `sentryfiber` oficial + panic recovery
- [ ] `SENTRY_TRACES_SAMPLE_RATE` parametrizado (**default 0.1**)
- [ ] `internal/obs/errors.go` + `error_codes.go` (11 códigos canônicos)
- [ ] Shape `{error:{code,message,request_id,timestamp}}` confirmado
- [ ] Catch-all ErrorHandler Fiber
- [ ] PWA `@sentry/nextjs` + `withSentryConfig` + source maps (`SENTRY_AUTH_TOKEN`)
- [ ] PWA `lib/api/client.ts` parseia `error.code` + `error.timestamp`

### Health check
- [ ] `/health` retorna `version`/`build_time`/`uptime_seconds`
- [ ] `-ldflags` injeta `main.version`/`main.buildTime`
- [ ] `/ready` JSON per-check com `status: "ok|connected|reachable"`, `latency_ms`
- [ ] Timeout 500ms per-check + timeout global 3s via `errgroup`

### Backup
- [ ] Handler `POST /api/ops/backup` autenticado (`X-Ops-Token`)
- [ ] Fly Machines schedule `--schedule daily` (comando documentado em `docs/ops/backup.md`)
- [ ] `scripts/backup-prune.sh` retention 30d + 12s + 6m
- [ ] Workflow `backup-drill.yml` cron `0 4 */14 * *` com restore+smoke+destroy
- [ ] Guard prefixo `laura-drill-*` antes de destroy

### Alertas
- [ ] Sentry 3 regras UI + `alerts.md`
- [ ] `notify-slack` em `deploy-api.yml` + `deploy-pwa.yml`
- [ ] Pool exhaustion `WARN` + `CaptureMessage`
- [ ] LLM timeout >10s métrica + warn

### Dashboards
- [ ] `go-runtime.json`, `postgres.json`, `http-laura.json`, `whatsmeow-llm.json`
- [ ] `README.md` import manual

### Docs
- [ ] `observability.md` expandido
- [ ] `runbooks/incident-response.md`
- [ ] `runbooks/error-debugging.md`
- [ ] `alerts.md`
- [ ] `backup.md` com comando Fly Machines schedule

### Tests
- [ ] Unit: `errors`, `logger`, `context_handler`, `metrics`, `tracer`, `sentry`, `context`
- [ ] Integration: `health`, `metrics`, `sentry`, `error_shape`, `tracing`, `backup`
- [ ] E2E: `observability.spec.ts`, `error-shape.spec.ts`
- [ ] Cobertura `internal/obs/*` ≥70%
- [ ] Smoke pós-deploy documentado

---

## 16. Resolução do Review #2 (18 itens)

| # | Item Review #2 | Decisão v3 | Cobertura (seção / task plan) |
|---|----------------|------------|-------------------------------|
| 1 | slog + context propagation (middleware + `slog.With`) | Pseudocódigo explícito `LoggerMiddleware` + `ContextHandler` wrapper | §4.1, §5.7 → tasks plan `obs-logger-foundation`, `obs-context-handler` |
| 2 | Prometheus middleware Fiber | `ansrivas/fiberprometheus/v2` v2.10+ oficial maintained | §4.2 → task `obs-prometheus-setup` |
| 3 | OTel exporter HTTP graceful no-op | `noop.NewTracerProvider()` quando env vazia | §4.3, §5.10 → task `obs-tracer-noop` |
| 4 | Sentry Fiber middleware lib oficial | `getsentry/sentry-go/fiber` (oficial do mesmo repo) | §4.4 → task `obs-sentry-backend` |
| 5 | PWA Sentry source maps via `SENTRY_AUTH_TOKEN` | GitHub Actions secret build-only | §4.4, §6 → task `obs-sentry-pwa` |
| 6 | Backup — Fly Machines schedule vs cron in-process | **Fly Machines schedule** (comando documentado) | §4.7, apêndice A → task `obs-backup-schedule` |
| 7 | Restore drill detalhado (CI semanal ephemeral) | Workflow completo com restore + smoke `SELECT count(*)` + destroy com guard | §4.7 → task `obs-backup-drill` |
| 8 | `/metrics` port `:9090` + `[metrics]` fly.toml | Seção `[metrics]` em fly.toml + goroutine `:9090` | §4.2, §5.4 → task `obs-metrics-fly-config` |
| 9 | Cardinality — 5 endpoints canônicos listados | `/api/v1/{transactions,dashboard,score,reports,auth/login}` | §5.8 → task `obs-metrics-workspace-label` |
| 10 | Sentry `TracesSampleRate` | **Default `0.1`** + adaptive sampling documentado | §4.4, §5.6, §13.5 → task `obs-sentry-sampling` |
| 11 | Error response 4 campos + helper + 10 códigos | Shape + 11 códigos + `respondError` helper | §4.5 → task `obs-error-response` |
| 12 | Health check enriquecido + timeout 3s | Shape canônico + `errgroup` per-check 500ms + global 3s | §4.6 → task `obs-health-enriched` |
| 13 | Ordem slog → Sentry confirmada | Plan respeita sequência 1→10 | §14.2 → plan ordering |
| 14 | Custos Sentry com sampling 0.1 | Projeção ~3k perf events/mês (confortável em 10k free) | §5.6 |
| 15 | Compatibilidade Fase 10 | `c.Locals("requestid")` preservada; logger Fiber JSON substituído atômico | §5.11 → task `obs-fase10-compat` |
| 16 | Tests — handlers + Sentry mock + respondError unit | Cobertura mapeada | §10.1, §10.2 → tasks `test-*` |
| 17 | Migrations DB | Zero migrations na Fase 11 (confirmado) | §11 |
| 18 | Self-review tabular 8 itens v2 §15 → task ID | Checklist §15 espelha 1:1 itens do plan | §15 + esta tabela |

---

## Apêndice A — Comandos operacionais comuns

### A.1. Setup Fly Machines schedule (backup cron)
```sh
fly machine run \
  --app laura-api \
  --schedule daily \
  --name laura-backup-cron \
  --env BACKUP_OPS_TOKEN=$BACKUP_OPS_TOKEN \
  --image ghcr.io/jvzanini/laura-backup-runner:latest \
  --region gru \
  --vm-size shared-cpu-1x \
  --vm-memory 256 \
  -- /app/run-backup.sh
```

### A.2. Smoke manual do drill backup
```sh
EPH_NAME="laura-drill-$(date +%Y%m%d%H%M%S)"
fly postgres create --name "$EPH_NAME" --region gru --vm-size shared-cpu-1x --initial-cluster-size 1
fly postgres restore --from-cluster laura-api-db --to-cluster "$EPH_NAME" --latest
fly postgres connect -a "$EPH_NAME" -c "SELECT count(*) FROM users;"
fly postgres destroy "$EPH_NAME" -y  # só se prefix laura-drill-*
```

### A.3. Consultar /metrics localhost via fly ssh
```sh
fly ssh console -a laura-api -C "curl -s http://127.0.0.1:9090/metrics | head -40"
```

### A.4. Disparar panic controlado em staging (smoke Sentry)
```sh
curl -X POST https://staging.laura-api.fly.dev/api/_debug/panic \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -H "X-Request-Id: smoke-$(date +%s)"
```

### A.5. Reduzir Sentry sampling sem rebuild
```sh
fly secrets set SENTRY_TRACES_SAMPLE_RATE=0.05 -a laura-api
# restart rolling automático
```

### A.6. Verificar `[metrics]` scraping Fly interno
```sh
fly metrics show -a laura-api  # caso Grafana Cloud esteja conectado
```

---

**Fim Spec v3 — FINAL.** Próximo passo: `superpowers:writing-plans` produz plan v1 seguindo ordem de implementação §14.2, commits atômicos por item do checklist §15, DoD parcial por checkpoint §14.3.
