# Open Finance runbook (Pluggy)

> STANDBY `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` — endpoints
> retornam 501 até os secrets serem configurados.

## Escopo

Integração Open Finance Brasil via Pluggy (planejado) ou Belvo (alternativa).
Esta fase (13) cobre apenas **foundation**: migration, client skeleton e
endpoints stub. Implementação real fica para Fase 14.

## Quando usar

- Setup inicial Pluggy quando o time tiver credenciais.
- Troubleshooting de `/api/v1/banking/sync` retornando 0 contas sincronizadas.
- Rollback de feature flag em emergência.

## Pré-requisitos

1. Conta Pluggy criada em <https://dashboard.pluggy.ai>.
2. Credenciais `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET` em `fly secrets`.
3. Feature flag `FEATURE_BANK_SYNC=on` (default: `off`).
4. Migration `000036_open_finance_foundation` aplicada em produção
   (`psql -f 000036_open_finance_foundation.up.sql` via container db).

## Procedimento de ativação

```sh
# 1. Setar secrets na Fly
fly secrets set \
  PLUGGY_CLIENT_ID=... \
  PLUGGY_CLIENT_SECRET=... \
  FEATURE_BANK_SYNC=on \
  -a laura-finance-api

# 2. Validar /api/v1/banking/connect (autenticado — usar cookie de sessão)
curl https://laura-finance-api.fly.dev/api/v1/banking/connect \
  -X POST -b cookies.txt

# Esperado: 200 { connect_token: "...", expires_in: 1800 }

# 3. Workflow .github/workflows/bank-sync.yml roda diariamente 05:00 UTC
#    e chama /api/v1/banking/sync com X-Ops-Token.
```

## Validação manual do sync

```sh
TOKEN=$(fly secrets list -a laura-finance-api | grep BACKUP_OPS_TOKEN)
# (obter valor real via Fly dashboard — não é exibido via list)
curl -X POST \
  -H "X-Ops-Token: $TOKEN" \
  https://laura-finance-api.fly.dev/api/v1/banking/sync

# Respostas possíveis:
# - 401: token ausente ou errado
# - 200 { status: "disabled" }: FEATURE_BANK_SYNC=off
# - 200 { status: "stub", synced_accounts: N }: Pluggy configurado
```

## Rollback

Desativar sync sem derrubar app:

```sh
fly secrets unset FEATURE_BANK_SYNC -a laura-finance-api
# sync continua retornando 200 disabled
```

Rollback total (remover tabelas):

```sh
# No container db
psql -f internal/migrations/000036_open_finance_foundation.down.sql
```

## Observabilidade

- Logs estruturados via `slog` (request_id, workspace_id).
- Métricas: TBD em Fase 14 (incrementar counter `bank_sync_accounts_total`).
- Tracing: OTEL spans em `CreateConnectToken` e `FetchTransactions`.

## Referências

- Plano Fase 13 v3: partes H.1–H.7.
- Doc Pluggy: <https://docs.pluggy.ai/>
- Workflow: `.github/workflows/bank-sync.yml`
- Client: `laura-go/internal/pluggy/client.go`
- Handlers: `laura-go/internal/handlers/banking.go`
