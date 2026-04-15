# Fase 11 — Observabilidade completa + Telemetria (Spec v2)

> Versão: v2 (pós Review #1)
> Data: 2026-04-15
> Autor: arquiteto sênior (review)
> Status: aguardando plan v1 (`superpowers:writing-plans`)
> Antecessor: `2026-04-15-fase-11-observability-telemetria-v1.md`

---

## 0. Mudanças vs v1

Consolidação completa das 10 questões abertas e remoção de ambiguidades arquiteturais. Mudanças principais:

1. **Questões abertas resolvidas** (seção 13 nova): todas as 10 receberam decisão final justificada, sem punt para v3.
2. **Consolidação Sentry vs OTel** (seção 4.3 + 4.4 reescritas): Sentry assume **errors + performance traces (sampling 100% MVP parametrizado)**; OTel assume **distributed tracing arquitetural** (cron, workers, backup jobs). Zero duplicação de spans HTTP (Sentry Fiber middleware já cobre HTTP; OTel cobre camadas não-HTTP).
3. **STANDBYs renomeados para IDs canônicos** (seção 6): `SENTRY-DSN-API`, `SENTRY-DSN-PWA`, `SENTRY-AUTH-TOKEN`, `SLACK-WEBHOOK`, `GRAFANA-CLOUD`, `OTEL-COLLECTOR-URL`, `FLY-API-TOKEN-BACKUP`, `PAGERDUTY` (opcional).
4. **Ordem de implementação** (seção 14 nova): prerequisite chain explícita — slog → error response → Sentry (hooka no slog) → Prometheus → OTel → backup → alertas → dashboards → docs.
5. **Contrato requestid ↔ slog** (seção 5.7 nova): `request_id` propagado via `context.Context` com chave tipada `obs.RequestIDKey`; middleware Fiber (Fase 10) grava em `c.Locals` **e** em `c.UserContext()` para que camadas profundas recuperem por `context.Value`.
6. **Cardinalidade Prometheus** (seção 5.8 nova): `workspace_id` como label **apenas** nos 5 endpoints críticos (`/messages/send`, `/llm/chat`, `/webhooks/meta`, `/auth/login`, `/workspaces/sync`); demais métricas usam boolean `workspace_present`.
7. **PWA RUM movido para Fase 12** (seção 3.2): não entra na 11.
8. **Custos detalhados por componente** (seção 5.6 expandida).
9. **Plano de testes com cobertura mínima 70%** (seção 10 expandida).
10. **LEI #5 confirmada explicitamente** (seção 5.9 nova): moeda em centavos não é tocada; HMAC de sessão não é tocado.
11. **Seções novas**: 11 (resumo de questões resolvidas), 12 (glossário), 13 (resolução das 10 questões abertas), 14 (pré-condições + ordem de implementação para plan v1), 15 (checklist consolidado de entregas).

---

## 1. Objetivo

Elevar o stack Laura Finance (backend Go `laura-go` + PWA Next.js `laura-pwa`) do nível atual de observabilidade "healthcheck + request-id" (entregue na Fase 10) para um patamar production-grade que permita, em produção:

1. **Diagnosticar** qualquer incidente em menos de 5 minutos a partir de um `request_id` (log structured → trace → erro Sentry → métrica Prometheus correlata).
2. **Medir** latência, throughput e saúde de cada dependência externa (Postgres, whatsmeow, LLM provider, WhatsApp Business API) com granularidade por rota.
3. **Alertar** proativamente antes que usuários percebam degradação (threshold de erro, pool exhaustion, latência LLM, fila de webhooks atrasada).
4. **Rastrear** distribuídamente um request que entra no PWA, viaja até o Go API, percorre queries pgx e uma chamada LLM, e volta, com spans correlacionados via `trace_id` + `request_id`.
5. **Recuperar** dados de uma falha catastrófica com backup automatizado + drill quinzenal validando o restore.

Entregável: sistema em produção onde um incidente é diagnosticado por logs + traces + métricas correlacionados pelo mesmo `request_id`, com alerta tendo chegado antes do primeiro usuário reportar.

## 2. Contexto e motivação (o que falta após Fase 10)

Fase 10 (commits `9013be7..7154914`) entregou:

| Item | Status |
|------|--------|
| Pipelines go-ci / pwa-ci / playwright / security / deploy-api STANDBY / deploy-pwa STANDBY | entregue |
| Dockerfile distroless + embed migrations | entregue |
| `fly.toml` single-machine + `/health` e `/ready` | entregue |
| Middleware `requestid` (X-Request-Id UUIDv4) | entregue |
| Logger Fiber JSON em production (somente camada HTTP) | entregue |
| Handler `/ready` com `db.Ping` | entregue |
| Runbooks rollback + secrets-rotation | entregue |
| E2E expandido (8 specs) | entregue |

Gaps que impedem operar com confiança (idênticos ao v1, mantidos por integridade):

| Gap | Impacto |
|-----|---------|
| `log.Printf` em `internal/` sem correlação ao `request_id` | impossibilita debug cross-layer |
| Sem `/metrics` | Grafana cego; sem alerta threshold |
| Sem tracing OTel | debug de latência cross-component é tentativa e erro |
| Sem Sentry Go + Next | erros 500 escondidos até reclamação |
| Error responses inconsistentes | PWA não consegue montar UI/observabilidade padronizada |
| `/ready` binário | não diferencia DB down de LLM fora |
| Backup manual | sem retenção formal, sem drill |
| Sem alertas | deploy falha silencioso, pool exhaustion invisível |
| Sem dashboards | Grafana não provisionado |
| Documentação operacional rasa | sem `incident-response.md`, sem `error-debugging.md` |

## 3. Escopo

### 3.1. Dentro do escopo (Fase 11)

1. Logger application-level `slog` (stdlib Go 1.21+) substituindo `log.Printf` em `internal/`.
2. Propagação de `request_id` via `context.Context` até camadas profundas (domain/infra).
3. Métricas Prometheus via `prometheus/client_golang` + `/metrics` em port `:9090` **interno** (não exposto no Fly router).
4. Middleware `fiberprometheus` para HTTP count/latency/errors por rota.
5. Métricas custom: pgxpool stats, whatsmeow connection state, cron duration, LLM latency, backup timestamps.
6. OpenTelemetry SDK + exporter **OTLP/HTTP** (decisão 13.3).
7. Spans em camadas **não-HTTP**: pgx queries (via `otelpgx`), LLM calls, whatsmeow events, cron jobs, backup workers. HTTP spans ficam com Sentry (ver 5.1).
8. Sentry backend (`getsentry/sentry-go` + `sentry-go/fiber`) com **`TracesSampleRate` parametrizado via env `SENTRY_TRACES_SAMPLE_RATE` (default 1.0 MVP)**.
9. Sentry PWA (`@sentry/nextjs`) + source maps upload no build (**sem RUM — Fase 12**).
10. Error response padronizado `{error:{code,message,request_id}}` + helper central.
11. `/ready` enriquecido (per-dependency) + versão do build em `/health` via `-ldflags`.
12. Backup automation via Fly Machines schedule externo chamando `/api/ops/backup` autenticado + retention 30d + drill quinzenal em **instância ephemeral** (decisão 13.4).
13. Alertas Sentry (configurados via **UI no MVP**; Terraform provider fica para Fase 12+, decisão 13.7) + Slack webhook para deploy fail + pool exhaustion warning.
14. Dashboards Grafana JSON em `docs/ops/grafana-dashboards/`.
15. Documentação operacional: `observability.md` expandido + runbooks `incident-response.md`, `error-debugging.md`.

### 3.2. Fora do escopo (Fase 12+)

1. PWA RUM / Web Vitals via `@sentry/nextjs` performance monitoring ou OTel Web SDK (**decisão 13.10**).
2. Log aggregation (Loki, Datadog, Logtail).
3. APM comercial.
4. SLO formais (error budgets, burn rate).
5. Chaos engineering.
6. Dashboards per-workspace (requer cardinalidade universal em todas métricas).
7. Distributed tracing do WhatsApp Business Cloud API.
8. PagerDuty automatizada.
9. On-call rotation docs.
10. Terraform Sentry provider.

## 4. Pendências detalhadas

### 4.1. Logger application-level structured (`slog`, decisão 13.1)

- **Estado atual:** `log.Printf`/`log.Println` em `internal/{app,whatsapp,llm,cron,repo}`. Sem níveis, sem structured fields, sem correlação ao `request_id`.
- **Ação:**
  1. `internal/obs/logger.go` com `slog.New(slog.NewJSONHandler(os.Stdout, opts))` em produção e `slog.NewTextHandler` em dev (via `APP_ENV`).
  2. Níveis: `DEBUG` (dev), `INFO` (default prod), `WARN` (degradação), `ERROR` (falha + dispatch Sentry).
  3. Atributos obrigatórios: `request_id`, `workspace_id` (quando disponível), `user_id` (quando disponível), `action` (nome lógico), `trace_id`, `span_id` (quando OTel ativo).
  4. Middleware Fiber `obs.LoggerMiddleware()` injeta `*slog.Logger` em `c.Locals("logger")` **e** em `c.UserContext()` via `context.WithValue(ctx, obs.LoggerKey, logger)`.
  5. Helper `obs.FromCtx(ctx) *slog.Logger` recupera logger em camadas profundas.
  6. Bridge `otelslog` (decisão 13.6) via `go.opentelemetry.io/contrib/bridges/otelslog` para emitir log records correlacionados a spans ativos.
  7. Script `scripts/migrate-log-printf.sh` (sed + review manual) para substituir ocorrências (~40 call sites).
- **Arquivos:** novos `laura-go/internal/obs/logger.go`, `internal/obs/context.go`; alterados `cmd/api/main.go`, `internal/app/router.go`, `internal/{app,whatsapp,llm,cron,repo}/*.go`.
- **Libs:** stdlib `log/slog` + `go.opentelemetry.io/contrib/bridges/otelslog`.
- **STANDBY:** nenhum.
- **Tempo:** 5h (inclui bridge otelslog + review 40 call sites).

### 4.2. Métricas Prometheus (decisão 13.2)

- **Estado atual:** zero métricas expostas.
- **Ação:**
  1. `github.com/prometheus/client_golang` + `github.com/ansrivas/fiberprometheus/v2`.
  2. Endpoint `/metrics` em **port `:9090` separado**, bind em `127.0.0.1:9090` (goroutine paralela ao Fiber principal). Fly router só expõe `:8080`. Scraper interno (Grafana Agent sidecar futuro) acessa via localhost.
  3. Middleware `fiberprometheus.New("laura_api")` registra `laura_http_requests_total`, `laura_http_request_duration_seconds`, `laura_http_requests_in_flight` por rota + status.
  4. Collectors custom em `internal/obs/metrics.go`:
     - `laura_pgxpool_acquire_count`, `laura_pgxpool_idle_conns`, `laura_pgxpool_total_conns` (de `pool.Stat()`).
     - `laura_whatsmeow_connected{workspace_id}` gauge 0/1 (workspace_id permitido pois volume esperado < 100 workspaces — ver 5.8).
     - `laura_cron_job_duration_seconds{job}` histogram.
     - `laura_llm_call_duration_seconds{provider,model}` histogram + `laura_llm_call_errors_total{provider,reason}`.
     - `laura_backup_last_success_timestamp_seconds`, `laura_backup_last_size_bytes`.
  5. `workspace_id` como label: **apenas** nos 5 endpoints críticos (ver 5.8).
- **Arquivos:** novos `internal/obs/metrics.go`; alterados `cmd/api/main.go`, `internal/cron/*.go`, `internal/llm/*.go`, `internal/whatsapp/client.go`; config `fly.toml` (não expor `:9090`).
- **Libs:** `prometheus/client_golang`, `fiberprometheus/v2`.
- **STANDBY:** `STANDBY [GRAFANA-CLOUD]` para scraping.
- **Tempo:** 3h.

### 4.3. Tracing OpenTelemetry (distributed tracing arquitetural)

- **Escopo consolidado:** OTel cobre **camadas não-HTTP** (pgx, LLM, whatsmeow, cron, backup). HTTP spans são cobertos por Sentry Performance (4.4) evitando duplicação.
- **Estado atual:** zero spans.
- **Ação:**
  1. SDK `go.opentelemetry.io/otel` + exporter **OTLP/HTTP** (`otlptracehttp`, decisão 13.3 — mais simples, sem TLS dance).
  2. Tracer provider em `internal/obs/tracer.go` lendo `OTEL_EXPORTER_OTLP_ENDPOINT`; vazio → NoOp.
  3. Resource: `OTEL_SERVICE_NAME=laura-api`, `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<APP_ENV>,service.version=<BUILD_SHA>`.
  4. Instrumentar pgx via `github.com/exaring/otelpgx` (nativo pgx v5).
  5. Spans manuais em `llm.Call` com atributos `llm.provider`, `llm.model`, `llm.tokens_in/out`.
  6. Spans em `whatsmeow.OnMessage` com `wa.jid`, `wa.msg_type`.
  7. Spans em cron jobs (`cron_job.name`, `cron_job.next_run`) e backup worker.
  8. Correlação log↔trace: bridge `otelslog` (ver 4.1) garante `trace_id`/`span_id` em todo log emitido dentro de span ativo.
- **Arquivos:** novos `internal/obs/tracer.go`, `internal/obs/slog_otel_handler.go` (wrapper se bridge oficial não cobrir 100%); alterados `cmd/api/main.go`, `internal/repo/db.go`, `internal/llm/*.go`, `internal/whatsapp/client.go`, `internal/cron/*.go`.
- **Libs:** `otel`, `otel/sdk`, `exporters/otlp/otlptrace/otlptracehttp`, `otelpgx`, `otelslog`.
- **STANDBY:** `STANDBY [OTEL-COLLECTOR-URL]`.
- **Tempo:** 5h.

### 4.4. Sentry SDK (errors + Performance HTTP)

- **Escopo consolidado:** Sentry cobre **errors** (panics, `ERROR` logs, 5xx) + **performance traces HTTP** (request → handler → response) com `TracesSampleRate` parametrizado. Não sobrepõe com OTel (que cobre cron/LLM/pgx/whatsmeow).
- **Ação backend Go:**
  1. `getsentry/sentry-go` + `sentry-go/fiber` middleware.
  2. Init em `cmd/api/main.go` lendo `SENTRY_DSN_API` (STANDBY). Vazio → NoOp.
  3. `TracesSampleRate` via env `SENTRY_TRACES_SAMPLE_RATE` — **default 1.0 MVP** (decisão 13.5), reduzir quando tier free for ameaçado.
  4. `EnableTracing: true`.
  5. Integração slog: custom handler emite `sentry.CaptureException` no nível `ERROR`.
  6. Middleware captura panics + enriquece scope com `request_id`, `workspace_id`, `user_id`.
- **Ação PWA Next.js:**
  1. `@sentry/nextjs` via `npx @sentry/wizard@latest -i nextjs`.
  2. `sentry.{client,server,edge}.config.ts`.
  3. `next.config.ts` wrap com `withSentryConfig` (source maps upload).
  4. `NEXT_PUBLIC_SENTRY_DSN_PWA` runtime; `SENTRY_AUTH_TOKEN` build CI only.
  5. **RUM / Web Vitals desabilitado** (Fase 12).
- **Arquivos:** novos Go `internal/obs/sentry.go`; alterados Go `cmd/api/main.go`, `internal/app/router.go`, `internal/obs/logger.go`; novos PWA `sentry.{client,server,edge}.config.ts`, `.sentryclirc.example`; alterados PWA `next.config.ts`, `package.json`.
- **Libs:** `getsentry/sentry-go`, `sentry-go/fiber`, `@sentry/nextjs`.
- **STANDBY:** `STANDBY [SENTRY-DSN-API]`, `STANDBY [SENTRY-DSN-PWA]`, `STANDBY [SENTRY-AUTH-TOKEN]`.
- **Tempo:** 4h.

### 4.5. Error response padronizado

- **Estado atual:** shapes divergentes por handler.
- **Ação:**
  1. Contrato único: `{ "error": { "code": "STRING_CANONICAL", "message": "texto PT-BR", "request_id": "uuid" } }`.
  2. Helper `obs.RespondError(c *fiber.Ctx, code string, status int, err error)` em `internal/obs/errors.go`.
  3. Catálogo em `internal/obs/error_codes.go`:
     - `VALIDATION_FAILED` (400), `AUTH_INVALID` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500), `DEPENDENCY_DOWN` (503), `WA_OFFLINE` (503), `LLM_UNAVAILABLE` (503), `DB_ERROR` (500).
  4. Mapear: `pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DEPENDENCY_DOWN`, `validator.ValidationErrors` → `VALIDATION_FAILED`.
  5. `RespondError` loga em nível apropriado (`WARN` < 500, `ERROR` ≥ 500) + `sentry.CaptureException` se ≥ 500.
  6. Middleware Fiber `ErrorHandler` catch-all para panics/erros não tratados.
