# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Plan v3 — FINAL)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Cada task é bite-sized (2-5 min) e termina com commit. Não pule verificações (`superpowers:verification-before-completion`).

**Data:** 2026-04-15
**Supersedes:** v2 (2026-04-15), v1 (2026-04-15)
**Status:** pronto para execução via `superpowers:subagent-driven-development` começando em 0.1.

**Goal:** Completar concerns Fase 12 (cache full integration incl. stub `/banking/accounts`, `ChatCompletion(ctx)` 1-task-por-arquivo, `/ready` 4 checks reais, coverage 30% com fallback limitado, PWA sprint 1 cleanup) + lançar foundation Open Finance (migration 000036, PluggyClient HTTP cru, `/banking/connect` + `/banking/sync` stubs, GitHub Action cron `bank-sync.yml` com retry) + wrapper `ChatCompletionLegacyAware`.

**Architecture:** Cache invalidation event-driven com `InvalidateWorkspace(ctx, wsID, scopes)`. `ChatCompletion` ganha `ctx` na interface + 3 providers + helper + caller + wrapper legacy `ChatCompletionLegacyAware`. `/ready` adiciona 3 checks (redis, whatsmeow via `whatsapp.Manager`, LLM ping com cache 5min e NoOp default). Open Finance: migration 000036 com RLS + Pluggy HTTP cru. CI ganha retry explícito em integration tests via `nick-fields/retry@v3` com fallback bash. Tag canônica: `phase-13-prepared` (consistência com Fases 10/11/12); semver `v1.x.y` fica para release formal quando deploy real ocorrer (Fase 14+).

**Tech Stack:** Go 1.26 + slog + redis/go-redis + golang-migrate + pgxpool + whatsmeow; Next.js 16 + ESLint; Postgres 16 + pgvector + RLS; GitHub Actions (schedules + retry); Pluggy API REST.

---

## Mudanças vs Plan v2 (10 itens)

1. **Ordem H.3 ⇄ A.5b**: `banking.go` agora nasce em H.3 (Open Finance), e a integração de cache do `GET /banking/accounts` foi renumerada para **H.3b** (após H.3) — elimina dependência circular "A.5b cria handler em arquivo que só existe em H.3".
2. **testcontainers v0.32+ API**: troca de `postgres.RunContainer(ctx, ...)` depreciado para **`tcpostgres.Run(ctx, "pgvector/pgvector:pg16", opts...)`** em G.1 (alias `tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"`).
3. **`nick-fields/retry@v3`** mantido como primário; adicionado **fallback bash** documentado em comentário dentro do workflow (caso action falhe em carregar).
4. **D.4 loop termination explícito**: máximo **2 iterações**. Se após iter 2 coverage ainda <30%, declarar **adiado para Fase 14** com nota em `docs/memory/coverage_roadmap.md` e ajustar gate CI temporariamente para baseline real (sem commit de gate >real).
5. **Tag semver removida**: apenas `phase-13-prepared`. I.2 não cria `v1.13.0`; nota explícita sobre semver deferir a deploy real.
6. **B.2.a ganha sub-sub-tarefa B.2.a.test** (TDD strict): antes de alterar interface, criar teste compilando a forma NOVA e falhando — depois aplicar rename.
7. **A.4 invalidation test-first**: A.4.test (teste que falha) vem **antes** de A.4 (impl helper), TDD strict conforme checklist item 7.
8. **Working directory explícito** em todo `Run:` (prefixo `cd laura-go &&` ou `cd laura-pwa &&`).
9. **Scopes de commit auditados** — todos ∈ {go, pwa, infra, ci, ops, db, e2e, security, telemetry, observability, cache, refactor, perf, lint, docs, hooks, banking, open-finance}. Corrigido `feat(cache):` → `feat(cache):` mantido; adicionado `feat(open-finance):` em alguns do H.
10. **Self-review tabular 1:1 com os 40 itens** do §15 v3 (não mais 44). STANDBYs listados à parte.

STANDBYs externos (não-tasks, anotados em H.3/H.6/H.8): `[PLUGGY-CLIENT-ID]` e `[PLUGGY-CLIENT-SECRET]`.

---

## Parte 0 — Pré-condições

### 0.1 Validar baseline Fase 12 done

- [ ] Run: `cd laura-go && go build ./... && go vet ./...`
  Expected: saída vazia, exit 0.
- [ ] Run: `cd laura-go && git tag --list 'phase-12-*'`
  Expected: linha `phase-12-prepared` presente.
- [ ] Run: `cd laura-go && git log --oneline -5`
  Expected: HEAD alinhado com fim da Fase 12.
- [ ] Se algum item falhar, parar e escalar. **Não prosseguir.**
- [ ] Commit: `chore(docs): iniciar fase 13 — baseline validado`.

### 0.2 Baseline de coverage + inventário ChatCompletion

- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-baseline.out ./... 2>&1 | tail -20`
  Expected: testes passam, `/tmp/cover-baseline.out` criado.
- [ ] Run: `cd laura-go && go tool cover -func=/tmp/cover-baseline.out | grep total`
  Expected: `total: (statements) XX.X%` (esperado ~15%). Anotar valor.
- [ ] Run: `cd laura-go && rg -c 'ChatCompletion\(' internal/services/*.go internal/handlers/*.go`
  Expected: ~5-6 matches consolidados.
- [ ] Criar `laura-go/docs/memory/phase_13_baseline.md` com: data, commit HEAD, coverage %, callsite count.
- [ ] Commit: `docs(go): registrar baseline fase 13 (coverage + inventário ChatCompletion)`.

---

## Parte A — Cache full integration

### A.1 TDD teste `InvalidateWorkspace` + `jitter`

> **TDD strict:** teste antes da impl. Build ficará vermelho até A.2.

- [ ] Criar `laura-go/internal/cache/invalidate_test.go` com:
  - `TestInvalidateWorkspace_AllScopes` (scopes vazio → wildcard `ws:%s:*`).
  - `TestInvalidateWorkspace_SpecificScopes` (3 scopes, cada um apaga só seu prefixo).
  - `TestJitter_WithinTenPercent` (100 iterações, max deviation ≤ 10%).
  - Usar `miniredis` via helper já existente (importa `github.com/alicebob/miniredis/v2`).
- [ ] Run: `cd laura-go && go test ./internal/cache/... -run Invalidate -v`
  Expected: falha de compilação (`undefined: InvalidateWorkspace`) — intencional.
- [ ] Commit: `test(cache): TDD InvalidateWorkspace + jitter (red)`.

### A.2 Implementar `InvalidateWorkspace` + `jitter`

- [ ] Criar `laura-go/internal/cache/invalidate.go`:
  ```go
  package cache

  import (
      "context"
      cryptorand "crypto/rand"
      "fmt"
      "math/big"
      "time"
  )

  func (c *Cache) InvalidateWorkspace(ctx context.Context, workspaceID string, scopes []string) error {
      if len(scopes) == 0 {
          return c.InvalidatePattern(ctx, fmt.Sprintf("ws:%s:*", workspaceID))
      }
      for _, scope := range scopes {
          pattern := fmt.Sprintf("ws:%s:%s:*", workspaceID, scope)
          if err := c.InvalidatePattern(ctx, pattern); err != nil {
              return err
          }
      }
      return nil
  }

  func jitter(base time.Duration) time.Duration {
      maxJitter := int64(float64(base) * 0.1)
      if maxJitter <= 0 {
          return base
      }
      n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(2*maxJitter))
      if err != nil {
          return base
      }
      return base + time.Duration(n.Int64()-maxJitter)
  }
  ```
- [ ] Run: `cd laura-go && go test ./internal/cache/... -run Invalidate -v`
  Expected: `PASS` nos 3 testes.
- [ ] Commit: `feat(cache): helper InvalidateWorkspace + jitter crypto-rand ±10%`.

### A.3 Cache em `GET /api/v1/score` (TTL 300s)

- [ ] Run: `cd laura-go && rg -n 'api/v1/score' internal/handlers/ --type go`
  Expected: localiza `score.go` e handler.
- [ ] Abrir handler. Envolver com `cache.GetOrSet`:
  ```go
  key := fmt.Sprintf("ws:%s:score:%s", wsID, paramsHash)
  ttl := 300 * time.Second
  out, err := h.deps.Cache.GetOrSet(ctx, key, ttl+jitter(ttl), func() (any, error) { /* fetcher existente */ })
  ```
- [ ] Criar `internal/handlers/score_test.go` com 2 cenários (hit + miss) via miniredis.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run Score -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/score (TTL 300s + jitter)`.

### A.4 Cache em `GET /api/v1/reports/monthly` (TTL 600s)

- [ ] Run: `cd laura-go && rg -n 'reports/monthly' internal/handlers/ --type go`
  Expected: localiza rota.
- [ ] Envolver handler com `cache.GetOrSet`, key `ws:%s:reports:monthly:%s`, TTL 600s+jitter.
- [ ] Adicionar `reports_monthly_test.go` com hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run ReportsMonthly -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/reports/monthly (TTL 600s + jitter)`.

### A.5 Cache em `GET /api/v1/reports/categories` (TTL 600s)

- [ ] Envolver handler, key `ws:%s:reports:categories:%s`, TTL 600s+jitter.
- [ ] Teste `reports_categories_test.go` hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run ReportsCategories -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/reports/categories (TTL 600s + jitter)`.

### A.6 Cache em `GET /api/v1/categories` (TTL 1800s)

- [ ] Envolver handler, key `ws:%s:categories:list`, TTL 1800s+jitter.
- [ ] Teste `categories_test.go` hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run Categories -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/categories (TTL 1800s + jitter)`.

### A.7 Hook invalidation em POST/PATCH/DELETE

> Stub `GET /banking/accounts` fica em H.3b (após handler existir em H.3).

- [ ] Em `POST /api/v1/transactions` (localizar via `cd laura-go && rg -n 'POST.*transactions' internal/`):
  ```go
  wsID := c.Locals("workspace_id").(string)
  _ = h.deps.Cache.InvalidateWorkspace(c.UserContext(), wsID, []string{"dashboard", "score", "reports"})
  ```
- [ ] Aplicar mesmo hook em `PATCH /api/v1/transactions/:id` e `DELETE /api/v1/transactions/:id`.
- [ ] Em `POST/PATCH/DELETE /api/v1/categories` → scopes `["categories","dashboard"]`.
- [ ] Erros de invalidation: log em `slog.Warn`, **não** falhar request.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `feat(cache): hooks invalidation event-driven em mutations (tx + categories)`.

### A.8 TDD coverage invalidation hooks

- [ ] Criar `internal/handlers/cache_invalidation_test.go` com 4 cenários:
  - `TestPOSTTransactions_InvalidatesDashboardScoreReports`
  - `TestPATCHTransactions_InvalidatesDashboardScoreReports`
  - `TestDELETETransactions_InvalidatesDashboardScoreReports`
  - `TestPOSTCategories_InvalidatesCategoriesDashboard`
- [ ] Usar miniredis: setar chave antes, chamar handler, confirmar `EXISTS` = 0 depois.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run CacheInvalidation -v`
  Expected: `PASS` 4 testes.
- [ ] Commit: `test(cache): TDD 4 hooks invalidation event-driven`.

---

## Parte B — ChatCompletion ctx propagation

### B.1 Grep callsites + baseline

- [ ] Run: `cd laura-go && rg -n 'ChatCompletion\(' internal/services/ internal/handlers/ --type go > /tmp/chatcompletion-before.txt`
  Expected: 5-6 linhas.
- [ ] Commit: `docs(go): inventário ChatCompletion callsites pré-refactor`.

### B.2.a.test TDD teste nova interface (red)

