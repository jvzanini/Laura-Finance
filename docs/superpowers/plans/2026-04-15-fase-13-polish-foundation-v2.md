# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plan task-a-task. Steps em checkbox (`- [ ]`). Cada task é bite-sized (2-5 min) e termina com commit.

**Goal:** Completar concerns Fase 12 (cache full integration incl. stub `/banking/accounts`, `ChatCompletion(ctx)` 1-task-por-arquivo, `/ready` 4 checks reais, coverage 30% com fallback D.4, PWA sprint 1 cleanup) + lançar foundation Open Finance (migration 000036, PluggyClient HTTP cru, `/banking/connect` + `/banking/sync` stubs, GitHub Action cron `bank-sync.yml` com retry) + wrapper de delegação concreto para `LLM_LEGACY_NOCONTEXT`.

**Architecture:** Cache invalidation event-driven com `InvalidateWorkspace(ctx, wsID, scopes)` (wildcard se scopes vazio, senão loop por scope). `ChatCompletion` ganha `ctx` na interface + 3 providers + helper + caller + wrapper legacy `ChatCompletionLegacyAware`. `/ready` adiciona 3 checks (redis, whatsmeow via `whatsapp.Manager` wrapper, LLM ping com cache 5min e NoOp default). Open Finance: migration 000036 com RLS + Pluggy HTTP cru (sem SDK) + endpoints 501/401 até secrets. CI ganha retry explícito em integration tests via `nick-fields/retry@v3`. Tag canônica: `phase-13-prepared` (consistência com Fases 10/11/12); semver `v1.13.0` fica para release formal futura.

**Tech Stack:** Go 1.26 + slog + redis/go-redis + golang-migrate + pgxpool + whatsmeow; Next.js 16 + ESLint; Postgres 16 + pgvector + RLS; GitHub Actions (schedules + retry); Pluggy API REST.

---

## Mudanças vs Plan v1 (9 itens)

1. **A.5b nova** — stub `GET /api/v1/banking/accounts` (lista vazia) + cache TTL 60s + scope `banking`, fechando o item A5 da spec §15 que v1 marcava como parcial.
2. **B.2 quebrada em 5 sub-tasks** (B.2.a..B.2.e) — 1 arquivo por task, big-bang mas granular (cada task <5 min, cada task termina em commit compilável ou explicitamente vermelho com flag `WIP`).
3. **B.6.b nova** — wrapper concreto `ChatCompletionLegacyAware(ctx, prompt)` + alias `ChatCompletionLegacy(prompt)` (não apenas documentação).
4. **D.4 nova** — fallback de coverage: se baseline + D.1..D.3 < 30%, adicionar testes em handlers menores (`profile`, `webhook`, `settings`) até hit; loop com medição até meta.
5. **G.3 ganha retry explícito** via `nick-fields/retry@v3` (3 tentativas, 30s entre) mitigando Docker-in-Docker flaky.
6. **Tag canônica `phase-13-prepared`** fixada em I.2 (sem semver `v1.13.0` neste ciclo — deixado para release formal Fase 14+).
7. **Código completo inline** em A.4 (InvalidateWorkspace), A.5 (hook POST /transactions), B.2.a (interface diff), C.1 (Manager wrapper) — nada de placeholder "conforme spec §X".
8. **H.1/H.2 referenciam spec §12.1-§12.4a** mas com caminhos exatos e blocos SQL/Go reproduzidos para facilitar copy-paste sem abrir outro arquivo.
9. **H.7 runbook com estrutura mínima concreta** — 5 seções (Quando usar / Pré-requisitos / Procedimento / Validação / Rollback) em vez de bullet genérico.

STANDBYs externos (não-tasks): `[PLUGGY-CLIENT-ID]` e `[PLUGGY-CLIENT-SECRET]` — anotados em H.3 (endpoint retorna 501), H.6 (PluggyClient testa `IsConfigured=false` path), H.8 (.env.example).

---

## Parte 0 — Pré-condições

### 0.1 Validar baseline Fase 12 done

- [ ] Run: `cd laura-go && go build ./... && go vet ./...`
  Expected: saída vazia, exit 0.
- [ ] Run: `git tag --list 'phase-12-*'`
  Expected: linha `phase-12-prepared` presente.
- [ ] Run: `git log --oneline -5`
  Expected: HEAD alinhado com fim da Fase 12 (commits contextuais).
- [ ] Se algum item falhar, parar e escalar ao usuário. **Não prosseguir.**
- [ ] Commit: `chore(docs): iniciar fase 13 — baseline validado`.

### 0.2 Baseline de coverage + inventário ChatCompletion

- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-baseline.out ./... 2>&1 | tail -20`
  Expected: testes passam, arquivo `/tmp/cover-baseline.out` existe.
- [ ] Run: `go tool cover -func=/tmp/cover-baseline.out | grep total`
  Expected: linha `total: (statements) XX.X%` (esperado ~15%). Anotar valor.
- [ ] Run: `rg -c 'ChatCompletion\(' laura-go/internal/services/*.go laura-go/internal/handlers/*.go`
  Expected: ~5-6 matches consolidados (alinhado com spec §12.7).
- [ ] Criar `laura-go/docs/memory/phase_13_baseline.md` com: data, commit HEAD, coverage %, callsite count.
- [ ] Commit: `docs(memory): registrar baseline fase 13 (coverage + inventário ChatCompletion)`.

---

## Parte A — Cache full integration

### A.1 Cache helper `InvalidateWorkspace` + jitter

- [ ] Criar `laura-go/internal/cache/invalidate.go`:
  ```go
  package cache

  import (
      "context"
      "fmt"
      "math/big"
      "time"

      cryptorand "crypto/rand"
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
- [ ] Criar `laura-go/internal/cache/invalidate_test.go` com:
  - `TestInvalidateWorkspace_AllScopes` (scopes vazio → wildcard).
  - `TestInvalidateWorkspace_SpecificScopes` (3 scopes, cada um apaga só seu prefixo).
  - `TestJitter_WithinTenPercent` (100 iterações, max deviation ≤ 10%).
  - Usar `miniredis` via helper já existente.
- [ ] Run: `cd laura-go && go test ./internal/cache/... -run Invalidate -v`
  Expected: `PASS` em ambos testes.
- [ ] Commit: `feat(cache): helper InvalidateWorkspace + jitter ±10% TTL`.

### A.2 Cache em `GET /api/v1/score` (TTL 300s)

- [ ] Run: `rg -n 'api/v1/score' laura-go/internal/handlers/ --type go`
  Expected: localiza arquivo `score.go` e handler.
- [ ] Abrir handler identificado. Envolver com `cache.GetOrSet`:
  ```go
  key := fmt.Sprintf("ws:%s:score:%s", wsID, paramsHash)
  ttl := 300 * time.Second
  out, err := h.deps.Cache.GetOrSet(ctx, key, ttl+jitter(ttl), func() (any, error) { /* fetcher existente */ })
  ```
- [ ] Criar `internal/handlers/score_test.go` com 2 cenários (hit + miss) via miniredis.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run Score -v`
  Expected: `PASS` 2 testes.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/score (TTL 300s + jitter)`.

### A.3 Cache em `GET /api/v1/reports/monthly` (TTL 600s)

- [ ] Run: `rg -n 'reports/monthly' laura-go/internal/handlers/ --type go`
  Expected: localiza rota.
- [ ] Envolver handler com `cache.GetOrSet`, `key = ws:%s:reports:monthly:%s`, TTL 600s+jitter.
- [ ] Adicionar teste `reports_monthly_test.go` com hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run ReportsMonthly -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/reports/monthly (TTL 600s + jitter)`.

### A.4 Cache em `GET /api/v1/reports/categories` (TTL 600s)

- [ ] Envolver handler `GET /api/v1/reports/categories`, key `ws:%s:reports:categories:%s`, TTL 600s+jitter.
- [ ] Teste `reports_categories_test.go` com hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run ReportsCategories -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/reports/categories (TTL 600s + jitter)`.

### A.5 Cache em `GET /api/v1/categories` (TTL 1800s)

- [ ] Envolver handler `GET /api/v1/categories`, key `ws:%s:categories:list`, TTL 1800s+jitter.
- [ ] Teste `categories_test.go` com hit/miss.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run Categories -v`
  Expected: `PASS`.
- [ ] Commit: `feat(cache): integrar cache em /api/v1/categories (TTL 1800s + jitter)`.

### A.5b Stub `GET /api/v1/banking/accounts` + cache TTL 60s

> Fecha spec §15 item A5 (“Cache integrado em `GET /api/v1/banking/accounts`”). Handler não existia na Fase 13; criar stub mínimo.

