# Runbook — Rollback

> Arquitetura: [#deploy-pipeline](../../architecture.md#deploy-pipeline)

> Procedimentos para reverter um deploy/migration que regrediu em produção.
> Sempre validar com smoke tests após rollback. Documentar incidente em
> `docs/ops/incidents/YYYY-MM-DD-<slug>.md`.

---

## 1. API (Fly)

### Quando usar

- Novo release em `laura-finance-api` causou crash loop, p95 acima de 2s,
  erro 5xx > 1% por > 3 minutos, ou regressão funcional confirmada.

### Pré-requisitos

- `STANDBY [FLY-AUTH]`: `flyctl` autenticado (`fly auth whoami`).
- Acesso ao app `laura-finance-api`.

### Procedimento

```sh
fly releases list -a laura-finance-api
```
Expected: lista ordenada por versão; identificar `vN` (atual, quebrado) e
`vN-1` (último bom).

```sh
fly releases rollback v<N-1> -a laura-finance-api
```
Expected: `✓ Rolled back to v<N-1>`; Fly dispara novo deploy com a imagem
da versão alvo.

### Validação

```sh
curl -fsS https://api.laura.finance/health && echo OK
curl -fsS https://api.laura.finance/ready && echo OK
fly status -a laura-finance-api
```
Expected: HTTP 200 em `/health` e `/ready`; status `running` com 1/1 máquina
saudável.

### Rollback do rollback

Se o rollback piorou: `fly releases rollback v<N> -a laura-finance-api`
volta para a versão original. Se nem `vN` nem `vN-1` funcionam, deploy de
emergência a partir do último commit tageado bom:

```sh
git checkout <tag-boa>
fly deploy -a laura-finance-api --dockerfile laura-go/Dockerfile
```

---

## 2. PWA (Vercel)

### Quando usar

- Deploy Vercel quebrou build, erro de runtime (500 no SSR), ou regressão
  UI crítica (login, dashboard, pagamento).

### Pré-requisitos

- `STANDBY [VERCEL-AUTH]`: `vercel login` feito (`vercel whoami`).
- Acesso ao projeto `laura-finance-pwa` (ou nome atribuído).

### Procedimento

```sh
vercel ls laura-finance-pwa
```
Expected: lista de deploys com timestamp, URL e status. Identificar o
deploy `READY` anterior ao quebrado.

```sh
vercel rollback <deployment-url> --yes
```
Expected: `✓ Success! Alias is now pointing to <deployment-url>`.

### Validação

```sh
curl -fsS https://laura.finance/ -o /dev/null -w "%{http_code}\n"
# Smoke manual:
#   1. Abrir /login → credenciais E2E → dashboard carrega
#   2. Navegação entre /transacoes /cartoes /metas sem erro console
```
Expected: HTTP 200 na home, login funcional, sem stack trace no console.

### Rollback do rollback

`vercel rollback <deployment-original>` volta para o deploy quebrado. Se
nenhum dos dois serve, `git revert <commit> && git push` dispara novo
build da versão anterior.

---

## 3. DB (Fly Postgres backup restore)

### Quando usar

- Corrupção de dados, apply acidental de migration, drop de tabela, ou
  perda de dados confirmada por usuário.

### Pré-requisitos

- `STANDBY [FLY-PG-CREATE]`: Fly Postgres provisionado (`fly postgres list`
  mostra o cluster).
- Backup recente existe (`fly postgres backup list -a <cluster>`).

### Procedimento

```sh
fly postgres backup list -a laura-finance-db
```
Expected: lista de backups com ID e timestamp. Identificar o snapshot
anterior ao evento ruim.

```sh
fly postgres backup restore <backup-id> -a laura-finance-db
```
Expected: novo cluster restaurado; reconfigurar `DATABASE_URL` via
`fly postgres attach --app laura-finance-api <novo-cluster>`.

### Validação

```sh
fly postgres connect -a laura-finance-db
```
Expected dentro do psql:

```sql
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
-- expected: 35 (ou versão coerente com o snapshot)
SELECT count(*) FROM transactions;
-- expected: contagem próxima à do momento do backup
```

### Rollback do rollback

Se o restore trouxe um estado ainda pior: `fly postgres backup restore
<backup-id-mais-recente>` para retornar ao estado pós-incidente (assumindo
que ele ainda é utilizável). Caso contrário, recuperação manual via
`pg_restore` a partir de dump em `infrastructure/backups/`.

---

## 4. Migration 000035 específico

### Quando usar

- Apply de 000035 em prod apagou linhas com `workspace_id IS NULL` que o
  usuário agora reivindica como necessárias, ou constraints NOT NULL
  quebraram um fluxo downstream.

### Pré-requisitos

- Dump pré-035 salvo em `infrastructure/backups/pre-000035-<timestamp>.sql`
  (passo 2 do `docs/ops/migrations.md`).

### Procedimento

```sh
scripts/migrate.sh version
```
Expected: `35`.

```sh
scripts/migrate.sh down 1
```
Expected: `Migrated DOWN 1/1`; version volta para `34`. **Atenção:** o
`down` de 000035 reverte constraints/triggers/índice mas **não restaura**
as linhas deletadas no `up`.

Restauração de dados (apenas as 8 tabelas-alvo):

```sh
pg_restore --data-only \
  --table=transactions \
  --table=cards \
  --table=categories \
  --table=subcategories \
  --table=message_logs \
  --table=financial_goals \
  --table=investments \
  --table=debt_rollovers \
  -d "$DATABASE_URL" \
  "infrastructure/backups/pre-000035-<timestamp>.sql"
```
Expected: `pg_restore: processing data for table "..."` para cada tabela;
sem erros.

### Validação

```sh
psql "$DATABASE_URL" -f scripts/dry-run-000035.sql
psql "$DATABASE_URL" -c "SELECT count(*) FROM transactions;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM cards;"
```
Expected: contagens batem com o backup (não necessariamente 0 NULLs —
após rollback, NULLs podem voltar a existir; é esperado).

### Rollback do rollback

N/A — se o restore quebrou algo, a única saída é re-aplicar 000035 via
`scripts/migrate.sh up` e perder novamente os NULLs.