- [ ] Criar `laura-go/internal/services/llm_ctx_test.go`:
  ```go
  package services

  import (
      "context"
      "testing"
  )

  // Garante que a interface aceita ctx como primeiro arg (falha enquanto não refatorada).
  func TestLLMProvider_AcceptsCtx(t *testing.T) {
      var _ LLMProvider = (*fakeProvider)(nil)
  }

  type fakeProvider struct{}

  func (f *fakeProvider) ChatCompletion(ctx context.Context, sys, user string) (string, error) {
      return "ok", nil
  }
  ```
- [ ] Run: `cd laura-go && go test ./internal/services/... -run LLMProvider_AcceptsCtx -v`
  Expected: falha compilação (interface ainda sem ctx).
- [ ] Commit: `test(go): TDD LLMProvider.ChatCompletion(ctx) — red`.

### B.2.a Refatorar interface `LLMProvider` em `llm.go`

- [ ] Abrir `laura-go/internal/services/llm.go` linha 14:
  ```go
  // DEPOIS
  type LLMProvider interface {
      ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error)
  }
  ```
- [ ] Adicionar `"context"` nos imports se ausente.
- [ ] Build quebra nos providers — intencional.
- [ ] Commit: `refactor(go): LLMProvider.ChatCompletion aceita ctx (interface rename)`.

### B.2.b Migrar `GroqProvider.ChatCompletion` (llm.go:177)

- [ ] Alterar assinatura para aceitar `ctx context.Context`.
- [ ] Propagar `ctx` para `groqChatCompletion` helper call.
- [ ] Commit: `refactor(go): GroqProvider.ChatCompletion recebe ctx`.

### B.2.c Migrar `OpenAIProvider.ChatCompletion` (llm.go:195)

- [ ] Alterar assinatura + trocar `http.NewRequest` por `http.NewRequestWithContext(ctx, ...)`.
- [ ] Commit: `refactor(go): OpenAIProvider.ChatCompletion recebe ctx`.

### B.2.d Migrar `GoogleProvider.ChatCompletion` (llm.go:220)

- [ ] Alterar assinatura + `http.NewRequestWithContext`.
- [ ] Run: `cd laura-go && go build ./internal/services/...`
  Expected: compila exceto pelo helper pendente em B.2.e.
- [ ] Commit: `refactor(go): GoogleProvider.ChatCompletion recebe ctx`.

### B.2.e Migrar helper `groqChatCompletion` (llm_helpers.go:32)

- [ ] Alterar assinatura `groqChatCompletion(ctx context.Context, ...)` + `http.NewRequestWithContext`.
- [ ] Commit: `refactor(go): groqChatCompletion helper recebe ctx`.

### B.3 Migrar caller `nlp.go:70`

- [ ] Em `internal/services/nlp.go:70` passar `ctx` recebido do parent ao chamar `provider.ChatCompletion(ctx, sysPrompt, text)`.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `refactor(go): nlp caller propaga ctx para ChatCompletion`.

### B.4 Span OTel em helper

- [ ] Em `groqChatCompletion` adicionar:
  ```go
  ctx, span := otel.Tracer("llm").Start(ctx, "ChatCompletion")
  defer span.End()
  ```
- [ ] Import: `go.opentelemetry.io/otel`.
- [ ] Run: `cd laura-go && go test ./internal/services/... -v`
  Expected: `PASS`.
- [ ] Commit: `feat(telemetry): span OTel em ChatCompletion helper`.

### B.5 Config flag `LLM_LEGACY_NOCONTEXT`

- [ ] Em `laura-go/internal/config/config.go` adicionar:
  ```go
  LLMLegacyNoContext bool // env: LLM_LEGACY_NOCONTEXT (rollback temporário — remover Fase 14)
  ```
  Loader: `os.Getenv("LLM_LEGACY_NOCONTEXT") == "true"`.
- [ ] Commit: `feat(config): flag LLM_LEGACY_NOCONTEXT para rollback Fase 14`.

### B.6 Documentação rollback flag

- [ ] Criar `laura-go/docs/ops/llm-rollback.md`:
  - Quando usar (incidente prod, erro ctx-related).
  - Como ativar (`LLM_LEGACY_NOCONTEXT=true` + redeploy).
  - Prazo remoção (Fase 14).
- [ ] Commit: `docs(ops): runbook rollback ChatCompletion via LLM_LEGACY_NOCONTEXT`.

### B.6.b Wrapper concreto `ChatCompletionLegacyAware`

- [ ] Em `laura-go/internal/services/llm_helpers.go` adicionar:
  ```go
  // ChatCompletionLegacy — alias sem ctx (remover Fase 14). Delega para background context.
  func ChatCompletionLegacy(p LLMProvider, systemPrompt, userMessage string) (string, error) {
      return p.ChatCompletion(context.Background(), systemPrompt, userMessage)
  }

  // ChatCompletionLegacyAware — escolhe entre versão com ctx ou legacy baseado em config.
  func ChatCompletionLegacyAware(ctx context.Context, p LLMProvider, legacyMode bool, systemPrompt, userMessage string) (string, error) {
      if legacyMode {
          return ChatCompletionLegacy(p, systemPrompt, userMessage)
      }
      return p.ChatCompletion(ctx, systemPrompt, userMessage)
  }
  ```
- [ ] Em `nlp.go:70` substituir chamada direta por `ChatCompletionLegacyAware(ctx, provider, cfg.LLMLegacyNoContext, sysPrompt, text)`.
- [ ] Teste `llm_legacy_aware_test.go`:
  - `TestLegacyAware_FlagOff_UsesCtx` (mock provider recebe ctx com value).
  - `TestLegacyAware_FlagOn_UsesBackground` (mock provider recebe `context.Background()`).
- [ ] Run: `cd laura-go && go test ./internal/services/... -run LegacyAware -v`
  Expected: `PASS`.
- [ ] Commit: `feat(go): wrapper ChatCompletionLegacyAware + alias ChatCompletionLegacy`.

---

## Parte C — Health checks reais

### C.1 Wrapper `whatsapp.Manager`