- **Arquivos:** novos `internal/obs/errors.go`, `internal/obs/error_codes.go`; alterados ~20 handlers em `internal/app/handlers/`; alterado PWA `lib/api/client.ts` parseia `error.code`.
- **Libs:** nenhuma nova.
- **STANDBY:** nenhum.
- **Tempo:** 4h.

### 4.6. Health check enriquecido + versão de build

- **Ação:**
  1. `/health` → `{ "status": "ok", "version": "<short-sha>", "build_time": "<ISO>", "uptime_seconds": N }`.
  2. Versão via `-ldflags "-X main.version=$(git rev-parse --short HEAD) -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"` no Dockerfile + workflow.
  3. `/ready` → `{ "status": "ok|degraded|fail", "checks": { "db":{...}, "whatsmeow":{...}, "llm":{...} } }` com `{ok, latency_ms, error?}` por check.
  4. Regras: `db` fail → overall `fail` (503); `whatsmeow` down → `degraded` (200); `llm` down → `degraded` (200).
  5. Timeout 500ms por check, paralelo com `errgroup`.
- **Arquivos:** alterados `cmd/api/main.go`, `internal/app/handlers/health.go`, `Dockerfile`, `.github/workflows/deploy-api.yml`.
- **Libs:** `golang.org/x/sync/errgroup`.
- **STANDBY:** nenhum.
- **Tempo:** 2h.

