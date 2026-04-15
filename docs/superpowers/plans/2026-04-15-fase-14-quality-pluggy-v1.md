# Fase 14 — Quality Maturation + Pluggy Integration Real + PWA Typing (Plan v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps em checkbox (`- [ ]`).

**Goal:** Completar concerns Fase 13 — PWA cleanup real (20 any em adminConfig.ts + 14 em 7 outros arquivos), testcontainers Redis + CI split unit/integration com retry, coverage Go 30% hard gate, Pluggy HTTP client real com retry/cache/taxonomia, ProcessMessageFlow ctx cascade (context.WithoutCancel + deadline 30s).

**Architecture:** PWA ganha zod schemas em border endpoints + type assertions para hydration. Testcontainers estende TestMain Fase 13 com Redis via `tcredis.Run(ctx, "redis:7-alpine")`. Coverage 30% via integration tests pgx-real + pgxpool.Pool em handlers/services. PluggyClient (HTTP cru, sem SDK) com auth cache 1h50m + custom retry 3x backoff (200ms/500ms/1s) + 4 sentinelas `ErrPluggy*`. ProcessMessageFlow nova assinatura `(ctx, msg) error` invocada via `context.WithoutCancel(parent)` + `WithTimeout(30s)`.

**Tech Stack:** Go 1.26.1 + context.WithoutCancel + testcontainers v0.32+ + singleflight; Next.js 16 + zod + Playwright; Postgres 16 + pgvector; GitHub Actions `nick-fields/retry@v3`.

---

## Parte 0 — Pré-condições

- [ ] **Task 0.1 — Confirmar baseline Fase 13**
  - Verificar tag anterior: `git tag --list 'phase-13-*'` retorna `phase-13-prepared`.
  - Verificar CI verde em `main`: `gh run list --branch main --limit 3 --json status,conclusion`.
  - Verificar `laura-go/internal/testutil/integration.go` existe e expõe `SharedPG`+`SharedDSN`.
  - Verificar Go version: `go version` → `go1.26.1`.
  - Sem alterações. Commit: N/A (verificação).

- [ ] **Task 0.2 — Baseline PWA typing real (rerun grep)**
  - Rodar `cd laura-pwa && grep -rE ": any\b| any\[\]|<any>" src/lib/actions/*.ts | cut -d: -f1 | sort | uniq -c | sort -rn | head -10`.
  - Rodar `grep -rE ": any\b| any\[\]|<any>" src/components src/lib/services src/lib/hooks src/lib/validators | cut -d: -f1 | sort | uniq -c | sort -rn`.
  - Confirmar counts: `adminConfig.ts=20`, `categories.ts=3`, `userProfile.ts=2`, `AuditLogView.tsx=3`, `AdminConfigEditor.tsx=3`.
  - Caso counts divirjam do spec, parar e abrir review; caso contrário seguir.
  - Salvar snapshot em `docs/runbooks/phase-14.md` seção "Baseline 2026-04-15".
  - Commit: `docs(quality): snapshot baseline PWA any counts Fase 14`.

---

## Parte A — PWA typing sprint 1

- [ ] **Task A.1 — Criar `src/types/admin.ts`**
  - Arquivo novo `laura-pwa/src/types/admin.ts`.
  - Exportar interfaces:
    ```ts
    export interface AdminConfigEntry {
      key: string;
      value: string | number | boolean | null;
      category: "stripe" | "resend" | "groq" | "openai" | "general";
      updatedAt: string;
      updatedBy: string | null;
    }
    export interface SettingPayload {
      key: string;
      value: AdminConfigEntry["value"];
    }
    export interface AdminFormState {
      status: "idle" | "saving" | "success" | "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    }
    ```
  - TDD: escrever `src/types/__tests__/admin.types.test.ts` com `expectTypeOf` checks (vitest + expect-type).
  - Rodar `pnpm test src/types/__tests__/admin.types.test.ts`.
  - Commit: `feat(typing): tipos canônicos admin config`.

