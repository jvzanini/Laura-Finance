# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Spec v1)

> Versão: v1 (rascunho inicial)
> Data: 2026-04-15
> Autor: agente autônomo
> Status: rascunho para review #1

---

## 1. Objetivo

Consolidar os concerns herdados da Fase 12 e abrir o primeiro caminho estratégico de produto — a **fundação de Open Finance** (bank connectors). A Fase 13 tem três vetores:

1. **Performance Polish** — fechar o ciclo de cache iniciado na Fase 12 (POC dashboard → 4 endpoints completos com invalidation event-driven) e finalizar a propagação de `context.Context` no pipeline LLM.
2. **Quality Hardening** — empurrar coverage Go de ~15% para ≥30%, eliminar warnings PWA em `lib/api/` + `lib/services/`, health checks reais em `/ready` (whatsmeow + LLM ping), testcontainers full (TestMain compartilhado) e cleanup de `gosec G124`.
3. **Open Finance Foundation** — scaffolding mínimo (tabela `bank_accounts`, connector `Pluggy` com interface `BankProvider`, endpoint `/api/v1/banking/connect` stub, worker `bank-sync` desligado por default) sem sincronização real — apenas o esqueleto testável.

A fase **não** entrega produto Open Finance usável; entrega a fundação arquitetural para que a Fase 14+ possa focar em UX do fluxo de conexão e categorização automática de transações bancárias.

---

## 2. Contexto e motivação

### 2.1. Concerns herdados da Fase 12

O documento `docs/memory/phase_12_complete.md` listou 10 concerns ao final da Fase 12 (tag `phase-12-prepared`, ~145 commits acumulados entre Fases 10/11/12). Destes, **8 são técnicos** (dívida ou cobertura) e **2 são estratégicos** (Open Finance + Coverage strategy).

| # | Concern | Natureza | Fase alvo |
|---|---------|----------|-----------|
| 1 | Cache integração restante (score, reports, categories) | Técnica | **13** |
| 2 | `ChatCompletion(ctx, prompt)` refactor big-bang (~10 callsites) | Técnica | **13** |
| 3 | Whatsmeow check real em `/ready` | Técnica | **13** |
| 4 | LLM Ping real em `/ready` | Técnica | **13** |
| 5 | Coverage Go 30% | Técnica | **13** |
| 6 | PWA 74 `no-explicit-any` em `lib/actions/` | Técnica | **13** (parcial) + 14 |
| 7 | gosec G124 em `testutil/session.go:43` | Técnica | **13** |
| 8 | golangci-lint v2.x Go 1.26 | Técnica | **13** (check) |
| 9 | Testcontainers full (TestMain compartilhado) | Técnica | **13** |
| 10 | Open Finance integration | Estratégica | **13** (foundation) + 14 (UX) |

### 2.2. Visão futura

- **Fase 14** — Open Finance UX completo (fluxo OAuth Pluggy, categorização automática ML-light, reconciliação contas) + PWA lint cleanup final.
- **Fase 15** — PWA RUM (Sentry Browser) + Mobile native (React Native expo wrapper).
- **Fase 16+** — Multi-region active-active (Postgres cross-region, Redis Cluster).

---

## 3. Escopo

### 3.1. Dentro do escopo

1. Cache integração full (3 endpoints: `/score`, `/reports`, `/categories`) com cache-aside pattern.
2. Invalidation hooks event-driven (`POST/PATCH/DELETE` → `Cache.Invalidate(keys...)`).
3. Refactor `ChatCompletion(ctx, prompt)` em todos os callsites.
4. `/ready` check real whatsmeow (ping socket + last-seen <30s).
5. `/ready` check real LLM (ping OpenAI ou provider ativo, timeout 2s).
6. Coverage Go ≥30% via testes unitários em `internal/handlers`, `internal/services/llm`, `internal/cache`, `internal/bootstrap`.
7. PWA lint cleanup: **0 warnings** em `lib/api/` + `lib/services/`. `lib/actions/` continua warn (progressivo).
8. Testcontainers full: `TestMain(m *testing.M)` em `internal/testutil/containers.go` com postgres+redis compartilhados entre testes do pacote.
9. gosec G124 cleanup (test helper refactor ou supressão justificada com comment).
10. golangci-lint v2.x — se já liberado com suporte Go 1.26, upgrade; senão, documentar e reagendar.
11. Open Finance Foundation:
    - Tabela `bank_accounts` (id, user_id, provider, external_id, status, last_sync_at, created_at).
    - Tabela `bank_transactions` (id, bank_account_id, external_id, amount, currency, posted_at, description, raw_json).
    - Interface `BankProvider` (`Connect`, `ListAccounts`, `FetchTransactions`).
    - Implementação `PluggyClient` (stub com credenciais `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` — sandbox).
    - Endpoint `POST /api/v1/banking/connect` (retorna `connect_token` stub ou real se STANDBY resolvido).
    - Worker `bank-sync` (desligado por flag `FEATURE_BANK_SYNC=off`).

