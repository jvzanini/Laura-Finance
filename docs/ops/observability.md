# Observabilidade — Laura Finance

## Endpoints

### `/health` (liveness)
Objetivo: processo vivo. NAO toca DB. Usado pelo Fly para reiniciar
maquina caso o handler trave.
- Path: `/health` (root, registrado em `main.go`).
- Duplicata: `/api/v1/health` (versionado, JSON detalhado).
- Response: 200 `{"status":"ok"}`.

### `/ready` (readiness)
Objetivo: processo pronto para servir trafego. Faz `db.Ping` com
timeout 2s. 503 quando DB indisponivel — Fly remove da rotacao mas
NAO reinicia a maquina.
- Path: `/ready` (root, registrado em `main.go`).
- Response OK: 200 `{"status":"ready","db":"ok"}`.
- Response NOK: 503 `{"status":"not-ready","db":"<erro>"}`.

## Correlacao via X-Request-Id

Middleware `fiber/middleware/requestid` gera UUIDv4 por request e
anexa no header `X-Request-Id` + logs (quando `ENVIRONMENT=production`).

## Logger

Logger application-level: **slog** (stdlib Go 1.21+).

### Formato
- Production (`APP_ENV=production`): JSON via `slog.NewJSONHandler`.
- Development: text via `slog.NewTextHandler`.

### Campos canonicos
- `time` (RFC3339 UTC)
- `level` (DEBUG | INFO | WARN | ERROR)
- `msg` (mensagem livre, em PT-BR)
- `request_id` (UUIDv4, injetado pelo middleware `obs.LoggerMiddleware`)
- `trace_id` / `span_id` (quando OTel ativo — Parte E)
- atributos custom via `slog.Info("msg", "key", value, ...)`

### Como filtrar por request_id

```sh
fly logs -a laura-finance-api | jq 'select(.request_id=="abc123-...")'
```

### Configuracao de nivel

`LOG_LEVEL=debug|info|warn|error` via env var. Default: `info` em prod,
`debug` em dev.

### Arquitetura

- `internal/obs/context.go` — chaves tipadas + helpers `WithRequestID`,
  `RequestIDFromCtx`, `WithLogger`, `FromCtx`.
- `internal/obs/context_handler.go` — wrapper que extrai `request_id` +
  `trace_id`/`span_id` do `context.Context` e anexa em cada registro.
- `internal/obs/logger.go` — `NewLogger(env)` monta chain
  `inner (JSON|Text) -> ContextHandler`.
- `internal/obs/middleware.go` — `LoggerMiddleware(base)` injeta logger
  com `request_id` bound em `c.Locals("logger")` e `c.UserContext()`.

## Metrics

Endpoint: `:9090/metrics` (interno, nao exposto pelo Fly HTTP service).

### Collectors customizados

| Metrica | Tipo | Labels |
|---|---|---|
| `laura_pgxpool_idle_conns` | gauge | - |
| `laura_pgxpool_total_conns` | gauge | - |
| `laura_pgxpool_acquire_count` | gauge | - |
| `laura_pgxpool_query_duration_seconds` | histogram | - |
| `laura_pgxpool_errors_total` | counter | type |
| `laura_llm_call_duration_seconds` | histogram | provider, model |
| `laura_llm_call_errors_total` | counter | provider, reason |
| `laura_llm_timeouts_total` | counter | provider |
| `laura_cron_job_duration_seconds` | histogram | job |
| `laura_backup_last_success_timestamp_seconds` | gauge | - |
| `laura_backup_last_size_bytes` | gauge | - |
| `laura_http_workspace_request_duration_seconds` | histogram | workspace_id, route, status |

### Cardinalidade controlada

`workspace_id` aparece APENAS nos 5 endpoints canonicos:
- `/api/v1/transactions`
- `/api/v1/dashboard`
- `/api/v1/score`
- `/api/v1/reports`
- `/api/v1/auth/login`

Outros endpoints contam apenas pela metrica padrao `laura_api_requests_total{path,method,status}`.

### Inspecao em prod

```sh
fly ssh console -a laura-finance-api -C "wget -qO- 127.0.0.1:9090/metrics | head -40"
```

### Coleta externa (Grafana Cloud — STANDBY [GRAFANA-CLOUD])

Configurar Grafana Agent com `scrape_config` apontando para
`<machine>.internal:9090/metrics`. Ver `docs/ops/grafana-dashboards/`.

## Referencias

- `laura-go/main.go` (handlers + middlewares).
- `laura-go/fly.toml` (`[[http_service.checks]]` /health + /ready, `[metrics]`).
- `laura-go/internal/obs/metrics.go` (metricsApp Fiber :9090).
- `laura-go/internal/obs/metrics_custom.go` (collectors custom).
- `laura-go/internal/obs/metrics_workspace.go` (workspace label middleware).

## Grafana

Dashboards: `docs/ops/grafana-dashboards/` (4 JSONs).

STANDBY [GRAFANA-CLOUD] — importar manualmente após provisionar Grafana Cloud free tier.