- [ ] **Task A.2 — Zod schemas para adminConfig actions**
  - Novo arquivo `laura-pwa/src/lib/validators/adminConfig.ts`:
    ```ts
    import { z } from "zod";
    export const settingPayloadSchema = z.object({
      key: z.string().min(1).max(128),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    });
    export const bulkUpdateSchema = z.object({
      settings: z.array(settingPayloadSchema).min(1).max(100),
    });
    ```
  - Teste `src/lib/validators/__tests__/adminConfig.test.ts` com casos válidos/invalidos.
  - Commit: `feat(typing): zod schemas settings admin`.

- [ ] **Task A.3 — Refatorar `adminConfig.ts` (20 any → 0)**
  - Arquivo `laura-pwa/src/lib/actions/adminConfig.ts`.
  - Importar `AdminConfigEntry`, `SettingPayload`, `AdminFormState` e `bulkUpdateSchema`.
  - Substituir `any` por tipos concretos em `updateAdminConfig`, `bulkUpdateSettings`, retornos Prisma.
  - Adicionar `bulkUpdateSchema.parse(input)` na borda.
  - Confirmar `grep -c ": any\b\| any\[\]\|<any>" src/lib/actions/adminConfig.ts` retorna `0`.
  - Rodar `pnpm typecheck`.
  - Commit: `refactor(typing): elimina 20 any em adminConfig.ts`.

- [ ] **Task A.4 — Refatorar `categories.ts` (3 any → 0)**
  - Arquivo `laura-pwa/src/lib/actions/categories.ts`.
  - Substituir `any` pelos tipos `Prisma.CategoryGetPayload<{ include: ... }>`.
  - Confirmar grep zero.
  - Commit: `refactor(typing): Prisma types em categories action`.

- [ ] **Task A.5 — Refatorar `userProfile.ts` (2 any → 0)**
  - Arquivo `laura-pwa/src/lib/actions/userProfile.ts`.
  - Criar zod schema input em `src/lib/validators/userProfile.ts`.
  - Remover `as any` em merge; usar spread tipado.
  - Commit: `refactor(typing): zod schema input userProfile`.

- [ ] **Task A.6 — Refatorar `AuditLogView.tsx` (3 any → 0)**
  - Arquivo `laura-pwa/src/components/admin/AuditLogView.tsx`.
  - Definir interface `AuditLogRow` local ou em `src/types/admin.ts`.
  - Tipar colunas e props. Commit: `refactor(typing): AuditLogRow em AuditLogView`.

- [ ] **Task A.7 — Refatorar `AdminConfigEditor.tsx` (3 any → 0)**
  - Arquivo `laura-pwa/src/components/admin/AdminConfigEditor.tsx`.
  - Tornar componente genérico: `export function AdminConfigEditor<T extends AdminConfigEntry>(props: ...)`.
  - Commit: `refactor(typing): props genérica AdminConfigEditor`.

- [ ] **Task A.8 — ESLint override per-file + validação final**
  - Arquivo `laura-pwa/eslint.config.mjs`. Adicionar bloco:
    ```js
    {
      files: [
        "src/lib/actions/adminConfig.ts",
        "src/lib/actions/categories.ts",
        "src/lib/actions/userProfile.ts",
        "src/components/admin/AuditLogView.tsx",
        "src/components/admin/AdminConfigEditor.tsx",
      ],
      rules: { "@typescript-eslint/no-explicit-any": "error" },
    }
    ```
  - Rodar `pnpm lint` (zero erros) + `pnpm typecheck` (verde).
  - Atualizar `docs/runbooks/phase-14.md` com status sprint 1.
  - Commit: `lint(typing): override no-explicit-any error em 5 arquivos`.

---

## Parte B — Testcontainers Redis + CI split

- [ ] **Task B.1 — Estender TestMain com SharedRedis**
  - Arquivo `laura-go/internal/testutil/integration.go` (build tag `integration`).
  - Adicionar import `tcredis "github.com/testcontainers/testcontainers-go/modules/redis"`.
  - Declarar `SharedRedis *tcredis.RedisContainer` e `SharedRedisURL string`.
  - Após bloco SharedPG existente, adicionar `rc, err := tcredis.Run(ctx, "redis:7-alpine")`.
  - Em falha: `_ = SharedPG.Terminate(ctx)` + `os.Exit(0)` (skip).
  - Popular `SharedRedisURL, err = rc.ConnectionString(ctx)`.
  - No teardown, terminar `rc` antes de `SharedPG`.
  - Rodar `go mod tidy` para adicionar módulo Redis.
  - Commit: `infra(test): testcontainers Redis em TestMain integration`.

