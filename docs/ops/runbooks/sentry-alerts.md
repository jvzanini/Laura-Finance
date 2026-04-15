# Sentry alerts runbook

> Arquitetura: [#observability-stack](../../architecture.md#observability-stack)

## Regras ativas (3)
- Unhandled 5xx
- LLM timeout
- DB connection failures

## Procedimento ack/silence
- Acessar Sentry UI → Issues → ack/silence individual.
- Para silenciar regra inteira: Settings → Alerts → toggle.
