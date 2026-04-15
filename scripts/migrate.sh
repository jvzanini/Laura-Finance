#!/usr/bin/env bash
# scripts/migrate.sh — wrapper golang-migrate CLI.
# Uso: scripts/migrate.sh up|down|version|force <ver>
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL obrigatorio}"
MIGRATIONS="${MIGRATIONS:-infrastructure/migrations}"
exec migrate -path "$MIGRATIONS" -database "$DATABASE_URL" "$@"