- [ ] **Task B.2 — `cache/redis_integration_test.go`**
  - Arquivo novo `laura-go/internal/cache/redis_integration_test.go` com build tag `integration`.
  - Testes: `TestRedisSetGetTTL`, `TestRedisPipeline`, `TestRedisPubSubBasic` usando `testutil.SharedRedisURL`.
  - Rodar `go test -tags=integration ./internal/cache/...` local.
  - Commit: `test(cache): integration Redis TTL + pipeline + pubsub`.

- [ ] **Task B.3 — `ratelimit/redis_integration_test.go`**
  - Arquivo novo com build tag `integration`.
  - Teste sliding window: 10 req em 1s, 11ª rejeitada; confirmar expiração.
  - Commit: `test(ratelimit): sliding window integration`.

- [ ] **Task B.4 — `sessions/revoke_integration_test.go`**
  - Arquivo novo com build tag `integration`.
  - Teste revogação: insert session, revoke, get → `ErrSessionRevoked`.
  - Commit: `test(sessions): revoke flow integration`.

- [ ] **Task B.5 — CI split `test-unit` + `test-integration`**
  - Arquivo `.github/workflows/go-ci.yml`.
  - Job `test-unit`: `cd laura-go && go test -race -count=1 ./...`, sem build tag, required em PR.
  - Job `test-integration`: `if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'`, `nick-fields/retry@v3` com `timeout_minutes: 10` `max_attempts: 3`, comando `go test -tags=integration -covermode=atomic -coverprofile=coverage.out ./...`.
  - Upload artifact `coverage.out`.
  - Commit: `ci(quality): split unit/integration + retry@v3 + required main`.

---

## Parte C — Coverage Go ≥ 30%

- [ ] **Task C.1 — Identificar funcs baixa coverage**
  - Rodar local `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=coverage.out ./...` + `go tool cover -func=coverage.out | sort -k3 -n | head -50`.
  - Documentar top-20 funcs <20% em `docs/runbooks/phase-14.md` seção "Coverage alvos".
  - Commit: `docs(quality): baseline coverage funcs alvo`.

- [ ] **Task C.2 — `handlers/transactions_integration_test.go`**
  - Arquivo novo com build tag `integration`.
  - Setup: `pgxpool.New(ctx, testutil.SharedDSN)`, criar user fixture em tx `BEGIN/ROLLBACK defer`.
  - Casos: POST 201, GET lista paginada, GET 404, PUT 200, DELETE 204, auth 401.
  - Commit: `test(go): handlers transactions integration`.

- [ ] **Task C.3 — `handlers/messages_integration_test.go`**
  - Mesma estrutura. Casos: POST mensagem, GET thread, GET não autorizado.
  - Commit: `test(go): handlers messages integration`.

- [ ] **Task C.4 — `handlers/users_integration_test.go`**
  - Casos: signup, login, me, update profile, 409 duplicate.
  - Commit: `test(go): handlers users integration`.

- [ ] **Task C.5 — `handlers/sessions_integration_test.go`**
  - Casos: create, list, revoke, revoke-all, expired.
  - Commit: `test(go): handlers sessions integration`.

- [ ] **Task C.6 — `handlers/admin_integration_test.go`**
  - Casos: RBAC admin-only 403, GET config, PUT config, audit-log append.
  - Commit: `test(go): handlers admin integration`.

- [ ] **Task C.7 — `handlers/webhooks_integration_test.go`**
  - Casos: HMAC válido 200, HMAC inválido 401, replay 409.
  - Commit: `test(go): handlers webhooks integration`.

- [ ] **Task C.8 — `services/transactionService_integration_test.go`**
  - Casos: create+categorize, soft delete, query por período.
  - Commit: `test(go): services transactionService integration`.