### 4.7. Backup automation (decisão 13.4 — drill ephemeral)

- **Ação:**
  1. Endpoint interno `POST /api/ops/backup` autenticado via header `X-Ops-Token` (valor em secret). Triggered por Fly Machines schedule externo `0 3 * * *` (UTC).
  2. Handler executa `flyctl postgres backup create -a <cluster>` via `exec.Command` + atualiza métricas `laura_backup_last_success_timestamp_seconds`, `laura_backup_last_size_bytes`.
  3. Retention: **30 backups diários** (decisão 13.8) + 12 semanais (`sunday`) + 6 mensais (`first-of-month`), gerenciados por `scripts/backup-prune.sh` rodado após criar novo.
  4. Drill restore quinzenal via workflow `.github/workflows/backup-drill.yml` cron `0 4 */14 * *`:
     - Executa `fly postgres restore --from <latest-backup> --name laura-drill-<timestamp>` em instância **ephemeral**.
     - Roda `migrate status` + `SELECT count(*) FROM users;` sanity query.
     - `fly postgres destroy laura-drill-<timestamp> -y`.
     - Reporta sucesso/falha no Slack (`STANDBY [SLACK-WEBHOOK]`).
     - Guard: script valida prefixo `laura-drill-*` hardcoded antes de `destroy` (R6 mitigado).
  5. Custo $0 extra (instância viva < 10min por drill, free tier Fly cobre).
