# Backup runbook — Laura Finance

> STANDBY [FLY-API-TOKEN-BACKUP] — workflows preparados; aguarda token Fly dedicado a backup.

## Quando usar
- Setup inicial: ler antes de configurar `FLY_API_TOKEN_BACKUP` no GH Secrets.
- Restauração: incidente DB requer backup recente.

## Pré-requisitos
- `FLY_API_TOKEN_BACKUP` no GH Secrets (escopo: postgres apps).
- App Fly Postgres `laura-api-db` provisionada (STANDBY [FLY-PG-CREATE]).

## Procedimento

### Backup automático (workflow)
- `.github/workflows/backup-fly-pg.yml` roda domingo 03:00 UTC.
- Cria backup via `flyctl postgres backup create`.
- Retention via `scripts/backup-prune.sh` (30 daily + 12 weekly + 6 monthly).

### Drill quinzenal (workflow)
- `.github/workflows/backup-drill.yml` roda dia 1 e 15 às 04:00 UTC.
- Provisiona DB ephemeral `laura-drill-<sha>`, restaura último backup, faz SELECT count em 6 tabelas, destrói ephemeral.
- Notifica Slack via `SLACK_WEBHOOK` (STANDBY [SLACK-WEBHOOK]).

### Restore manual
```sh
flyctl postgres backup list -a laura-api-db
flyctl postgres backup restore <BACKUP_ID> -a laura-api-db
```

### Backup on-demand
```sh
curl -X POST https://laura-finance-api.fly.dev/api/ops/backup \
  -H "X-Ops-Token: $BACKUP_OPS_TOKEN"
```

## Validação
- Job status `success` em `backup-fly-pg.yml`.
- Drill status `success` em `backup-drill.yml`.
- Métrica `laura_backup_last_success_timestamp_seconds` recente em Grafana.

## Rollback
- Se restore corromper estado: `flyctl postgres backup restore <PREVIOUS> -a laura-api-db`.
- Se drill falhar: investigar via Slack notify + `gh run view`.
