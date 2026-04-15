# Runbook: Remoção da flag LLM_LEGACY_NOCONTEXT

> Arquitetura: [#fluxo-de-request](../../architecture.md#fluxo-de-request)
> Schedule: executar após 2026-05-15 (T+30d do deploy Fase 13).

## Pré-requisitos

- Deploy Fase 13 em prod há ≥ 30 dias.
- Zero issues reportadas relacionadas a `LLM_LEGACY_NOCONTEXT=true` em Sentry.

## Procedimento

1. Abrir PR removendo `ChatCompletionLegacyAware` + `ChatCompletionLegacy` wrappers.
2. Remover flag `LLM_LEGACY_NOCONTEXT` do `Config` struct + `.env.example`.
3. Atualizar `docs/ops/observability.md` removendo seção da flag.
4. Tag commit com `chore(llm): remove LLM_LEGACY_NOCONTEXT flag (T+30d validation OK)`.

## Validação pós-merge

- Smoke `/api/v1/nlp/extract` com mensagem de teste.
- Grafana: zero spike em `laura_llm_call_errors_total`.

## Rollback

- Se issues surgirem: `git revert` do commit + redeploy.