- [ ] Em `laura-go/internal/handlers/banking.go` (criado na parte H, mas stub de GET pode vir antes):
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
- [ ] Registrar rota `GET /api/v1/banking/accounts` apontando para `ListAccounts`.
- [ ] Teste `banking_accounts_test.go` — hit/miss + retorna `{"accounts": []}`.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run BankingAccounts -v`
  Expected: `PASS`.
- [ ] Commit: `feat(banking): stub GET /api/v1/banking/accounts com cache TTL 60s`.

### A.6 Hook invalidation em POST/PATCH/DELETE

- [ ] Em `POST /api/v1/transactions` (localizar via `rg -n 'POST.*transactions' laura-go/internal/`):
  ```go
  // POST /api/v1/transactions
  func (h *TxHandler) Create(c *fiber.Ctx) error {
      // ... lógica existente
      wsID := c.Locals("workspace_id").(string)
      _ = h.deps.Cache.InvalidateWorkspace(c.UserContext(), wsID, []string{"dashboard", "score", "reports"})
      return c.JSON(result)
  }
  ```
- [ ] Aplicar mesmo hook em `PATCH /api/v1/transactions/:id` e `DELETE /api/v1/transactions/:id`.
- [ ] Em `POST/PATCH/DELETE /api/v1/categories` → scopes `["categories","dashboard"]`.
- [ ] Em `POST /api/v1/banking/accounts` (stub ainda — placeholder de rota): scopes `["banking","dashboard"]`.
- [ ] Erros de invalidation: log em `slog.Warn`, **não** falhar request.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `feat(cache): hooks invalidation em mutations (transactions/categories/banking)`.

### A.7 TDD coverage invalidation hooks

- [ ] Criar `internal/handlers/cache_invalidation_test.go` com 5 cenários:
  - `TestPOSTTransactions_InvalidatesDashboardScoreReports`
  - `TestPATCHTransactions_InvalidatesDashboardScoreReports`
  - `TestDELETETransactions_InvalidatesDashboardScoreReports`
  - `TestPOSTCategories_InvalidatesCategoriesDashboard`
  - `TestPOSTBankingAccounts_InvalidatesBankingDashboard`
- [ ] Usar miniredis: setar chave antes, chamar handler, confirmar `EXISTS` = 0 depois.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... -run CacheInvalidation -v`
  Expected: `PASS` 5 testes.
- [ ] Commit: `test(cache): TDD 5 hooks invalidation event-driven`.

---

## Parte B — ChatCompletion ctx propagation (granular 1-arquivo-por-task)

### B.1 Grep callsites + baseline

- [ ] Run: `rg -n 'ChatCompletion\(' laura-go/internal/services/ laura-go/internal/handlers/ --type go > /tmp/chatcompletion-before.txt`
  Expected: arquivo com 5-6 linhas (spec §12.7). Se divergente, escalar.
- [ ] Commit: `docs(memory): inventário ChatCompletion callsites pré-refactor`.

### B.2.a Refatorar interface `LLMProvider` em `llm.go`

- [ ] Abrir `laura-go/internal/services/llm.go` linha 14.
  ```go
  // ANTES
  type LLMProvider interface {
      ChatCompletion(systemPrompt, userMessage string) (string, error)
  }

  // DEPOIS
  type LLMProvider interface {
      ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error)
  }
  ```
- [ ] Adicionar `"context"` nos imports se ausente.
- [ ] Build vai quebrar nos implementadores — intencional. Próximas tasks resolvem.
- [ ] Commit: `refactor(go): LLMProvider.ChatCompletion aceita ctx (interface rename)`.

### B.2.b Migrar `GroqProvider.ChatCompletion` (llm.go:177)

- [ ] Alterar assinatura de `GroqProvider.ChatCompletion` para aceitar `ctx`.
- [ ] Propagar `ctx` para `groqChatCompletion` helper call.
- [ ] Run: `cd laura-go && go build ./internal/services/...`
  Expected: falha apenas nos providers OpenAI/Google ainda não migrados (B.2.c/d).
- [ ] Commit: `refactor(go): GroqProvider.ChatCompletion recebe ctx`.

### B.2.c Migrar `OpenAIProvider.ChatCompletion` (llm.go:195)

- [ ] Alterar assinatura + trocar `http.NewRequest` por `http.NewRequestWithContext(ctx, ...)`.
- [ ] Commit: `refactor(go): OpenAIProvider.ChatCompletion recebe ctx`.

### B.2.d Migrar `GoogleProvider.ChatCompletion` (llm.go:220)

- [ ] Alterar assinatura + propagar `ctx` em `http.NewRequestWithContext`.
- [ ] Run: `cd laura-go && go build ./internal/services/...`
  Expected: build passa em `services/llm.go` (helper ainda pode quebrar — B.2.e resolve).
- [ ] Commit: `refactor(go): GoogleProvider.ChatCompletion recebe ctx`.

### B.2.e Migrar helper `groqChatCompletion` (llm_helpers.go:32)

- [ ] Alterar assinatura para `groqChatCompletion(ctx context.Context, ...)` e usar `http.NewRequestWithContext`.
- [ ] Commit: `refactor(go): groqChatCompletion helper recebe ctx`.

### B.3 Migrar caller `nlp.go:70`

- [ ] `internal/services/nlp.go:70` — passar `ctx` recebido do parent handler ao chamar `provider.ChatCompletion(ctx, sysPrompt, text)`.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0 (cadeia compila inteira agora).
- [ ] Commit: `refactor(go): nlp caller propaga ctx para ChatCompletion`.

### B.4 Span OTel em helper

- [ ] Em `groqChatCompletion` helper adicionar:
  ```go
  ctx, span := otel.Tracer("llm").Start(ctx, "ChatCompletion")
  defer span.End()
  ```
- [ ] Imports: `go.opentelemetry.io/otel`.
- [ ] Run: `cd laura-go && go test ./internal/services/... -v`
  Expected: `PASS` (testes atuais).