- [ ] Criar `laura-go/internal/whatsapp/manager.go`:
  ```go
  package whatsapp

  import (
      "sync"
      "time"
  )

  type manager struct {
      mu       sync.RWMutex
      lastSeen time.Time
  }

  var Manager = &manager{}

  func (m *manager) IsConnected() bool {
      if Client == nil || Client.Store == nil || Client.Store.ID == nil {
          return false
      }
      return Client.IsConnected() && Client.IsLoggedIn()
  }

  func (m *manager) LastSeen() time.Time {
      m.mu.RLock()
      defer m.mu.RUnlock()
      return m.lastSeen
  }

  func (m *manager) TouchLastSeen() {
      m.mu.Lock()
      m.lastSeen = time.Now()
      m.mu.Unlock()
  }
  ```
- [ ] Run: `cd laura-go && go build ./internal/whatsapp/...`
  Expected: exit 0.
- [ ] Commit: `feat(observability): wrapper whatsapp.Manager (IsConnected/LastSeen/TouchLastSeen)`.

### C.2 Hook `TouchLastSeen` no event handler Connected

- [ ] Run: `cd laura-go && rg -n 'Connected' internal/whatsapp/client.go`
  Expected: localiza handler `*events.Connected`.
- [ ] Adicionar `Manager.TouchLastSeen()` no branch `Connected`.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `feat(observability): hook TouchLastSeen em event handler Connected`.

### C.3 `whatsappCheck` real em `/ready`

- [ ] Abrir `laura-go/internal/handlers/health.go`.
- [ ] Adicionar `LastSeenS int` em struct `Check` (json tag `last_seen_seconds,omitempty`).
- [ ] Implementar:
  ```go
  func (h *HealthHandler) whatsappCheck() Check {
      c := Check{Name: "whatsmeow"}
      if whatsapp.Manager.IsConnected() {
          c.Status = "ok"
          c.LastSeenS = int(time.Since(whatsapp.Manager.LastSeen()).Seconds())
          if c.LastSeenS > 30 {
              c.Status = "degraded"
          }
      } else {
          c.Status = "fail"
      }
      return c
  }
  ```
- [ ] Substituir mock atual no `Ready()` por `h.whatsappCheck()`.
- [ ] Commit: `feat(observability): /ready whatsappCheck real via Manager wrapper`.

### C.4 `redisCheck` em `/ready`

- [ ] Em `health.go`:
  ```go
  func (h *HealthHandler) redisCheck(ctx context.Context) Check {
      ctx2, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
      defer cancel()
      if err := h.deps.Redis.Ping(ctx2).Err(); err != nil {
          return Check{Name: "redis", Status: "fail", Reason: err.Error()}
      }
      return Check{Name: "redis", Status: "ok"}
  }
  ```
- [ ] Garantir `h.deps.Redis *redis.Client` injetado no bootstrap.
- [ ] Teste unit `health_test.go` — miniredis ok; redis down → fail.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run HealthRedis -v`
  Expected: `PASS`.
- [ ] Commit: `feat(observability): redisCheck integrado em /ready`.

### C.5 Config `LLMPingDisabled`

- [ ] Em `config.go` adicionar `LLMPingDisabled bool` lendo `LLM_PING_DISABLED` (default `true`).
- [ ] Commit: `feat(config): LLM_PING_DISABLED env var (default true)`.

### C.6 `llmCheck` com cache 5min + NoOp default

- [ ] Adicionar em `health.go` exatamente bloco spec §12.10 (var `llmPingCache` + método `llmCheck` com timeout 3s).
- [ ] Commit: `feat(observability): llmCheck cache 5min + NoOp default + timeout 3s`.

### C.7 Integrar `llmCheck` em `Ready()`

- [ ] Alterar slice em `Ready()` para `[db, redis, whatsmeow, llm]`.
- [ ] Overall logic: `fail` > `degraded` > `ok`/`skipped`.
- [ ] Teste `health_test.go` 3 cenários: LLMPingDisabled=true → skipped; mock ok → 200; mock fail → 503.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run HealthReady -v`
  Expected: `PASS` 3 testes.
- [ ] Commit: `test(observability): /ready com 4 checks (db+redis+whatsmeow+llm)`.

---

## Parte D — Coverage 30%

### D.1 Testes handlers críticos (5 endpoints)

- [ ] Adicionar testes em:
  - `internal/handlers/score_test.go` — expandir edge cases (auth failure, params inválidos).
  - `internal/handlers/reports_monthly_test.go` — período inválido, auth failure.
  - `internal/handlers/categories_test.go` — list empty, RLS isolation.
  - `internal/handlers/banking_test.go` — `/connect` 501, 200 stub.
  - `internal/handlers/banking_sync_test.go` — 401 sem token, 200 disabled.
- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-d1.out ./... && go tool cover -func=/tmp/cover-d1.out | grep total`
  Expected: coverage ≥ baseline+10%.
- [ ] Commit: `test(go): handlers críticos +coverage (score/reports/categories/banking)`.

### D.2 Testes services LLM + cache

- [ ] Criar `internal/services/llm_test.go` — `httptest.Server` mocks Groq/OpenAI/Google (success + 500 + timeout).
- [ ] Criar `internal/cache/cache_test.go` — `GetOrSet` + `InvalidatePattern` edge cases.
- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-d2.out ./... && go tool cover -func=/tmp/cover-d2.out | grep total`
  Expected: coverage ≥ baseline+15%.
- [ ] Commit: `test(go): services LLM + cache unit (httptest + miniredis)`.

### D.3 CI gate hard 30%

- [ ] Editar `.github/workflows/test.yml`:
  ```yaml
  - name: Coverage gate
    run: |
      cd laura-go
      go test -coverprofile=cover.out ./...
      PCT=$(go tool cover -func=cover.out | awk '/total:/ {print $3}' | sed 's/%//')
      echo "Coverage: $PCT%"
      awk -v p="$PCT" 'BEGIN{exit !(p+0 >= 30)}'
  ```