- **Arquivos:** novos `laura-go/internal/app/handlers/ops_backup.go`, `scripts/backup-prune.sh`, `scripts/backup-restore-drill.sh`, `.github/workflows/backup-drill.yml`; alterados `internal/app/router.go`.
- **Libs:** `flyctl` CLI, `pg_dump` fallback.
- **STANDBY:** `STANDBY [FLY-API-TOKEN-BACKUP]`, `STANDBY [SLACK-WEBHOOK]`.
- **Tempo:** 5h.

### 4.8. Alertas (configuração via UI — decisão 13.7)

- **Ação:**
  1. Sentry alert rules configurados **via UI no MVP** (documentados em `docs/ops/alerts.md`; Terraform Sentry provider fica Fase 12+):
     - `rate(errors) > 5/5min` → e-mail + Slack.
     - `new issue in production` → Slack.
     - `performance regression p95 > 2s` → e-mail.
  2. GitHub Actions: step `notify-slack` em `deploy-api.yml` e `deploy-pwa.yml` (`slackapi/slack-github-action@v1`) posta em `STANDBY [SLACK-WEBHOOK]` quando `failure()`.
  3. Pool exhaustion: `pgxpool.Stat().AcquireCount / TotalConns > 0.9` → `WARN` + `sentry.CaptureMessage`.
  4. LLM timeout: `llm.Call` > 10s → `WARN` + `laura_llm_timeouts_total++`.
- **Arquivos:** alterados `.github/workflows/deploy-api.yml`, `deploy-pwa.yml`; novos `docs/ops/alerts.md`.
- **Libs:** `slackapi/slack-github-action@v1`.
- **STANDBY:** `STANDBY [SLACK-WEBHOOK]`, `STANDBY [SENTRY-DSN-API]`, `STANDBY [SENTRY-DSN-PWA]`, `STANDBY [PAGERDUTY]` (opcional).
- **Tempo:** 2h.

### 4.9. Dashboards Grafana

- **Ação:**
  1. Exportar JSONs para `docs/ops/grafana-dashboards/`:
     - `go-runtime.json` (base ID 10826).
     - `postgres.json` (base ID 9628).
     - `http-laura.json` (custom fiberprometheus: request rate, p50/p95/p99, error rate por rota).
     - `whatsmeow-llm.json` (custom: conn state, LLM latency por provider).
  2. `README.md` explica import manual via Grafana Cloud.
  3. Provisioning automático fica STANDBY até credencial.
- **Arquivos:** novos `docs/ops/grafana-dashboards/*.json`, `README.md`.
- **STANDBY:** `STANDBY [GRAFANA-CLOUD]`.
- **Tempo:** 3h.

### 4.10. Documentação operacional

