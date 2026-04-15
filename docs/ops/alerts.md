# Alertas — Laura Finance

> STANDBY [SENTRY-DSN-API], [SLACK-WEBHOOK] — regras preparadas; ativar quando DSN+webhook configurados.

## Regras Sentry (configurar via UI Sentry)

### Regra 1 — Rate de errors > 5/5min
- **Quando usar:** detectar incidentes em produção.
- **Condição:** `event.level:error` count > 5 em 5min.
- **Notificação:** email + Slack `#alerts-laura`.
- **Procedimento:** abrir Sentry → Alerts → Create Alert → Issue Frequency.

### Regra 2 — Issue novo em production
- **Condição:** `release:production` AND new issue.
- **Notificação:** Slack `#alerts-laura`.
- **Procedimento:** Sentry → Alerts → "First Seen in production".

### Regra 3 — Performance regression p95 > 2s
- **Condição:** `transaction.duration:p95 > 2s` em 10min.
- **Notificação:** email.
- **Procedimento:** Sentry → Performance → Alerts.

## Slack webhooks

- `SLACK_WEBHOOK` em GH Secrets (canal `#alerts-laura`).
- Usado por: `deploy-api.yml`, `deploy-pwa.yml`, `backup-drill.yml`.

## Pre-requisitos
- Sentry workspace + projeto Laura Finance.
- Slack workspace + canal `#alerts-laura` + incoming webhook.

## Validação
- Trigger sintético: rota dev `/api/_debug/panic` em staging deve disparar Regra 1 em 5min.
- Deploy fail trigger: workflow_dispatch com env inválida deve postar no Slack.

## Rollback
- Desabilitar regra Sentry via UI.
- Remover step `notify-slack` dos workflows (commit revert).