- [ ] **Task C.9 — `services/messageService_integration_test.go`**
  - Casos: ingest, dedupe hash, retry no erro LLM.
  - Commit: `test(go): services messageService integration`.

- [ ] **Task C.10 — `services/userService_integration_test.go`**
  - Casos: create, authenticate, password hash argon2, rotate.
  - Commit: `test(go): services userService integration`.

- [ ] **Task C.11 — Coverage gate 30% no CI**
  - Adicionar step no job `test-integration` (`.github/workflows/go-ci.yml`):
    ```yaml
    - name: Coverage gate 30%
      run: |
        cd laura-go
        go tool cover -func=coverage.out | tail -1 | \
          awk '{if ($3+0 < 30.0) { print "FAIL: " $3 " < 30%"; exit 1 } else { print "OK: " $3 }}'
    ```
  - Rodar workflow em branch; confirmar ≥30%.
  - Commit: `ci(quality): hard gate coverage 30%`.

- [ ] **Task C.12 — Roadmap coverage doc**
  - Atualizar `docs/runbooks/phase-14.md` com % atual e alvo Fase 15 (40%).
  - Commit: `docs(quality): roadmap coverage pós Fase 14`.

---

## Parte D — Pluggy HTTP client real

- [ ] **Task D.1 — `errors.go` com 4 sentinelas**
  - Arquivo `laura-go/internal/integrations/pluggy/errors.go`.
  - Exportar `ErrPluggyAuthFailed`, `ErrPluggyRateLimited`, `ErrPluggyNotFound`, `ErrPluggyInternal` via `errors.New`.
  - Teste `errors_test.go`: confirmar `errors.Is` funciona + strings.
  - Commit: `feat(pluggy): sentinelas ErrPluggy*`.

- [ ] **Task D.2 — `client.go` struct + getAuthToken**
  - Arquivo `laura-go/internal/integrations/pluggy/client.go`.
  - Struct `Client{ baseURL, clientID, clientSecret, http, authMu sync.RWMutex, authToken, authExp }`.
  - Construtor `New(clientID, clientSecret string, opts ...Option) *Client` com baseURL default `https://api.pluggy.ai` e `http.Client{Timeout: 15s}`.
  - Método `getAuthToken(ctx)` com fast-path RLock + slow-path Lock + double-check + POST `/auth` + mapear 200/401/403/429/5xx → sentinelas + set `authExp = now + 1h50m`.
  - Commit: `feat(pluggy): auth cache RWMutex double-check TTL 1h50`.

- [ ] **Task D.3 — `retryableDo` + `isRetryable`**
  - Adicionar em `client.go` (ou `retry.go`).
  - Backoffs `[]time.Duration{200ms, 500ms, 1s}`; respeita `ctx.Done()`.
  - `isRetryable(err)` retorna true se `errors.Is(err, ErrPluggyRateLimited) || errors.Is(err, ErrPluggyInternal)`.
  - Teste `retry_test.go`: 3 falhas + sucesso; não-retriable aborta; ctx cancel.
  - Commit: `feat(pluggy): retry custom 3x backoff 200/500/1000`.

- [ ] **Task D.4 — `CreateConnectToken(ctx, opts)`**
  - Em `client.go`: método POST `/connect_tokens` com header `X-API-KEY` (auth token).
  - Input struct `ConnectTokenOptions{ ItemID, Options map[string]any }`; Output `{AccessToken, ExpiresAt}`.
  - Encapsular em `retryableDo`.
  - Commit: `feat(pluggy): CreateConnectToken`.

- [ ] **Task D.5 — `FetchTransactions(ctx, itemID, opts)`**
  - Método GET `/items/{id}/transactions?pageSize=500`; suportar pageToken via opts.
  - Struct `Transaction` (id, amount, description, date, categoryId).
  - Parse `{results, total, totalPages}`.
  - Commit: `feat(pluggy): FetchTransactions paginado`.

