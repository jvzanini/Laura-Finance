# Fase 11 — Observabilidade completa + Telemetria (Spec v1)

> Versão: v1 (rascunho inicial)
> Data: 2026-04-15
> Autor: agente autônomo
> Status: aguardando review #1

---

## 1. Objetivo

Elevar o stack Laura Finance (backend Go `laura-go` + PWA Next.js `laura-pwa`) do nível atual de observabilidade "healthcheck + request-id" (entregue na Fase 10) para um patamar production-grade que permita, em produção:

1. **Diagnosticar** qualquer incidente em menos de 5 minutos a partir de um `request_id` (log structured → trace → erro Sentry → métrica Prometheus correlata).
2. **Medir** latência, throughput e saúde de cada dependência externa (Postgres, whatsmeow, LLM provider, WhatsApp Business API) com granularidade por rota.
3. **Alertar** proativamente antes que usuários percebam degradação (threshold de erro, pool exhaustion, latência LLM, fila de webhooks atrasada).
4. **Rastrear** distribuídamente um request que entra no PWA, viaja até o Go API, percorre queries pgx e uma chamada LLM, e volta, com spans correlacionados.
5. **Recuperar** dados de uma falha catastrófica com backup automatizado + drill quinzenal validando o restore.

O entregável final da Fase 11 é um sistema onde um incidente em produção é diagnosticado por logs + traces + métricas correlacionados pelo mesmo `request_id`, com alerta tendo chegado antes do primeiro usuário reportar.

## 2. Contexto e motivação (o que falta após Fase 10)

A Fase 10 (commits `9013be7..7154914`) entregou o alicerce de infra + CI/CD:

| Item | Status Fase 10 |
|------|----------------|
| Pipelines go-ci / pwa-ci / playwright / security / deploy-api STANDBY / deploy-pwa STANDBY | entregue |
| Dockerfile distroless + embed migrations | entregue |
| `fly.toml` single-machine + healthchecks `/health` e `/ready` | entregue |
| Middleware `requestid` (X-Request-Id UUIDv4) | entregue |
| Logger Fiber JSON em production | entregue (apenas camada HTTP) |
| Handler `/ready` com `db.Ping` | entregue |
| Runbooks rollback + secrets-rotation | entregue |
| E2E expandido (8 specs, fixture auth, seed-e2e.sh) | entregue |

Gaps remanescentes que impedem operar com confiança:

| Gap | Impacto em produção |
|-----|---------------------|
| `log.Printf` em todo `internal/` | Impossível correlacionar logs ao `request_id` do header. Sem níveis, sem structured fields. |
| Sem endpoint `/metrics` | Grafana cego. Impossível alertar por threshold de latência/erro. |
| Sem tracing OpenTelemetry | Debug de latência cross-component (API→DB→LLM) é tentativa e erro. |
| Sem Sentry Go + Next | Erros 500 escondidos até alguém reclamar. Sem stack trace agregado. |
| Error responses inconsistentes | Cada handler retorna shape diferente, dificulta tooling front-end e observabilidade. |
| `/ready` binário (ok/fail) | Não diferencia "DB down" de "LLM fora" nem mostra versão do build. |
| Backup manual | `fly postgres backup` rodado ad-hoc. Sem retenção formal. Sem drill de restore. Dependência de memória humana. |
| Sem alertas | Deploy falha silencioso, pool exhaustion passa despercebido, 5xx acumulam sem notificação. |
| Sem dashboards | Grafana Cloud não provisionado. Métricas Fly não exploradas. |
| Documentação operacional rasa | Não existe `incident-response.md` nem `error-debugging.md`. |

Sem essa camada, o risco de incidente sem detecção + sem restauração rápida é alto, e o tempo médio de diagnóstico tende a subir conforme o sistema cresce em superfície (WhatsApp + LLM + jobs cron).

## 3. Escopo

### 3.1. Dentro do escopo (Fase 11)

