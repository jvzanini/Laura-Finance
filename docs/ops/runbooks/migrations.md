# Migrations runbook

> Arquitetura: [#persistência](../../architecture.md#persistência)

## Aplicar migration em prod
- Set `MIGRATE_ON_BOOT=true` em fly secrets antes de deploy.
- Próximo restart aplica via embed.FS + golang-migrate.

## Rollback manual
- `migrate -database $DATABASE_URL -path internal/migrations down 1`

## Consolidação Fase 12
- Migrations agora vivem em `laura-go/internal/migrations/` (go:embed canônico).
- `infrastructure/migrations/` foi removido.
