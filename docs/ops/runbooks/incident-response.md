# Runbook — Incident response

> Arquitetura: [#fluxo-de-request](../../architecture.md#fluxo-de-request)

## Quando usar
Incidente em produção com impacto para usuários (API down, erros 5xx em massa, DB lento, WhatsApp desconectado, LLM provider fora).

## Severidades
- **SEV1** — API totalmente fora ou perda de dados. Resposta imediata (<15min).
- **SEV2** — Degradação severa (p95 > 5s, 10%+ de erros). Resposta em <1h.
- **SEV3** — Degradação localizada (uma rota, um workspace). Resposta em <4h.

## Pré-requisitos
- Acesso GitHub repo + Actions.
- Acesso Fly.io (token `FLY_API_TOKEN`).
- Acesso Sentry + Grafana (quando STANDBYs levantados).
- Acesso Slack `#alerts-laura`.

## Procedimento (5min triage)

### 1. Confirmar o incidente
- Checar `#alerts-laura` no Slack para Sentry alerts + deploy failures.
- `curl https://laura-finance-api.fly.dev/api/v1/health` — 200? errored?
- `fly logs -a laura-finance-api | tail -100` — padrão de erro visível?

### 2. Classificar
- **SEV1/2** → abrir thread no `#alerts-laura` + pingar on-call.
- **SEV3** → issue GitHub + seguir sozinho.

### 3. Mitigar (ordem de preferência)
1. **Rollback** via `runbooks/rollback.md` se incidente começou após deploy recente.
2. **Scale up** Fly `fly scale count 2 -a laura-finance-api` se tráfego pico.
3. **Feature flag** (se existir) para desabilitar rota problemática.
4. **Circuit breaker manual** — env var `DISABLE_<FEATURE>=1` via `fly secrets set`.

### 4. Comunicar
- Post inicial no Slack: severidade + impacto + ETA.
- Updates a cada 30min até resolução.

### 5. Investigar causa raiz
- Usar `error-debugging.md` runbook para lookup de `request_id` → Sentry → trace OTel.

## Validação
- `/api/v1/health` retorna 200.
- Error rate em Sentry < baseline após 15min.
- Métrica `laura_api_requests_total{status=~"5.."}` cai.

## Rollback
Se mitigação piorou: seguir `runbooks/rollback.md` (revert commit + redeploy).

## Template post-mortem

```md
# Post-mortem — <título curto>

- **Data/hora:** <UTC start> → <UTC end>
- **Severidade:** SEV1/2/3
- **Duração:** Xmin
- **Impacto:** <N usuários / N requests>

## Timeline
- HH:MM — primeiro alerta
- HH:MM — triagem iniciada
- HH:MM — mitigação aplicada
- HH:MM — resolvido

## Causa raiz
<descrição técnica>

## O que funcionou
- ...

## O que falhou
- ...

## Ação items
- [ ] <owner> — <ação> — <data>
```