1. Logger application-level `slog` (Go 1.21+) substituindo `log.Printf` em `internal/`.
2. Propagação de `request_id` via `context.Context` até camada de domain/infra.
3. Métricas Prometheus via `prometheus/client_golang` + endpoint `/metrics` em port interno separado.
4. Middleware `fiberprometheus` para HTTP count/latency/errors por rota.
5. Métricas custom: pgxpool stats, whatsmeow connection state, cron duration, LLM provider latency.
6. OpenTelemetry SDK (`go.opentelemetry.io/otel`) + tracer provider configurável via `OTEL_EXPORTER_OTLP_ENDPOINT`.
7. Spans em handlers HTTP, queries pgx, chamadas LLM, eventos whatsmeow.
8. Sentry backend (`getsentry/sentry-go`) + middleware Fiber + captura de panic.
9. Sentry PWA (`@sentry/nextjs`) + auto-instrumentation + source maps upload no build.
10. Error response padronizado `{error:{code,message,request_id}}` + helper central `respondError`.
11. `/ready` enriquecido com detalhes por dependência + versão do build em `/health` via `-ldflags`.
12. Backup automation: cron job interno em `laura-go` ou Fly Machines schedule + retention policy + script drill.
13. Alertas Sentry (thresholds) + Slack webhook STANDBY para deploy fail + pool exhaustion log/warning.
14. Dashboards Grafana: exportar JSON de dashboards padrão (Go runtime, Postgres, HTTP) para `docs/ops/grafana-dashboards/`.
15. Documentação operacional: expandir `docs/ops/observability.md` + novos runbooks.

### 3.2. Fora do escopo (Fase 12+)

1. Web Vitals PWA via OTel Web SDK (front-end RUM).
2. Log aggregation (Loki, Datadog, Logtail) — por enquanto apenas stdout + Fly logs.
3. APM comercial (New Relic, Datadog APM).
4. SLO formais (error budgets, burn rate).
5. Chaos engineering / fault injection.
6. Custom Grafana dashboard cross-tenant por workspace (precisa de tags em todas as métricas, deixar para fase dedicada).
7. Distributed tracing do WhatsApp Business Cloud API (sem hooks externos disponíveis).
8. Integração PagerDuty automatizada (STANDBY, rotina humana 24x7 não existe ainda).
9. On-call rotation docs.

## 4. Pendências detalhadas

### 4.1. Logger application-level structured (slog padrão Go 1.21+)

- **Estado atual:** `log.Printf`/`log.Println` espalhados em `internal/app`, `internal/whatsapp`, `internal/llm`, `internal/cron`, `internal/repo`. Formato texto, sem níveis, sem campos estruturados, sem correlação ao `request_id` do middleware Fiber.
- **Ação proposta:**
  1. Introduzir `internal/obs/logger.go` com `slog.New(slog.NewJSONHandler(os.Stdout, opts))` em produção e `slog.NewTextHandler` em dev (via `APP_ENV`).
  2. Níveis: `DEBUG` (dev only), `INFO` (default), `WARN` (degradação), `ERROR` (falha + envio Sentry).
  3. Atributos obrigatórios em cada log: `request_id`, `workspace_id` (quando disponível), `user_id` (quando disponível), `action` (nome lógico da operação).
  4. Middleware Fiber `obs.Logger()` injeta `*slog.Logger` no `c.Locals("logger")` já com `request_id` pré-preenchido.
  5. Helper `obs.FromCtx(ctx) *slog.Logger` recupera logger a partir de `context.Context` para uso em camadas profundas.
  6. Script `scripts/migrate-log-printf.sh` (sed + review manual) para substituir ocorrências.
- **Arquivos afetados:**
  - Novos: `laura-go/internal/obs/logger.go`, `laura-go/internal/obs/context.go`.
  - Alterados: `laura-go/cmd/api/main.go`, `laura-go/internal/app/router.go`, todos os arquivos em `internal/{app,whatsapp,llm,cron,repo}` com `log.Printf`.
- **Libs/comandos:** stdlib `log/slog` (Go 1.21+). Nenhuma dependência externa adicional.
- **Dependências externas (STANDBY):** nenhuma.
- **Tempo estimado:** 4h (incluindo revisão de ~40 call sites).

### 4.2. Métricas Prometheus

- **Estado atual:** zero métricas expostas. Fly mostra CPU/memória do host mas nada application-level.
- **Ação proposta:**
  1. Adicionar `github.com/prometheus/client_golang` + `github.com/ansrivas/fiberprometheus/v2`.
  2. Endpoint `/metrics` servido em **port 9090** separado (`app.Listen(":9090")` em goroutine) para evitar exposição externa via Fly router; apenas rede interna Fly.
  3. Middleware `fiberprometheus.New("laura_api")` em `cmd/api/main.go` registra `http_requests_total`, `http_request_duration_seconds`, `http_requests_in_flight` por rota + status.
  4. Collectors custom em `internal/obs/metrics.go`:
     - `pgxpool_acquire_count`, `pgxpool_idle_conns`, `pgxpool_total_conns` (de `pool.Stat()`).
     - `whatsmeow_connected{workspace_id}` gauge 0/1.
     - `cron_job_duration_seconds{job}` histogram.
     - `llm_call_duration_seconds{provider,model}` histogram + `llm_call_errors_total{provider,reason}`.
  5. Registry default Prometheus, sem namespace forçado além do prefixo `laura_`.