- **Ação:**
  1. Expandir `docs/ops/observability.md`:
     - Diagrama (logs stdout → Fly; métricas /metrics → Grafana; traces OTLP → Tempo; errors → Sentry).
     - Correlacionar `request_id`/`trace_id` entre camadas.
     - Tabela de códigos de erro canônicos.
  2. Novo `docs/ops/runbooks/incident-response.md`: severidade (SEV1/2/3), primeiros 5min, escalada (STANDBY), template post-mortem.
  3. Novo `docs/ops/runbooks/error-debugging.md`: workflow error code → grep logs por `request_id` → Sentry → trace Tempo → Grafana. Casos comuns (503 DEPENDENCY_DOWN, 500 DB_ERROR, 500 LLM_UNAVAILABLE).
- **Arquivos:** alterado `docs/ops/observability.md`; novos runbooks.
- **STANDBY:** nenhum.
- **Tempo:** 3h.

## 5. Decisões de arquitetura

### 5.1. slog como padrão (decisão 13.1)
stdlib, zero dep, handler JSON nativo, bridge `otelslog` oficial. Performance vs zap irrelevante (<100 req/s).

### 5.2. Prometheus para metrics, OTel para traces
OTel metrics SDK ainda imaturo. Prometheus + Grafana dashboards prontos. OTel traces maduros sem alternativa.

### 5.3. Sentry para errors + HTTP performance; OTel para camadas não-HTTP
Evita duplicação. Sentry Fiber middleware cobre HTTP span. OTel cobre pgx, LLM, whatsmeow, cron, backup. `trace_id` Sentry e OTel **não são correlacionados** (limitação Fase 11 documentada); em Fase 12 avaliar OTel exporter para Sentry (`go.opentelemetry.io/contrib/bridges/otel-sentry`).

### 5.4. `/metrics` em port `:9090` interno (decisão 13.2)
Bind `127.0.0.1:9090`. Fly router só expõe `:8080`. Sem basic auth (port não roteada). Scraper interno (Grafana Agent sidecar) futuro acessa localhost.

### 5.5. Source maps PWA upload via `withSentryConfig`
Necessário para stack traces legíveis. Requer `SENTRY_AUTH_TOKEN` CI-only.

### 5.6. Custos esperados detalhados

| Serviço | Plano | Limite free | Volume esperado | Custo/mês |
|---------|-------|-------------|-----------------|-----------|
| Sentry Developer (errors + perf API) | 5k events + 10k perf | volume atual ~1k errors + ~3k perf | $0 |
| Sentry PWA (mesmo projeto-org) | compartilha cota | estimativa +500 events | $0 |
| Grafana Cloud Free | 10k series + 50GB logs + 50GB traces + 14d retention | séries estimadas ~2k, traces ~5GB | $0 |
| Fly Postgres backups | incluso | 30 diários + 12 sem + 6 mensais (~3GB total) | $0 |
| Fly Machines schedule (backup cron) | incluso nos 3 VMs free | 1 execução/dia 30s | $0 |
| Fly Postgres drill ephemeral | instância viva <10min quinzenal | dentro free tier shared-cpu-1x | $0 |
| Slack webhook | Free workspace | ilimitado | $0 |
| OTel Collector (se Grafana Cloud Tempo) | incluso no Free | 50GB traces | $0 |
| PagerDuty | STANDBY (Fase 12+) | — | — |
| **Total Fase 11** | | | **$0** |

Trigger de revisão: se Sentry errors > 4k/mês OR Grafana series > 8k OR traces > 40GB → subir para Team plan.

### 5.7. Contrato requestid ↔ slog ↔ OTel
Fase 10 middleware grava `X-Request-Id` em `c.Locals("request_id")`. Fase 11 estende:
1. Mesmo middleware **também** grava em `c.UserContext()` via `context.WithValue(ctx, obs.RequestIDKey{}, id)`.
2. `obs.LoggerMiddleware()` (roda depois) cria `slog.Logger` com atributo `request_id` e injeta em `c.UserContext()` via `obs.LoggerKey{}`.
3. `obs.FromCtx(ctx)` recupera logger em camadas profundas; `obs.RequestIDFromCtx(ctx)` recupera ID puro.
4. OTel span root (criado por Sentry Fiber middleware) lê `request_id` de context e adiciona como span attribute.
5. Bridge `otelslog` garante que todo log emitido dentro de span ativo recebe `trace_id`/`span_id`.

### 5.8. Cardinalidade Prometheus — `workspace_id` scoped
Regra: `workspace_id` como label apenas nas métricas dos **5 endpoints críticos**:
- `laura_http_requests_total{workspace_id, route="/messages/send", ...}`
- `laura_http_requests_total{workspace_id, route="/llm/chat", ...}`
- `laura_http_requests_total{workspace_id, route="/webhooks/meta", ...}`
- `laura_http_requests_total{workspace_id, route="/auth/login", ...}`
- `laura_http_requests_total{workspace_id, route="/workspaces/sync", ...}`

Demais métricas HTTP usam label `workspace_present="true|false"` boolean. Métricas pgxpool/cron/backup sem workspace_id. Proteção adicional: volume atual < 100 workspaces → 5 rotas × 100 ws × 5 status = 2500 séries críticas (dentro budget free tier).

### 5.9. LEI #5 confirmada
- **Moeda em centavos:** Fase 11 não altera valores monetários, nenhum handler de cobrança/saldo é tocado. Apenas camada de observabilidade.
- **HMAC de sessão:** Fase 11 não altera crypto de sessão; headers `X-Request-Id` e `X-Ops-Token` (novo para backup) são independentes.

## 6. Pré-requisitos / STANDBYs canônicos

