# Fase 14 — Quality Maturation + Pluggy Integration Real + PWA Typing (Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Steps em checkbox (`- [ ]`). Toda `Run:` indica working dir explícito (`cd laura-go &&` ou `cd laura-pwa &&` ou raiz do monorepo).

**Goal:** Fechar concerns Fase 13 — PWA typing sprint 1 (31 `any` em 5 arquivos), testcontainers Redis + CI split unit/integration, coverage Go ≥ 30% hard gate, Pluggy HTTP client real em `internal/pluggy/` (path real, não `internal/integrations/pluggy/`), ProcessMessageFlow `(ctx, msg) error` + `context.WithoutCancel` + deadline 30s.

**Architecture:** Reuso estrito de `laura-go/internal/testutil/integration.go` (já expõe `SharedPG`+`SharedDSN`). Pluggy: evoluir o skeleton **existente** em `laura-go/internal/pluggy/` (NÃO criar `internal/integrations/pluggy/`). PWA: zod schemas em borda, tipos canônicos em `src/types/admin.ts`. Mock httptest é único caminho de CI; sandbox real só via `workflow_dispatch`.

**Tech Stack:** Go 1.26.1 + testcontainers v0.32+ + singleflight; Next.js 16 + zod; Postgres 16; GitHub Actions `nick-fields/retry@v3`.

---

## Mudanças vs v1 (delta review #1)

1. **GAP A.1 (expect-type)** — Confirmado: `laura-pwa/package.json` **não** tem `vitest` nem `expect-type`. Fallback adotado: teste de tipo via `tsc --noEmit` em fixture `src/lib/actions/__fixtures__/adminConfig.types.test.ts` com assertivas `type _Assert = Expect<Equal<...>>` puro TypeScript. Task A.1 reescrita para NÃO assumir runtime de teste TS; testes de zod (runtime) movidos para script Node one-shot ou integrados ao pipeline `pnpm typecheck`.
2. **GAP C.1 (baseline dinâmico)** — Inserida nova **Task C.0** (baseline real coverage antes de definir alvos); C.11/C.12/C.13 ficam dinâmicas — se somatório C.2–C.10 não cruzar 30%, executar tasks extras listadas em C.0 até cruzar.
3. **GAP F.1 (golangci-lint sub-branches)** — Confirmado pelo workflow atual: está **desabilitado** com nota "v1.64.8 não suporta Go 1.26". `golangci-lint` **não está instalado local**. F.1 quebrada em **F.1.a (check version)**, **F.1.b (reabilitar se v2.x)**, **F.1.c (ADR formal se v1.x ainda)** em `docs/architecture/adr/001-golangci-lint-aguarda-v2.md`.
4. **GAP D.6 (mock API pública)** — Confirmado: pacote atual `laura-go/internal/pluggy/` só tem `client.go` + `client_test.go`, sem `MockBehaviors`/`Behavior`. D.6 passa a definir struct pública `MockBehaviors` + construtor `NewMockServer(t, MockBehaviors) *httptest.Server`.
5. **GAP F.2 (PR draft permissão)** — Quebrada em **F.2.a (tentar `gh pr create --draft`)** e **F.2.b (fallback PR normal + label `do-not-merge` + milestone Fase 15)**.
6. **Path Pluggy corrigido** — v1 referenciava `internal/integrations/pluggy/`; path real é `laura-go/internal/pluggy/` (já com skeleton). Todas as tasks D.* ajustadas.
7. **Task A.2 (zod+20 any) quebrada** — v1 tinha task única grande; v2 divide em **A.2.a (criar zod schemas)**, **A.2.b (tipar retornos Prisma e eliminar 10 primeiros `any`)**, **A.2.c (eliminar 10 `any` restantes + parse em borda)** para ficar em janelas ≤ 5 min cada.
8. **STANDBY markers** — Tasks D.* que exigem sandbox real anotadas `[STANDBY:creds,mock-ok]` — mock httptest desbloqueia CI mesmo sem creds.
9. **Working directory explícito** — Todo `Run:` prefixado com `cd laura-go &&` / `cd laura-pwa &&` / raiz conforme aplicável.
10. **Commit scopes Fase 13 + 3 novos** — Conjunto canônico expandido (base Fase 13: go, pwa, infra, ci, ops, db, e2e, security, telemetry, observability, cache, refactor, perf, lint, docs, hooks, banking, open-finance; + Fase 14: `pluggy`, `typing`, `quality` = 21 scopes).

---

## Parte 0 — Pré-condições

- [ ] **Task 0.1 — Confirmar baseline Fase 13**
  - Run: `git tag --list 'phase-13-*'` (esperado incluir `phase-13-prepared`).
  - Run: `gh run list --branch main --limit 3 --json status,conclusion` (esperado verde).
  - Run: `cd laura-go && test -f internal/testutil/integration.go && grep -E "SharedPG|SharedDSN" internal/testutil/integration.go` (esperado match).
  - Run: `go version` (esperado `go1.26.1`).
  - Commit: N/A (verificação).

