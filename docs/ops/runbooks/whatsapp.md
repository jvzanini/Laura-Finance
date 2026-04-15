# WhatsApp runbook

> Arquitetura: [#observability-stack](../../architecture.md#observability-stack)

## Rescan QR pós-restart Fly
1. `fly logs -a laura-api | grep "qr code"`.
2. Escanear QR no terminal local.
3. Sessão persiste em Postgres (Fase 11 sqlstore).

## Troubleshooting reconnect
- `whatsmeow.IsConnected()` false → restart máquina Fly.

## Validação
- `curl https://api.laura.finance/ready | jq .checks.whatsmeow`.