- [ ] **Task D.6 — `httptest_mock.go`**
  - Arquivo `laura-go/internal/integrations/pluggy/httptest_mock.go` com build tag `!smoke` ou helper público.
  - Função `NewMockServer(t *testing.T, behaviors ...Behavior) *httptest.Server`.
  - Behaviors: `Behavior200`, `Behavior401`, `Behavior429Then200` (1ª chamada 429, depois 200), `Behavior500`.
  - Expor seeds JSON para `/auth`, `/connect_tokens`, `/items/*/transactions`.
  - Commit: `test(pluggy): httptest mock server`.

- [ ] **Task D.7 — `client_test.go` suite httptest**
  - Arquivo `laura-go/internal/integrations/pluggy/client_test.go` (unit, sem build tag).
  - Casos: auth success, auth 401 → `ErrPluggyAuthFailed`, 429 → retry → OK, 500×3 → `ErrPluggyInternal`, double-check concorrência (2 goroutines → 1 POST /auth), CreateConnectToken OK, FetchTransactions pagina.
  - Rodar `go test -race ./internal/integrations/pluggy/...`.
  - Commit: `test(pluggy): suite completa httptest + concorrência`.

- [ ] **Task D.8 — Workflow `pluggy-smoke.yml` manual**
  - Arquivo `.github/workflows/pluggy-smoke.yml`.
  - `on: workflow_dispatch` (apenas manual).
  - Job: setup-go 1.26.1, env `PLUGGY_CLIENT_ID`+`PLUGGY_CLIENT_SECRET` via secrets, `go test -tags=smoke ./internal/integrations/pluggy/...`.
  - Adicionar `//go:build smoke` em `client_smoke_test.go` (skip se env vazias).
  - Commit: `ci(pluggy): workflow_dispatch smoke sandbox`.

---

## Parte E — ProcessMessageFlow ctx cascade

- [ ] **Task E.1 — Nova assinatura `ProcessMessageFlow`**
  - Arquivo `laura-go/internal/bot/wa/processor.go`.
  - Mudar `func ProcessMessageFlow(msg Message)` → `func ProcessMessageFlow(ctx context.Context, msg Message) error`.
  - Substituir todos `context.Background()` internos por `ctx`.
  - Retornar erros propagados de LLM/DB em vez de log-and-swallow.
  - Ajustar testes existentes para nova assinatura.
  - Commit: `refactor(go): ProcessMessageFlow(ctx, msg) error`.

- [ ] **Task E.2 — Caller `wa_webhook.go` com WithoutCancel + WithTimeout**
  - Arquivo `laura-go/internal/handlers/wa_webhook.go`.
  - Dentro do `go func()`: `msgCtx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 30*time.Second); defer cancel()`.
  - Chamar `ProcessMessageFlow(msgCtx, msg)`; logar com `logger.WarnContext`.
  - Responder `200` imediatamente.
  - Commit: `refactor(go): WA webhook WithoutCancel + deadline 30s`.

- [ ] **Task E.3 — Span OTel manual em ProcessMessageFlow**
  - Em `processor.go`, adicionar:
    ```go
    tracer := otel.Tracer("wa.processor")
    ctx, span := tracer.Start(ctx, "ProcessMessageFlow")
    defer span.End()
    ```
  - Adicionar atributos `msg.id`, `user.id`.
  - Commit: `observability(go): span ProcessMessageFlow`.

- [ ] **Task E.4 — Integration test ctx cascade**
  - Arquivo novo `laura-go/internal/handlers/wa_webhook_integration_test.go` (build tag `integration`).
  - Caso 1: POST webhook com `X-Request-Id: abc-123` → aguardar goroutine → asserção log contém `request_id=abc-123` e `user_id=<fixture>`.
  - Caso 2: injetar mock processor que `time.Sleep(31*time.Second)` → asserção log `deadline exceeded`.
  - Usar `testutil.SharedDSN` para fixture user.
  - Commit: `test(go): WA ctx cascade + deadline exceeded`.

---

## Parte F — Lint + flag removal + runbook