- [ ] **Task 0.2 — Baseline PWA typing real (rerun grep)**
  - Run: `cd laura-pwa && grep -rE ": any\b| any\[\]|<any>" src/lib/actions/*.ts | cut -d: -f1 | sort | uniq -c | sort -rn | head -10`.
  - Run: `cd laura-pwa && grep -rE ": any\b| any\[\]|<any>" src/components src/lib/services src/lib/hooks src/lib/validators | cut -d: -f1 | sort | uniq -c | sort -rn`.
  - Esperado (confirmado 2026-04-15): `adminConfig.ts=20`, `categories.ts=3`, `userProfile.ts=2`, `AuditLogView.tsx=3`, `AdminConfigEditor.tsx=3`.
  - Se counts divergirem: parar, abrir review #2; caso contrário, seguir.
  - Criar `docs/runbooks/phase-14.md` seção "Baseline 2026-04-15" com snapshot.
  - Commit: `docs(quality): snapshot baseline PWA any counts Fase 14`.

---

## Parte A — PWA typing sprint 1

- [ ] **Task A.1 — Criar `src/types/admin.ts` + fixture de tipos (sem vitest)**
  - Novo: `laura-pwa/src/types/admin.ts`:
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
  - **Fallback sem vitest/expect-type** (laura-pwa não tem runner de teste TS): criar fixture `laura-pwa/src/types/__fixtures__/admin.types.fixture.ts` usando utilitário type-level próprio:
    ```ts
    import type { AdminConfigEntry, SettingPayload } from "../admin";
    // helpers type-level puro TS (sem dep)
    type Equal<X, Y> =
      (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
    type Expect<T extends true> = T;
    // assertions
    type _k1 = Expect<Equal<SettingPayload["key"], string>>;
    type _v1 = Expect<Equal<SettingPayload["value"], AdminConfigEntry["value"]>>;
    type _cat = Expect<Equal<AdminConfigEntry["category"], "stripe" | "resend" | "groq" | "openai" | "general">>;
    ```
  - Run: `cd laura-pwa && pnpm typecheck` (deve ficar verde; se alguma assertion quebrar, `tsc` falha).
  - Commit: `feat(typing): tipos canônicos admin config + fixture tsc-only`.

- [ ] **Task A.2.a — Zod schemas para adminConfig (validação runtime)**
  - Novo: `laura-pwa/src/lib/validators/adminConfig.ts`:
    ```ts
    import { z } from "zod";
    export const settingValueSchema = z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
    ]);
    export const settingPayloadSchema = z.object({
      key: z.string().min(1).max(128),
      value: settingValueSchema,
    });
    export const bulkUpdateSchema = z.object({
      settings: z.array(settingPayloadSchema).min(1).max(100),
    });
    export type SettingPayloadParsed = z.infer<typeof settingPayloadSchema>;
    ```
  - Run: `cd laura-pwa && pnpm typecheck`.
  - Commit: `feat(typing): zod schemas settings admin (bulk + single)`.

- [ ] **Task A.2.b — Refatorar `adminConfig.ts` parte 1 (10 primeiros `any` + retornos Prisma)**
  - Arquivo: `laura-pwa/src/lib/actions/adminConfig.ts`.
  - Importar `AdminConfigEntry`, `SettingPayload`, `AdminFormState`.
  - Substituir `any` em retornos Prisma por `Prisma.AdminConfigGetPayload<...>` ou `AdminConfigEntry`; tipar arrays `rows: AdminConfigEntry[]`.
  - Escopo desta task: **10 primeiras ocorrências** (grep retorna linhas; fazer na ordem).
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/lib/actions/adminConfig.ts` (esperado ≤ 10).
  - Commit: `refactor(typing): elimina 10 any em adminConfig.ts (fase 1/2)`.

- [ ] **Task A.2.c — Refatorar `adminConfig.ts` parte 2 (10 restantes + zod parse na borda)**
  - Arquivo: `laura-pwa/src/lib/actions/adminConfig.ts`.
  - Importar `bulkUpdateSchema` e `settingPayloadSchema`.
  - Nas server actions exportadas `updateAdminConfig` e `bulkUpdateSettings`, adicionar `const parsed = schema.parse(input)` na primeira linha útil pós auth.
  - Substituir 10 `any` restantes pelos tipos concretos.
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/lib/actions/adminConfig.ts` (esperado `0`).
  - Run: `cd laura-pwa && pnpm typecheck`.
  - Commit: `refactor(typing): zero any em adminConfig.ts + zod na borda (fase 2/2)`.

- [ ] **Task A.3 — Refatorar `categories.ts` (3 any → 0)**
  - Arquivo: `laura-pwa/src/lib/actions/categories.ts`.
  - Substituir `any` por `Prisma.CategoryGetPayload<{ include: ... }>` onde aplicável.
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/lib/actions/categories.ts` (esperado `0`).
  - Commit: `refactor(typing): Prisma types em categories action`.

- [ ] **Task A.4 — Refatorar `userProfile.ts` (2 any → 0)**
  - Arquivo: `laura-pwa/src/lib/actions/userProfile.ts`.
  - Novo validator `laura-pwa/src/lib/validators/userProfile.ts` com `updateProfileSchema` (zod).
  - Remover `as any` em merge; usar spread tipado.
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/lib/actions/userProfile.ts` (esperado `0`).
  - Commit: `refactor(typing): zod schema input userProfile`.

