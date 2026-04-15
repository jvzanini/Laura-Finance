# Coverage Roadmap

## Histórico

- **Fase 12:** gate soft 5% (baseline ~12%).
- **Fase 13:** gate soft 12.5% (baseline 13.6%).
- **Fase 14:** gate 15% (baseline pós-test adicional: 16.6%). Meta 30% adiada para Fase 15.

## Meta Fase 15

- **Hard gate 30%** via integration tests completos:
  - testcontainers pgvector + redis (já setup parcial em Fase 13-14).
  - Handlers HTTP reais instanciando Fiber + stack completa.
- **Prioridade por pacote** (coverage atual):
  - `internal/handlers/*` — atual <5% em muitos arquivos. Alvo primário.
  - `internal/obs/middleware.go`, `scope_middleware.go`, `metrics_workspace.go` — 0%.
  - `internal/bootstrap/app.go` (NewFiberApp), `db.go` (InitDB), `migrations.go` (RunMigrations) — 0%.
  - `internal/cache/redis.go` — 0% (coberto apenas em integration com Redis real).

## Estratégia

1. Subir testcontainers Redis (já disponível via `testutil.SharedRedisURL`).
2. Subir testcontainers Postgres pgvector para handlers que dependem de DB.
3. Criar helper `handlers/testutil.go` que instancia Fiber app completa com deps injetadas.
4. Cobrir 1 handler por domínio (banking, transactions, categorization, etc).

## Testes adicionados em Fase 14

- `internal/obs/metrics_custom_test.go` — Observe* functions (no-panic smoke).
- `internal/obs/logger_levels_test.go` — levelFromEnv + NewLogger variants.
- `internal/cache/memory_test.go` — Ping + GetMiss.
