#!/bin/bash
# Re-sincroniza o código do laura-pwa do repo (Google Drive) para /tmp/laura-pwa-dev
# onde o Turbopack roda. Use depois de editar arquivos no Drive enquanto o dev
# server estiver rodando — o Next detecta a mudança e faz hot reload.
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOCAL_PWA="/tmp/laura-pwa-dev"

if [ ! -d "$LOCAL_PWA" ]; then
    echo "❌ $LOCAL_PWA não existe. Rode ./start.sh primeiro."
    exit 1
fi

rsync -a \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.turbo' \
    "$REPO_ROOT/laura-pwa/" "$LOCAL_PWA/"

echo "✔ PWA sincronizado $REPO_ROOT/laura-pwa → $LOCAL_PWA"
