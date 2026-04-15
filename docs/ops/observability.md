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

## Referencias

- `laura-go/main.go` (handlers + middlewares).
- `laura-go/fly.toml` (`[[http_service.checks]]` /health + /ready).