| ID canônico | Onde usado | Bloqueia merge? |
|-------------|------------|-----------------|
| `STANDBY [SENTRY-DSN-API]` | `cmd/api/main.go` init Sentry Go | não (NoOp se vazio) |
| `STANDBY [SENTRY-DSN-PWA]` | `sentry.client.config.ts` | não (NoOp) |
| `STANDBY [SENTRY-AUTH-TOKEN]` | CI `deploy-pwa.yml` upload source maps | não (build pula upload) |
| `STANDBY [SLACK-WEBHOOK]` | deploy workflows + drill backup | não (skip notificação) |
| `STANDBY [GRAFANA-CLOUD]` | scraper + import dashboards | não (métricas ficam locais) |
| `STANDBY [OTEL-COLLECTOR-URL]` | `internal/obs/tracer.go` | não (NoOp tracer) |
| `STANDBY [FLY-API-TOKEN-BACKUP]` | workflow `backup-drill.yml` | sim para drill em CI (código local roda sem) |
| `STANDBY [PAGERDUTY]` | opcional, Fase 12+ | nunca |

Código com STANDBY pendente **deve** ter fallback NoOp/log-only para dev + CI não quebrarem.

## 7. Critérios de aceite (DoD)

1. `go test ./...` passa verde (incluindo novos testes `obs/*`); cobertura ≥ 70% em novo código.
2. `pnpm test` em `laura-pwa` verde; build PWA gera source maps e (com `SENTRY_AUTH_TOKEN`) faz upload; sem token não falha.
3. `curl http://127.0.0.1:9090/metrics` retorna Prometheus válido com métricas esperadas.
4. `curl http://localhost:8080/health` retorna JSON com `version` preenchida.
5. `curl http://localhost:8080/ready` retorna JSON com `checks.db`, `checks.whatsmeow`, `checks.llm`.
6. Erro em `/api/_debug/panic` (dev-only) dispara captura Sentry + log `ERROR` com `request_id` + span OTel associado.
7. Erro em qualquer rota retorna shape `{error:{code,message,request_id}}`.
8. `grep -r "log.Printf\|log.Println" laura-go/internal/` retorna zero linhas.
9. `scripts/backup-restore-drill.sh --dry-run` executa sem erro.
10. Docs `observability.md`, `incident-response.md`, `error-debugging.md`, `alerts.md` completos sem `TBD`.
11. Dashboards JSON + README presentes.
12. CI workflows existentes continuam verdes.
13. Trace `trace_id` de log `ERROR` pode ser aberto no backend OTel configurado (validado em manual QA se `OTEL-COLLECTOR-URL` presente).

## 8. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|-------|-------|---------|-----------|
| R1 | Migração `log.Printf` → `slog` quebra consumidor grep externo | baixa | baixo | aviso runbook + commit atômico reversível |
| R2 | `fiberprometheus` breaking em Fiber v3 | média | médio | isolar em `internal/obs/metrics.go` |
| R3 | OTel SDK breaking entre minors | média | médio | pin `go.mod` + revisar quarterly |
| R4 | Sentry DSN vazar em source maps | baixa | alto | DSN client-side é pública; `SENTRY_AUTH_TOKEN` jamais em bundle |
| R5 | `/metrics` inacessível sem agent sidecar | média | baixo | documentar em `observability.md` |
| R6 | Backup drill destrói instância prod | baixíssima | catastrófico | script valida prefixo `laura-drill-*` hardcoded antes de destroy |
| R7 | `request_id` não propaga em goroutines | média | baixo | doc padrão + code review |
| R8 | Volume de logs explode por DEBUG acidental | baixa | médio | `LOG_LEVEL=info` default; alerta > N MB/h |
| R9 | Overhead OTel > 5% CPU | baixa | médio | sample rate revisável; OTel só camadas não-HTTP reduz volume |
| R10 | Dual Sentry DSN confunde | média | baixo | IDs distintos `SENTRY-DSN-API` vs `SENTRY-DSN-PWA` |
| R11 | Sentry `TracesSampleRate=1.0` estoura tier free | média | médio | env parametrizado; alarme em 80% do quota → reduzir para 0.3 |
| R12 | OTel e Sentry `trace_id` não correlacionam | alta | baixo | documentado; Fase 12 bridge |

## 9. Métricas de sucesso

1. **MTTR diagnóstico:** < 10 min pós-Fase 11.
2. **% requests com `request_id` propagado em logs profundos:** 100%.
3. **Cobertura instrumentação:** 100% handlers HTTP com span Sentry; 100% queries pgx com span OTel.
4. **Erros silenciosos:** 0% (5xx sem evento Sentry).
5. **Backup drill success rate:** 100% (2/2 primeiros 30 dias).
6. **Alert noise ratio:** > 80% acionáveis em 30 dias.
7. **Overhead latência p95 instrumentação:** < 5ms.
8. **Cobertura testes novo código:** ≥ 70%.

## 10. Plano de testes

### 10.1. Unit (cobertura mínima 70%)
- `internal/obs/errors_test.go`: `RespondError` para cada code mapeia status+JSON; `pgx.ErrNoRows` → `NOT_FOUND`; `context.DeadlineExceeded` → `DEPENDENCY_DOWN`.
- `internal/obs/logger_test.go`: handler JSON produz linha válida com `request_id`/`level`/`msg`/`time`; handler texto em dev; `FromCtx` recupera logger; atributo `trace_id` presente quando span ativo.
- `internal/obs/metrics_test.go`: collectors custom registram; `pgxpool` stats preenchidas; `workspace_id` label aparece só em 5 rotas críticas.
- `internal/obs/tracer_test.go`: NoOp ativo quando env vazia; real tracer quando preenchido; span pgx criado via `otelpgx`.
- `internal/obs/sentry_test.go`: init NoOp se DSN vazio; handler slog `ERROR` dispara capture via server mock.
- `internal/obs/context_test.go`: `RequestIDFromCtx` + `LoggerFromCtx` roundtrip.