- [ ] **Task F.1 — golangci-lint v2 reavaliação**
  - Rodar `golangci-lint --version`; se ≥ v2.0, rodar `cd laura-go && golangci-lint run ./... --timeout=5m`.
  - Se zero issues: reabilitar job em `.github/workflows/go-ci.yml` removendo `continue-on-error` + commit `ci(lint): reabilita golangci-lint v2`.
  - Caso contrário: criar `docs/decisions/2026-04-15-golangci-v2.md` documentando motivo do adiamento (contagem de issues, categorias) + commit `docs(lint): ADR adiamento golangci-v2`.

- [ ] **Task F.2 — PR draft `LLM_LEGACY_NOCONTEXT` removal**
  - Criar branch local `chore/remove-llm-legacy-nocontext`.
  - Remover flag de `laura-go/internal/llm/config.go` + call sites (código condicionado).
  - `gh pr create --draft --title "chore: remove LLM_LEGACY_NOCONTEXT flag" --body "..."`.
  - Criar ADR `docs/decisions/2026-04-15-llm-legacy-nocontext-removal.md` com data-alvo **2026-05-15** + critério `llm_legacy_nocontext_activations_total == 0` 30d contínuos.
  - Adicionar label `ready-after-2026-05-15` no PR.
  - Commit ADR: `docs(go): ADR remoção LLM_LEGACY_NOCONTEXT 2026-05-15`.

- [ ] **Task F.3 — Runbook migration 000036 apply**
  - Arquivo novo `docs/operations/prod-migration-apply.md`.
  - Conteúdo: pré-reqs (backup pg_dump+age), comando `psql $DATABASE_URL -f migrations/000036_*.sql`, validação `SELECT ...`, rollback plan.
  - Marcar explicitamente "NÃO EXECUTAR — depende STANDBY FLY-PG-CREATE".
  - Commit: `docs(ops): runbook migration 000036 prod apply`.

- [ ] **Task F.4 — Atualizar `docs/ops/alerts.md`**
  - Adicionar regras: coverage drop >5pp 7d; Pluggy auth failure rate > 1/min 5min; WA deadline exceeded > 10/min.
  - Commit: `docs(ops): alertas Fase 14 — coverage + pluggy + WA deadline`.

- [ ] **Task F.5 — Expandir commit scope allowlist**
  - Arquivo `.githooks/commit-msg` ou `scripts/validate-commit.js` (onde houver a validação existente).
  - Adicionar `pluggy`, `typing`, `quality` ao regex allowlist.
  - Atualizar `docs/conventions/commits.md` (ou CLAUDE.md) listando 22 scopes.
  - Commit: `hooks(quality): scope allowlist +pluggy +typing +quality`.

---

## Parte G — Validação + tag

- [ ] **Task G.1 — Validações finais**
  - Rodar `cd laura-go && go vet ./...` verde.
  - Rodar `cd laura-go && go test ./...` (unit) verde.
  - Rodar `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=coverage.out ./...`.
  - Rodar gate `go tool cover -func=coverage.out | tail -1 | awk '{if ($3+0 < 30.0) {exit 1}}'`.
  - Rodar `cd laura-pwa && pnpm lint && pnpm typecheck`.
  - Se qualquer passo falhar: parar, corrigir, recomeçar validações.
  - Commit: N/A (só validação).

- [ ] **Task G.2 — Tag `phase-14-prepared`**
  - `git tag -a phase-14-prepared -m "Fase 14: quality + pluggy real + pwa typing"`.
  - `git push origin phase-14-prepared`.
  - Verificar no GitHub Actions que release/deploy dispara (se configurado).
  - Commit: N/A (tag).

- [ ] **Task G.3 — HANDOFF + memory entry**
  - Atualizar `docs/HANDOFF.md` com: status Fase 14 concluída, coverage %, PWA any residuais (3 em Fase 15), PR draft flag removal pendente.
  - Adicionar memory entry em `~/.claude/projects/.../memory/MEMORY.md` linkando `session_state_2026_04_15_fase_14.md` com: commits totais, coverage final, Pluggy status (creds OK ou blocked).
  - Commit: `docs(quality): HANDOFF Fase 14 concluída`.

---

## Self-review — mapeamento checklist §15 → tasks

