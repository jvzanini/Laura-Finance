#!/usr/bin/env bash
# scripts/backup-restore-drill.sh — versão local do workflow backup-drill.
set -euo pipefail
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

echo "[drill] DRY_RUN=$DRY_RUN"
if ! command -v flyctl >/dev/null 2>&1; then
  echo "[drill] flyctl ausente — STANDBY [FLY-API-TOKEN-BACKUP]"
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[drill] simularia: create ephemeral + restore + smoke + destroy"
  exit 0
fi

echo "[drill] execução real ainda não implementada localmente — usar workflow CI"
exit 0
