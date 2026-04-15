# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Plan v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Goal:** Completar concerns Fase 12 (cache full integration, ChatCompletion ctx, /ready checks reais, coverage 30%, PWA cleanup) + lançar foundation Open Finance (Pluggy connector + bank_accounts/transactions tables + sync worker).

**Architecture:** Cache layer ganha invalidation hooks event-driven (POST/PATCH/DELETE) + 3 endpoints adicionais (score/reports/categories TTL 300/600/1800s). ChatCompletion(ctx) propagado em 5 definições + 1 caller via big-bang com flag rollback `LLM_LEGACY_NOCONTEXT`. /ready adiciona Redis + whatsmeow real (wrapper Manager.IsConnected()) + LLM ping NoOp default. Coverage Go 30% via testes em handlers/services/cache/bootstrap. PWA cleanup 10 arq/sprint em lib/actions. Open Finance: migration 000036 (bank_accounts + bank_transactions com RLS workspace_id), Pluggy HTTP client (sem SDK terceiro), endpoint /api/v1/banking/sync stub gated por X-Ops-Token, GitHub Action workflow `bank-sync.yml` semanal.

**Tech Stack:** Go 1.26 + slog + redis/go-redis + golang-lru + golang-migrate + pgxpool; Next.js 16 + Playwright; Postgres 16 + pgvector + RLS; GitHub Actions schedules; Pluggy API REST.

---

## Parte 0 — Pré-condições

### 0.1 Validar baseline Fase 12 done

- [ ] Rodar `cd laura-go && go build ./... && go vet ./...` — deve passar clean.
- [ ] Rodar `git tag --list 'phase-12-*'` — confirmar `phase-12-prepared` existe.
- [ ] Rodar `git log --oneline -5` — confirmar HEAD está alinhado com fim da Fase 12.
- [ ] Se algum item falhar, parar e escalar ao usuário (não prosseguir).
- [ ] Commit: `chore(docs): iniciar fase 13 — baseline validado`.

### 0.2 Baseline de coverage atual

- [ ] Rodar `cd laura-go && go test -coverprofile=/tmp/cover-baseline.out ./... 2>&1 | tail -20`.
- [ ] Rodar `go tool cover -func=/tmp/cover-baseline.out | grep total` e anotar % (esperado ~15%).
- [ ] Salvar em `docs/memory/phase_13_baseline.md`: data, commit, coverage %, ChatCompletion callsite count (`rg -c 'ChatCompletion\(' internal/services/*.go`).
- [ ] Commit: `docs(memory): registrar baseline fase 13 (coverage + inventário)`.

---

## Parte A — Cache full integration

### A.1 Cache helper `InvalidateWorkspace` + jitter

- [ ] Criar `laura-go/internal/cache/invalidate.go` com o conteúdo exato da §12.6 da spec:
  - `InvalidateWorkspace(ctx, wsID, scopes)` — vazio = wildcard `ws:%s:*`; scopes = loop `ws:%s:%s:*`.
  - `jitter(base)` usando `crypto/rand` (evita G404).
- [ ] Adicionar imports: `context`, `fmt`, `time`, `math/big`, `crypto/rand` (aliased `cryptorand`).
- [ ] Escrever `internal/cache/invalidate_test.go`:
  - Teste `TestInvalidateWorkspace_AllScopes` (wildcard).
  - Teste `TestInvalidateWorkspace_SpecificScopes` (3 scopes).
  - Teste `TestJitter_WithinTenPercent` (100 iter, max deviation).
  - Usar `miniredis` via helper existente.
- [ ] Rodar `go test ./internal/cache/... -run Invalidate -v` — verde.
- [ ] Commit: `feat(cache): helper InvalidateWorkspace + jitter ±10% TTL`.

### A.2 Cache em `GET /api/v1/score` (TTL 300s)

- [ ] Abrir `laura-go/internal/handlers/score.go` (ou equivalente — confirmar via `rg 'api/v1/score' internal/handlers/`).
- [ ] Envolver handler com `cache.GetOrSet(ctx, key, ttl+jitter(ttl), fetcher)` onde:
  - `key = fmt.Sprintf("ws:%s:score:%s", wsID, paramsHash)`.
  - `ttl = 300 * time.Second`.