### 3.2. Fora do escopo (Fase 14+)

- PWA RUM Sentry Browser (Fase 15).
- Mobile native React Native (Fase 15).
- Multi-region active-active (Fase 16+).
- Categorização automática de transações bancárias via ML (Fase 14).
- Fluxo OAuth UX completo Pluggy Connect Widget (Fase 14).
- Reconciliação automática conta↔lançamento (Fase 14).
- Belvo connector (avaliado e descartado nesta fase — ver 5.3).
- PWA cleanup `lib/actions/` 74 warnings (progressivo até Fase 15).

---

## 4. Pendências detalhadas agrupadas

### 4.1. Cache integração full (3 endpoints + invalidation)

**Estado atual:** Fase 12 implementou cache-aside POC em `GET /api/v1/dashboard` com interface `Cache` (`Get`, `Set`, `Delete`, `Invalidate`). Drivers: `InMemoryCache` (default) e `RedisCache` (se `REDIS_URL` setado). TTL default 60s.

**Ação proposta:**
- Estender cache-aside para `GET /api/v1/score`, `GET /api/v1/reports/*`, `GET /api/v1/categories`.
- Chave: `v1:<endpoint>:<user_id>:<hash_query_params>`.
- TTL por endpoint: score 300s, reports 120s, categories 600s.
- Hooks de invalidation:
  - `POST /api/v1/transactions` → invalida `v1:dashboard:*`, `v1:score:*`, `v1:reports:*`.
  - `PATCH/DELETE /api/v1/transactions/:id` → idem.
  - `POST/PATCH/DELETE /api/v1/categories` → invalida `v1:categories:*`.
- Implementar `Cache.InvalidatePattern(pattern string)` em `RedisCache` via `SCAN + DEL`, em `InMemoryCache` via varredura de keys.

**Arquivos afetados:**
- `internal/cache/cache.go` (interface + InvalidatePattern).
- `internal/cache/memory.go`, `internal/cache/redis.go`.
- `internal/handlers/score.go`, `reports.go`, `categories.go`.
- `internal/handlers/transactions.go` (hooks invalidation).

**Libs/comandos:**
- `go test ./internal/cache/...` (cobertura InvalidatePattern).
- `redis-cli --scan --pattern 'v1:*'` (verificação manual).

**Dependências externas:** `[REDIS-INSTANCE]` opcional (Upstash). Fallback InMemory mantido.

**Tempo estimado:** 6-8h.

---

### 4.2. ChatCompletion ctx propagation (refactor big-bang)

**Estado atual:** Fase 12 introduziu `ChatCompletionCtx(ctx, prompt)` como API nova, mantendo `ChatCompletion(prompt)` (sem ctx) por trás de flag `LLM_LEGACY_NOCONTEXT=true` (default). ~10 callsites ainda usam a API legada.

**Ação proposta:**
- Refactor big-bang: renomear `ChatCompletionCtx` → `ChatCompletion(ctx, prompt)` (ctx obrigatório).
- Remover flag `LLM_LEGACY_NOCONTEXT`.
- Atualizar 10 callsites (grep `ChatCompletion(` sem `ctx`).
- Garantir ctx propagado de `handler.ctx` (gin) → `service` → `llm.Client`.
- Trace OTel: span `llm.chat_completion` com attrs `model`, `prompt_tokens`, `latency_ms`.

