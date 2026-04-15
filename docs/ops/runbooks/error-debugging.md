# Runbook — Error debugging

> Arquitetura: [#fluxo-de-request](../../architecture.md#fluxo-de-request)

## Quando usar
Usuário reporta erro específico OU Sentry alerta de issue nova e você precisa achar a causa raiz.

## Pré-requisitos
- `request_id` (cliente) OU `error.code` (Sentry issue).
- Acesso `fly logs`, Sentry, Grafana.

## Workflow lookup

### 1. Usuário tem `request_id`
O JSON de erro canônico inclui `error.request_id`:

```json
{"error": {"code": "INTERNAL", "request_id": "9f2a...", "timestamp": "..."}}
```

Buscar nos logs do Fly:

```sh
fly logs -a laura-finance-api | jq 'select(.request_id=="9f2a...")'
```

Contexto completo: método, path, user_id (se autenticado), stack (se panic).

### 2. `error.code` sem `request_id`
Entrar em Sentry → Issues → filtro por tag `error_code:<CODE>`. Listar issues recentes.

Abrir issue → ver `request_id` na aba tags → voltar ao passo 1.

### 3. Sentry issue → trace OTel
Dentro da issue Sentry, aba "Trace" mostra `trace_id` correlacionado. Click → abre o waterfall span tree (HTTP → DB → LLM → externo).

Identificar qual span foi lento/errou.

### 4. Métrica Grafana (contexto)
Dashboard "HTTP & Workspaces" no intervalo de 5min antes do erro:
- `laura_api_requests_total{status=~"5.."}` — outras requests erraram também?
- `laura_pgxpool_idle_conns` — pool saturado?
- `laura_llm_call_errors_total` — provider IA fora?

Dashboard "Postgres" + "LLM" complementam.

### 5. Fix
- Se bug no código → PR + deploy.
- Se infra → seguir `incident-response.md`.
- Se config → `fly secrets set` + redeploy.

## Códigos de erro mais comuns
Ver tabela completa em `docs/ops/observability.md` (seção "Códigos de erro canônicos").

## Validação do fix
- Reproduzir request original com `request_id` em staging → esperado 2xx.
- Métrica `laura_api_requests_total{status=~"5..",path="..."}` volta a zero.
- Sem novas ocorrências em Sentry nas próximas 24h.

## Rollback
Se fix introduziu regressão: `runbooks/rollback.md`.