- [ ] Commit: `feat(telemetry): span OTel em ChatCompletion helper`.

### B.5 Config flag `LLM_LEGACY_NOCONTEXT`

- [ ] Em `laura-go/internal/config/config.go` adicionar:
  ```go
  LLMLegacyNoContext bool // env: LLM_LEGACY_NOCONTEXT (rollback temporário Fase 14 remove)
  ```
  Ler via `os.Getenv("LLM_LEGACY_NOCONTEXT") == "true"` no loader.
- [ ] Commit: `feat(config): flag LLM_LEGACY_NOCONTEXT para rollback Fase 14`.

### B.6 Documentação rollback flag

- [ ] Criar `laura-go/docs/ops/llm-rollback.md` documentando:
  - Quando usar (incidente prod, erro ctx-related em ChatCompletion).
  - Como ativar (`LLM_LEGACY_NOCONTEXT=true` + redeploy).
  - Prazo para remoção (Fase 14).
- [ ] Commit: `docs(ops): runbook rollback ChatCompletion via LLM_LEGACY_NOCONTEXT`.

### B.6.b Wrapper concreto `ChatCompletionLegacyAware`

> Garante que a flag B.5 tem **efeito real** (não só lida do env).

- [ ] Em `laura-go/internal/services/llm_helpers.go` adicionar:
  ```go
  // ChatCompletionLegacy — alias temporário sem ctx (remover Fase 14).
  // Delega para background context + versão com ctx.
  func ChatCompletionLegacy(p LLMProvider, systemPrompt, userMessage string) (string, error) {
      return p.ChatCompletion(context.Background(), systemPrompt, userMessage)
  }

  // ChatCompletionLegacyAware — wrapper que escolhe entre versão com ctx ou legacy
  // baseado em config.LLMLegacyNoContext. Callers de alto nível usam este.
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
- [ ] Commit: `feat(llm): wrapper ChatCompletionLegacyAware + alias ChatCompletionLegacy`.

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
- [ ] Commit: `feat(whatsapp): wrapper Manager com IsConnected/LastSeen/TouchLastSeen`.

### C.2 Hook `TouchLastSeen` no event handler Connected

- [ ] Run: `rg -n 'Connected' laura-go/internal/whatsapp/client.go`
  Expected: localiza handler de evento `*events.Connected`.
- [ ] Adicionar `Manager.TouchLastSeen()` dentro do branch `Connected`.
- [ ] Run: `cd laura-go && go build ./...`
  Expected: exit 0.
- [ ] Commit: `feat(whatsapp): hook TouchLastSeen em event handler Connected`.

### C.3 `whatsappCheck` real em `/ready`

- [ ] Abrir `laura-go/internal/handlers/health.go`.
- [ ] Adicionar field `LastSeenS int` em struct `Check` (json tag `last_seen_seconds,omitempty`).
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
- [ ] Substituir o mock atual no `Ready()` por `h.whatsappCheck()`.
- [ ] Commit: `feat(observability): /ready whatsappCheck real via Manager wrapper`.

### C.4 `redisCheck` em `/ready`

- [ ] Adicionar em `health.go`:
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

- [ ] Adicionar em `health.go` exatamente o bloco da spec §12.10 (var `llmPingCache` + método `llmCheck`).
- [ ] Commit: `feat(observability): llmCheck cache 5min + NoOp default + timeout 3s`.

### C.7 Integrar `llmCheck` em `Ready()`

- [ ] Alterar slice de checks em `Ready()` para `[db, redis, whatsmeow, llm]`.
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
  - `internal/handlers/banking_test.go` — `/connect` 501 sem Pluggy, 200 com stub (configurado).
  - `internal/handlers/banking_sync_test.go` — 401 sem token, 200 disabled.
- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-d1.out ./... && go tool cover -func=/tmp/cover-d1.out | grep total`
  Expected: coverage total ≥ baseline+10%.
- [ ] Commit: `test(go): handlers críticos +coverage (score/reports/categories/banking)`.

### D.2 Testes services LLM + cache

- [ ] Criar `internal/services/llm_test.go` — `httptest.Server` mocks para Groq/OpenAI/Google (success + 500 + timeout).
- [ ] Criar `internal/cache/cache_test.go` — `GetOrSet` + `InvalidatePattern` + jitter (já parte em A.1, expandir edge cases).
- [ ] Run: `cd laura-go && go test -coverprofile=/tmp/cover-d2.out ./... && go tool cover -func=/tmp/cover-d2.out | grep total`
  Expected: coverage total ≥ baseline+15% (acumulado D.1+D.2).
- [ ] Commit: `test(go): services LLM + cache unit (httptest + miniredis)`.

### D.3 CI gate hard 30%