**Arquivos afetados:**
- `internal/services/llm/client.go` (rename + drop flag).
- `internal/handlers/chat.go`, `score.go`, `insights.go`, `categories.go`, `reports.go`, `onboarding.go` (e outros 4).
- `internal/config/flags.go` (remove `LLM_LEGACY_NOCONTEXT`).

**Libs/comandos:**
- `rg 'ChatCompletion\(' --type go -g '!*_test.go'` (inventário pre-refactor).
- `go test ./... -race` (regressão).

**Dependências externas:** nenhuma.

**Tempo estimado:** 3-4h.

---

### 4.3. Health checks reais (whatsmeow + LLM)

**Estado atual:** `/ready` tem interface `HealthChecker` com checks `db` (ping Postgres) e `redis` (ping). `whatsmeow` e `llm` retornam `{"status":"unknown"}` (placeholder).

**Ação proposta:**
- **Whatsmeow check:** obter handle da sessão ativa do `whatsmeow.Store`, verificar `LastSeen` (<30s) + socket status. Degraded se >30s, fail se socket fechado.
- **LLM check:** enviar prompt mínimo (`"ping"`) com `max_tokens=1` e timeout 2s. Degraded se latência >1.5s, fail se erro/timeout.
- Estrutura resposta `/ready`:
  ```json
  {
    "status": "ready" | "degraded" | "not_ready",
    "checks": {
      "db": {"status": "ok", "latency_ms": 3},
      "redis": {"status": "ok", "latency_ms": 1},
      "whatsmeow": {"status": "ok", "last_seen_s": 12},
      "llm": {"status": "degraded", "latency_ms": 1680}
    }
  }
  ```
- Semântica: `not_ready` → HTTP 503 (k8s remove do LB). `degraded` → HTTP 200 (mas alertar observability).

**Arquivos afetados:**
- `internal/handlers/health.go`.
- `internal/services/whatsapp/session.go` (expor `LastSeen()`).
- `internal/services/llm/client.go` (método `Ping(ctx)`).

**Libs/comandos:**
- `curl -i http://localhost:8080/ready` (smoke).
- Teste integration com mock LLM (latency injection).

**Dependências externas:** nenhuma (LLM provider já configurado).

**Tempo estimado:** 4-5h.

---

### 4.4. Coverage 30% (testes unit + integration)

**Estado atual:** Coverage Go ~15% (CI reporta via `go test -coverprofile`). Meta CLAUDE.md: ≥30% na Fase 13.

**Ação proposta:**
- Priorizar pacotes críticos com cobertura <20%:
  - `internal/handlers` (testes table-driven com `httptest`).
  - `internal/services/llm` (mock provider).
  - `internal/cache` (cobertura InvalidatePattern).
  - `internal/bootstrap` (wire DI + flags).
- Adicionar `make coverage` target: `go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out`.
- Gate CI: fail se coverage <30% (threshold configurável).
- Badge README coverage via `go-test-coverage` action.

**Arquivos afetados:**
- `internal/handlers/*_test.go` (novos).
- `internal/services/llm/client_test.go` (novo).
- `internal/cache/*_test.go` (completar).
- `internal/bootstrap/bootstrap_test.go` (novo).
- `Makefile`, `.github/workflows/ci.yml`.

**Libs/comandos:**
- `go test ./... -coverprofile=coverage.out`.
- `go tool cover -html=coverage.out` (inspeção local).

**Dependências externas:** nenhuma.

**Tempo estimado:** 8-10h.

---

### 4.5. PWA lint cleanup progressivo (lib/actions/)

**Estado atual:** `npm run lint` reporta 74 `no-explicit-any` warnings em `pwa/lib/actions/`. `lib/api/` e `lib/services/` ainda com alguns warnings residuais.

**Ação proposta nesta fase (parcial):**
- **Fase 13 target:** `lib/api/` + `lib/services/` = **0 warnings**.
- **Fase 13 stretch:** reduzir `lib/actions/` de 74 → 50 warnings (sprint 1 de 3 planejadas).
- Substituir `any` por tipos reais (Zod schema inferred ou interfaces manuais).
- Promover `no-explicit-any` de warn → error em `lib/api/` e `lib/services/` via override ESLint por path.

