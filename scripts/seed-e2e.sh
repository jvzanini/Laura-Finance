#!/usr/bin/env bash
# scripts/seed-e2e.sh — seed idempotente para suite E2E Playwright.
# Pre-reqs: API em :8080 + DB limpo com migrations aplicadas.
set -euo pipefail

API="${API:-http://localhost:8080}"
EMAIL="e2e@laura.test"
PASSWORD="e2epass123!"

echo "[seed-e2e] garantindo user $EMAIL"
curl -fsS -X POST "$API/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"E2E\"}" \
  2>/dev/null || echo "[seed-e2e] user ja existe (skip)"

TOKEN=$(curl -fsS -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

echo "[seed-e2e] criando categorias default"
for cat in Alimentacao Transporte Lazer; do
  curl -fsS -X POST "$API/api/v1/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"$cat\",\"kind\":\"expense\"}" \
    >/dev/null || true
done

echo "[seed-e2e] pronto"