- [ ] Editar `.github/workflows/test.yml` adicionando step:
  ```yaml
  - name: Coverage gate
    run: |
      go test -coverprofile=cover.out ./...
      PCT=$(go tool cover -func=cover.out | awk '/total:/ {print $3}' | sed 's/%//')
      echo "Coverage: $PCT%"
      awk -v p="$PCT" 'BEGIN{exit !(p+0 >= 30)}'
  ```
  (usa `awk` em vez de `bc` — mais portável).
- [ ] Criar `laura-go/docs/memory/coverage_roadmap.md` com meta soft 50% + histórico baseline→30%→50%.
- [ ] Run: `cd laura-go && go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total`
  Expected: valor ≥ 30%.
- [ ] Commit: `ci(go): gate hard coverage 30% + roadmap soft 50%`.

### D.4 Fallback coverage (se <30% após D.1+D.2+D.3 local)

> Execute APENAS se `D.3` valor local ficar em 27-29%. Se já ≥30%, pular.

- [ ] Run: `cd laura-go && go tool cover -func=cover.out | sort -k3 -n | head -20`
  Expected: lista dos 20 packages/funcs com menor coverage — alvos prioritários.
- [ ] Adicionar testes em 3 handlers menores (escolher da lista, ex.: `profile`, `webhook`, `settings`):
  - cenário happy path
  - cenário auth failure
  - cenário payload inválido
- [ ] Re-run coverage. Se ainda <30%, adicionar 3 testes em services/bootstrap.
- [ ] Loop até `PCT >= 30.0`. Max 2 iterações — se não subir, escalar.
- [ ] Commit: `test(go): fallback coverage — atingir meta 30% em handlers menores`.

---

## Parte E — PWA lint cleanup sprint 1

### E.1 Script ordenação 10 arquivos

- [ ] Run primeiro (preferida):
  ```sh
  cd laura-pwa && npx eslint src/lib/actions --format json 2>/dev/null \
    | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
    | sort -k2 -nr | head -10 > /tmp/pwa-sprint1.txt
  ```
  Expected: `/tmp/pwa-sprint1.txt` com 10 linhas `<path>\t<count>`.
- [ ] Se eslint falhar/vazio, fallback spec §12.11 com grep:
  ```sh
  cd laura-pwa && grep -rln ": any\b\| any\[\]\|<any>" src/lib/actions/*.ts \
    | xargs -I {} sh -c 'echo "$(grep -c "any" {})  {}"' \
    | sort -rn | head -10 > /tmp/pwa-sprint1.txt
  ```
- [ ] Copiar lista para `laura-pwa/docs/memory/pwa_sprint_1.md` (data, comando usado, 10 arquivos).
- [ ] Commit: `docs(pwa): lista sprint 1 cleanup (10 arquivos lib/actions)`.

### E.2 Tipar 10 arquivos sprint 1

- [ ] Para cada arquivo em `/tmp/pwa-sprint1.txt`:
  - Substituir `any` por tipo específico (Prisma `TransactionGetPayload<...>`, interfaces locais) ou `unknown` com type guard.
  - Preferir tipos derivados de Prisma quando aplicável.
- [ ] Run: `cd laura-pwa && npx eslint $(cat /tmp/pwa-sprint1.txt | cut -f1)`
  Expected: 0 warnings nos 10 arquivos alvo.
- [ ] Commit: `chore(pwa): sprint 1 tipagem — 10 arquivos lib/actions sem warnings`.

### E.3 Fechar sprint 1

- [ ] Atualizar `laura-pwa/docs/memory/pwa_sprint_1.md` com status `done` + delta (warnings antes/depois).
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
- [ ] Se G124 ainda surgir, aplicar `#nosec G124 -- integridade session token mock`.
- [ ] Commit (condicional): `security(go): G124 testutil final check`.

---

## Parte G — Testcontainers

### G.1 `TestMain` pgvector compartilhado

- [ ] Criar `laura-go/internal/testutil/integration.go` (build tag `//go:build integration`):
  ```go
  //go:build integration

  package testutil

  import (
      "context"
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
          postgres.WithUsername("test"),
          postgres.WithPassword("test"),
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
- [ ] Commit: `test(go): TestMain pgvector shared (build tag integration)`.

### G.2 `TestMain` redis compartilhado

- [ ] Estender `integration.go` com `SharedRedis` + `SharedRedisAddr` via `testcontainers-go/modules/redis`.
- [ ] Terminate ambos containers no cleanup (defer após `m.Run()`).
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
        - name: Run integration tests with retry
          uses: nick-fields/retry@v3
          with:
            timeout_minutes: 10
            max_attempts: 3
            retry_wait_seconds: 30
            command: cd laura-go && go test -tags=integration ./...
  ```
- [ ] Run (local smoke): `cd laura-go && go test -tags=integration ./internal/cache/...`
  Expected: `PASS` com containers sobem.
- [ ] Commit: `ci(go): split test-unit + test-integration com retry 3x (Docker-in-Docker flaky mitigation)`.

