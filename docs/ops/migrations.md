# Migrations — procedimento ops

> Fonte canônica: `infrastructure/migrations/` (golang-migrate, pares `*.up.sql` / `*.down.sql`).
> Runtime: `MIGRATE_ON_BOOT=true` executa `migrate.Up()` a partir de `embed.FS` (ver `laura-go/internal/db/migrations.go`).
> CLI: `scripts/migrate.sh` wrapper sobre `golang-migrate` para execução manual.

## Estado atual (2026-04-15)

- **Último aplicado local:** 000035 (drop de linhas `workspace_id IS NULL` + NOT NULL constraints + 5 CHECKs + 14 triggers `trg_updated_at` + índice `idx_trans_workspace_date`).
- **Validação local (5 SELECTs):** ✅ 5 constraints presentes, 14 triggers, índice OK, 0 NULLs nas 8 tabelas-alvo.
- **Tabela `schema_migrations`:** ausente (migrations 001-035 aplicadas via `psql` direto, não via golang-migrate). Ao rodar o binário com `MIGRATE_ON_BOOT=true`, golang-migrate criará a tabela e pode precisar de `migrate force 35` antes de avançar.
- **STANDBY [FLY-PG-CREATE]:** apply em prod depende de Fly Postgres provisionado.

## Migration 000035 — tabelas-alvo

A migration 000035 remove linhas com `workspace_id IS NULL` em 8 tabelas e aplica `NOT NULL`:

1. `cards`
2. `categories`
3. `subcategories`
4. `transactions`
5. `message_logs`
6. `financial_goals`
7. `investments`
8. `debt_rollovers`

Após o drop, cria 5 CHECK constraints, 14 triggers `trg_updated_at` e 1 índice composto `idx_trans_workspace_date (workspace_id, transaction_date DESC)`.

## Procedimento — aplicar em produção

> Pré-requisito: Fly Postgres provisionado (STANDBY [FLY-PG-CREATE]) + `DATABASE_URL` exportado.

### 1. Dry-run (contagem de impacto)

```sh
export DATABASE_URL='postgres://...'   # read replica ou primary em leitura
psql "$DATABASE_URL" -f scripts/dry-run-000035.sql
```

**Expected:** todas as linhas retornam `0`. Se qualquer valor > 0, **parar** — investigar origem dos NULLs e decidir: (a) atribuir `workspace_id` manualmente ou (b) aceitar o drop (com registro em audit log + comunicação ao usuário).

### 2. Backup pré-apply

```sh
TS=$(date +%Y%m%d-%H%M%S)
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  -f "infrastructure/backups/pre-000035-$TS.sql"
ls -lh "infrastructure/backups/pre-000035-$TS.sql"
```

**Expected:** arquivo SQL com tamanho compatível com o dataset (checar não-vazio).

> Ou usar `fly postgres backup` (STANDBY [FLY-PG-CREATE]).

### 3. Apply

**Opção A — wrapper CLI:**

```sh
scripts/migrate.sh version     # antes
scripts/migrate.sh up
scripts/migrate.sh version     # depois (deve ser 35)
```

**Opção B — via boot do binário:**

```sh
fly secrets set MIGRATE_ON_BOOT=true -a laura-finance-api
fly deploy -a laura-finance-api
fly logs -a laura-finance-api | grep -i migrat
```

**Expected (log):** `migrations: applied 1 migration, current version 35` (ou similar).

### 4. Validação pós-apply

```sh
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conname IN ('chk_transaction_type','chk_transaction_amount_positive','chk_goal_target_positive','chk_invoice_status','chk_rollover_status') ORDER BY conname;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_trigger WHERE tgname='trg_updated_at';"
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE indexname='idx_trans_workspace_date';"
psql "$DATABASE_URL" -f scripts/dry-run-000035.sql
```

**Expected:** 5 constraints, 14 triggers, 1 índice, 0 NULLs.

### 5. Rollback (se necessário)

```sh
scripts/migrate.sh down 1      # volta para 34
# ou restaurar backup:
psql "$DATABASE_URL" < "infrastructure/backups/pre-000035-$TS.sql"
```

> Nota: `down` de 000035 **não restaura** linhas deletadas. Restauração completa exige o backup do passo 2.

## Adicionar nova migration

1. Criar par `infrastructure/migrations/0000NN_descricao.up.sql` + `0000NN_descricao.down.sql`.
2. Testar local: `scripts/migrate.sh up` + `scripts/migrate.sh down 1` + `scripts/migrate.sh up`.
3. Commitar ambos os arquivos no mesmo commit.
4. Deploy: boot com `MIGRATE_ON_BOOT=true` aplica automaticamente.

## Referências

- `infrastructure/migrations/000035_*.up.sql` — script canônico.
- `laura-go/internal/db/migrations.go` — runner embed.FS.
- `scripts/dry-run-000035.sql` — contagem de impacto.
- `scripts/migrate.sh` — wrapper CLI.
- `docs/ops/runbooks/rollback.md` §Migration 000035 específico.
