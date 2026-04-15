# Grafana dashboards — Laura Finance

> STANDBY [GRAFANA-CLOUD] — dashboards stubs preparados; importar manualmente ao configurar Grafana Cloud.

## Dashboards

- `go-runtime.json` — base ID 10826 (Go runtime).
- `postgres.json` — base ID 9628 (Postgres) + custom `laura_pgxpool_*`.
- `http-laura.json` — custom `laura_api_*` + `laura_http_workspace_*`.
- `whatsmeow-llm.json` — custom `laura_llm_*` + whatsmeow connection.

## Importar

1. Grafana Cloud → Dashboards → Import.
2. Cole o JSON ou arquivo.
3. Selecione datasource Prometheus (scrape de `laura-finance-api.fly.dev:9090`).
4. Save.

## Customização

Cada JSON é stub mínimo. Adapte os panels conforme métricas reais aparecerem em `:9090/metrics`.