- [ ] **Task A.5 — Refatorar `AuditLogView.tsx` (3 any → 0)**
  - Arquivo: `laura-pwa/src/components/admin/AuditLogView.tsx`.
  - Definir `interface AuditLogRow` em `src/types/admin.ts`; tipar colunas/props.
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/components/admin/AuditLogView.tsx` (esperado `0`).
  - Commit: `refactor(typing): AuditLogRow em AuditLogView`.

- [ ] **Task A.6 — Refatorar `AdminConfigEditor.tsx` (3 any → 0)**
  - Arquivo: `laura-pwa/src/components/admin/AdminConfigEditor.tsx`.
  - Tornar componente genérico: `export function AdminConfigEditor<T extends AdminConfigEntry>(props: Props<T>)`.
  - Run: `cd laura-pwa && grep -cE ": any\b| any\[\]|<any>" src/components/admin/AdminConfigEditor.tsx` (esperado `0`).
  - Commit: `refactor(typing): props genérica AdminConfigEditor`.

- [ ] **Task A.7 — ESLint override per-file + validação final sprint 1**
  - Arquivo: `laura-pwa/eslint.config.mjs`. Adicionar bloco:
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
  - Run: `cd laura-pwa && pnpm lint` (esperado zero erros).
  - Run: `cd laura-pwa && pnpm typecheck` (verde).
  - Atualizar `docs/runbooks/phase-14.md` seção "Sprint 1 PWA typing — concluído".
  - Commit: `lint(typing): override no-explicit-any error em 5 arquivos`.

---

## Parte B — Testcontainers Redis + CI split

- [ ] **Task B.1 — Estender TestMain com SharedRedis**
  - Arquivo: `laura-go/internal/testutil/integration.go` (build tag `integration`).
  - Adicionar import: `tcredis "github.com/testcontainers/testcontainers-go/modules/redis"`.
  - Declarar vars globais: `SharedRedis *tcredis.RedisContainer`, `SharedRedisURL string`.
  - Após bloco `SharedPG` existente no `TestMain`, adicionar:
    ```go
    rc, err := tcredis.Run(ctx, "redis:7-alpine")
    if err != nil { _ = SharedPG.Terminate(ctx); fmt.Fprintln(os.Stderr, "skip: redis tc:", err); os.Exit(0) }
    SharedRedis = rc
    SharedRedisURL, err = rc.ConnectionString(ctx)
    if err != nil { _ = rc.Terminate(ctx); _ = SharedPG.Terminate(ctx); os.Exit(0) }
    ```
  - No teardown (defer/after tests), terminar `SharedRedis` antes de `SharedPG`.
  - Run: `cd laura-go && go mod tidy`.
  - Run: `cd laura-go && go build -tags=integration ./internal/testutil/...`.
  - Commit: `infra(test): testcontainers Redis em TestMain integration`.

- [ ] **Task B.2 — `cache/redis_integration_test.go`**
  - Novo: `laura-go/internal/cache/redis_integration_test.go` com `//go:build integration`.
  - Testes: `TestRedisSetGetTTL`, `TestRedisPipeline`, `TestRedisPubSubBasic` usando `testutil.SharedRedisURL`.
  - Run: `cd laura-go && go test -tags=integration -run TestRedis ./internal/cache/...`.
  - Commit: `test(cache): integration Redis TTL + pipeline + pubsub`.

- [ ] **Task B.3 — `ratelimit/redis_integration_test.go`**
  - Novo com build tag `integration`.
  - Teste sliding window: 10 req em 1s, 11ª rejeitada; confirma expiração.
  - Run: `cd laura-go && go test -tags=integration ./internal/ratelimit/...`.
  - Commit: `test(ratelimit): sliding window integration`.

- [ ] **Task B.4 — `sessions/revoke_integration_test.go`**
  - Novo com build tag `integration`.
  - Teste: insert session → revoke → get retorna `ErrSessionRevoked`.
  - Run: `cd laura-go && go test -tags=integration ./internal/sessions/...`.
  - Commit: `test(sessions): revoke flow integration`.

- [ ] **Task B.5 — CI split `test-unit` + `test-integration`**
  - Arquivo: `.github/workflows/go-ci.yml`.
  - Job `test-unit`: `cd laura-go && go test -race -count=1 ./...` (sem build tag), **required em PR**.
  - Job `test-integration`: `if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'`; uses `nick-fields/retry@v3` com `timeout_minutes: 10`, `max_attempts: 3`, comando `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=coverage.out ./...`.
  - Upload artifact `coverage.out`.
  - Commit: `ci(quality): split unit/integration + retry@v3 + required main`.

---

## Parte C — Coverage Go ≥ 30% (dinâmico)

- [ ] **Task C.0 — Baseline coverage real + lista top-10 funcs baixas**
  - Run local: `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=/tmp/cov.out ./...`.
  - Run: `cd laura-go && go tool cover -func=/tmp/cov.out | sort -k3 -n | head -20` → registrar em `docs/runbooks/phase-14.md` seção "Coverage baseline Fase 14" com **% atual total** e top-10 funcs <20%.
  - Se % total atual ≥ 30: reduzir tasks C.2–C.10 ao mínimo necessário (priorizar só handlers faltantes).
  - Se % projetado pós C.2–C.10 (estimativa +8–12pp) < 30: listar **tasks extras C.11–C.13** com alvos específicos (arquivos top-3 da lista).
  - Commit: `docs(quality): baseline coverage + roadmap dinâmico Fase 14`.