**Arquivos afetados:**
- `pwa/lib/api/*.ts` (~15 arquivos).
- `pwa/lib/services/*.ts` (~10 arquivos).
- `pwa/lib/actions/*.ts` (10 arquivos do sprint 1).
- `pwa/.eslintrc.json` (overrides por path).

**Libs/comandos:**
- `cd pwa && npm run lint -- --max-warnings=0` (após cleanup).

**Dependências externas:** nenhuma.

**Tempo estimado:** 6-7h.

---

### 4.6. golangci-lint v2.x (verificar disponibilidade Go 1.26)

**Estado atual:** Fase 12 fixou `golangci-lint v1.62` por falta de suporte Go 1.26 no v2.x. Issue upstream aberto.

**Ação proposta:**
- Checar release notes `golangci-lint` v2.x — se Go 1.26 supported, upgrade.
- Se não, documentar em `docs/memory/golangci_lint_upgrade.md` e reagendar Fase 14.
- Timebox: 30min de verificação.

**Arquivos afetados:**
- `.golangci.yml` (se upgrade), `.github/workflows/ci.yml`.

**Libs/comandos:**
- `golangci-lint version`, `golangci-lint run ./...`.

**Dependências externas:** nenhuma.

**Tempo estimado:** 0.5-2h (dependendo do upgrade).

---

### 4.7. Testcontainers full (TestMain compartilhado)

**Estado atual:** Fase 12 adicionou `testcontainers-go` para testes integration, mas cada teste sobe seu próprio container (lento — ~40s/suite).

**Ação proposta:**
- Criar `internal/testutil/containers.go` com `TestMain(m *testing.M)`:
  - Sobe `postgres:16` + `redis:7` uma vez por pacote.
  - Injeta DSN/URL em vars globais (`TestPostgresDSN`, `TestRedisURL`).
  - Teardown após `m.Run()`.
- Migrar testes integration para consumir vars compartilhadas.
- Esperado: suite tempo 40s → 8s.

**Arquivos afetados:**
- `internal/testutil/containers.go` (novo).
- Testes em `internal/handlers`, `internal/repository`, `internal/cache`.

**Libs/comandos:**
- `go test -v ./internal/handlers/... -run TestMain`.

**Dependências externas:** Docker daemon local + CI runner com Docker-in-Docker.

**Tempo estimado:** 4-5h.

---

### 4.8. gosec G124 cleanup

**Estado atual:** `testutil/session.go:43` aciona G124 (MEDIUM) — uso de `math/rand` em test helper para gerar session ID.

**Ação proposta:**
- Opção A (preferida): trocar `math/rand` por `crypto/rand` com `base64.URLEncoding`.
- Opção B: suprimir com comment `// #nosec G124 -- test helper, deterministic seed OK` + justificativa no spec.

**Arquivos afetados:**
- `internal/testutil/session.go`.

**Libs/comandos:**
- `gosec ./... | grep G124`.

**Dependências externas:** nenhuma.

**Tempo estimado:** 0.5h.

---

### 4.9. Open Finance Foundation (Pluggy connector skeleton)

**Estado atual:** Não existe. Backlog estratégico da Fase 12.

**Ação proposta:**
- **Schema:**
  - `bank_accounts` (id UUID, user_id FK, provider TEXT, external_id TEXT, display_name TEXT, status TEXT, last_sync_at TIMESTAMPTZ, created_at, updated_at).
  - `bank_transactions` (id UUID, bank_account_id FK, external_id TEXT UNIQUE, amount NUMERIC, currency CHAR(3), posted_at TIMESTAMPTZ, description TEXT, raw_json JSONB, created_at).
  - Migration `migrations/0023_bank_accounts.up.sql`.
- **Interface:**
  ```go
  type BankProvider interface {
      Connect(ctx context.Context, userID string) (connectToken string, err error)
      ListAccounts(ctx context.Context, itemID string) ([]Account, error)
      FetchTransactions(ctx context.Context, accountID string, since time.Time) ([]Transaction, error)
  }
  ```
- **Implementação Pluggy stub:**
  - `internal/services/banking/pluggy/client.go`.
  - Usa `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` via env.
  - Sandbox endpoint `https://api.pluggy.ai`.
  - Se creds ausentes → retorna `ErrProviderNotConfigured` (STANDBY).