- **Arquivos afetados:**
  - Novos: `laura-go/internal/obs/metrics.go`.
  - Alterados: `laura-go/cmd/api/main.go`, `laura-go/internal/cron/*.go`, `laura-go/internal/llm/*.go`, `laura-go/internal/whatsapp/client.go`.
  - Config: `laura-go/fly.toml` (não expor port 9090 externamente).
- **Libs/comandos:**
  - `go get github.com/prometheus/client_golang@latest`
  - `go get github.com/ansrivas/fiberprometheus/v2@latest`
- **Dependências externas (STANDBY):** nenhuma imediata. Em produção, scraper precisará de `STANDBY [GRAFANA-CLOUD]` agent para puxar `/metrics`.
- **Tempo estimado:** 3h.

### 4.3. Tracing OpenTelemetry

- **Estado atual:** zero spans. Impossível ver cadeia "HTTP → DB → LLM".
- **Ação proposta:**
  1. SDK `go.opentelemetry.io/otel` + exporter OTLP HTTP (`otlptracehttp`).
  2. Tracer provider configurado em `internal/obs/tracer.go` lendo `OTEL_EXPORTER_OTLP_ENDPOINT` (se vazio, NoOp tracer, não quebra dev/CI).
  3. `OTEL_SERVICE_NAME=laura-api`, `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<APP_ENV>,service.version=<BUILD_SHA>`.
  4. Middleware Fiber `otelfiber` ou implementação manual que abre span root por request usando `request_id` como atributo.
  5. Instrumentar pgx via `go.nhat.io/otelsql` ou `github.com/exaring/otelpgx` (preferência: `otelpgx` nativo pgx v5).
  6. Spans manuais em chamadas LLM (`llm.Call`) com atributos `llm.provider`, `llm.model`, `llm.tokens_in/out`.
  7. Span em handler whatsmeow `OnMessage` com `wa.jid`, `wa.msg_type`.
  8. Correlação logger↔trace: `slog` handler customizado que inclui `trace_id` e `span_id` quando presentes no context.
- **Arquivos afetados:**
  - Novos: `laura-go/internal/obs/tracer.go`, `laura-go/internal/obs/slog_otel_handler.go`.
  - Alterados: `laura-go/cmd/api/main.go`, `laura-go/internal/repo/db.go` (wrap pool com otelpgx), `laura-go/internal/llm/*.go`, `laura-go/internal/whatsapp/client.go`.
- **Libs/comandos:**
  - `go get go.opentelemetry.io/otel@latest`
  - `go get go.opentelemetry.io/otel/sdk@latest`
  - `go get go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp@latest`
  - `go get github.com/exaring/otelpgx@latest`
- **Dependências externas (STANDBY):** `STANDBY [OTEL-COLLECTOR]` (endpoint do collector — Grafana Cloud Tempo, Honeycomb, ou self-hosted). Em Fase 11 deixamos o código pronto e NoOp por default.
- **Tempo estimado:** 5h.

### 4.4. Sentry SDK

- **Estado atual:** panics em Go são logadas com stack trace no stdout Fly e perdidas. No PWA, erros client-side ficam apenas no devtools do usuário.
- **Ação proposta (backend Go):**
  1. `getsentry/sentry-go` + `sentry-go/fiber` middleware.
  2. Init em `cmd/api/main.go` lendo `SENTRY_DSN` (STANDBY). Se vazio, SDK roda NoOp.
  3. `TracesSampleRate: 0.1` prod, `1.0` dev; `EnableTracing: true`.
  4. Integração com slog: nível `ERROR` dispara `sentry.CaptureException(err)` via handler customizado.
  5. Middleware captura panic + enriquece scope com `request_id`, `workspace_id`, `user_id`.
