# Runbook: Migration 000036 apply em prod

> Arquitetura: [#persistência](../../architecture.md#persistência)
> STANDBY [FLY-PG-CREATE]

## Pré-requisitos

- Fly Postgres `laura-finance-db` provisionado (STANDBY [FLY-PG-CREATE]).
- Migration 035 aplicada.

## Procedimento

1. Conectar: `fly postgres connect -a laura-finance-db`.
2. Aplicar: `\i /path/to/000036_open_finance_foundation.up.sql`.
3. Validar: `\dt bank_*` retorna 2 tabelas.
4. Alternativa via worker: `fly secrets set MIGRATE_ON_BOOT=true` e restart app — golang-migrate aplica automaticamente.

## Validação

- `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` retorna 36.

## Rollback

- `migrate -path internal/migrations -database "$DATABASE_URL" down 1`.