- **Endpoint:**
  - `POST /api/v1/banking/connect` → chama `provider.Connect`, retorna `connect_token` para frontend montar widget.
  - `GET /api/v1/banking/accounts` → lista `bank_accounts` do usuário.
- **Worker:**
  - `cmd/worker-bank-sync/main.go` (stub, loop 6h, desligado por `FEATURE_BANK_SYNC=off`).
  - Lê `bank_accounts` com `last_sync_at` > 6h, chama `FetchTransactions`, persiste.

**Arquivos afetados:**
- `migrations/0023_bank_accounts.up.sql`, `.down.sql`.
- `internal/domain/banking/account.go`, `transaction.go`.
- `internal/services/banking/provider.go` (interface).
- `internal/services/banking/pluggy/client.go` (impl).
- `internal/handlers/banking.go` (novo).
- `internal/router/routes.go` (rotas `/banking/*`).
- `cmd/worker-bank-sync/main.go` (novo).
- `docker-compose.yml` (service `worker-bank-sync`).

**Libs/comandos:**
- `go get github.com/pluggy-ai/pluggy-go-sdk` (se existir) ou `net/http` manual.
- Test integration com mock Pluggy (httptest server).

**Dependências externas:** `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` (STANDBY).

**Tempo estimado:** 10-12h.

---

### 4.10. Mutation invalidation hooks (integrado ao 4.1)

**Estado atual:** coberto em 4.1 (hooks POST/PATCH/DELETE em transactions + categories).

**Observação:** separado apenas para visibilidade — implementação junto com 4.1 no mesmo PR.

**Tempo estimado:** incluído em 4.1.

---

## 5. Decisões de arquitetura

### 5.1. Cache invalidation: TTL + event-driven híbrido

- **TTL** curto (60-600s conforme endpoint) como safety net.
- **Event-driven** via hooks nos mutation handlers (`POST/PATCH/DELETE`) chama `Cache.InvalidatePattern(...)`.
- Evita stale reads pós-mutation sem depender apenas de TTL.
- **Não** usaremos pub/sub para invalidation cross-instance nesta fase — assume-se replica única ou sticky sessions via LB. Fase 14+ avalia Redis keyspace notifications se multi-replica virar real.

### 5.2. ChatCompletion(ctx) — big-bang com smoke test

- Remoção do flag `LLM_LEGACY_NOCONTEXT` é big-bang (sem gradual rollout) porque ctx propagation não tem risco comportamental — apenas adiciona timeout/cancel.
- Smoke test pós-deploy: `/ready` LLM check + 1 prompt real em ambiente staging.
- Rollback: revert commit único (refactor isolado).

### 5.3. Open Finance provider: Pluggy (vs Belvo)

**Escolha: Pluggy.**

| Critério | Pluggy | Belvo |
|----------|--------|-------|
| Ecossistema BR | Forte (sede BR, suporta PIX, CPF/CNPJ nativo) | Médio (foco LatAm geral) |
| Pricing sandbox | Free tier 10 conexões | Free tier 50 conexões |
| Docs PT-BR | Sim | Parcial |
| SDK Go | Não-oficial (stub via HTTP) | Não-oficial |
| Instituições BR suportadas | 100+ (Itaú, Bradesco, Nubank, Inter, C6...) | 50+ |
| OAuth Connect Widget | Sim (Pluggy Connect) | Sim (Belvo Widget) |

**Veredito:** Pluggy por cobertura BR superior e docs PT-BR. Interface `BankProvider` abstrai o vendor — fase futura pode adicionar Belvo como fallback.

### 5.4. Coverage strategy

- **Não** perseguir coverage de código gerado (mocks, generated clients).
- Foco em:
  1. Handlers HTTP (contract testing).
  2. Services com lógica de negócio (LLM, banking, score, reports).
  3. Bootstrap/DI wiring (regressão de startup).
  4. Cache drivers (in-memory + redis).
- Excluir via `.golangci.yml` ou `go:build` tags: mocks, `cmd/` entrypoints.

### 5.5. PWA tipos progressivos