### 10.2. Integration
- `test/integration/health_test.go`: `/health.version` preenchida; `/ready` db down → 503 detalhado; whatsmeow offline → 200 `degraded`.
- `test/integration/metrics_test.go`: port 9090 localhost corpo Prometheus + métricas após requests; port 9090 não acessível via Fly public.
- `test/integration/sentry_test.go`: DSN mock servidor local; `/api/_debug/panic` envia evento com `request_id` no scope.
- `test/integration/error_shape_test.go`: todas rotas conhecidas retornam shape `{error:{code,message,request_id}}` em cenário de erro.
- `test/integration/tracing_test.go`: OTLP mock recebe spans pgx + LLM com `request_id` attribute.
- `test/integration/backup_test.go`: handler `/api/ops/backup` requer `X-Ops-Token` válido; retorna métricas atualizadas.

### 10.3. E2E
- Playwright `e2e/observability.spec.ts`: request ao PWA → `X-Request-Id` na response → mesmo ID no log stdout (capturado via `fly logs` fixture).
- Playwright `e2e/error-shape.spec.ts`: provocar 404/500 → PWA consome `error.code` e renderiza UI correspondente.

### 10.4. Smoke pós-deploy
- Disparar `/api/_debug/panic` em staging → verificar Sentry issue.
- `fly ssh console` → `curl localhost:9090/metrics`.
- Rodar drill backup manual 1× pré-agendamento.
- Validar trace no backend OTel (se `OTEL-COLLECTOR-URL` resolvido).

### 10.5. Cobertura
- `go test -coverprofile=coverage.out ./...` + gate CI ≥ 70% em `internal/obs/*`.
- `pnpm test --coverage` PWA ≥ 70% em novos arquivos Sentry config.

## 11. Resumo de questões resolvidas (para Review #2)

Todas as 10 questões abertas do v1 foram resolvidas nesta v2 (ver seção 13 para decisão final). Nenhuma fica em aberto para v3. Novas questões que possam surgir durante plan v1 devem ser levantadas como Review #2 follow-up, não prorrogadas para spec.

## 12. Glossário

- **`request_id`**: UUIDv4 gerado pelo middleware `requestid` (Fase 10) no header `X-Request-Id`. Correlaciona logs, spans, Sentry events, métricas.
- **`trace_id` / `span_id`**: OpenTelemetry trace identifier W3C Trace Context. Gerado pelo SDK OTel em span root (Sentry HTTP) ou spans filhos (pgx/LLM).
- **STANDBY**: secret/credencial externa pendente; código tem fallback NoOp.
- **NoOp tracer/logger/SDK**: implementação vazia que permite executar sem side-effect quando config ausente.
- **Drill ephemeral**: instância temporária Fly Postgres criada pelo workflow `backup-drill.yml`, validada e destruída na mesma execução (<10min).
- **OTLP/HTTP**: OpenTelemetry Line Protocol sobre HTTP (`otlptracehttp`), alternativa ao gRPC.
- **Bridge `otelslog`**: `go.opentelemetry.io/contrib/bridges/otelslog` — emite slog records correlacionados ao span ativo.
- **Workspace-scoped label**: label Prometheus `workspace_id` restrito aos 5 endpoints críticos para controlar cardinalidade.

## 13. Resolução das 10 questões abertas do v1

| # | Questão v1 | Decisão v2 | Justificativa |
|---|------------|------------|---------------|
| 13.1 | slog vs zap | **slog** | stdlib, zero dep, volume <100 req/s torna perf irrelevante, bridge `otelslog` oficial disponível |
| 13.2 | `/metrics` port separada vs basic auth | **Port `:9090` bind `127.0.0.1`** | mais seguro, sem expor via Fly router, sem manutenção de creds basic auth |
| 13.3 | OTLP HTTP vs gRPC | **HTTP** | sem TLS cert dance, mais simples atravessar proxies, overhead irrelevante no volume atual |
| 13.4 | Backup drill dedicado vs ephemeral | **Ephemeral** via `fly postgres restore --name laura-drill-<ts>` + destroy na mesma execução | $0 extra, drill quinzenal <10min cabe no free tier, guard de prefixo mitiga R6 |
| 13.5 | `TracesSampleRate` | **1.0 MVP, parametrizado via `SENTRY_TRACES_SAMPLE_RATE`** | volume atual confortável no 10k perf events free; env permite reduzir para 0.3 em minutos se necessário |
| 13.6 | Bridge otelslog in-house vs oficial | **Oficial `go.opentelemetry.io/contrib/bridges/otelslog`** | garante compatibilidade cross-version; código in-house é débito |
| 13.7 | Alertas Sentry UI vs Terraform | **UI no MVP**; Terraform provider **Fase 12+** | evita inflar escopo Fase 11; 3 regras manuais rápidas de configurar; documentadas em `alerts.md` |
| 13.8 | Retention backups 14 vs 30 dias | **30 dias** + 12 semanais + 6 mensais | suficiente, dentro free tier Fly, alinhado SaaS B2B maduro |
| 13.9 | `workspace_id` label universal | **Apenas 5 endpoints críticos** (`/messages/send`, `/llm/chat`, `/webhooks/meta`, `/auth/login`, `/workspaces/sync`); demais usam `workspace_present=bool` | evita cardinality explosion; endpoints críticos são onde diagnóstico per-workspace agrega valor |
| 13.10 | PWA RUM Fase 11 vs 12 | **Fase 12** | mantém Fase 11 focada em backend + errors; RUM requer tuning separado e consome tier Sentry |

## 14. Pré-condições + ordem de implementação (para plan v1)

### 14.1. Pré-condições (assumptions)
- Go 1.26.1 instalado (slog stdlib disponível desde 1.21; bridge `otelslog` requer 1.21+).
- Fiber v2.52+ (middleware `c.UserContext()` estável).
- `pgx` v5 em uso (requerido por `otelpgx`).
- Node 20+ / pnpm para PWA (Next.js 16).
- `flyctl` disponível no runner CI.
- Fase 10 merged (middleware `requestid` + `/health` + `/ready` já presentes).