- **Ação proposta (PWA Next.js):**
  1. `@sentry/nextjs` + wizard `npx @sentry/wizard@latest -i nextjs`.
  2. `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
  3. `next.config.ts` wrap com `withSentryConfig` para source maps upload.
  4. DSN via env (`NEXT_PUBLIC_SENTRY_DSN` — STANDBY).
  5. Auth token `SENTRY_AUTH_TOKEN` (STANDBY) usado só no build CI.
- **Arquivos afetados:**
  - Novos Go: `laura-go/internal/obs/sentry.go`.
  - Alterados Go: `laura-go/cmd/api/main.go`, `laura-go/internal/app/router.go`, `laura-go/internal/obs/logger.go`.
  - Novos PWA: `laura-pwa/sentry.{client,server,edge}.config.ts`, `laura-pwa/.sentryclirc.example`.
  - Alterados PWA: `laura-pwa/next.config.ts`, `laura-pwa/package.json`.
- **Libs/comandos:**
  - `go get github.com/getsentry/sentry-go@latest`
  - `go get github.com/getsentry/sentry-go/fiber@latest`
  - `pnpm add @sentry/nextjs` (no diretório `laura-pwa`)
- **Dependências externas (STANDBY):** `STANDBY [SENTRY-DSN]` (projeto Go + projeto Next — 2 DSNs distintos), `STANDBY [SENTRY-AUTH-TOKEN]`.
- **Tempo estimado:** 4h.

### 4.5. Error response padronizado

- **Estado atual:** cada handler retorna shape diferente. Alguns `{error:"msg"}`, outros `{message:...}`, outros texto puro. PWA não consegue montar UI consistente; logs ficam ruidosos.
- **Ação proposta:**
  1. Definir contrato único: `{ "error": { "code": "STRING_CANONICAL", "message": "texto PT-BR", "request_id": "uuid" } }`.
  2. Helper central `obs.RespondError(c *fiber.Ctx, code string, status int, err error)` em `internal/obs/errors.go`.
  3. Catálogo de códigos em `internal/obs/error_codes.go`:
     - `VALIDATION_FAILED` (400), `AUTH_INVALID` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500), `DEPENDENCY_DOWN` (503), `WA_OFFLINE` (503), `LLM_UNAVAILABLE` (503), `DB_ERROR` (500).
  4. Mapear erros conhecidos: `pgx.ErrNoRows` → `NOT_FOUND`, `context.DeadlineExceeded` → `DEPENDENCY_DOWN`, `validator.ValidationErrors` → `VALIDATION_FAILED`.
  5. `RespondError` loga em nível apropriado (`WARN` < 500, `ERROR` >= 500) e envia a Sentry se `status >= 500`.
  6. Middleware Fiber final catch-all `ErrorHandler` normaliza panics e erros não-tratados.
- **Arquivos afetados:**
  - Novos: `laura-go/internal/obs/errors.go`, `laura-go/internal/obs/error_codes.go`.
  - Alterados: todos handlers em `laura-go/internal/app/handlers/` (estimativa 20 arquivos).
  - Alterados PWA: `laura-pwa/lib/api/client.ts` passa a parsear `error.code`.
- **Libs/comandos:** nenhuma nova.
- **Dependências externas (STANDBY):** nenhuma.
- **Tempo estimado:** 4h.

### 4.6. Health check enriquecido + versão de build

- **Estado atual:** `/health` retorna `200 OK` hardcoded. `/ready` retorna `200` se `db.Ping` ok, `503` caso contrário, sem corpo detalhado.
- **Ação proposta:**
  1. `/health` retorna `{ "status": "ok", "version": "<short-sha>", "build_time": "<ISO>", "uptime_seconds": N }`.
  2. Versão injetada via `-ldflags "-X main.version=$(git rev-parse --short HEAD) -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"` no Dockerfile + workflow.
  3. `/ready` retorna `{ "status": "ok|degraded|fail", "checks": { "db": {...}, "whatsmeow": {...}, "llm": {...} } }` com cada check reportando `{ok, latency_ms, error?}`.
  4. Regras: `db` FAIL → overall `fail` (503); `whatsmeow` down → `degraded` (200, pois API HTTP continua útil sem WA); `llm` down → `degraded` (200).
  5. Timeout curto (500ms) por check, paralelizado com `errgroup`.
- **Arquivos afetados:**
  - Alterados: `laura-go/cmd/api/main.go` (ldflags via build), `laura-go/internal/app/handlers/health.go`, `laura-go/Dockerfile`, `.github/workflows/deploy-api.yml`.
- **Libs/comandos:** `golang.org/x/sync/errgroup` (já transitivo provavelmente).
- **Dependências externas (STANDBY):** nenhuma.
- **Tempo estimado:** 2h.

### 4.7. Backup automation

- **Estado atual:** `fly postgres backup create` rodado manualmente em momentos ad-hoc. Sem retenção documentada. Sem drill de restore. Sem monitoramento.
- **Ação proposta:**
  1. Cron job via `robfig/cron` (já presente) em `laura-go/internal/cron/backup.go` que dispara `fly postgres backup create -a <cluster>` via `exec.Command` ou via API `flyctl` se disponível — **alternativa preferida**: Fly Machines schedule externo chamando `/api/ops/backup` autenticado (mais simples e testável localmente).
  2. Schedule: daily 03:00 UTC (low traffic).
  3. Retention policy: 30 backups diários + 12 semanais (`sunday`) + 6 mensais (`first-of-month`). Gerenciado via script `scripts/backup-prune.sh` rodando após criar novo.
  4. Drill restore: script `scripts/backup-restore-drill.sh` quinzenal em CI agendado (workflow `backup-drill.yml` cron `0 4 */14 * *`) que:
     - Clona o backup mais recente para instância temporária Fly Postgres `laura-drill`.
     - Roda `migrate status` + query sanity `SELECT count(*) FROM users;`.
     - Destroi instância.
     - Reporta sucesso/falha no Slack (STANDBY).
  5. Métricas: `backup_last_success_timestamp_seconds` + `backup_last_size_bytes` expostas em `/metrics`.
- **Arquivos afetados:**
  - Novos: `laura-go/internal/cron/backup.go`, `laura-go/scripts/backup-prune.sh`, `laura-go/scripts/backup-restore-drill.sh`, `.github/workflows/backup-drill.yml`.
  - Alterados: `laura-go/internal/cron/scheduler.go`.
- **Libs/comandos:** `flyctl` CLI (em CI), `pg_dump` (opção fallback local).
- **Dependências externas (STANDBY):** `STANDBY [FLY-API-TOKEN-BACKUP]` (token com escopo mínimo para backup/restore), `STANDBY [SLACK-WEBHOOK]` para notificação.
- **Tempo estimado:** 5h.

### 4.8. Alertas

- **Estado atual:** nenhum alerta. Deploy pode falhar silenciosamente (depende de alguém abrir o GitHub), erros 500 acumulam.
- **Ação proposta:**
  1. Sentry alert rules (configurado via Terraform ou UI — manual OK em Fase 11):
     - `rate(errors) > 5/5min` → e-mail + Slack.
     - `new issue in production` → Slack.
     - `performance regression p95 > 2s` → e-mail.
  2. GitHub Actions: step `notify-slack` em `deploy-api.yml` e `deploy-pwa.yml` usando `slackapi/slack-github-action` que posta em `STANDBY [SLACK-WEBHOOK]` quando `failure()`.
  3. Pool exhaustion: quando `pgxpool.Stat().AcquireCount / TotalConns > 0.9`, logger emite `WARN` + `sentry.CaptureMessage` com contexto.
  4. LLM timeout: quando `llm.Call` excede 10s, logger `WARN` + métrica `llm_timeouts_total` incrementada.
- **Arquivos afetados:**
  - Alterados: `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-pwa.yml`.
  - Novos: `docs/ops/alerts.md` com lista de regras Sentry (manual config).
- **Libs/comandos:** `slackapi/slack-github-action@v1`.
- **Dependências externas (STANDBY):** `STANDBY [SLACK-WEBHOOK]`, `STANDBY [SENTRY-DSN]`, `STANDBY [PAGERDUTY]` (opcional, futuro).
- **Tempo estimado:** 2h.

### 4.9. Dashboards Grafana

- **Estado atual:** nenhum dashboard.
- **Ação proposta:**
  1. Exportar dashboards padrão JSON para `docs/ops/grafana-dashboards/`:
     - `go-runtime.json` (heap, GC, goroutines) — base do dashboard oficial Grafana ID 10826.
     - `postgres.json` (connections, cache hit, locks) — ID 9628.
     - `http-laura.json` (request rate, p50/p95/p99, error rate por rota) — custom baseado nas métricas `fiberprometheus`.
     - `whatsmeow-llm.json` (conn state, LLM latency por provider) — custom.
  2. README em `docs/ops/grafana-dashboards/README.md` explicando import manual via Grafana Cloud.
  3. Provisioning automático fica STANDBY até credencial Grafana Cloud estar disponível.
- **Arquivos afetados:**
  - Novos: `docs/ops/grafana-dashboards/*.json`, `docs/ops/grafana-dashboards/README.md`.
- **Libs/comandos:** `grafonnet` opcional; exportação manual a partir de Grafana.com como baseline.
- **Dependências externas (STANDBY):** `STANDBY [GRAFANA-CLOUD]`.
- **Tempo estimado:** 3h (curadoria + customização dashboards HTTP/WA).

### 4.10. Documentação operacional

- **Estado atual:** `docs/ops/observability.md` existe com placeholder mínimo. Sem runbook de incident response nem debugging.
- **Ação proposta:**
  1. Expandir `docs/ops/observability.md` com:
     - Diagrama arquitetural (logs stdout → Fly; métricas /metrics → Grafana; traces OTLP → Tempo; erros → Sentry).
     - Como correlacionar `request_id` entre camadas.
     - Tabela de códigos de erro canônicos.
  2. Novo `docs/ops/runbooks/incident-response.md`:
     - Severidade (SEV1/2/3).
     - Primeiros 5 minutos (checar `/ready`, logs, Sentry).
     - Escalada (quem chamar — STANDBY enquanto não houver rotation).
     - Post-mortem template.
  3. Novo `docs/ops/runbooks/error-debugging.md`:
     - Workflow: error code → grep logs por `request_id` → Sentry issue → trace Tempo → query Grafana.
     - Casos comuns: 503 DEPENDENCY_DOWN, 500 DB_ERROR, 500 LLM_UNAVAILABLE.
- **Arquivos afetados:**
  - Alterados: `docs/ops/observability.md`.
  - Novos: `docs/ops/runbooks/incident-response.md`, `docs/ops/runbooks/error-debugging.md`.
- **Libs/comandos:** nenhuma.
- **Dependências externas (STANDBY):** nenhuma.
- **Tempo estimado:** 3h.

## 5. Decisões de arquitetura

### 5.1. slog vs zap vs zerolog

**Recomendação: `slog` (stdlib Go 1.21+).**

- **Prós:** zero dependência externa, API estável, handler JSON nativo, suporte a `context` via `slog.InfoContext`, futuro-provado (tende a virar padrão do ecossistema).
- **Contras vs zap:** marginalmente mais lento em benchmarks (~20%) para volumes extremos (>100k logs/s). Não é nosso caso.
- **Contras vs zerolog:** API menos fluente.
- **Decisão:** a perda de performance é irrelevante para Laura Finance (esperamos < 100 req/s em horizonte 12 meses). Ganho de "stdlib, sem dep" supera.

### 5.2. Prometheus vs OpenTelemetry metrics

**Recomendação: Prometheus para métricas, OTel apenas para traces (por enquanto).**

- OTel metrics SDK ainda tem UX inferior e menos ecosistema de dashboards prontos.
- Prometheus + Grafana é padrão da indústria, dashboards gratuitos no Grafana.com.
- OTel traces são maduros e não há alternativa comparável.
- **Decisão:** manter separação. Migrar métricas para OTel quando Grafana Cloud ingest OTLP for first-class e tivermos bandwidth para mudar dashboards.

### 5.3. Sentry vs Bugsnag vs Rollbar

**Recomendação: Sentry.**

- **Prós:** tier gratuito 5k events/mês (suficiente para volume atual), SDKs maduros Go + Next.js, integração com Slack/GitHub.
- **Contras:** preço escala rápido se volume crescer (>50k events/mês custa $26/mês).
- **Decisão:** Sentry. Se ultrapassarmos tier, revisar em Fase 12+.

### 5.4. `/metrics` público vs interno

**Recomendação: bind em port `:9090` separado, **não** exposto via Fly router.**

- Evita vazamento de métricas potencialmente sensíveis (ex: `workspace_id` em labels).
- Permite scraper interno (Grafana Agent rodando como sidecar) acessar via `localhost:9090`.
- Fly só expõe `:8080` (API pública) externamente via `[[services]]`.
- **Trade-off:** enquanto não houver agent sidecar, `/metrics` fica inacessível. Aceitável: a fase atual não tem Grafana Cloud ainda.

### 5.5. Source maps PWA

**Recomendação: upload automático via `withSentryConfig` no build do GitHub Actions.**

- Sem source maps, stack traces em prod são ilegíveis (variáveis minificadas `t`, `a`, `e`).
- `withSentryConfig` gera e deleta source maps localmente, enviando para Sentry API no build.
- Requer `SENTRY_AUTH_TOKEN` como secret CI — STANDBY.

### 5.6. Custos esperados

| Serviço | Plano | Custo mensal |
|---------|-------|--------------|
| Sentry | Developer (5k events) | $0 |
| Grafana Cloud | Free (10k series, 50 GB logs, 50 GB traces) | $0 |
| Fly backups | incluído no Postgres | $0 extra |
| Slack webhook | Free workspace | $0 |
| PagerDuty | STANDBY | - |
| **Total Fase 11** | | **$0** |

Premissa: volume atual < limites free tier. Reavaliar em Fase 12 quando tivermos métricas reais.

## 6. Pré-requisitos / dependências externas (STANDBY)

- `STANDBY [SENTRY-DSN]` — projeto Go (`laura-api`).
- `STANDBY [SENTRY-DSN-PWA]` — projeto Next (`laura-pwa`).
- `STANDBY [SENTRY-AUTH-TOKEN]` — upload de source maps no build CI.
- `STANDBY [SLACK-WEBHOOK]` — alertas deploy fail + drill backup.
- `STANDBY [GRAFANA-CLOUD]` — token + URL stack para provisioning dashboards.
- `STANDBY [OTEL-COLLECTOR]` — endpoint OTLP HTTP (Grafana Cloud Tempo ou Honeycomb).
- `STANDBY [FLY-API-TOKEN-BACKUP]` — token scoped para `machines:write` + `postgres:backup` usado no workflow `backup-drill.yml`.
- `STANDBY [PAGERDUTY]` — opcional, Fase 12+.

Todas as dependências STANDBY devem ter código correspondente no-op / log-only quando env vazia, garantindo que dev + CI rodem sem segredo.

## 7. Critérios de aceite (DoD)

1. `go test ./...` em `laura-go` passa verde (incluindo novos testes de `obs/logger`, `obs/errors`, `obs/metrics`).
2. `pnpm test` em `laura-pwa` passa verde; build PWA gera source maps e (quando `SENTRY_AUTH_TOKEN` presente) faz upload — em CI sem token, build não falha.
3. `curl http://localhost:9090/metrics` retorna corpo Prometheus válido com métricas `laura_http_requests_total`, `laura_pgxpool_idle_conns`, `laura_llm_call_duration_seconds` presentes.
4. `curl http://localhost:8080/health` retorna JSON com `version` preenchida por ldflags.
5. `curl http://localhost:8080/ready` retorna JSON com chaves `checks.db`, `checks.whatsmeow`, `checks.llm`.
6. Erro intencional em rota de teste `/api/_debug/panic` (gated por `APP_ENV=dev`) dispara captura Sentry (quando DSN presente) + log `ERROR` com `request_id`.
7. Response de erro em qualquer rota segue shape `{error:{code,message,request_id}}`.
8. `grep -r "log.Printf" laura-go/internal/` retorna zero linhas.
9. `scripts/backup-restore-drill.sh` executa localmente (com `flyctl` mockado) sem erro.
10. Documentos `docs/ops/observability.md`, `docs/ops/runbooks/incident-response.md`, `docs/ops/runbooks/error-debugging.md` completos e sem `TBD`.
11. Dashboards JSON presentes em `docs/ops/grafana-dashboards/` e README explica import.
12. CI workflows `go-ci`, `pwa-ci`, `playwright`, `security` permanecem verdes.
13. Fase rodando em produção via `deploy-api` (STANDBY ainda OK — não bloqueante para merge da Fase 11).

## 8. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Migração `log.Printf` → `slog` quebra formato esperado por algum consumidor externo (grep manual). | baixa | baixo | Aviso em runbook + commit atômico reversível. |
| R2 | `fiberprometheus` diverge de API estável do Fiber v2 quando upgrade Fiber v3 chegar. | média | médio | Isolar em `internal/obs/metrics.go`; upgrade futuro troca apenas uma import. |
| R3 | OTel SDK muda breaking entre versões minor. | média | médio | Pinar versão em `go.mod`; revisar quarterly. |
| R4 | Sentry DSN vazar em source maps. | baixa | alto | DSNs client-side são públicas por design; garantir que `SENTRY_AUTH_TOKEN` NUNCA vai em bundle. |
| R5 | `/metrics` inacessível sem scraper interno, dando falsa sensação de "não funciona". | média | baixo | Documentar explicitamente em `observability.md` que requer Grafana Agent. |
| R6 | Backup drill destrói por engano instância de produção. | baixíssima | catastrófico | Script usa prefixo `laura-drill-*` hardcoded + validação de nome antes de `destroy`. |
| R7 | Propagação de `request_id` via context quebra em goroutines spawned dentro de handlers. | média | baixo | Lint customizado ou code review para `go func()` dentro de handlers; documentar padrão. |
| R8 | Volume de logs em prod explode por `DEBUG` acidental. | baixa | médio | Env `LOG_LEVEL=info` default; `DEBUG` requer override explícito; alerta se logs > N MB/h. |
| R9 | Overhead de tracing > 5% CPU em produção. | baixa | médio | Sample rate 10% em prod; revisar métrica CPU após rollout. |
| R10 | Dual Sentry DSN (Go + Next) confunde e alguém aponta o errado. | média | baixo | Variáveis com sufixo distintivo (`SENTRY_DSN_API` vs `NEXT_PUBLIC_SENTRY_DSN`). |

## 9. Métricas de sucesso

1. **MTTR diagnóstico** (mean time to root-cause em incidentes): alvo < 10 min após Fase 11. Baseline atual: desconhecido (sem observabilidade).
2. **% requests com `request_id` propagado em logs profundos**: alvo 100%. Baseline: 0%.
3. **Cobertura de instrumentação**: % handlers HTTP com span OTel ativo — alvo 100%.
4. **Erros silenciosos**: erros 500 que **não** aparecem em Sentry — alvo 0% (excluindo dev/test).
5. **Backup drill success rate**: alvo 100% (2/2 drills nos próximos 30 dias pós-Fase 11 com `STANDBY [FLY-API-TOKEN-BACKUP]` resolvido).
6. **Alert noise ratio**: alertas acionáveis / alertas totais — alvo > 80% após primeiros 30 dias.
7. **Overhead**: latência p95 adicionada por instrumentação — alvo < 5ms.

## 10. Plano de testes

### Unit
- `internal/obs/errors_test.go`: `RespondError` com cada code mapeia para status correto + JSON válido; erros `pgx.ErrNoRows` mapeiam para `NOT_FOUND`.
- `internal/obs/logger_test.go`: handler JSON produz linha válida com `request_id`, `level`, `msg`, `time`; handler texto em dev.
- `internal/obs/metrics_test.go`: collectors custom registram métricas esperadas; `pgxpool` stats preenchidas.
- `internal/obs/tracer_test.go`: NoOp tracer ativo quando `OTEL_EXPORTER_OTLP_ENDPOINT` vazio; real tracer quando preenchido.

### Integration
- `test/integration/health_test.go`: `/health` retorna `version` preenchida; `/ready` com DB down retorna 503 + detalhes por check; `/ready` com whatsmeow offline retorna 200 `degraded`.
- `test/integration/metrics_test.go`: `/metrics` na port 9090 retorna corpo Prometheus + métricas esperadas após requests.
- `test/integration/sentry_test.go`: com DSN mock (servidor HTTP local), endpoint `_debug/panic` envia evento com `request_id` no scope.
- `test/integration/error_shape_test.go`: todas as rotas conhecidas retornam shape `{error:{code,message,request_id}}` em cenário de erro.

### E2E
- Playwright `e2e/observability.spec.ts`: request ao PWA → header `X-Request-Id` presente na response → o mesmo ID aparece no log stdout capturado pelo Fly.

### Manual QA pós-deploy
- Disparar erro em `_debug/panic` em staging → verificar Sentry issue.
- Observar `/metrics` via `fly ssh console` + `curl localhost:9090/metrics`.
- Rodar drill backup manualmente uma vez antes de agendar.

---

## Self-review final

- Zero ocorrências de "TBD", "implement later" ou reticências de omissão verificadas manualmente.
- STANDBYs anotadas com prefixo `STANDBY [<id>]` nas seções 4 e 6. Lista consolidada:
  - `STANDBY [SENTRY-DSN]`
  - `STANDBY [SENTRY-DSN-PWA]`
  - `STANDBY [SENTRY-AUTH-TOKEN]`
  - `STANDBY [SLACK-WEBHOOK]`
  - `STANDBY [GRAFANA-CLOUD]`
  - `STANDBY [OTEL-COLLECTOR]`
  - `STANDBY [FLY-API-TOKEN-BACKUP]`
  - `STANDBY [PAGERDUTY]` (opcional, Fase 12+)

### Questões abertas para review #1

1. **Slog vs zap definitivo?** Volume atual justifica stdlib, mas há simpatia do time por zap que pode valer acomodar agora para evitar migração futura se volume crescer?
2. **`/metrics` endpoint — port separada `:9090` ou rota no mesmo port `:8080` protegida por basic auth?** A separada é mais limpa; basic auth em `:8080` exige menos mudança em Fly.
3. **OTel exporter default em prod:** OTLP HTTP ou gRPC? HTTP é mais simples atravessar proxies; gRPC tem menos overhead mas requer cert config.
4. **Backup drill — rodar em cluster `laura-drill` dedicado (custa $5/mês Fly Postgres mínimo) ou restaurar para instância temporária e destruir na mesma execução?** O segundo é grátis mas dobra tempo de drill.
5. **Sentry `TracesSampleRate` 10% produção é suficiente ou queremos 100% com sampling cliente-side stratified?** Tier free pode ser excedido com 100%.
6. **Logger handler customizado para correlacionar `trace_id` — construir in-house ou usar `go.opentelemetry.io/contrib/bridges/otelslog`?** Bridge oficial tem sobrecarga de dependência mas garante compatibilidade.
7. **Alertas Sentry — configurar via UI manual ou Terraform Sentry provider?** Terraform agrega infra-as-code ao escopo, pode inflar Fase 11.
8. **Retention de backups diários: 30 ou 14 dias?** 30 gasta mais storage Fly; 14 é padrão SaaS B2B pequeno. Decidir com base em compliance (nenhum atualmente).
9. **Incluir `workspace_id` como label em métricas Prometheus?** Aumenta cardinalidade (1 série por workspace × rota × status). Alternativa: usar traces/logs para debug por workspace e manter métricas só com `workspace_present=true/false` boolean.
10. **PWA RUM (Web Vitals via `@sentry/nextjs` performance monitoring)** — incluir já na Fase 11 ou adiar Fase 12 conforme escopo 3.2? Se habilitar, consome mais do tier free Sentry.