- Estratégia de **10 arquivos por sprint** em `lib/actions/`:
  - Sprint 1 (Fase 13): 10 arquivos → 74 → ~50 warnings.
  - Sprint 2 (Fase 14): 10 arquivos → ~50 → ~25 warnings.
  - Sprint 3 (Fase 15): restante → 0 warnings.
- Evita PR gigante impossível de revisar e reduz risco de quebrar runtime.

---

## 6. Pré-requisitos / dependências externas (STANDBY)

| ID | Descrição | Bloqueia |
|----|-----------|----------|
| `[PLUGGY-CLIENT-ID]` | Client ID Pluggy (sandbox + prod) | 4.9 endpoint real (stub funciona sem) |
| `[PLUGGY-CLIENT-SECRET]` | Client Secret Pluggy | 4.9 endpoint real |
| `[REDIS-INSTANCE]` | Upstash Redis URL (opcional) | 4.1 produção (fallback InMemory OK) |

STANDBYs herdados Fases 10/11/12 (16 IDs) permanecem válidos — não são reintroduzidos aqui.

---

## 7. Critérios de aceite (DoD)

- [ ] **Cache:** hit-ratio >80% medido em 4 endpoints (dashboard, score, reports, categories) via métrica `cache_hit_ratio` Prometheus em janela 10min pós-deploy.
- [ ] **Invalidation:** teste e2e confirma que `POST /transactions` invalida cache `dashboard` (GET subsequente retorna dados atualizados sem esperar TTL).
- [ ] **ChatCompletion(ctx):** 0 callsites sem ctx (`rg 'ChatCompletion\(' --type go -g '!*_test.go'` → todos com `ctx`). Flag `LLM_LEGACY_NOCONTEXT` removida do código.
- [ ] **Trace OTel:** span `llm.chat_completion` aparece em `/api/v1/score` request trace (verificação via Jaeger local).
- [ ] **/ready:** 4 checks reais (db, redis, whatsmeow, llm) — teste `curl /ready` retorna estrutura nova com `latency_ms` por check.
- [ ] **Coverage Go:** `go test ./... -cover` ≥ 30% no CI. Gate falha PR se regressão.
- [ ] **PWA lint:** `lib/api/` + `lib/services/` = 0 warnings. `lib/actions/` ≤ 50 warnings.
- [ ] **Testcontainers:** suite `go test ./internal/handlers/... -v` roda em ≤ 15s (vs ≥ 40s antes).
- [ ] **gosec:** `gosec ./...` → 0 findings MEDIUM+.
- [ ] **golangci-lint:** upgrade v2.x completo OU documentação de reagendamento em `docs/memory/`.
- [ ] **Open Finance:** migration `0023` aplicada. Endpoint `POST /api/v1/banking/connect` responde 200 (stub ou real). Worker `worker-bank-sync` compila e sobe no compose (desligado por flag).
- [ ] **Tag:** `phase-13-prepared` criada após CI verde em 4 jobs core.
- [ ] **Docs:** `docs/memory/phase_13_complete.md` com concerns residuais.

---

## 8. Riscos

1. **Cache invalidation storms** — endpoints quentes (dashboard) podem sofrer miss storm simultâneo se TTL de muitos usuários expirar no mesmo tick. **Mitigação:** jitter ±10% no TTL ao setar + singleflight pattern em `Cache.Get`.
2. **Pluggy free tier limitado** — 10 conexões sandbox podem esgotar em testes. **Mitigação:** mock Pluggy em test integration, conexões reais apenas em smoke manual.
3. **ChatCompletion big-bang** — callsites esquecidos podem falhar em runtime (compile-time pegará a maioria). **Mitigação:** `rg` inventário + `go vet` + smoke staging.
4. **Testcontainers CI flakiness** — Docker-in-Docker no GitHub Actions pode ter latência variável. **Mitigação:** retry 3× + cache layer postgres/redis images.
5. **Coverage gate pode bloquear PRs legítimos** — fase de ramp-up. **Mitigação:** threshold inicial 28% (gate) com meta 30% (aviso), sobe após estabilizar.
6. **Open Finance scope creep** — tentação de implementar UX completo. **Mitigação:** spec explícita — apenas foundation; UX em Fase 14.

---

## 9. Métricas de sucesso

