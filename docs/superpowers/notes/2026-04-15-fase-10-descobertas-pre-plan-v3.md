# Descobertas pré plan v3 — Fase 10

> Estas descobertas vieram de inspeção do banco local + grep do código,
> em paralelo à geração do plan v2. O **review #2 + plan v3** DEVE
> consumir este arquivo e reduzir o escopo de tarefas conforme listado.

## 1. Migration 000035 JÁ ESTÁ APLICADA no banco local

Inspeção em 2026-04-15 02:05 BRT no `infrastructure-postgres-1`:

- ✅ CHECK constraints presentes: `chk_transaction_type`,
  `chk_transaction_amount_positive`, `chk_goal_target_positive`,
  `chk_invoice_status`, `chk_rollover_status`.
- ✅ Trigger `trg_updated_at` em 14 tabelas.
- ✅ Índice `idx_trans_workspace_date` existe.
- ✅ `workspace_id IS NULL` count = 0 em todas as 8 tabelas alvo.

**Impacto no plan v3:** as tasks F.1 + F.2 (dry-run + apply local da
035) viram apenas:
- F.local: rodar SELECT de validação confirmando estado (constraints +
  triggers + índices + 0 NULLs); marcar como "já aplicada local";
  documentar em `docs/ops/migrations.md`.
- O dry-run + apply em PROD continua válido (depende de
  `STANDBY [FLY-PG-CREATE]`).

## 2. Whatsmeow já usa Postgres

`laura-go/internal/whatsapp/client.go:47` e
`laura-go/internal/whatsapp/instance_manager.go:110`:

```go
container, err := sqlstore.New(context.Background(), "postgres", dbURL, dbLog)
```

Tabelas `whatsmeow_*` (15 tabelas) existem no Postgres local — confirmando
que o `sqlstore` foi inicializado e o schema foi auto-criado pela
biblioteca (Whatsmeow internamente roda `Container.Upgrade` ao chamar
`sqlstore.New`).

**Impacto no plan v3:** B.1 (Container.Upgrade) provavelmente
DESNECESSÁRIA. Mas confirmar que `sqlstore.New` chama `Upgrade` de fato
na versão atual da biblioteca (`go.mau.fi/whatsmeow`). Se sim, B.1 vira
apenas teste de regressão; se não, manter B.1.

## 3. Handler `/health` JÁ EXISTE — em DOIS lugares

- `laura-go/main.go:39` — `app.Get("/health", ...)` (root path)
- `laura-go/internal/handlers/router.go:45` — `app.Get("/api/v1/health", ...)`
  (path versionado)

**Impacto no plan v3:**
- B.4 ainda válida apenas para `/ready` (probe de DB).
- ATENÇÃO: `fly.toml` deve apontar para `/health` (root). O agente B já
  configurou `[[http_service.checks]] path = "/health"`. Confirmar.
- Decidir se `/api/v1/health` é redundante ou serve outro propósito;
  pode ficar para limpeza pós-Fase 10.

## 4. Handler `/ready` NÃO EXISTE

Grep retornou vazio para `/ready`.

**Impacto no plan v3:** B.4 mantida — criar handler `/ready` que faz
ping no Postgres (`db.Ping(ctx)` com timeout 2s). Retornar 200 se OK,
503 se falhar. Documentar diferença `/health` (liveness) vs `/ready`
(readiness).

## 5. Middleware `requestid` NÃO EXISTE

Grep retornou vazio para `requestid` no código Go.

**Impacto no plan v3:** B.3 mantida — adicionar `requestid.New()` do
Fiber middleware no `main.go`, propagar header `X-Request-Id` para logs
e respostas.

## 6. `DISABLE_WHATSAPP` guard NÃO EXISTE

Não verificado diretamente, mas seguindo padrão da spec — provavelmente
ausente.

**Impacto no plan v3:** B.2 mantida — adicionar guard env-based no
boot do whatsapp client.

## 7. `bin/` em `laura-go` (untracked)

Há diretório `bin/` em `laura-go/` provavelmente vazio ou com binary
local. Confirmar `.gitignore` (já cobre `bin/`).

## Resumo de impacto no plan v3

| Task v2 | Status pós-descobertas | Ação |
|---------|----------------------|------|
| B.1 Container.Upgrade | Possivelmente NO-OP | Verificar lib + manter como teste de regressão |
| B.2 DISABLE_WHATSAPP | Mantida | TDD red-green |
| B.3 requestid middleware | Mantida | TDD red-green |
| B.4 `/ready` (e `/health`) | Reduzida | Apenas `/ready`; `/health` validar |
| F.1 dry-run 035 LOCAL | Já aplicada | Validar + documentar; remover "apply" da execução local |
| F.2 apply 035 LOCAL | Já aplicada | Idem |
| Outros (Parte A, C, D, E, G, H, I, J, K, L, M) | Sem mudança | OK |

## Comandos de verificação rodados

```bash
docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
  "SELECT conname FROM pg_constraint WHERE conname IN (...)"
# → 5 constraints retornadas

docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
  "SELECT count(*) FROM pg_trigger WHERE tgname='trg_updated_at'"
# → 14

docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
  "SELECT count(*) FROM cards WHERE workspace_id IS NULL"
# → 0 (e idem para outras 7 tabelas)

grep -rn "sqlstore\|/health\|/ready\|requestid" laura-go/ --include="*.go"
# → /health em 2 lugares; sqlstore em whatsapp/; /ready e requestid ausentes
```