- [ ] **Task C.1 — `handlers/transactions_integration_test.go`** `[STANDBY:none]`
  - Novo com `//go:build integration`.
  - Setup: `pgxpool.New(ctx, testutil.SharedDSN)`, user fixture em tx `BEGIN/ROLLBACK defer`.
  - Casos: POST 201, GET lista paginada, GET 404, PUT 200, DELETE 204, auth 401.
  - Commit: `test(go): handlers transactions integration`.

- [ ] **Task C.2 — `handlers/messages_integration_test.go`**
  - Casos: POST mensagem, GET thread, GET não autorizado.
  - Commit: `test(go): handlers messages integration`.

- [ ] **Task C.3 — `handlers/users_integration_test.go`**
  - Casos: signup, login, me, update profile, 409 duplicate.
  - Commit: `test(go): handlers users integration`.

- [ ] **Task C.4 — `handlers/sessions_integration_test.go`**
  - Casos: create, list, revoke, revoke-all, expired.
  - Commit: `test(go): handlers sessions integration`.

- [ ] **Task C.5 — `handlers/admin_integration_test.go`**
  - Casos: RBAC admin-only 403, GET config, PUT config, audit-log append.
  - Commit: `test(go): handlers admin integration`.

- [ ] **Task C.6 — `handlers/webhooks_integration_test.go`**
  - Casos: HMAC válido 200, HMAC inválido 401, replay 409.
  - Commit: `test(go): handlers webhooks integration`.

- [ ] **Task C.7 — `services/transactionService_integration_test.go`**
  - Casos: create+categorize, soft delete, query por período.
  - Commit: `test(go): services transactionService integration`.

- [ ] **Task C.8 — `services/messageService_integration_test.go`**
  - Casos: ingest, dedupe hash, retry no erro LLM.
  - Commit: `test(go): services messageService integration`.

- [ ] **Task C.9 — `services/userService_integration_test.go`**
  - Casos: create, authenticate, password hash argon2, rotate.
  - Commit: `test(go): services userService integration`.

- [ ] **Task C.10 — Validar coverage ≥ 30% (primeira checagem)**
  - Run: `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=/tmp/cov.out ./... && go tool cover -func=/tmp/cov.out | tail -1`.
  - Se ≥ 30%: pular C.11–C.13 (marcar `[SKIP:≥30]`).
  - Se < 30%: executar C.11–C.13 nos arquivos da lista C.0.
  - Commit: N/A (validação).

- [ ] **Task C.11 — Extra coverage #1 (condicional)** `[IF C.10 < 30%]`
  - Alvo: função #1 da lista C.0 (substituir placeholder). Escrever integration test cobrindo ao menos 2 paths.
  - Commit: `test(go): cobertura <func-1> integration`.

- [ ] **Task C.12 — Extra coverage #2 (condicional)** `[IF C.10 < 30%]`
  - Alvo: função #2 da lista C.0.
  - Commit: `test(go): cobertura <func-2> integration`.

- [ ] **Task C.13 — Extra coverage #3 (condicional)** `[IF C.10 < 30%]`
  - Alvo: função #3 da lista C.0.
  - Commit: `test(go): cobertura <func-3> integration`.

- [ ] **Task C.14 — Coverage gate 30% no CI**
  - Arquivo: `.github/workflows/go-ci.yml` job `test-integration`, step novo:
    ```yaml
    - name: Coverage gate 30%
      working-directory: laura-go
      run: |
        go tool cover -func=coverage.out | tail -1 | \
          awk '{if ($3+0 < 30.0) { print "FAIL: " $3 " < 30%"; exit 1 } else { print "OK: " $3 }}'
    ```
  - Run manual: disparar workflow no branch + confirmar verde.
  - Commit: `ci(quality): hard gate coverage 30%`.

- [ ] **Task C.15 — Roadmap coverage doc**
  - Atualizar `docs/runbooks/phase-14.md` com % final atingido e alvo Fase 15 (40%).
  - Commit: `docs(quality): roadmap coverage pós Fase 14`.

---

## Parte D — Pluggy HTTP client real (`laura-go/internal/pluggy/`)

> **Path correto confirmado:** `laura-go/internal/pluggy/` (skeleton já existe com `client.go`+`client_test.go`). NÃO criar `internal/integrations/pluggy/`.

- [ ] **Task D.1 — `errors.go` com 4 sentinelas** `[STANDBY:none,mock-ok]`
  - Arquivo novo: `laura-go/internal/pluggy/errors.go`.
  - Exportar `ErrPluggyAuthFailed`, `ErrPluggyRateLimited`, `ErrPluggyNotFound`, `ErrPluggyInternal` via `errors.New`.
  - Novo teste `errors_test.go`: `errors.Is` + mensagens.
  - Run: `cd laura-go && go test ./internal/pluggy/...`.
  - Commit: `feat(pluggy): sentinelas ErrPluggy*`.

