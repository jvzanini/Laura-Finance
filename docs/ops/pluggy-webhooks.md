# Runbook — Pluggy Webhooks

Feature flag: `FEATURE_PLUGGY_WEBHOOKS=true`. Default off.

## Configuração

1. No dashboard Pluggy (https://dashboard.pluggy.ai), aba Webhooks,
   cadastrar URL `https://<api>/api/banking/webhooks/pluggy`.
2. Copiar o secret gerado e setar no host:
   ```bash
   fly secrets set PLUGGY_WEBHOOK_SECRET="<valor>"
   fly secrets set FEATURE_PLUGGY_WEBHOOKS=true
   ```
3. Restart instâncias.

## Rotação de secret (dual-secret grace period)

Para trocar o secret sem dropar eventos:

```bash
# Passo 1 — mover atual para SLOT old, criar novo.
fly secrets set \
  PLUGGY_WEBHOOK_SECRET_OLD="<secret_atual>" \
  PLUGGY_WEBHOOK_SECRET="<secret_novo>"

# Passo 2 — atualizar no dashboard Pluggy para o novo secret.
# Pluggy passa a assinar com o novo. Nosso handler aceita ambos.

# Passo 3 — depois de 24h (grace period), remover old:
fly secrets unset PLUGGY_WEBHOOK_SECRET_OLD
```

## Inspeção da fila

```sql
-- Eventos pendentes
SELECT id, event_type, item_id, retry_count, received_at, error_message
FROM bank_webhook_events
WHERE processed_at IS NULL
ORDER BY received_at DESC
LIMIT 20;

-- Depth por event_type
SELECT event_type, COUNT(*)
FROM bank_webhook_events
WHERE processed_at IS NULL
GROUP BY event_type;

-- Últimas falhas
SELECT id, event_type, retry_count, error_message
FROM bank_webhook_events
WHERE error_message IS NOT NULL
ORDER BY received_at DESC
LIMIT 20;
```

## Replay manual

```sql
-- Reprocessar um evento específico:
UPDATE bank_webhook_events
SET processed_at = NULL, retry_count = 0, error_message = NULL
WHERE id = '<uuid>';
```

Worker vai pegar no próximo tick (~30s).

## Troubleshooting

### 401 Unauthorized no handler
- Header `X-Pluggy-Signature` ausente ou fora do formato `sha256=<hex>`.
- Secret divergente — verificar `PLUGGY_WEBHOOK_SECRET` e `_OLD`.
- Sentry warn `pluggy_webhook_unauthorized` aparece em cada falha.

### 404 item not linked
- `item_id` do payload não existe em `bank_accounts.item_id`.
- Verificar se sync inicial do item já rodou e populou `bank_accounts`.

### Queue depth subindo
- Monitor `laura_pluggy_webhook_queue_depth`.
- Worker travado? `kubectl logs` / `fly logs` — buscar
  `pluggy_webhook_worker_stopped` fora de contexto de shutdown.
- Dispatch falhando — buscar `pluggy_worker_dead_letter` para DLQ.

### Feature flag off em prod
Handler retorna 503 + log `pluggy_webhooks_disabled`. Pluggy vai
retentar (backoff próprio deles).

## Métricas Prometheus

- `laura_pluggy_webhook_received_total{event,outcome}`
- `laura_pluggy_webhook_processed_total{event,outcome}`
- `laura_pluggy_webhook_queue_depth` (gauge)

Alerta sugerido: `queue_depth > 1000` por 5min → page oncall.
