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

## Logs JSON em producao

Logger Fiber emite formato JSON quando `ENVIRONMENT=production`; em
dev, formato texto padrao.

## Referencias

- `laura-go/main.go` (handlers + middlewares).
- `laura-go/fly.toml` (`[[http_service.checks]]` /health + /ready).