- [ ] **Task D.2 — Expandir `client.go` struct + `getAuthToken`** `[STANDBY:creds,mock-ok]`
  - Arquivo: `laura-go/internal/pluggy/client.go` (evoluir skeleton existente; **não apagar** `NewClient`/`IsConfigured`).
  - Adicionar campos na struct `Client`: `authMu sync.RWMutex`, `authToken string`, `authExp time.Time`.
  - Novo método `getAuthToken(ctx context.Context) (string, error)`: fast-path `RLock` retorna token válido; slow-path `Lock` + double-check + `POST /auth` com `{clientId, clientSecret}` body JSON; mapear status 200/401/403/429/5xx → sentinelas; `authExp = time.Now().Add(1*time.Hour + 50*time.Minute)`.
  - Adicionar `http.Client{Timeout: 15*time.Second}` se ainda não configurado.
  - Run: `cd laura-go && go build ./internal/pluggy/...`.
  - Commit: `feat(pluggy): auth cache RWMutex double-check TTL 1h50`.

- [ ] **Task D.3 — `retryableDo` + `isRetryable`** `[STANDBY:none,mock-ok]`
  - Arquivo novo: `laura-go/internal/pluggy/retry.go`.
  - `retryableDo(ctx, fn func() (*http.Response, error)) (*http.Response, error)`; backoffs `[]time.Duration{200*ms, 500*ms, 1*s}`; respeita `ctx.Done()`.
  - `isRetryable(err error) bool` → true para `ErrPluggyRateLimited` ou `ErrPluggyInternal`.
  - Novo teste `retry_test.go`: 3 falhas + sucesso; não-retriable aborta; ctx cancel.
  - Run: `cd laura-go && go test -race ./internal/pluggy/...`.
  - Commit: `feat(pluggy): retry custom 3x backoff 200/500/1000`.

- [ ] **Task D.4 — Evoluir `CreateConnectToken(ctx, opts)`** `[STANDBY:creds,mock-ok]`
  - Arquivo: `laura-go/internal/pluggy/client.go` — substituir stub existente.
  - Input novo: struct `ConnectTokenOptions{ ItemID string; Options map[string]any }`.
  - Output: struct `ConnectTokenResponse{ AccessToken string; ExpiresAt time.Time }`.
  - POST `/connect_tokens` com header `X-API-KEY: <authToken>`; encapsular em `retryableDo`.
  - Run: `cd laura-go && go build ./internal/pluggy/...`.
  - Commit: `feat(pluggy): CreateConnectToken real (substitui stub)`.

- [ ] **Task D.5 — Evoluir `FetchTransactions(ctx, itemID, opts)`** `[STANDBY:creds,mock-ok]`
  - Arquivo: `laura-go/internal/pluggy/client.go` — substituir stub existente.
  - GET `/items/{id}/transactions?pageSize=500`; suportar `pageToken` via `opts`.
  - Struct `Transaction{ID, Amount, Description, Date, CategoryID}` (evoluir a existente).
  - Parse `{results, total, totalPages}`.
  - Commit: `feat(pluggy): FetchTransactions paginado`.

- [ ] **Task D.6 — `httptest_mock.go` com API pública** `[STANDBY:none,mock-ok]`
  - Arquivo novo: `laura-go/internal/pluggy/httptest_mock.go` (sem build tag — exporta helpers consumíveis em testes).
  - Tipo exportado:
    ```go
    type MockBehaviors struct {
        AuthOK              bool
        AuthStatus          int    // override se !AuthOK
        ConnectTokenOK      bool
        TransactionsStatus  int    // default 200
        RateLimitFirstThenOK bool  // 1ª chamada 429, demais 200
        FailAllWith500      bool
    }
    func NewMockServer(t *testing.T, b MockBehaviors) *httptest.Server { ... }
    ```
  - Seeds JSON inline para `/auth`, `/connect_tokens`, `/items/*/transactions`.
  - Commit: `test(pluggy): httptest mock server público`.

- [ ] **Task D.7 — `client_test.go` suite httptest** `[STANDBY:none,mock-ok]`
  - Arquivo: `laura-go/internal/pluggy/client_test.go` — estender suite existente (não apagar testes `IsConfigured`).
  - Casos novos: auth success, auth 401 → `ErrPluggyAuthFailed`, 429→retry→OK (`RateLimitFirstThenOK: true`), 500×3 → `ErrPluggyInternal`, double-check concorrência (2 goroutines → 1 POST /auth — usar contador atomic no mock), `CreateConnectToken` OK, `FetchTransactions` paginado.
  - Run: `cd laura-go && go test -race ./internal/pluggy/...`.
  - Commit: `test(pluggy): suite completa httptest + concorrência`.

- [ ] **Task D.8 — Workflow `pluggy-smoke.yml` manual** `[STANDBY:creds]`
  - Arquivo novo: `.github/workflows/pluggy-smoke.yml`.
  - `on: workflow_dispatch` (único trigger).
  - Job: `actions/setup-go@v5` com `go-version: 1.26.1`; env `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` via `secrets.*`; `cd laura-go && go test -tags=smoke ./internal/pluggy/...`.
  - Novo arquivo `laura-go/internal/pluggy/client_smoke_test.go` com `//go:build smoke`; `t.Skip` se env vazias.
  - Commit: `ci(pluggy): workflow_dispatch smoke sandbox`.

---

## Parte E — ProcessMessageFlow ctx cascade

- [ ] **Task E.1 — Nova assinatura `ProcessMessageFlow`**
  - Arquivo: `laura-go/internal/bot/wa/processor.go`.
  - Mudar `func ProcessMessageFlow(msg Message)` → `func ProcessMessageFlow(ctx context.Context, msg Message) error`.
  - Substituir `context.Background()` internos por `ctx`.
  - Propagar erros (LLM/DB) em vez de log-and-swallow.
  - Ajustar testes existentes do pacote para nova assinatura.
  - Run: `cd laura-go && go build ./... && go test ./internal/bot/wa/...`.
  - Commit: `refactor(go): ProcessMessageFlow(ctx, msg) error`.