| # | Item §15 | Task ID | Status |
|---|---|---|---|
| 1 | `src/types/admin.ts` | A.1 | IN_PLAN |
| 2 | Refatorar `adminConfig.ts` | A.2 + A.3 | IN_PLAN |
| 3 | Refatorar `categories.ts` | A.4 | IN_PLAN |
| 4 | Refatorar `userProfile.ts` | A.5 | IN_PLAN |
| 5 | Refatorar `AuditLogView.tsx` | A.6 | IN_PLAN |
| 6 | Refatorar `AdminConfigEditor.tsx` | A.7 | IN_PLAN |
| 7 | Override eslint per-file | A.8 | IN_PLAN |
| 8 | `pnpm lint` + `pnpm typecheck` | A.8 + G.1 | IN_PLAN |
| 9 | Estender TestMain com Redis | B.1 | IN_PLAN |
| 10 | `cache/redis_integration_test.go` | B.2 | IN_PLAN |
| 11 | `ratelimit/redis_integration_test.go` | B.3 | IN_PLAN |
| 12 | `sessions/revoke_integration_test.go` | B.4 | IN_PLAN |
| 13 | CI split `go-ci.yml` + retry@v3 | B.5 | IN_PLAN |
| 14 | `handlers/transactions_integration_test.go` | C.2 | IN_PLAN |
| 15 | `handlers/messages_integration_test.go` | C.3 | IN_PLAN |
| 16 | `handlers/users_integration_test.go` | C.4 | IN_PLAN |
| 17 | `handlers/sessions_integration_test.go` | C.5 | IN_PLAN |
| 18 | `handlers/admin_integration_test.go` | C.6 | IN_PLAN |
| 19 | `handlers/webhooks_integration_test.go` | C.7 | IN_PLAN |
| 20 | `services/transactionService_integration_test.go` | C.8 | IN_PLAN |
| 21 | `services/messageService_integration_test.go` | C.9 | IN_PLAN |
| 22 | `services/userService_integration_test.go` | C.10 | IN_PLAN |
| 23 | Coverage gate 30% CI | C.11 | IN_PLAN |
| 24 | `pluggy/errors.go` sentinelas | D.1 | IN_PLAN |
| 25 | `getAuthToken` RWMutex double-check TTL 1h50 | D.2 | IN_PLAN |
| 26 | `retryableDo` + `isRetryable` | D.3 | IN_PLAN |
| 27 | `CreateConnectToken` | D.4 | IN_PLAN |
| 28 | `FetchTransactions` | D.5 | IN_PLAN |
| 29 | `httptest_mock.go` | D.6 | IN_PLAN |
| 30 | `client_test.go` unit+integration | D.7 | IN_PLAN |
| 31 | `pluggy-smoke.yml` workflow_dispatch | D.8 | IN_PLAN |
| 32 | Assinatura `ProcessMessageFlow(ctx, msg) error` | E.1 | IN_PLAN |
| 33 | Caller WithoutCancel+WithTimeout(30s) | E.2 | IN_PLAN |
| 34 | Integration test request_id+user_id log | E.4 | IN_PLAN |
| 35 | Integration test sleep(31s) deadline exceeded | E.4 | IN_PLAN |
| 36 | golangci-lint v2 run ou ADR | F.1 | IN_PLAN |
| 37 | PR draft remove LLM_LEGACY_NOCONTEXT + ADR | F.2 | IN_PLAN |
| 38 | Runbook `prod-migration-apply.md` | F.3 | IN_PLAN |
| 39 | Atualizar `docs/runbooks/phase-14.md` | 0.2 + A.8 + C.1 + C.12 | IN_PLAN |
| 40 | Scope allowlist `pluggy/typing/quality` | F.5 | IN_PLAN |
| 41 | Tag `phase-14-prepared` + push | G.2 | IN_PLAN |

**Cobertura:** 41/41 IN_PLAN; 0 STANDBY; 0 DEFERRED.

**Extras fora §15 mas no spec:** Task C.1 (baseline coverage), Task C.12 (roadmap pós), Task E.3 (span OTel), Task F.4 (alertas), Task G.1 (validação), Task G.3 (HANDOFF) — todos como reforço operacional.

---

**Fim do Plan v1 Fase 14.**
