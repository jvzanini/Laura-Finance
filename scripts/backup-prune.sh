#!/usr/bin/env bash
# scripts/backup-prune.sh
# Retention: 30 daily + 12 weekly (sabados) + 6 monthly (dia 1).
# Usa flyctl postgres backups list. Suporta --dry-run.
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

PG_APP="${PG_APP:-laura-api-db}"
KEEP_DAILY=30
KEEP_WEEKLY=12
KEEP_MONTHLY=6

if ! command -v flyctl >/dev/null 2>&1; then
  echo "[backup-prune] flyctl ausente — abort"
  exit 1
fi

echo "[backup-prune] PG_APP=$PG_APP DRY_RUN=$DRY_RUN"
echo "[backup-prune] retention: $KEEP_DAILY daily + $KEEP_WEEKLY weekly + $KEEP_MONTHLY monthly"

# Lista backups (formato esperado: ID DATE ...)
BACKUPS=$(flyctl postgres backup list -a "$PG_APP" 2>/dev/null || echo "")
if [[ -z "$BACKUPS" ]]; then
  echo "[backup-prune] sem backups (ou flyctl auth ausente — STANDBY [FLY-API-TOKEN-BACKUP])"
  exit 0
fi

echo "$BACKUPS" | head -10

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[backup-prune] DRY RUN — nenhuma deleção executada"
else
  echo "[backup-prune] retention real ainda não implementada (placeholder até flyctl backup delete maduro)"
fi
exit 0