- [ ] **Task E.2 — Caller `wa_webhook.go` com WithoutCancel + WithTimeout**
  - Arquivo: `laura-go/internal/handlers/wa_webhook.go`.
  - Dentro do `go func()`:
    ```go
    msgCtx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 30*time.Second)
    defer cancel()
    if err := ProcessMessageFlow(msgCtx, msg); err != nil {
        logger.WarnContext(msgCtx, "wa process failed", "err", err)
    }
    ```
  - Responder `200` ao webhook imediatamente (antes da goroutine).
  - Commit: `refactor(go): WA webhook WithoutCancel + deadline 30s`.

- [ ] **Task E.3 — Span OTel manual em ProcessMessageFlow**
  - Arquivo: `laura-go/internal/bot/wa/processor.go`.
  - Adicionar:
    ```go
    tracer := otel.Tracer("wa.processor")
    ctx, span := tracer.Start(ctx, "ProcessMessageFlow")
    defer span.End()
    span.SetAttributes(attribute.String("msg.id", msg.ID), attribute.String("user.id", msg.UserID))
    ```
  - Commit: `observability(go): span ProcessMessageFlow`.

- [ ] **Task E.4 — Integration test ctx cascade**
  - Arquivo novo: `laura-go/internal/handlers/wa_webhook_integration_test.go` (`//go:build integration`).
  - Caso 1: POST webhook com header `X-Request-Id: abc-123`; aguardar goroutine (via canal `done` no mock processor); asserção log contém `request_id=abc-123` + `user_id=<fixture>`.
  - Caso 2: mock processor que `time.Sleep(31*time.Second)` → asserção log `deadline exceeded`.
  - Usar `testutil.SharedDSN` para fixture user.
  - Run: `cd laura-go && go test -tags=integration ./internal/handlers/...`.
  - Commit: `test(go): WA ctx cascade + deadline exceeded`.

---

## Parte F — Lint + flag removal + runbook

- [ ] **Task F.1.a — Check version golangci-lint**
  - Run: `golangci-lint --version 2>&1 || echo "NOT_INSTALLED"`.
  - Registrar output em `docs/runbooks/phase-14.md` seção "golangci-lint status".
  - Decisão: versão ≥ v2.0 → seguir F.1.b; v1.x ou ausente → seguir F.1.c.
  - Commit: N/A (verificação).

- [ ] **Task F.1.b — Reabilitar job golangci-lint (SE v2.x disponível)**
  - Run: `cd laura-go && golangci-lint run ./... --timeout=5m`.
  - Se zero issues: descomentar job `lint` em `.github/workflows/go-ci.yml` (atualmente comentado — confirmado 2026-04-15) usando `golangci/golangci-lint-action@v6` com `version: v2.x`.
  - Se issues > 0: categorizar, corrigir triviais em commit separado (`lint(go): fix golangci v2 <categoria>`), reabilitar só depois.
  - Commit: `ci(lint): reabilita golangci-lint v2`.

- [ ] **Task F.1.c — ADR adiamento (SE v1.x ainda)**
  - Arquivo novo: `docs/architecture/adr/001-golangci-lint-aguarda-v2.md`.
  - Seções: Contexto (Go 1.26.1 incompatível com v1.64.8), Decisão (adiar), Consequências, Critério reavaliação (golangci-lint v2.x GA com suporte Go 1.26), Data revisão (+90d).
  - Commit: `docs(lint): ADR 001 adiamento golangci-lint v2`.

- [ ] **Task F.2.a — Tentar PR draft `LLM_LEGACY_NOCONTEXT` removal**
  - Run: `git checkout -b chore/remove-llm-legacy-nocontext`.
  - Remover flag de `laura-go/internal/llm/config.go` + call sites (código condicionado).
  - Run: `cd laura-go && go build ./... && go test ./internal/llm/...`.
  - Commit: `chore(go): remove LLM_LEGACY_NOCONTEXT flag`.
  - Run: `git push -u origin chore/remove-llm-legacy-nocontext`.
  - Run: `gh pr create --draft --title "chore: remove LLM_LEGACY_NOCONTEXT flag" --body "$(cat <<'EOF'
## Resumo
Remoção da flag temporária conforme ADR 2026-04-15. Merge bloqueado até 2026-05-15 (T+30d deploy Fase 13) + métrica `llm_legacy_nocontext_activations_total == 0` por 30d contínuos.
EOF
)"`.
  - Se sucesso → seguir para F.3.
  - Se erro de permissão (`--draft` não permitido no plano gratuito): **seguir F.2.b**.
  - Commit: N/A (PR criação).

- [ ] **Task F.2.b — Fallback PR normal + label `do-not-merge` (SE F.2.a falhar)**
  - Run: `gh pr create --title "chore: remove LLM_LEGACY_NOCONTEXT flag" --body "<mesmo body>" --label "do-not-merge" --milestone "Fase 15"`.
  - Se label/milestone não existir: criar antes com `gh label create "do-not-merge" --color B60205 --description "Aguarda critério — NÃO mergear"` e `gh api repos/:owner/:repo/milestones -f title="Fase 15"`.
  - Adicionar comentário no PR: "NÃO MERGEAR antes de 2026-05-15; aguardando métrica zero 30d".
  - Commit: N/A (PR fallback).