- [ ] Criar `laura-go/docs/memory/coverage_roadmap.md` com meta soft 50% + histórico baseline→30%→50%.
- [ ] Run: `cd laura-go && go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total`
  Expected: ≥ 30.0%.
- [ ] Commit: `ci(go): gate hard coverage 30% + roadmap soft 50%`.

### D.4 Fallback coverage (bounded, max 2 iterações)

> Executar SOMENTE se `D.3` local ficar em 27-29%. Se já ≥30%, pular inteiro.

- [ ] **Iteração 1:**
  - [ ] Run: `cd laura-go && go tool cover -func=cover.out | sort -k3 -n | head -20`
    Expected: 20 funcs menor coverage.
  - [ ] Adicionar testes em 3 handlers menores (`profile`, `webhook`, `settings`): happy path, auth failure, payload inválido.
  - [ ] Re-run: `cd laura-go && go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total`
    Expected: `PCT`.
- [ ] **Iteração 2 (se ainda <30%):**
  - [ ] Adicionar 3 testes em services/bootstrap (funcs menor coverage).
  - [ ] Re-run coverage.
- [ ] **Se após iter 2 ainda <30%:**
  - [ ] Atualizar `docs/memory/coverage_roadmap.md` com nota: "Fase 13 atingiu X% — meta 30% adiada para Fase 14".
  - [ ] Ajustar gate em `.github/workflows/test.yml` para valor real alcançado (ex.: 28) e abrir item em roadmap para subir a 30% em Fase 14.
  - [ ] Commit: `docs(go): adiar meta coverage 30% para fase 14 (iter 1+2 insuficientes)`.
- [ ] **Se ≥30% em iter 1 ou 2:**
  - [ ] Commit: `test(go): fallback coverage — atingir 30% em handlers menores`.

---

## Parte E — PWA lint cleanup sprint 1

### E.1 Script ordenação 10 arquivos

- [ ] Run (preferida):
  ```sh
  cd laura-pwa && npx eslint src/lib/actions --format json 2>/dev/null \
    | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
    | sort -k2 -nr | head -10 > /tmp/pwa-sprint1.txt
  ```
  Expected: 10 linhas `<path>\t<count>`.
- [ ] Se eslint falhar/vazio, fallback:
  ```sh
  cd laura-pwa && grep -rln ": any\b\| any\[\]\|<any>" src/lib/actions/*.ts \
    | xargs -I {} sh -c 'echo "$(grep -c "any" {})  {}"' \
    | sort -rn | head -10 > /tmp/pwa-sprint1.txt
  ```
- [ ] Copiar lista para `laura-pwa/docs/memory/pwa_sprint_1.md` (data, comando, 10 arquivos).
- [ ] Commit: `docs(pwa): lista sprint 1 cleanup (10 arquivos lib/actions)`.

### E.2 Tipar 10 arquivos sprint 1

- [ ] Para cada arquivo em `/tmp/pwa-sprint1.txt`:
  - Substituir `any` por tipo específico (Prisma `TransactionGetPayload<...>`, interfaces locais) ou `unknown` com type guard.
- [ ] Run: `cd laura-pwa && npx eslint $(cat /tmp/pwa-sprint1.txt | cut -f1)`
  Expected: 0 warnings.
- [ ] Commit: `lint(pwa): sprint 1 tipagem — 10 arquivos lib/actions sem warnings`.

### E.3 Fechar sprint 1

- [ ] Atualizar `laura-pwa/docs/memory/pwa_sprint_1.md` status `done` + delta (warnings antes/depois).
- [ ] Commit: `docs(pwa): fechar sprint 1 cleanup lib/actions`.

---

## Parte F — Lint Go + gosec

### F.1 golangci-lint v2.x check

- [ ] Run: `cd laura-go && golangci-lint run ./...`
  Expected: exit 0. Se v2 não instalado, `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`.
- [ ] Corrigir issues residuais (ignorar geradores).
- [ ] Commit: `lint(go): golangci-lint clean (v2.x)`.

### F.2 `.gosec.yml` suprimir G706+G101

- [ ] Criar `laura-go/.gosec.yml`:
  ```yaml
  exclude:
    - G706  # dir traversal FP — paths sanitized via filepath.Clean
    - G101  # hardcoded base64 FP — nonces estáticos de tests
  ```
- [ ] Atualizar CI job gosec para usar `-conf .gosec.yml`.
- [ ] Run: `cd laura-go && gosec -conf .gosec.yml ./...`
  Expected: `Issues: 0`.
- [ ] Commit: `security(go): suprimir G706+G101 FP com justificativa inline`.

### F.3 G124 testutil verificação

- [ ] Run: `cd laura-go && gosec ./internal/testutil/...`
  Expected: 0 issues.
- [ ] Se G124 surgir, aplicar `#nosec G124 -- integridade session token mock`.
- [ ] Commit (condicional): `security(go): G124 testutil final check`.

---

## Parte G — Testcontainers

### G.1 `TestMain` pgvector compartilhado (API v0.32+)

- [ ] Criar `laura-go/internal/testutil/integration.go` (build tag `//go:build integration`):
  ```go
  //go:build integration

  package testutil

  import (
      "context"
      "os"
      "testing"

      "github.com/testcontainers/testcontainers-go"
      tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
  )

  var SharedPG *tcpostgres.PostgresContainer
  var SharedDSN string

  func TestMain(m *testing.M) {
      ctx := context.Background()
      var err error
      SharedPG, err = tcpostgres.Run(ctx,
          "pgvector/pgvector:pg16",
          tcpostgres.WithDatabase("laura_test"),
          tcpostgres.WithUsername("test"),
          tcpostgres.WithPassword("test"),
          testcontainers.WithWaitStrategy(tcpostgres.DefaultWaitStrategy()),
      )
      if err != nil {
          panic(err)
      }
      SharedDSN, _ = SharedPG.ConnectionString(ctx, "sslmode=disable")
      code := m.Run()
      _ = SharedPG.Terminate(ctx)
      os.Exit(code)
  }
  ```