### 14.2. Ordem de implementação (prerequisite chain)
Plan v1 deve respeitar esta sequência para evitar retrabalho:

1. **slog foundation** (4.1) — base para tudo, propagação via context.
2. **Error response padronizado** (4.5) — depende de slog para logar com nível correto.
3. **Sentry SDK** (4.4) — hooka no slog handler `ERROR`; usa error response padronizado.
4. **Prometheus metrics** (4.2) — independente, mas `workspace_id` label usa context propagado por slog.
5. **OpenTelemetry tracing** (4.3) — bridge `otelslog` depende do logger pronto; `otelpgx` independe.
6. **Health check enriquecido** (4.6) — pode rodar em paralelo com 4.4-4.5 (sem dependência).
7. **Backup automation** (4.7) — depende de métricas (4.2) para `backup_last_success_*`.
8. **Alertas** (4.8) — depende de Sentry (4.4) + deploy workflows existentes.
9. **Dashboards Grafana** (4.9) — depende de métricas (4.2) disponíveis.
10. **Docs ops** (4.10) — última, consolida todo o resto.

Commits atômicos por item. Cada item tem DoD parcial próprio (subset do DoD global).

### 14.3. Checkpoints sugeridos
- Checkpoint A: itens 1-3 concluídos → rodar smoke local `_debug/panic`.
- Checkpoint B: itens 4-6 concluídos → validar `/metrics`, `/ready`, trace pgx.
- Checkpoint C: itens 7-10 concluídos → PR final com DoD global verde.

## 15. Checklist consolidado de entregas

### Logger (slog + context)
- [ ] `internal/obs/logger.go` com handler JSON prod / texto dev
- [ ] `internal/obs/context.go` com keys tipadas + helpers
- [ ] Bridge `otelslog` integrado
- [ ] Middleware Fiber injeta logger em `c.Locals` e `c.UserContext`
- [ ] Zero `log.Printf` em `internal/`

### Metrics (Prometheus)
- [ ] `internal/obs/metrics.go` com collectors custom
- [ ] Middleware `fiberprometheus` registrado
- [ ] Endpoint `/metrics` em `127.0.0.1:9090`
- [ ] `workspace_id` label nos 5 endpoints críticos
- [ ] Métricas `laura_backup_last_*` populadas pelo handler ops

### Tracing (OpenTelemetry)
- [ ] `internal/obs/tracer.go` com OTLP/HTTP exporter + NoOp fallback
- [ ] `otelpgx` wrap no pool Postgres
- [ ] Spans manuais em `llm.Call`, `whatsmeow.OnMessage`, cron jobs, backup worker
- [ ] `trace_id`/`span_id` em logs via bridge

### Errors (Sentry + error response)
- [ ] `internal/obs/sentry.go` init + fiber middleware + panic recovery
- [ ] `SENTRY_TRACES_SAMPLE_RATE` parametrizado (default 1.0)
- [ ] `internal/obs/errors.go` + `error_codes.go`
- [ ] Catch-all ErrorHandler Fiber normaliza panics
- [ ] PWA `@sentry/nextjs` configs + `withSentryConfig` + source maps
- [ ] PWA `lib/api/client.ts` parseia `error.code`

### Health check
- [ ] `/health` retorna `version`/`build_time`/`uptime_seconds`
- [ ] `-ldflags` injeta `main.version`/`main.buildTime` no Dockerfile
- [ ] `/ready` retorna per-check com `ok|degraded|fail`
- [ ] Timeout 500ms por check com `errgroup`

### Backup
- [ ] Handler `POST /api/ops/backup` autenticado (`X-Ops-Token`)
- [ ] Fly Machines schedule cron externo 0 3 * * *
- [ ] `scripts/backup-prune.sh` retention 30d + 12s + 6m
- [ ] Workflow `.github/workflows/backup-drill.yml` cron `0 4 */14 * *`
- [ ] Drill ephemeral + guard prefixo `laura-drill-*`

### Alertas
- [ ] Sentry 3 regras configuradas via UI + documentadas em `alerts.md`
- [ ] `notify-slack` step em `deploy-api.yml` + `deploy-pwa.yml`
- [ ] Pool exhaustion warn em `WARN` + `CaptureMessage`
- [ ] LLM timeout > 10s métrica + warn

### Dashboards
- [ ] `docs/ops/grafana-dashboards/go-runtime.json`
- [ ] `docs/ops/grafana-dashboards/postgres.json`
- [ ] `docs/ops/grafana-dashboards/http-laura.json`
- [ ] `docs/ops/grafana-dashboards/whatsmeow-llm.json`
- [ ] `docs/ops/grafana-dashboards/README.md`

### Docs
- [ ] `docs/ops/observability.md` expandido (diagrama + correlação + códigos)
- [ ] `docs/ops/runbooks/incident-response.md`
- [ ] `docs/ops/runbooks/error-debugging.md`
- [ ] `docs/ops/alerts.md`

### Tests
- [ ] Unit `obs/errors_test.go`, `logger_test.go`, `metrics_test.go`, `tracer_test.go`, `sentry_test.go`, `context_test.go`
- [ ] Integration `health_test.go`, `metrics_test.go`, `sentry_test.go`, `error_shape_test.go`, `tracing_test.go`, `backup_test.go`
- [ ] E2E Playwright `observability.spec.ts`, `error-shape.spec.ts`
- [ ] Cobertura `internal/obs/*` ≥ 70%
- [ ] Smoke pós-deploy documentado

---

**Fim Spec v2.** Próximo passo: `superpowers:writing-plans` produz plan v1 seguindo ordem de implementação (seção 14.2), commits atômicos por item, DoD parcial por checkpoint.
