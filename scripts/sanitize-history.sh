#!/usr/bin/env bash
# scripts/sanitize-history.sh — rewrite do historico git removendo secrets.
# PRE-REQ: (1) GROQ_API_KEY ja revogada; (2) nova chave em GH/Fly secrets.
# NAO executar sem STANDBY [GROQ-REVOKE] confirmado pelo usuario.
set -euo pipefail

SECRETS_FILE="${SECRETS_FILE:-.git-secrets-to-purge.txt}"
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "ERRO: $SECRETS_FILE ausente. Crie com as strings EXATAS a expurgar." >&2
  exit 1
fi

# Backup via bundle antes do rewrite
BUNDLE="../laura-finance-pre-sanitize-$(date +%Y%m%d-%H%M%S).bundle"
git bundle create "$BUNDLE" --all
echo "Backup criado: $BUNDLE"

# Rewrite
if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERRO: instale git-filter-repo (brew install git-filter-repo)." >&2
  exit 1
fi
git filter-repo --replace-text "$SECRETS_FILE" --force

# Validacao
echo "=== Validacao: buscas pos-rewrite (esperado vazio) ==="
git log -p -Sgsk_ --all | head -5 || true

echo
echo "PRONTO. Proximos passos MANUAIS:"
echo "  git push --force --all"
echo "  git push --force --tags"
echo "  STANDBY [FORCE-PUSH]"