- [ ] Run: `cd laura-go && go build -tags=integration ./internal/testutil/...`
  Expected: exit 0.
- [ ] Commit: `test(go): TestMain pgvector shared via testcontainers v0.32+ API`.

### G.2 `TestMain` redis compartilhado

- [ ] Estender `integration.go` com `SharedRedis` + `SharedRedisAddr` via `tcredis "github.com/testcontainers/testcontainers-go/modules/redis"` usando `tcredis.Run(ctx, "redis:7-alpine", ...)`.
- [ ] Terminate ambos containers no cleanup (defer após `m.Run()`).
- [ ] Run: `cd laura-go && go build -tags=integration ./internal/testutil/...`
  Expected: exit 0.
- [ ] Commit: `test(go): TestMain redis shared via testcontainers`.

### G.3 Integration tests + CI split + retry

- [ ] Adicionar build tag `integration` em 2 testes: `handlers/banking_integration_test.go`, `cache/integration_test.go`.
- [ ] Editar `.github/workflows/test.yml` criando jobs separados:
  ```yaml
  jobs:
    test-unit:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-go@v5
          with: { go-version: '1.26' }
        - run: cd laura-go && go test ./...

    test-integration:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-go@v5
          with: { go-version: '1.26' }
        # Primary: action oficial. Fallback bash abaixo comentado caso action indisponível.
        - name: Run integration tests with retry
          uses: nick-fields/retry@v3
          with:
            timeout_minutes: 10
            max_attempts: 3
            retry_wait_seconds: 30
            command: cd laura-go && go test -tags=integration ./...
        # Fallback bash (descomentar se nick-fields/retry@v3 indisponível):
        # - name: Run integration tests (bash retry)
        #   run: |
        #     cd laura-go
        #     for i in 1 2 3; do
        #       go test -tags=integration ./... && break
        #       echo "attempt $i failed, sleeping 30s"
        #       sleep 30
        #     done
  ```
- [ ] Run (local smoke): `cd laura-go && go test -tags=integration ./internal/cache/...`
  Expected: `PASS`.
- [ ] Commit: `ci(go): split test-unit + test-integration com retry 3x (DinD mitigation)`.

---

## Parte H — Open Finance Foundation

### H.1 Migration 000036 up+down

> STANDBY: `[PLUGGY-CLIENT-ID]` / `[PLUGGY-CLIENT-SECRET]` não bloqueiam migration.

- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.up.sql` com schemas `bank_accounts` (spec §12.1) e `bank_transactions` (spec §12.2) — RLS + índices + trigger `updated_at`.
- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.down.sql`:
  ```sql
  DROP TABLE IF EXISTS bank_transactions CASCADE;
  DROP TABLE IF EXISTS bank_accounts CASCADE;
  ```
- [ ] Run: `cd laura-go && migrate -path internal/migrations -database "$DATABASE_URL" up`
  Expected: `1/u open_finance_foundation (XX.Xms)`.
- [ ] Run: `psql "$DATABASE_URL" -c '\dt bank_*'`
  Expected: 2 tabelas listadas.
- [ ] Commit: `feat(db): migration 000036 open finance foundation (bank_accounts+transactions+RLS)`.

### H.2 PluggyClient skeleton

> STANDBY: `[PLUGGY-CLIENT-ID]` / `[PLUGGY-CLIENT-SECRET]` — skeleton funciona sem.

- [ ] Criar `laura-go/internal/pluggy/client.go` com conteúdo spec §12.4a (Client struct, `NewClient`, `IsConfigured`, `CreateConnectToken` stub, `FetchTransactions` stub, `Transaction` struct).
- [ ] Run: `cd laura-go && go build ./internal/pluggy/...`
  Expected: exit 0.
- [ ] Commit: `feat(open-finance): PluggyClient skeleton HTTP cru (sem SDK)`.

### H.3 Handler `/api/v1/banking/connect` + `/sync` (cria banking.go)

> STANDBY: `[PLUGGY-CLIENT-ID]` / `[PLUGGY-CLIENT-SECRET]` — handler retorna 501 quando ausentes.

- [ ] Criar `laura-go/internal/handlers/banking.go` com struct `BankingHandler` + métodos `Connect` e `Sync` conforme spec §12.4:
  - `Connect`: 501 se `!IsConfigured()` com `standby`; 200 com `{connect_token, expires_in: 1800}` se configurado.
  - `Sync`: 401 se `X-Ops-Token` mismatch; 200 `{status:disabled}` se `FEATURE_BANK_SYNC != "on"`; 200 `{status:stub, synced_accounts:0}` caso contrário.
- [ ] Import `pluggy` package.
- [ ] Registrar rotas `POST /api/v1/banking/connect` e `POST /api/v1/banking/sync` no router.
- [ ] Adicionar `OpsToken` e `FeatureBankSync` em `config.go` (env: `OPS_TOKEN`, `FEATURE_BANK_SYNC`).
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `feat(banking): endpoints /connect + /sync stubs (501 STANDBY + 401/200)`.

### H.3b Stub `GET /api/v1/banking/accounts` + cache TTL 60s

> Fecha spec §15 item A5. Depende de H.3 (handler file existe).

- [ ] Em `laura-go/internal/handlers/banking.go` adicionar método:
  ```go
  func (h *BankingHandler) ListAccounts(c *fiber.Ctx) error {
      ctx := c.UserContext()
      wsID := c.Locals("workspace_id").(string)
      key := fmt.Sprintf("ws:%s:banking:accounts", wsID)
      ttl := 60 * time.Second
      out, err := h.deps.Cache.GetOrSet(ctx, key, ttl+jitter(ttl), func() (any, error) {
          return []struct{}{}, nil // Fase 14: SELECT de bank_accounts
      })
      if err != nil {
          return c.Status(500).JSON(fiber.Map{"error": err.Error()})
      }
      return c.JSON(fiber.Map{"accounts": out})
  }
  ```