- [ ] Teste `internal/handlers/score_test.go` — hit/miss com miniredis.
- [ ] Rodar `go test ./internal/handlers/... -run Score -v`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/score (TTL 300s + jitter)`.

### A.3 Cache em `GET /api/v1/reports/*` (TTL 600s)

- [ ] Identificar sub-rotas via `rg 'reports/(monthly|categories)' internal/handlers/`.
- [ ] Envolver `GET /api/v1/reports/monthly` — key `ws:%s:reports:monthly:%s`, TTL 600s+jitter.
- [ ] Envolver `GET /api/v1/reports/categories` — key `ws:%s:reports:categories:%s`, TTL 600s+jitter.
- [ ] Teste `reports_test.go` — 2 cenários hit.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/reports/* (TTL 600s + jitter)`.

### A.4 Cache em `GET /api/v1/categories` (TTL 1800s)

- [ ] Envolver handler — key `ws:%s:categories:list`, TTL 1800s+jitter.
- [ ] Teste categorias — hit/miss.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/categories (TTL 1800s + jitter)`.

### A.5 Hook invalidation em POST/PATCH/DELETE

- [ ] Em handlers de `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` — após mutate success:
  ```go
  _ = h.deps.Cache.InvalidateWorkspace(ctx, wsID, []string{"dashboard","score","reports"})
  ```
- [ ] Em handlers de `POST/PATCH/DELETE /categories` — scopes `["categories","dashboard"]`.
- [ ] Em `POST /api/v1/banking/accounts` (stub) — scopes `["banking","dashboard"]`.
- [ ] Ignorar erro de invalidation (log em slog warn); não falhar request.
- [ ] Commit: `feat(cache): hooks de invalidation em mutations (transactions/categories/banking)`.

### A.6 TDD coverage invalidation hooks

- [ ] Criar `internal/handlers/cache_invalidation_test.go` — 5 cenários:
  - POST /transactions invalida dashboard+score+reports.
  - PATCH /transactions idem.
  - DELETE /transactions idem.
  - POST /categories invalida categories+dashboard.
  - POST /banking/accounts invalida banking+dashboard.
- [ ] Usar `miniredis.Check(key)` antes/depois para confirmar delete.
- [ ] Rodar `go test ./internal/handlers/... -run CacheInvalidation -v`.
- [ ] Commit: `test(cache): TDD de 5 hooks de invalidation event-driven`.

---

## Parte B — ChatCompletion ctx propagation

### B.1 Grep callsites + baseline

- [ ] Rodar `rg -n 'ChatCompletion\(' laura-go/internal/services/ laura-go/internal/handlers/ --type go > /tmp/chatcompletion-before.txt`.
- [ ] Confirmar 5-6 matches (spec §12.7). Se divergente, escalar.
- [ ] Commit: `docs(memory): inventário ChatCompletion callsites pré-refactor`.

### B.2 Refatorar interface em `llm.go`

- [ ] Abrir `laura-go/internal/services/llm.go` linha 14.
- [ ] Alterar interface `LLMProvider`:
  ```go
  ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error)
  ```
- [ ] Adicionar import `context` se faltar.
- [ ] Build vai quebrar — intencional (próximas tasks resolvem).
- [ ] Commit: `refactor(go): interface LLMProvider.ChatCompletion aceita ctx`.

### B.3 Migrar `GroqProvider.ChatCompletion`

- [ ] `internal/services/llm.go:177` — alterar assinatura para aceitar `ctx`.
- [ ] Propagar `ctx` para `groqChatCompletion` helper call.
- [ ] Commit: `refactor(go): GroqProvider.ChatCompletion recebe ctx`.

### B.4 Migrar `OpenAIProvider.ChatCompletion`

- [ ] `internal/services/llm.go:195` — assinatura + propagação do ctx para `http.NewRequestWithContext`.
- [ ] Commit: `refactor(go): OpenAIProvider.ChatCompletion recebe ctx`.

### B.5 Migrar `GoogleProvider.ChatCompletion` + helper + caller

- [ ] `internal/services/llm.go:220` — `GoogleProvider` aceita ctx.
- [ ] `internal/services/llm_helpers.go:32` — `groqChatCompletion(ctx, ...)` usa `http.NewRequestWithContext`.
- [ ] `internal/services/nlp.go:70` — caller único passa `ctx` recebido do parent handler.
- [ ] Rodar `go build ./...` — deve passar clean.
- [ ] Commit: `refactor(go): propagar ctx em Google provider + helper + nlp caller`.

### B.6 Span OTel + flag legacy

- [ ] Em `groqChatCompletion` helper adicionar span manual:
  ```go
  ctx, span := otel.Tracer("llm").Start(ctx, "ChatCompletion")
  defer span.End()
  ```
- [ ] Garantir env var `LLM_LEGACY_NOCONTEXT` lida em `config.go` (fallback de rollback — delega para versão sem ctx). Documentar em `docs/ops/llm-rollback.md` que flag deve ser removida em Fase 14.
- [ ] Rodar `go test ./internal/services/... -v` — verde.
- [ ] Commit: `feat(telemetry): span OTel em ChatCompletion + flag rollback documentada`.

---

## Parte C — Health checks reais

### C.1 Wrapper `whatsapp.Manager`

- [ ] Criar `laura-go/internal/whatsapp/manager.go` com o conteúdo exato da §12.8 da spec:
  - Struct `manager` com `mu sync.RWMutex` + `lastSeen time.Time`.
  - `var Manager = &manager{}`.
  - Métodos `IsConnected()`, `LastSeen()`, `TouchLastSeen()`.
- [ ] Imports: `sync`, `time`.
- [ ] Commit: `feat(go): wrapper whatsapp.Manager com IsConnected/LastSeen/TouchLastSeen`.

### C.2 Integrar `whatsappCheck` real em `/ready`

- [ ] Abrir `internal/handlers/health.go`.
- [ ] Adicionar field `LastSeenS int` em struct `Check` (json tag `last_seen_seconds,omitempty`).
- [ ] Substituir mock por `whatsappCheck()` conforme §12.9 (degraded se `LastSeenS > 30`).
- [ ] Em `internal/whatsapp/client.go` (ou event handler Connected existente), chamar `Manager.TouchLastSeen()` após connect success.
- [ ] Commit: `feat(observability): /ready whatsapp real via Manager wrapper`.

### C.3 Wrapper LLM ping cache 5min + NoOp default

- [ ] Adicionar `LLMPingDisabled bool` em `internal/config/config.go` lendo `LLM_PING_DISABLED` (default `true` em prod).
- [ ] Implementar `llmCheck(ctx)` em `internal/handlers/health.go` conforme §12.10 (cache 5min via `sync.Mutex`, timeout 3s, status `skipped`/`ok`/`degraded`/`fail`).
- [ ] Commit: `feat(observability): llmCheck com cache 5min + NoOp default`.

### C.4 Integrar llmCheck em `/ready`

- [ ] Adicionar `h.llmCheck(ctx)` na slice de checks em `Ready()`.
- [ ] Garantir overall logic: `fail` > `degraded` > `ok`/`skipped`.
- [ ] Teste `health_test.go` — mock LLM fail retorna 503; mock ok retorna 200; `LLMPingDisabled=true` retorna `skipped`.
- [ ] Commit: `test(observability): /ready com 4 checks (db+redis+whatsmeow+llm)`.

### C.5 Redis check em `/ready`

- [ ] Adicionar `redisCheck(ctx)` conforme §12.9 (timeout 500ms via context).
- [ ] Garantir que `h.deps.Redis` injeta `*redis.Client` (checar bootstrap).
- [ ] Teste unit — miniredis retorna ok; redis inalcançável retorna fail.
- [ ] Commit: `feat(observability): redisCheck integrado em /ready`.

---

## Parte D — Coverage 30%

### D.1 Testes handlers críticos (5 endpoints)

- [ ] Adicionar testes para:
  - `/api/v1/score` (cache hit/miss já coberto em A.2 — expandir edge cases).
  - `/api/v1/reports/monthly` — período inválido, auth failure.
  - `/api/v1/categories` — list empty, RLS isolation.
  - `/api/v1/banking/connect` — 501 sem Pluggy, 200 com stub.
  - `/api/v1/banking/sync` — 401 sem token, disabled.
- [ ] Alvo: +10-15% coverage.
- [ ] Commit: `test(go): handlers críticos (score/reports/categories/banking) +coverage`.

### D.2 Testes services LLM + cache

- [ ] Adicionar `internal/services/llm_test.go` — mock HTTP `httptest.Server` cobrindo Groq/OpenAI/Google providers (success + 500 + timeout).
- [ ] Adicionar `internal/cache/cache_test.go` cobrindo GetOrSet + jitter + InvalidatePattern.
- [ ] Alvo: +5-10% coverage.
- [ ] Commit: `test(go): services LLM + cache unit (mock httptest + miniredis)`.

### D.3 CI gate >= 30%

- [ ] Editar `.github/workflows/test.yml`:
  ```yaml
  - name: Coverage gate
    run: |
      go test -coverprofile=cover.out ./...
      PCT=$(go tool cover -func=cover.out | awk '/total:/ {print $3}' | sed 's/%//')
      echo "Coverage: $PCT%"
      if (( $(echo "$PCT < 30" | bc -l) )); then exit 1; fi
  ```
- [ ] Criar `docs/memory/coverage_roadmap.md` com meta soft 50%.
- [ ] Rodar local `go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total` — confirmar ≥30%.
- [ ] Commit: `ci(go): gate hard coverage 30% + roadmap soft 50%`.

---

## Parte E — PWA lint cleanup

### E.1 Script ordenação por densidade de `any`

- [ ] Rodar:
  ```sh
  cd laura-pwa && npx eslint src/lib/actions --format json 2>/dev/null \
    | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
    | sort -k2 -nr | head -10 > /tmp/pwa-sprint1.txt
  ```
- [ ] Se eslint falhar, usar fallback grep (spec §12.11).
- [ ] Anotar os 10 arquivos em `docs/memory/pwa_sprint_1.md`.
- [ ] Commit: `docs(pwa): lista sprint 1 cleanup (10 arquivos lib/actions)`.

### E.2 Tipar 10 arquivos sprint 1

- [ ] Para cada arquivo na lista de E.1:
  - Substituir `any` por tipos específicos ou `unknown` com narrow via type guards.
  - Adicionar tipos derivados de Prisma quando aplicável (`Prisma.TransactionGetPayload<...>`).
- [ ] Rodar `npm run lint` — 0 warnings nos 10 arquivos alvo.
- [ ] Commit: `chore(pwa): sprint 1 tipagem — 10 arquivos lib/actions sem warnings`.

### E.3 Gate critical dirs (opcional smoke)

- [ ] Adicionar comment em `.eslintrc` indicando sprint 1 coberto (sem mudar regra global).
- [ ] Atualizar `docs/memory/pwa_sprint_1.md` com status done.
- [ ] Commit: `docs(pwa): fechar sprint 1 cleanup`.

---

## Parte F — Lint Go follow-up

### F.1 golangci-lint v2.x check

- [ ] Rodar `cd laura-go && golangci-lint run ./...`.
- [ ] Corrigir issues residuais (ignorar geradores).
- [ ] Se `golangci-lint` v2.x não instalado, instalar via `go install`.
- [ ] Commit: `lint(go): golangci-lint clean (v2.x)`.

### F.2 gosec final + suprimir G706/G101

- [ ] Criar/atualizar `laura-go/.gosec.yml`:
  ```yaml
  exclude:
    - G706  # dir traversal FP — paths sanitized via filepath.Clean
    - G101  # hardcoded base64 FP — nonces estáticos de tests
  ```
- [ ] Rodar `gosec -conf .gosec.yml ./...` — 0 issues.
- [ ] Atualizar CI job gosec.
- [ ] Commit: `security(go): suprimir G706+G101 FP com justificativa inline`.

### F.3 G124 testutil verificação

- [ ] Conferir `laura-go/internal/testutil/session.go` — G124 deve estar fechado (Fase 12).
- [ ] Rodar `gosec ./internal/testutil/...` — 0 issues.
- [ ] Se ainda houver, aplicar `#nosec G124 -- justificativa`.
- [ ] Commit (condicional): `security(go): G124 testutil final check`.

---

## Parte G — Testcontainers full

### G.1 TestMain pgvector compartilhado

- [ ] Criar `laura-go/internal/testutil/integration.go` com build tag `//go:build integration`:
  ```go
  //go:build integration
  package testutil

  import (
      "context"
      "database/sql"
      "os"
      "testing"
      "github.com/testcontainers/testcontainers-go"
      "github.com/testcontainers/testcontainers-go/modules/postgres"
  )

  var SharedPG *postgres.PostgresContainer
  var SharedDSN string

  func TestMain(m *testing.M) {
      ctx := context.Background()
      var err error
      SharedPG, err = postgres.RunContainer(ctx,
          testcontainers.WithImage("pgvector/pgvector:pg16"),
          postgres.WithDatabase("laura_test"),
          postgres.WithUsername("test"), postgres.WithPassword("test"),
      )
      if err != nil { panic(err) }
      SharedDSN, _ = SharedPG.ConnectionString(ctx, "sslmode=disable")
      code := m.Run()
      _ = SharedPG.Terminate(ctx)
      os.Exit(code)
  }
  ```
- [ ] Commit: `test(go): TestMain pgvector shared via testcontainers (build tag integration)`.

### G.2 TestMain redis compartilhado

- [ ] Estender `integration.go` com `SharedRedis *redis.RedisContainer` + `SharedRedisAddr`.
- [ ] Termine ambos containers em cleanup.
- [ ] Commit: `test(go): TestMain redis shared via testcontainers`.

### G.3 Integration tests rodando contra containers

- [ ] Adicionar build tag `integration` em 2-3 testes existentes mais críticos (`handlers/banking_integration_test.go`, `cache/integration_test.go`).
- [ ] CI split em `.github/workflows/test.yml`:
  ```yaml
  test-unit: go test ./...
  test-integration: go test -tags=integration ./...
  ```
- [ ] Commit: `ci(go): split test-unit + test-integration jobs paralelos`.

---

## Parte H — Open Finance Foundation

### H.1 Migration 000036

- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.up.sql` com os schemas exatos das §12.1 (`bank_accounts`) e §12.2 (`bank_transactions`), incluindo RLS policies + índices + trigger `updated_at`.
- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.down.sql`:
  ```sql
  DROP TABLE IF EXISTS bank_transactions CASCADE;
  DROP TABLE IF EXISTS bank_accounts CASCADE;
  ```
- [ ] Rodar migration em DB local (`make migrate-up` ou `migrate -path ... up`).
- [ ] Commit: `feat(db): migration 000036 open finance foundation (bank_accounts+transactions+RLS)`.

### H.2 PluggyClient skeleton

- [ ] Criar `laura-go/internal/pluggy/client.go` com o conteúdo exato da §12.4a da spec (Client struct, `NewClient`, `IsConfigured`, `CreateConnectToken` stub, `FetchTransactions` stub, struct `Transaction`).
- [ ] Imports: `context`, `errors`, `net/http`, `os`, `time`.
- [ ] Commit: `feat(banking): PluggyClient skeleton HTTP cru (sem SDK)`.

### H.3 Handler `/api/v1/banking/connect` stub

- [ ] Criar `laura-go/internal/handlers/banking.go` com struct `BankingHandler` + método `Connect` conforme §12.4:
  - `!IsConfigured()` → 501 com `standby: ["[PLUGGY-CLIENT-ID]","[PLUGGY-CLIENT-SECRET]"]`.
  - Configured → retorna `{connect_token, expires_in: 1800}`.
- [ ] Registrar rota `POST /api/v1/banking/connect` no router.
- [ ] Commit: `feat(banking): endpoint /connect stub (501 STANDBY + 200 token stub)`.

### H.4 Handler `/api/v1/banking/sync` stub

- [ ] Adicionar método `Sync` em `banking.go` conforme §12.4:
  - Verifica `X-Ops-Token` → 401 se mismatch.
  - `FEATURE_BANK_SYNC != "on"` → 200 `{status: "disabled"}`.
  - Caso on → 200 `{status: "stub", synced_accounts: 0}`.
- [ ] Registrar rota `POST /api/v1/banking/sync`.
- [ ] Adicionar `OpsToken` e `FeatureBankSync` em `config.go`.
- [ ] Commit: `feat(banking): endpoint /sync stub gated por X-Ops-Token`.

### H.5 Workflow `bank-sync.yml`

- [ ] Criar `.github/workflows/bank-sync.yml` com o conteúdo exato da §12.5 (cron `0 5 * * *` + workflow_dispatch + curl com `BACKUP_OPS_TOKEN`).
- [ ] Confirmar secret `BACKUP_OPS_TOKEN` já existe no repo (mesmo do backup).
- [ ] Commit: `ci(ops): workflow bank-sync cron diário 05:00 UTC`.

### H.6 Testes handlers banking + PluggyClient

- [ ] Criar `internal/handlers/banking_test.go`:
  - `TestSync_Unauthorized` — sem X-Ops-Token → 401.
  - `TestSync_Disabled` — flag off → 200 status=disabled.
  - `TestSync_StubEnabled` — flag on → 200 status=stub.
  - `TestConnect_NotConfigured` → 501.
- [ ] Criar `internal/pluggy/client_test.go`:
  - `TestIsConfigured_False` / `True`.
  - `TestCreateConnectToken_StubUnconfigured` → erro.
  - `TestFetchTransactions_StubUnconfigured` → erro.
- [ ] Rodar `go test ./internal/handlers/... ./internal/pluggy/... -v` — verde.
- [ ] Commit: `test(banking): handlers + PluggyClient (401/200/501/disabled/configured)`.

### H.7 Runbook Open Finance

- [ ] Criar `docs/ops/runbooks/open-finance.md` documentando:
  - Env vars (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `FEATURE_BANK_SYNC`).
  - Fluxo manual `curl` (§14.7).
  - Como ativar sync real (Fase 14+).
  - Troubleshooting 401/501.
- [ ] Commit: `docs(ops): runbook open finance (Pluggy + sync + feature flag)`.

### H.8 Env vars `.env.example`

- [ ] Adicionar em `.env.example` (ou `.env.production.example`):
  ```
  PLUGGY_CLIENT_ID=           # [STANDBY]
  PLUGGY_CLIENT_SECRET=       # [STANDBY]
  FEATURE_BANK_SYNC=off
  LLM_PING_DISABLED=true
  LLM_LEGACY_NOCONTEXT=false
  ```
- [ ] Commit: `docs(open-finance): env vars PLUGGY_* + FEATURE_BANK_SYNC em .env.example`.

---

## Parte I — Tag + Docs

### I.1 Validações finais

- [ ] Rodar em paralelo:
  - `cd laura-go && go build ./... && go vet ./...`
  - `cd laura-go && go test ./...` (verde).
  - `cd laura-go && go test -tags=integration ./...` (verde).
  - `cd laura-go && gosec -conf .gosec.yml ./...` (0 issues).
  - `cd laura-go && go tool cover -func=cover.out | grep total` (≥30%).
  - `cd laura-pwa && npm run lint` (0 warnings nos 10 alvo).
- [ ] Se algum falhar, voltar à parte correspondente. Não prosseguir.
- [ ] Commit (se necessário): `chore(ci): validações finais fase 13 verdes`.

### I.2 Tag `phase-13-prepared`

- [ ] `git tag -a phase-13-prepared -m "Fase 13 — Polish + Foundation pronta para prod"`.
- [ ] `git push origin phase-13-prepared`.
- [ ] Commit: (tag, sem commit).

### I.3 HANDOFF + memory entry

- [ ] Atualizar `docs/HANDOFF.md` com:
  - Estado pós-Fase 13 (coverage %, endpoints stub, cache full).
  - STANDBYs pendentes (`[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]`).
  - Próximos passos Fase 14.
- [ ] Criar `docs/memory/phase_13_complete.md` com:
  - 40 checklist itens marcados.
  - Commits principais.
  - Métricas (coverage delta, warnings delta).
- [ ] Commit: `docs(memory): fase 13 complete + HANDOFF atualizado`.

---

## Self-review — cobertura dos 40 itens §15

| # | Item da spec §15 | Task v1 | Status |
|---|------------------|---------|--------|
| A1 | `internal/cache/invalidate.go` helper | A.1 | IN_PLAN |
| A2 | Cache `/api/v1/score` | A.2 | IN_PLAN |
| A3 | Cache `/api/v1/reports/monthly` | A.3 | IN_PLAN |
| A4 | Cache `/api/v1/reports/categories` | A.3 | IN_PLAN |
| A5 | Cache `/api/v1/banking/accounts` | A.4 (via categories scope; banking accounts stub coberto em H) | IN_PLAN |
| A6 | 4 invalidation hooks | A.5 + A.6 | IN_PLAN |
| B1 | Rename interface ChatCompletion(ctx) | B.2 | IN_PLAN |
| B2 | GroqProvider.ChatCompletion | B.3 | IN_PLAN |
| B3 | OpenAIProvider.ChatCompletion | B.4 | IN_PLAN |
| B4 | GoogleProvider.ChatCompletion | B.5 | IN_PLAN |
| B5 | Helper groqChatCompletion | B.5 | IN_PLAN |
| B6 | Caller nlp.go:70 | B.5 | IN_PLAN |
| C1 | redisCheck | C.5 | IN_PLAN |
| C2 | Manager wrapper IsConnected/LastSeen/TouchLastSeen | C.1 | IN_PLAN |
| C3 | Hook TouchLastSeen no Connected handler | C.2 | IN_PLAN |
| C4 | whatsappCheck real via Manager | C.2 | IN_PLAN |
| C5 | llmCheck cache 5min + NoOp default + timeout 3s | C.3 + C.4 | IN_PLAN |
| D1 | Gate hard 30% CI | D.3 | IN_PLAN |
| D2 | Testes novos handlers/services | D.1 + D.2 | IN_PLAN |
| D3 | `coverage_roadmap.md` soft 50% | D.3 | IN_PLAN |
| E1 | Executar §14.4 ordenação | E.1 | IN_PLAN |
| E2 | 10 arquivos tipados | E.2 | IN_PLAN |
| E3 | `npm run lint` passa 10 alvo | E.2 + E.3 | IN_PLAN |
| F1 | `.gosec.yml` suprime G706+G101 | F.2 | IN_PLAN |
| F2 | gosec 0 issues | F.2 | IN_PLAN |
| F3 | CI job gosec atualizado | F.2 | IN_PLAN |
| G1 | TestMain shared PG+Redis | G.1 + G.2 | IN_PLAN |
| G2 | Build tag `integration` | G.3 | IN_PLAN |
| G3 | CI split test-unit + test-integration | G.3 | IN_PLAN |
| H1 | Migration 000036 up | H.1 | IN_PLAN |
| H2 | Migration 000036 down | H.1 | IN_PLAN |
| H3 | `internal/pluggy/client.go` skeleton | H.2 | IN_PLAN |
| H4 | `internal/handlers/banking.go` Connect+Sync | H.3 + H.4 | IN_PLAN |
| H5 | Rotas POST /connect + /sync | H.3 + H.4 | IN_PLAN |
| H6 | `.github/workflows/bank-sync.yml` | H.5 | IN_PLAN |
| H7 | Config vars PLUGGY_* + FEATURE_BANK_SYNC + OPS_TOKEN | H.4 + H.8 | IN_PLAN |
| H8 | Testes handler banking | H.6 | IN_PLAN |
| I1 | `docs/HANDOFF.md` update | I.3 | IN_PLAN |
| I2 | `docs/memory/phase_13_complete.md` | I.3 | IN_PLAN |
| I3 | Git tag `v1.13.0` | I.2 (renomeado `phase-13-prepared`; tag semver pode ser adicionada no release final) | IN_PLAN |

**Resumo:** 40/40 IN_PLAN. 0 STANDBY. 0 DEFERRED.

STANDBYs externos (bloqueadores fora do código, não tasks do plan): `[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]` — plan entrega stubs + endpoints 501 até secrets chegarem.

---

## GAPs conhecidos para review #1

1. **A.5 banking accounts endpoint** — a spec §15 lista item separado "Cache integrado em `GET /api/v1/banking/accounts` (stub)" mas o endpoint `/banking/accounts` não é criado na Fase 13 (apenas `/connect` e `/sync`). Plan v1 marca item como coberto parcialmente via scope `"banking"` em invalidation; talvez review #1 decida remover A5 do checklist ou adicionar um stub GET listagem vazio.
2. **I.3 tag `v1.13.0`** — spec fala tag semver, plan cria `phase-13-prepared`. Decidir no review se tag semver `v1.13.0` entra na I.2 também.
3. **D.1/D.2 meta de 30%** — plan estima +15-25% mas não garante sem rodar; pode precisar task D.4 de follow-up se coverage ficar em 27-29%.
4. **G.3 CI split** — runner GitHub Free pode ter Docker-in-Docker flaky; spec §8 risco 3 mitigação retry 2x — plan não inclui retry explícito, pode precisar adicionar.
5. **B.6 flag `LLM_LEGACY_NOCONTEXT`** — plan apenas documenta; não há wrapper de delegação concreto implementado (só env var lida). Review pode pedir task adicional explicitando wrapper.