---

## Parte H — Open Finance Foundation

### H.1 Migration 000036 up+down

> STANDBY: `[PLUGGY-CLIENT-ID]` e `[PLUGGY-CLIENT-SECRET]` não bloqueiam migration (apenas stub endpoint).

- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.up.sql` com os schemas `bank_accounts` (spec §12.1) e `bank_transactions` (spec §12.2) — incluindo RLS policies + índices + trigger `updated_at`.
- [ ] Criar `laura-go/internal/migrations/000036_open_finance_foundation.down.sql`:
  ```sql
  DROP TABLE IF EXISTS bank_transactions CASCADE;
  DROP TABLE IF EXISTS bank_accounts CASCADE;
  ```
- [ ] Run: `cd laura-go && migrate -path internal/migrations -database "$DATABASE_URL" up`
  Expected: `1/u open_finance_foundation (XX.Xms)`.
- [ ] Run sanity: `psql "$DATABASE_URL" -c '\dt bank_*'`
  Expected: 2 tabelas listadas.
- [ ] Commit: `feat(db): migration 000036 open finance foundation (bank_accounts+transactions+RLS)`.

### H.2 PluggyClient skeleton

> STANDBY: `[PLUGGY-CLIENT-ID]` / `[PLUGGY-CLIENT-SECRET]` — skeleton funciona sem (retorna erro em stub methods).

- [ ] Criar `laura-go/internal/pluggy/client.go` com o conteúdo da spec §12.4a (Client struct, `NewClient`, `IsConfigured`, `CreateConnectToken` stub, `FetchTransactions` stub, `Transaction` struct).
- [ ] Run: `cd laura-go && go build ./internal/pluggy/...`
  Expected: exit 0.
- [ ] Commit: `feat(banking): PluggyClient skeleton HTTP cru (sem SDK)`.

### H.3 Handler `/api/v1/banking/connect` stub

> STANDBY: `[PLUGGY-CLIENT-ID]` / `[PLUGGY-CLIENT-SECRET]` — handler retorna 501 quando ausentes.

- [ ] Criar `laura-go/internal/handlers/banking.go` com struct `BankingHandler` + método `Connect` conforme spec §12.4 (501 se `!IsConfigured()` com `standby`; 200 com `{connect_token, expires_in: 1800}` se configurado).
- [ ] Adicionar import de `pluggy` package.
- [ ] Registrar rota `POST /api/v1/banking/connect` no router principal.
- [ ] Commit: `feat(banking): endpoint /connect stub (501 STANDBY + 200 token stub)`.

### H.4 Handler `/api/v1/banking/sync` stub

- [ ] Adicionar método `Sync` em `banking.go` conforme spec §12.4:
  - `X-Ops-Token` mismatch → 401.
  - `FEATURE_BANK_SYNC != "on"` → 200 `{"status": "disabled", "reason": "FEATURE_BANK_SYNC=off"}`.
  - Flag on → 200 `{"status": "stub", "synced_accounts": 0}`.
- [ ] Registrar rota `POST /api/v1/banking/sync`.
- [ ] Adicionar `OpsToken` e `FeatureBankSync` em `config.go` (env: `OPS_TOKEN`, `FEATURE_BANK_SYNC`).
- [ ] Commit: `feat(banking): endpoint /sync stub gated por X-Ops-Token`.

### H.5 Workflow `bank-sync.yml`

- [ ] Criar `.github/workflows/bank-sync.yml` conforme spec §12.5 (cron `0 5 * * *` + workflow_dispatch + curl `X-Ops-Token: ${{ secrets.BACKUP_OPS_TOKEN }}`).
- [ ] Confirmar secret `BACKUP_OPS_TOKEN` já existe no repo (mesmo do backup).
- [ ] Commit: `ci(ops): workflow bank-sync cron diário 05:00 UTC`.

### H.6 Testes handlers banking + PluggyClient

> STANDBY: testes cobrem explicitamente o path `IsConfigured=false` (standby válido).

- [ ] Criar `internal/handlers/banking_test.go`:
  - `TestSync_Unauthorized` — sem `X-Ops-Token` → 401.
  - `TestSync_Disabled` — flag off → 200 `status=disabled`.
  - `TestSync_StubEnabled` — flag on → 200 `status=stub`.
  - `TestConnect_NotConfigured` → 501 com array `standby`.
- [ ] Criar `internal/pluggy/client_test.go`:
  - `TestIsConfigured_False` / `TestIsConfigured_True`.
  - `TestCreateConnectToken_StubUnconfigured` → erro "pluggy not configured".
  - `TestFetchTransactions_StubUnconfigured` → erro.
- [ ] Run: `cd laura-go && go test ./internal/handlers/... ./internal/pluggy/... -run 'Banking|Pluggy|Sync|Connect|Configured' -v`
  Expected: `PASS`.
- [ ] Commit: `test(banking): handlers + PluggyClient (401/200/501/disabled/configured)`.

### H.7 Runbook Open Finance

- [ ] Criar `laura-go/docs/ops/runbooks/open-finance.md` com 5 seções:
  ```markdown
  # Runbook — Open Finance (Pluggy)

  ## Quando usar
  - Primeira conexão de banco Pluggy pelo usuário.
  - Debug de sync diário falhando via GitHub Action `bank-sync.yml`.
  - Rotação de secrets Pluggy.

  ## Pré-requisitos
  - `PLUGGY_CLIENT_ID` configurado (secret prod).
  - `PLUGGY_CLIENT_SECRET` configurado (secret prod).
  - `FEATURE_BANK_SYNC=on` (env var app).
  - `OPS_TOKEN` / `BACKUP_OPS_TOKEN` configurados (mesmo valor).

  ## Procedimento
  ### Trigger manual
  curl -X POST https://api.laura.finance/api/v1/banking/sync \
    -H "X-Ops-Token: $BACKUP_OPS_TOKEN" -v

  ### Habilitar em prod (Fase 14+)
  1. Definir `FEATURE_BANK_SYNC=on` no Fly secrets.
  2. Redeploy.
  3. Rodar sync manual (acima) para validar.

  ## Validação
  - HTTP 200 com `{"status":"stub"|"ok","synced_accounts":N}`.
  - Logs: `slog` nível info com `event=bank_sync_completed`.
  - `psql -c 'SELECT count(*) FROM bank_transactions WHERE imported_at > NOW() - interval ''1 day'';'` > 0.

  ## Rollback
  - Setar `FEATURE_BANK_SYNC=off` → endpoint retorna 200 disabled imediato.
  - Desabilitar workflow: `gh workflow disable bank-sync.yml`.
  - Em caso de dados inconsistentes: `DELETE FROM bank_transactions WHERE imported_at > '<timestamp>'`.
  ```
- [ ] Commit: `docs(ops): runbook open finance (Pluggy + sync + feature flag + rollback)`.

### H.8 Env vars `.env.example`

- [ ] Adicionar em `.env.example` (ou `.env.production.example`):
  ```
  # Open Finance (Fase 13 foundation — STANDBY)
  PLUGGY_CLIENT_ID=           # [STANDBY]
  PLUGGY_CLIENT_SECRET=       # [STANDBY]
  FEATURE_BANK_SYNC=off

  # Observability
  LLM_PING_DISABLED=true
  LLM_LEGACY_NOCONTEXT=false
  ```
- [ ] Commit: `docs(env): PLUGGY_* + FEATURE_BANK_SYNC + LLM_* em .env.example`.

---

## Parte I — Tag + Docs

### I.1 Validações finais

- [ ] Run em sequência (parar no primeiro fail):
  - `cd laura-go && go build ./... && go vet ./...` — **Expected:** exit 0.
  - `cd laura-go && go test ./...` — **Expected:** `PASS`.
  - `cd laura-go && go test -tags=integration ./...` — **Expected:** `PASS`.
  - `cd laura-go && gosec -conf .gosec.yml ./...` — **Expected:** `Issues: 0`.
  - `cd laura-go && go test -coverprofile=cover.out ./... && go tool cover -func=cover.out | grep total` — **Expected:** ≥ 30.0%.
  - `cd laura-pwa && npx eslint $(cat /tmp/pwa-sprint1.txt | cut -f1)` — **Expected:** 0 warnings.
- [ ] Se algum falhar, voltar à Parte correspondente. Não prosseguir.
- [ ] Commit (se necessário): `chore(ci): validações finais fase 13 verdes`.

### I.2 Tag `phase-13-prepared`

- [ ] Run: `git tag -a phase-13-prepared -m "Fase 13 — Polish + Foundation pronta para prod"`
- [ ] Run: `git push origin phase-13-prepared`
  Expected: `[new tag] phase-13-prepared -> phase-13-prepared`.

> Semver `v1.13.0` deixado para release formal (Fase 14+) quando deploy real for corrido. Consistente com tags `phase-10-prepared`, `phase-11-prepared`, `phase-12-prepared`.

### I.3 HANDOFF + memory entry

- [ ] Atualizar `laura-go/docs/HANDOFF.md` com:
  - Estado pós-Fase 13 (coverage %, endpoints stub ativos, cache full, 4 checks em /ready).
  - STANDBYs pendentes: `[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]`.
  - Próximos passos Fase 14 (Pluggy Connect Widget, categorização ML, PWA sprint 2).
- [ ] Criar `laura-go/docs/memory/phase_13_complete.md`:
  - Os 44 itens do self-review marcados.
  - Commits principais por parte.
  - Métricas: coverage delta, warnings delta PWA, gosec issues 0.
- [ ] Commit: `docs(memory): fase 13 complete + HANDOFF atualizado`.

---

## Self-review — cobertura dos 40 itens spec §15

> 1:1 com as 9 categorias A-I da spec §15 (40 itens totais).

| # | Item spec §15 | Task v2 | Status |
|---|--------------|---------|--------|
| A1 | `internal/cache/invalidate.go` helper | A.1 | IN_PLAN |
| A2 | Cache `GET /api/v1/score` | A.2 | IN_PLAN |
| A3 | Cache `GET /api/v1/reports/monthly` | A.3 | IN_PLAN |
| A4 | Cache `GET /api/v1/reports/categories` | A.4 | IN_PLAN |
| A5 | Cache `GET /api/v1/banking/accounts` (stub) | **A.5b** (nova) | IN_PLAN |
| A6 | 4 invalidation hooks (tx/cat/banking) | A.6 + A.7 | IN_PLAN |
| B1 | Rename interface `ChatCompletion(ctx)` | B.2.a | IN_PLAN |
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
| D2 | Testes novos handlers/services (30% meta) | D.1 + D.2 + **D.4 fallback** | IN_PLAN |
| D3 | `coverage_roadmap.md` soft 50% | D.3 | IN_PLAN |
| E1 | Executar §14.4 ordenação | E.1 | IN_PLAN |
| E2 | 10 arquivos tipados | E.2 | IN_PLAN |
| E3 | `npm run lint` passa 10 alvo | E.2 + E.3 | IN_PLAN |
| F1 | `.gosec.yml` suprime G706+G101 | F.2 | IN_PLAN |
| F2 | gosec 0 issues | F.2 | IN_PLAN |
| F3 | CI job gosec atualizado | F.2 | IN_PLAN |
| G1 | TestMain shared PG+Redis | G.1 + G.2 | IN_PLAN |
| G2 | Build tag `integration` | G.3 | IN_PLAN |
| G3 | CI split test-unit + test-integration (+retry) | G.3 | IN_PLAN |
| H1 | Migration 000036 up | H.1 | IN_PLAN |
| H2 | Migration 000036 down | H.1 | IN_PLAN |
| H3 | `internal/pluggy/client.go` skeleton | H.2 | IN_PLAN |
| H4 | `internal/handlers/banking.go` Connect+Sync | H.3 + H.4 | IN_PLAN |
| H5 | Rotas POST /connect + /sync | H.3 + H.4 | IN_PLAN |
| H6 | `.github/workflows/bank-sync.yml` | H.5 | IN_PLAN |
| H7 | Config vars PLUGGY_* + FEATURE_BANK_SYNC + OPS_TOKEN | H.4 + H.8 | IN_PLAN |
| H8 | Testes handler banking + PluggyClient | H.6 | IN_PLAN |
| I1 | `docs/HANDOFF.md` update | I.3 | IN_PLAN |
| I2 | `docs/memory/phase_13_complete.md` | I.3 | IN_PLAN |
| I3 | Git tag canônica | I.2 (**`phase-13-prepared`**, sem semver neste ciclo) | IN_PLAN |

**Resumo:** 40/40 IN_PLAN. 0 STANDBY (externos `[PLUGGY-CLIENT-ID/SECRET]` não são tasks — apenas anotados em H.3/H.6/H.8). 0 DEFERRED.

**Tasks extras v2 vs v1** (fora do §15 mas fechando GAPs review #1):
- B.5 (config flag) + B.6 (runbook rollback) + **B.6.b (wrapper concreto `ChatCompletionLegacyAware`)**.
- **D.4** fallback para atingir 30%.
- Retry 3x em G.3 via `nick-fields/retry@v3`.

---

## GAPs conhecidos para review #2

1. **Ordem execução H.3 vs A.5b** — `A.5b` cria `ListAccounts` em `banking.go`, mas `banking.go` só nasce em `H.3`. Plan assume que A.5b roda depois de H.3 na prática. **Solução sugerida review #2:** inverter ordem (H.3 antes de A.5b) OU criar `banking.go` vazio como pré-task em A.5b.
2. **`postgres.RunContainer` API** — testcontainers-go v0.32+ depreciou em favor de `postgres.Run(ctx, "image", opts...)`. Plan v2 usa API antiga (alinhado spec §G.1). Confirmar versão real em `go.mod` ou atualizar para API nova.
3. **`nick-fields/retry@v3` disponibilidade** — assumir latest stable; se action mudou nome/major, substituir por bash `for i in 1 2 3; do go test && break; sleep 30; done`.
4. **Meta coverage D.4 loop termination** — Plan v2 limita 2 iterações; se handlers leves não subirem +3-5% por rodada, pode precisar mocks de cobertura em bootstrap/`cmd/`. Escalar se ficar em 28-29% após D.4.
5. **Tag semver `v1.13.0`** — decisão v2 é só `phase-13-prepared`. Se release formal for exigida para pipeline de versionamento de clientes (ex.: changelog automático), review #2 deve adicionar I.2b com `git tag -a v1.13.0`.