- [ ] **Task F.2.c — ADR data-alvo LLM_LEGACY_NOCONTEXT**
  - Arquivo novo: `docs/architecture/adr/002-llm-legacy-nocontext-removal.md`.
  - Seções: Contexto, Decisão (remover 2026-05-15), Critério objetivo (`llm_legacy_nocontext_activations_total == 0` por 30d), Rollback (reverter PR).
  - Commit: `docs(go): ADR 002 remoção LLM_LEGACY_NOCONTEXT 2026-05-15`.

- [ ] **Task F.3 — Runbook migration 000036 apply**
  - Arquivo novo: `docs/operations/prod-migration-apply.md`.
  - Conteúdo: pré-reqs (backup `pg_dump+age+S3`), comando `psql $DATABASE_URL -f migrations/000036_*.sql`, validações `SELECT`, rollback plan.
  - Marcar explicitamente `⚠️ NÃO EXECUTAR — depende STANDBY FLY-PG-CREATE`.
  - Commit: `docs(ops): runbook migration 000036 prod apply`.

- [ ] **Task F.4 — Atualizar `docs/ops/alerts.md`**
  - Adicionar regras: coverage drop > 5pp em 7d; Pluggy auth failure rate > 1/min por 5min; WA deadline exceeded > 10/min.
  - Commit: `docs(ops): alertas Fase 14 — coverage + pluggy + WA deadline`.

- [ ] **Task F.5 — Expandir commit scope allowlist**
  - Arquivo: `.githooks/commit-msg` ou `scripts/validate-commit.js` (localizar com grep por `scope|allowlist` em hooks).
  - Adicionar `pluggy`, `typing`, `quality` ao regex allowlist.
  - Atualizar `docs/conventions/commits.md` (ou seção pertinente em `CLAUDE.md`) listando 21 scopes canônicos:
    `go, pwa, infra, ci, ops, db, e2e, security, telemetry, observability, cache, refactor, perf, lint, docs, hooks, banking, open-finance, pluggy, typing, quality`.
  - Run: tentar commit teste com scope `pluggy` (verificar validação).
  - Commit: `hooks(quality): scope allowlist +pluggy +typing +quality`.

---

## Parte G — Validação + tag

- [ ] **Task G.1 — Validações finais**
  - Run: `cd laura-go && go vet ./...` (verde).
  - Run: `cd laura-go && go test -race -count=1 ./...` (unit verde).
  - Run: `cd laura-go && go test -tags=integration -covermode=atomic -coverprofile=coverage.out ./...` (verde).
  - Run gate: `cd laura-go && go tool cover -func=coverage.out | tail -1 | awk '{if ($3+0 < 30.0) {exit 1}}'` (OK).
  - Run: `cd laura-pwa && pnpm lint && pnpm typecheck` (verde).
  - Se qualquer passo falhar: parar, corrigir em commit dedicado, recomeçar validações.
  - Commit: N/A (validação).

- [ ] **Task G.2 — Tag `phase-14-prepared`**
  - Run: `git tag -a phase-14-prepared -m "Fase 14: quality + pluggy real + pwa typing"`.
  - Run: `git push origin phase-14-prepared`.
  - Verificar no GitHub Actions que workflows disparam conforme esperado.
  - Commit: N/A (tag).

- [ ] **Task G.3 — HANDOFF + memory entry**
  - Atualizar `docs/HANDOFF.md`: status Fase 14 concluída, coverage % final, PWA any residuais (3 em Fase 15), PR `LLM_LEGACY_NOCONTEXT` pendente, Pluggy status (`creds-ok` ou `blocked:creds`).
  - Adicionar memory entry `~/.claude/projects/<laura>/memory/MEMORY.md` linkando `session_state_2026_04_15_fase_14.md` com: commits totais, coverage final, Pluggy status, ADRs criados (001 golangci, 002 LLM flag).
  - Commit: `docs(quality): HANDOFF Fase 14 concluída`.

---

## Self-review — mapeamento checklist §15 (spec v3) → tasks Plan v2