- **Latência P95 dashboard:** -30% após cache full (medido Grafana, janela 7d pós-deploy).
- **Coverage Go:** ≥30% (hoje ~15%).
- **PWA lint warnings `lib/api+services`:** 0 (hoje ~12).
- **PWA lint warnings `lib/actions`:** ≤50 (hoje 74).
- **Suite integration time:** ≤15s (hoje ~40s).
- **`/ready` checks reais:** 4/4 (hoje 2/4).
- **Open Finance:** endpoint `/banking/connect` responde 200 em smoke manual com creds sandbox.
- **CI time total:** ≤ +20% vs baseline Fase 12 (testcontainers adiciona mas TestMain compartilhado compensa).

---

## 10. Plano de testes

### 10.1. Testes unitários

- `internal/cache/*_test.go`: cobertura InvalidatePattern em InMemory + Redis (miniredis).
- `internal/handlers/*_test.go`: table-driven com `httptest` para `/score`, `/reports`, `/categories`, `/banking/*`.
- `internal/services/llm/client_test.go`: mock HTTP server (httptest) + ctx cancelation test.
- `internal/services/banking/pluggy/client_test.go`: mock Pluggy API.

### 10.2. Testes integration

- `internal/handlers/integration_test.go` (TestMain shared): fluxo POST transaction → GET dashboard (cache miss → hit → invalidation).
- `internal/services/banking/integration_test.go`: Connect → ListAccounts → FetchTransactions com mock Pluggy.

### 10.3. Smoke tests manuais

- `curl /ready` → valida 4 checks com latência.
- `curl POST /api/v1/transactions` seguido de `curl /api/v1/dashboard` → valida invalidation.
- `curl POST /api/v1/banking/connect` com creds sandbox Pluggy → valida connect_token válido.

### 10.4. CI gates

- `go test ./... -race -coverprofile=coverage.out` + `go tool cover -func=coverage.out | grep total` ≥ 30%.
- `golangci-lint run ./...` → 0 errors.
- `gosec ./...` → 0 MEDIUM+.
- `cd pwa && npm run lint -- --max-warnings=50` (ou target parcial).

---

## 11. Questões abertas para review #1

1. **Cache pub/sub cross-instance:** manter decisão de não implementar nesta fase, ou antecipar pensando em multi-replica próximo? Custo extra estimado ~4h.
2. **Coverage threshold:** gate em 30% exato ou 28% com stretch 30%? Risco de bloquear PRs legítimos.
3. **Pluggy vs Belvo:** decisão final Pluggy OK, ou manter ambos como plugins desde o início (interface já abstrai)? Custo extra ~2h.
4. **PWA sprint size:** 10 arquivos por fase é realista ou acelerar para 20? Impacta carga Fase 13.
5. **gosec G124:** opção A (crypto/rand) ou B (suppress com comment)? A é mais limpo mas test helper muda determinismo.
6. **Worker bank-sync:** subir no `docker-compose.yml` como service separado ou rodar como goroutine no app principal? Separado é mais limpo mas +1 container.
7. **Health check LLM:** prompt `"ping"` real gasta tokens ($ real). Alternativa: endpoint `/models` (sem custo) — mas não valida latência de completion. Qual preferir?
8. **Big-bang ChatCompletion:** aceitar risco de callsite esquecido ou manter flag por mais uma fase com feature flag gradual?
9. **Tabela bank_transactions:** criar já na Fase 13 (foundation completa) ou apenas `bank_accounts` e deixar `bank_transactions` para Fase 14? Spec atual inclui ambas — confirmar.
10. **Testcontainers CI:** aceitar +docker-in-docker ou investir em mocks (miniredis + `pgx-mock`) para manter CI sem Docker? Long-term mocks são mais rápidos.

---

## 12. Referências

- `docs/memory/phase_12_complete.md` — concerns herdados.
- `docs/superpowers/specs/2026-04-15-fase-12-refactoring-performance-v3.md` — spec anterior.
- `docs/memory/cache_pattern.md` — pattern cache-aside Fase 12.
- [Pluggy docs](https://docs.pluggy.ai/) — API reference.
- [Belvo docs](https://developers.belvo.com/) — comparativo 5.3.
- [golangci-lint v2 issue](https://github.com/golangci/golangci-lint/issues) — rastreio Go 1.26.