- [ ] Registrar `GET /api/v1/banking/accounts` → `ListAccounts`.
- [ ] Teste `banking_accounts_test.go` — hit/miss + retorna `{"accounts": []}`.
- [ ] Adicionar hook invalidation em eventual `POST /api/v1/banking/accounts` stub (registrar rota placeholder que retorna 501 + chama `InvalidateWorkspace(wsID, []string{"banking","dashboard"})` antes de 501 para exercitar hook em testes).
- [ ] Teste `TestPOSTBankingAccounts_InvalidatesBankingDashboard` (miniredis: setar key, call handler, confirmar EXISTS=0).
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run 'BankingAccounts|BankingInvalidation' -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): stub GET /banking/accounts com cache TTL 60s + hook invalidation`.

### H.4 Workflow `bank-sync.yml`

- [ ] Criar `.github/workflows/bank-sync.yml` conforme spec §12.5 (cron `0 5 * * *` + workflow_dispatch + curl `X-Ops-Token: ${{ secrets.BACKUP_OPS_TOKEN }}`).
- [ ] Confirmar secret `BACKUP_OPS_TOKEN` já existe no repo.
- [ ] Commit: `ci(ops): workflow bank-sync cron diário 05:00 UTC`.

### H.5 Testes handlers banking + PluggyClient

> STANDBY: testes cobrem `IsConfigured=false` (standby válido).

- [ ] Criar `internal/handlers/banking_test.go`:
  - `TestSync_Unauthorized` — sem `X-Ops-Token` → 401.
  - `TestSync_Disabled` — flag off → 200 `status=disabled`.
  - `TestSync_StubEnabled` — flag on → 200 `status=stub`.
  - `TestConnect_NotConfigured` → 501 + array `standby`.
- [ ] Criar `internal/pluggy/client_test.go`:
  - `TestIsConfigured_False` / `TestIsConfigured_True`.
  - `TestCreateConnectToken_StubUnconfigured` → erro "pluggy not configured".
  - `TestFetchTransactions_StubUnconfigured` → erro.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... ./internal/pluggy/... -run 'Banking|Pluggy|Sync|Connect|Configured' -v`
  Expected: `PASS`.
- [ ] Commit: `test(banking): handlers + PluggyClient (401/200/501/disabled/configured)`.

### H.6 Runbook Open Finance

- [ ] Criar `laura-go/docs/ops/runbooks/open-finance.md` com 5 seções conforme spec §H.7 v2 (Quando usar / Pré-requisitos / Procedimento / Validação / Rollback). Incluir STANDBYs `[PLUGGY-CLIENT-ID]`/`[PLUGGY-CLIENT-SECRET]`.
- [ ] Commit: `docs(ops): runbook open finance (Pluggy + sync + feature flag + rollback)`.

### H.7 Env vars `.env.example`

- [ ] Adicionar em `.env.example`:
  ```
  # Open Finance (Fase 13 foundation — STANDBY)
  PLUGGY_CLIENT_ID=           # [STANDBY]
  PLUGGY_CLIENT_SECRET=       # [STANDBY]
  FEATURE_BANK_SYNC=off

  # Observability
  LLM_PING_DISABLED=true
  LLM_LEGACY_NOCONTEXT=false
  ```
- [ ] Commit: `docs(ops): PLUGGY_* + FEATURE_BANK_SYNC + LLM_* em .env.example`.

---

## Parte I — Tag + Docs

### I.1 Validações finais

- [ ] Run em sequência (parar no primeiro fail):
  - `cd laura-go && go build ./... && go vet ./...` — Expected: exit 0.
  - `cd laura-go && go test ./...` — Expected: `PASS`.
  - `cd laura-go && go test -tags=integration ./...` — Expected: `PASS`.
  - `cd laura-go && gosec -conf .gosec.yml ./...` — Expected: `Issues: 0`.
  - `cd laura-go && go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total` — Expected: ≥ 30.0% (ou valor aceito conforme D.4).
  - `cd laura-pwa && npx eslint $(cat /tmp/pwa-sprint1.txt | cut -f1)` — Expected: 0 warnings.
- [ ] Se falhar, voltar à Parte correspondente.
- [ ] Commit (se necessário): `chore(ci): validações finais fase 13 verdes`.

### I.2 Tag `phase-13-prepared`

- [ ] Run: `git tag -a phase-13-prepared -m "Fase 13 — Polish + Foundation pronta para prod"`
  Expected: tag criada local.
- [ ] Run: `git push origin phase-13-prepared`
  Expected: `[new tag] phase-13-prepared -> phase-13-prepared`.

> **Sem semver `v1.x.y` nesta fase.** Tag semver fica para release formal quando deploy real ocorrer (Fase 14+). Consistente com `phase-10-prepared`, `phase-11-prepared`, `phase-12-prepared`.

### I.3 HANDOFF + memory entry

- [ ] Atualizar `laura-go/docs/HANDOFF.md`:
  - Estado pós-Fase 13 (coverage %, endpoints stub ativos, cache full, 4 checks `/ready`).
  - STANDBYs: `[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]`.
  - Próximos Fase 14 (Pluggy Connect Widget, categorização ML, PWA sprint 2).
- [ ] Criar `laura-go/docs/memory/phase_13_complete.md`:
  - 40 itens self-review marcados.
  - Commits principais por parte.
  - Métricas: coverage delta, warnings delta PWA, gosec 0.
- [ ] Commit: `docs(go): fase 13 complete + HANDOFF atualizado`.

---

## Self-review — cobertura 1:1 dos 40 itens spec §15 v3