| # | Item §15 / DoD | Task ID | Status |
|---|---|---|---|
| 1 | `src/types/admin.ts` criado | A.1 | IN_PLAN |
| 2 | Fixture tipos sem vitest (fallback) | A.1 | IN_PLAN |
| 3 | Zod schemas `adminConfig` validators | A.2.a | IN_PLAN |
| 4 | Refatorar `adminConfig.ts` parte 1 (10 any) | A.2.b | IN_PLAN |
| 5 | Refatorar `adminConfig.ts` parte 2 (10 + borda) | A.2.c | IN_PLAN |
| 6 | Refatorar `categories.ts` (3→0) | A.3 | IN_PLAN |
| 7 | Refatorar `userProfile.ts` (2→0) | A.4 | IN_PLAN |
| 8 | Refatorar `AuditLogView.tsx` (3→0) | A.5 | IN_PLAN |
| 9 | Refatorar `AdminConfigEditor.tsx` (3→0) | A.6 | IN_PLAN |
| 10 | Override ESLint per-file + validação | A.7 | IN_PLAN |
| 11 | TestMain integration + SharedRedis | B.1 | IN_PLAN |
| 12 | `cache/redis_integration_test.go` | B.2 | IN_PLAN |
| 13 | `ratelimit/redis_integration_test.go` | B.3 | IN_PLAN |
| 14 | `sessions/revoke_integration_test.go` | B.4 | IN_PLAN |
| 15 | CI split unit/integration + retry@v3 | B.5 | IN_PLAN |
| 16 | Baseline coverage + roadmap dinâmico | C.0 | IN_PLAN |
| 17 | `handlers/transactions_integration_test.go` | C.1 | IN_PLAN |
| 18 | `handlers/messages_integration_test.go` | C.2 | IN_PLAN |
| 19 | `handlers/users_integration_test.go` | C.3 | IN_PLAN |
| 20 | `handlers/sessions_integration_test.go` | C.4 | IN_PLAN |
| 21 | `handlers/admin_integration_test.go` | C.5 | IN_PLAN |
| 22 | `handlers/webhooks_integration_test.go` | C.6 | IN_PLAN |
| 23 | `services/transactionService_integration_test.go` | C.7 | IN_PLAN |
| 24 | `services/messageService_integration_test.go` | C.8 | IN_PLAN |
| 25 | `services/userService_integration_test.go` | C.9 | IN_PLAN |
| 26 | Validar coverage ≥ 30% antes de gate | C.10 | IN_PLAN |
| 27 | Extra coverage #1 (condicional) | C.11 | CONDITIONAL |
| 28 | Extra coverage #2 (condicional) | C.12 | CONDITIONAL |
| 29 | Extra coverage #3 (condicional) | C.13 | CONDITIONAL |
| 30 | Coverage gate 30% CI | C.14 | IN_PLAN |
| 31 | Roadmap coverage doc | C.15 | IN_PLAN |
| 32 | `pluggy/errors.go` sentinelas | D.1 | IN_PLAN |
| 33 | Auth cache RWMutex double-check TTL 1h50 | D.2 | IN_PLAN `[STANDBY:creds,mock-ok]` |
| 34 | `retryableDo` + `isRetryable` | D.3 | IN_PLAN |
| 35 | `CreateConnectToken` real | D.4 | IN_PLAN `[STANDBY:creds,mock-ok]` |
| 36 | `FetchTransactions` paginado | D.5 | IN_PLAN `[STANDBY:creds,mock-ok]` |
| 37 | `httptest_mock.go` API pública | D.6 | IN_PLAN |
| 38 | Suite unit httptest + concorrência | D.7 | IN_PLAN |
| 39 | `pluggy-smoke.yml` workflow_dispatch | D.8 | IN_PLAN `[STANDBY:creds]` |
| 40 | `ProcessMessageFlow(ctx, msg) error` | E.1 | IN_PLAN |
| 41 | Caller WithoutCancel + WithTimeout(30s) | E.2 | IN_PLAN |
| 42 | Span OTel ProcessMessageFlow | E.3 | IN_PLAN |
| 43 | Integration test request_id + user_id | E.4 | IN_PLAN |
| 44 | Integration test deadline 31s | E.4 | IN_PLAN |
| 45 | golangci-lint version check | F.1.a | IN_PLAN |
| 46 | Reabilitar golangci-lint (se v2) | F.1.b | CONDITIONAL |
| 47 | ADR 001 adiamento (se v1) | F.1.c | CONDITIONAL |
| 48 | PR draft removal flag (path feliz) | F.2.a | IN_PLAN |
| 49 | PR fallback normal + label (se bloqueio) | F.2.b | CONDITIONAL |
| 50 | ADR 002 data-alvo LLM flag | F.2.c | IN_PLAN |
| 51 | Runbook `prod-migration-apply.md` | F.3 | IN_PLAN |
| 52 | Atualizar `docs/ops/alerts.md` | F.4 | IN_PLAN |
| 53 | Scope allowlist +pluggy/typing/quality | F.5 | IN_PLAN |
| 54 | Validações finais G.1 | G.1 | IN_PLAN |
| 55 | Tag `phase-14-prepared` + push | G.2 | IN_PLAN |
| 56 | HANDOFF + memory entry | G.3 | IN_PLAN |

**Cobertura:** 56 linhas; **48 IN_PLAN incondicionais** + **6 CONDITIONAL** (C.11/C.12/C.13/F.1.b/F.1.c/F.2.b — mutuamente exclusivas em pares) + **0 STANDBY bloqueante** (todas com fallback mock). Total real de tasks no plan: **58** (0.1, 0.2, A.1, A.2.a, A.2.b, A.2.c, A.3, A.4, A.5, A.6, A.7, B.1–B.5, C.0–C.15, D.1–D.8, E.1–E.4, F.1.a, F.1.b, F.1.c, F.2.a, F.2.b, F.2.c, F.3, F.4, F.5, G.1, G.2, G.3).

**Extras fora §15:** Task C.0 (baseline dinâmico); Task C.11–C.13 (fallback dinâmico coverage); Task F.1.a/b/c (sub-branches golangci); Task F.2.a/b (sub-branches PR draft); Task A.1 fixture tsc-only (fallback vitest ausente) — todos justificados por GAPs review #1.

---

**Fim do Plan v2 Fase 14.**