| # | Item spec §15 | Task v3 | Status |
|---|--------------|---------|--------|
| A1 | `internal/cache/invalidate.go` helper | A.2 (impl) + A.1 (TDD) | IN_PLAN |
| A2 | Cache `GET /api/v1/score` | A.3 | IN_PLAN |
| A3 | Cache `GET /api/v1/reports/monthly` | A.4 | IN_PLAN |
| A4 | Cache `GET /api/v1/reports/categories` | A.5 | IN_PLAN |
| A5 | Cache `GET /api/v1/banking/accounts` (stub) | **H.3b** (renumerada após H.3) | IN_PLAN |
| A6 | 4 invalidation hooks (tx/cat/banking) | A.7 + A.8 + H.3b | IN_PLAN |
| B1 | Rename interface `ChatCompletion(ctx)` | B.2.a.test + B.2.a | IN_PLAN |
| B2 | GroqProvider.ChatCompletion | B.2.b | IN_PLAN |
| B3 | OpenAIProvider.ChatCompletion | B.2.c | IN_PLAN |
| B4 | GoogleProvider.ChatCompletion | B.2.d | IN_PLAN |
| B5 | Helper `groqChatCompletion` | B.2.e | IN_PLAN |
| B6 | Caller `nlp.go:70` | B.3 | IN_PLAN |
| C1 | `redisCheck` implementado | C.4 | IN_PLAN |
| C2 | `whatsapp.Manager` wrapper | C.1 | IN_PLAN |
| C3 | Hook `TouchLastSeen` em Connected | C.2 | IN_PLAN |
| C4 | `whatsappCheck` real via Manager | C.3 | IN_PLAN |
| C5 | `llmCheck` cache 5min + NoOp + timeout 3s | C.5 + C.6 + C.7 | IN_PLAN |
| D1 | Gate hard 30% CI | D.3 | IN_PLAN |
| D2 | Testes novos handlers/services (30%) | D.1 + D.2 + D.4 fallback | IN_PLAN |
| D3 | `coverage_roadmap.md` soft 50% | D.3 | IN_PLAN |
| E1 | Executar §14.4 ordenação | E.1 | IN_PLAN |
| E2 | 10 arquivos tipados | E.2 | IN_PLAN |
| E3 | `npm run lint` passa 10 alvo | E.2 + E.3 | IN_PLAN |
| F1 | `.gosec.yml` suprime G706+G101 | F.2 | IN_PLAN |
| F2 | gosec 0 issues | F.2 | IN_PLAN |
| F3 | CI job gosec atualizado | F.2 | IN_PLAN |
| G1 | TestMain shared PG+Redis | G.1 + G.2 | IN_PLAN |
| G2 | Build tag `integration` | G.3 | IN_PLAN |
| G3 | CI split test-unit + test-integration + retry | G.3 | IN_PLAN |
| H1 | Migration 000036 up | H.1 | IN_PLAN |
| H2 | Migration 000036 down | H.1 | IN_PLAN |
| H3 | `internal/pluggy/client.go` skeleton | H.2 | IN_PLAN |
| H4 | `internal/handlers/banking.go` Connect+Sync | H.3 | IN_PLAN |
| H5 | Rotas POST /connect + /sync | H.3 | IN_PLAN |
| H6 | `.github/workflows/bank-sync.yml` | H.4 | IN_PLAN |
| H7 | Config vars PLUGGY_* + FEATURE_BANK_SYNC + OPS_TOKEN | H.3 + H.7 | IN_PLAN |
| H8 | Testes handler banking + PluggyClient | H.5 | IN_PLAN |
| I1 | `docs/HANDOFF.md` update | I.3 | IN_PLAN |
| I2 | `docs/memory/phase_13_complete.md` | I.3 | IN_PLAN |
| I3 | Git tag canônica | I.2 (`phase-13-prepared`; semver DEFERRED Fase 14+) | IN_PLAN |

**Resumo:** 40/40 IN_PLAN. 0 DEFERRED interno. STANDBYs externos = 2 (`[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]`) — anotados em H.3/H.5/H.6/H.7, não são tasks.

**Tasks extras v3 (fora do §15 mas fechando review #2):**
- B.2.a.test (TDD strict antes de rename interface).
- A.1 (TDD strict antes de impl helper).
- B.5 + B.6 + B.6.b (config flag + runbook + wrapper LegacyAware).
- D.4 fallback bounded (max 2 iter com escape clause para Fase 14).
- G.3 retry com `nick-fields/retry@v3` + fallback bash comentado.

---

## Apêndice — Comandos canônicos

### Build/vet/test

```sh
cd laura-go && go build ./... && go vet ./...
cd laura-go && go test ./...
cd laura-go && go test -tags=integration ./...
```

### Gosec

```sh
cd laura-go && gosec -conf .gosec.yml ./...
```

### Coverage

```sh
cd laura-go && go test -coverprofile=cover.out ./... \
  && go tool cover -func=cover.out | grep total
```

### Redis (miniredis local smoke)

```sh
redis-cli -h localhost -p 6379 PING
```

### Banking endpoints

```sh
# Connect (retorna 501 STANDBY até Pluggy configurado)
curl -X POST https://api.laura.finance/api/v1/banking/connect -v

# Sync manual (X-Ops-Token = BACKUP_OPS_TOKEN)
curl -X POST https://api.laura.finance/api/v1/banking/sync \
  -H "X-Ops-Token: $BACKUP_OPS_TOKEN" -v

# List accounts (cache 60s)
curl -X GET https://api.laura.finance/api/v1/banking/accounts \
  -H "Authorization: Bearer $TOKEN" -v
```

### Nota sobre `fly machine schedule`

Não usado nesta fase — worker bank-sync roda via GitHub Action cron (`.github/workflows/bank-sync.yml`). Caso Fase 14+ migre para Fly Machine schedule, comando canônico seria `fly machine run --schedule=daily --region=gru ...`.

### Migration

```sh
cd laura-go && migrate -path internal/migrations -database "$DATABASE_URL" up
cd laura-go && migrate -path internal/migrations -database "$DATABASE_URL" down 1
```

### Inventário ChatCompletion

```sh
cd laura-go && rg -n 'ChatCompletion\(' internal/services/ internal/handlers/ --type go
```
