# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Spec v3 — FINAL)

> Versão: v3 (FINAL — review #2 aplicado, pente fino concluído)
> Data: 2026-04-15
> Autor: agente autônomo (arquiteto sênior)
> Status: pronto para `superpowers:writing-plans`
> Supersedes: v2 (2026-04-15), v1 (2026-04-15)

---

## 0. Mudanças vs v2

1. **Worker bank-sync → GitHub Actions cron** (não Fly Machine schedule). Mesmo padrão de `backup-fly-pg.yml`: mais simples, ergo zero config nova em `fly.toml`, endpoint HTTP `/api/v1/banking/sync` protegido por `X-Ops-Token`.
2. **Wrapper `whatsapp.Manager.IsConnected()` + `LastSeen()` adicionado** — métodos não existem hoje (só `whatsmeow.Client` exposto via pacote `whatsapp`). Nova task em §12.8.
3. **Migration numerada como 000036** — confirmado que última é `000035_security_hardening.up.sql`.
4. **Pluggy = HTTP cru** (`net/http` + structs), sem SDK terceiro (não há oficial Go). Skeleton em §12.4a.
5. **Inventário ChatCompletion consolidado** — 5 callsites exatos em `services/llm.go` (3× provider methods) + `services/nlp.go:70` + `services/llm_helpers.go:32`. Plan v1 terá 1 task por callsite + 1 task de interface rename.
6. **PWA script de ordenação refinado** — usa `eslint --format json` + `jq` com fallback a `grep -c "any"` quando eslint falha.
7. **gosec A confirmado mas `math/rand` audit deu vazio** — nenhuma task de migração crypto/rand é necessária. Suprimir G706/G101 via config apenas.
8. **Seção 13 nova** — Resolução review #2 (12 itens).
9. **Seção 14 nova** — Apêndice de comandos canônicos.
10. **Seção 15 nova** — Checklist consolidado de entregas agrupado por categoria.

---

## 1. Objetivo

Consolidar concerns herdados da Fase 12 e abrir o caminho estratégico de Open Finance. Três vetores:

1. **Performance Polish** — fechar ciclo de cache (POC dashboard → 4 endpoints full + invalidation event-driven) e finalizar `context.Context` no pipeline LLM.
2. **Quality Hardening** — coverage Go ~15% → ≥30% (gate CI hard), zero warnings PWA em `lib/api/` + `lib/services/` (sprint 1 = 10 arquivos), health checks reais `/ready` (db + redis + whatsmeow + LLM ping com NoOp default), testcontainers com `TestMain` compartilhado, cleanup gosec (G706 + G101 suprimidos).
3. **Open Finance Foundation** — scaffolding mínimo (`bank_accounts` + `bank_transactions` + `PluggyClient` concreto + `/api/v1/banking/connect` stub + endpoint `/api/v1/banking/sync` stub + GitHub Action cron `bank-sync.yml`). Sem sync real; apenas esqueleto testável.

A fase **não** entrega Open Finance usável; entrega a base arquitetural para Fase 14+ focar em UX + categorização.

---

## 2. Contexto e motivação

### 2.1. Concerns herdados Fase 12

Mantido idêntico às v1/v2 §2.1 (tabela 10 itens). Síntese:

- Cache POC dashboard → faltam 4 endpoints (`/score`, `/reports/monthly`, `/reports/categories`, `/banking/*`) + invalidation hooks.
- ChatCompletion ainda mistura `ChatCompletion(prompt)` + `ChatCompletionCtx(ctx, prompt)` — 5 callsites a uniformizar.
- Coverage Go ~15% com linter amarelo; falta testcontainers compartilhado.
- PWA com 74 arquivos em `lib/actions/` contendo `any` (warnings, não errors).
- `/ready` retorna `ok` mesmo com whatsmeow e LLM degradados (check mock).
- gosec warnings (G706 dir traversal FP, G101 base64 FP, G124 já corrigido).
- Pluggy/Belvo foundation não iniciada.

### 2.2. Visão futura

- **Fase 14** — Open Finance UX (Pluggy Connect Widget) + categorização ML-light + refactor interface `BankProvider` + PWA sprint 2 (mais 10 arquivos).
- **Fase 15** — PWA RUM Sentry Browser + Mobile React Native + cache pub/sub cross-instance (se scaling horizontal materializou).
- **Fase 16+** — Multi-region active-active.

---

## 3. Escopo

### 3.1. Dentro do escopo

1. Cache full em 4 endpoints + invalidation event-driven + jitter ±10% TTL.
2. ChatCompletion ctx — 5 callsites migrados + flag `LLM_LEGACY_NOCONTEXT` mantida como rollback.
3. Coverage Go hard 30% (gate CI).
4. PWA sprint 1 — 10 arquivos tipados (ordenados por `any` desc).
5. `/ready` com 4 checks: db, redis (NOVO), whatsmeow (real via wrapper), llm (NoOp default).
6. Wrapper `whatsapp.Manager.IsConnected()` + `LastSeen()` expondo estado do singleton.
7. Testcontainers + mocks paralelos no CI (split jobs `test-unit` + `test-integration`).
8. gosec cleanup — suprimir G706 + G101 com justificativa inline.
9. Open Finance Foundation — `bank_accounts` + `bank_transactions` + `PluggyClient` HTTP cru + `/api/v1/banking/connect` stub + `/api/v1/banking/sync` stub.
10. Worker bank-sync via GitHub Action cron `bank-sync.yml` (não Fly Machine).
11. LLM ping cache 5min + TTL; `LLM_PING_DISABLED=true` default.

### 3.2. Fora do escopo (Fase 14+)

- Pluggy Connect Widget UX, sync real end-to-end, categorização ML.
- Interface abstrata `BankProvider` (YAGNI até Belvo/fallback entrar).
- Cache pub/sub multi-replica.
- PWA sprint 2-8 (arquivos 11-74).
- Worker bank-sync embutido como processo no app principal.
- Mobile React Native.

---

## 4. Pendências detalhadas

### 4.1. Cache integração full

- Integrar cache em 4 endpoints faltantes (`/score`, `/reports/monthly`, `/reports/categories`, `/banking/accounts`).
- TTL com jitter ±10% via `cache.Set(key, val, ttl + jitter(ttl))`.
- Invalidation event-driven: `POST/PATCH/DELETE` relevantes chamam `Cache.InvalidateWorkspace(ctx, wsID, scopes)`.
- Pub/sub cross-instance adiado p/ Fase 15.

### 4.2. ChatCompletion ctx — 5 callsites

Inventário real (via `rg`, ver §14):
1. `internal/services/llm.go:14` — interface `LLMProvider.ChatCompletion(systemPrompt, userMessage)`.
2. `internal/services/llm.go:177` — `GroqProvider.ChatCompletion`.
3. `internal/services/llm.go:195` — `OpenAIProvider.ChatCompletion`.
4. `internal/services/llm.go:220` — `GoogleProvider.ChatCompletion`.
5. `internal/services/llm_helpers.go:32` — `groqChatCompletion` (internal helper).
6. `internal/services/nlp.go:70` — único caller `provider.ChatCompletion(nlpSystemPrompt, text)`.

Rename: interface vira `ChatCompletion(ctx context.Context, systemPrompt, userMessage string)`. Flag `LLM_LEGACY_NOCONTEXT` no wrapper mantida 1 fase extra.

### 4.3. Health checks reais

- **db:** já existe (Fase 12).
- **redis:** NOVO — `PING` com timeout 500ms, status `ok`/`fail`.
- **whatsmeow:** `whatsapp.Manager.IsConnected()` + `LastSeen()` — precisa wrapper (métodos não existem, apenas singleton `Client *whatsmeow.Client` com `.Store.ID`).
- **llm:** NoOp por default (`LLM_PING_DISABLED=true` em prod). Habilitação manual + TTL 5min entre pings reais.

### 4.4. Coverage 30% — hard gate CI

- Gate hard 30% no pipeline. Meta soft 50% em `docs/memory/coverage_roadmap.md`.
- Foco testes: handlers, services/llm, cache, bootstrap.
- Excluir: `cmd/`, mocks, generated.

### 4.5. PWA lint cleanup — sprint 1 (10 arquivos)

10 arquivos de `lib/actions/` ordenados por densidade de `any` desc. Ver §14 para comando de ordenação. Alvo: 0 warnings nesses 10.

### 4.6. Testcontainers + mocks paralelos

- Unit tests (default) — mocks (`miniredis`, `pgx-mock`).
- Integration tests (build tag `integration`) — testcontainers com `TestMain` shared em `internal/testutil/integration.go`.
- CI split: job `test-unit` (~30s) + job `test-integration` (~90s).

### 4.7. gosec cleanup

- Suprimir G706 + G101 via `.gosec.yml` com justificativa inline.
- G124 já fixado em `testutil/session.go`.
- `math/rand` audit: **vazio** — nenhuma migração crypto/rand necessária.

### 4.8. Open Finance Foundation

- Migration `000036_open_finance_foundation.up.sql` (+ `.down.sql`).
- `PluggyClient` HTTP cru (`net/http` + structs) — §12.4a.
- Endpoint `/api/v1/banking/connect` stub — 501 com `[PLUGGY-CLIENT-ID]` se não configurado.
- Endpoint `/api/v1/banking/sync` stub — protegido por `X-Ops-Token` (mesmo secret do backup).
- GitHub Action `.github/workflows/bank-sync.yml` — cron diário 05:00 UTC disparando `/api/v1/banking/sync`.

### 4.9. Invalidation hooks — integrado em 4.1.

### 4.10. `math/rand` → `crypto/rand` — CANCELADO (audit vazio).

---

## 5. Decisões de arquitetura (recap pós-review #2)

### 5.1. Cache invalidation

- TTL curto + jitter 10% + event-driven hooks.
- **Não** pub/sub cross-instance.

### 5.2. ChatCompletion big-bang

- Rename da interface `LLMProvider.ChatCompletion` para aceitar `ctx` como primeiro arg.
- 5 callsites migram juntos. `LLM_LEGACY_NOCONTEXT` mantido como rollback (remover Fase 14).

### 5.3. Open Finance = Pluggy concreto via HTTP cru

- Sem SDK Go (não existe oficial). `net/http` + structs próprias.
- Sem interface `BankProvider` ainda (YAGNI — Fase 14).

### 5.4. Coverage strategy

- Gate hard 30% CI. Meta soft 50% documentada.

### 5.5. PWA sprint

- 10 arquivos/sprint em `lib/actions/` ordenados por `any` desc.

### 5.6. Worker bank-sync deployment — REVISADO

- **GitHub Action cron** (`.github/workflows/bank-sync.yml`) em vez de Fly Machine schedule.
- Dispara `POST /api/v1/banking/sync` com `X-Ops-Token` (mesmo secret `BACKUP_OPS_TOKEN`).
- Motivo: mais simples, 1 workflow único paralelo ao `backup-fly-pg.yml`, sem nova config em `fly.toml`.
- Endpoint no app lê `FEATURE_BANK_SYNC` e (quando on) itera `bank_accounts.last_synced_at > 6h`.

### 5.7. Testcontainers + mocks paralelos

- Unit = mocks, integration = testcontainers (build tag).

### 5.8. Whatsmeow wrapper

- Adicionar pacote `whatsapp.Manager` com métodos `IsConnected()` + `LastSeen()` delegando para `Client.IsConnected()` + `Client.LastSuccessfulConnect` (ou state interno).

---

## 6. Pré-requisitos e STANDBYs

| ID | Descrição | Bloqueia |
|----|-----------|----------|
| `[PLUGGY-CLIENT-ID]` | Pluggy sandbox + prod client id | Endpoint `/connect` real (stub funciona sem) |
| `[PLUGGY-CLIENT-SECRET]` | Pluggy client secret | Idem |

`[REDIS-INSTANCE]` promovido a obrigatório (health check redis precisa). STANDBYs finais = **2**.

STANDBYs herdados Fases 10/11/12 permanecem mas não bloqueiam Fase 13.

---

## 7. Critérios de aceite (DoD)

- Cache integrado em 4 endpoints + 4 invalidation hooks ativos + jitter 10%.
- 5 callsites de ChatCompletion migrados para `ctx`.
- Coverage Go ≥30% (gate hard CI).
- 10 arquivos PWA sem warnings em `lib/actions/`.
- `/ready` retorna 4 checks: db/redis/whatsmeow/llm (llm = skipped default).
- `whatsapp.Manager.IsConnected()` + `LastSeen()` funcionando.
- Testcontainers com build tag `integration` + CI split.
- gosec zero warnings (G706 + G101 suprimidos com justificativa).
- Migration 000036 aplicada; `PluggyClient` compila; 2 endpoints stub ativos.
- GitHub Action `bank-sync.yml` configurada.

---

## 8. Riscos

1. Cache invalidation pattern esquecido em algum callsite → staleness. **Mitigação:** grep de testes que valida lista de callers.
2. Coverage 30% exige testes novos em handlers complexos → tempo subestimado. **Mitigação:** foco em handlers leves + services.
3. Testcontainers flaky no CI GitHub (Docker-in-Docker). **Mitigação:** job isolado + retry 2x.
4. PluggyClient HTTP cru → auth token refresh manual. **Mitigação:** stub só cria token 1x, refresh é Fase 14.
5. GitHub Action bank-sync dispara antes do endpoint estar pronto. **Mitigação:** flag `FEATURE_BANK_SYNC=off` default, endpoint retorna 200 `{"status":"disabled"}`.
6. Wrapper whatsmeow mal alinhado com lifecycle real do Client. **Mitigação:** delegar direto para `Client.IsConnected()` + inspecionar store estado.
7. LLM ping disabled default mascara regressão silenciosa. **Mitigação:** job weekly em staging que força ping real + alerta.

---

## 9. Métricas de sucesso

- Coverage Go ≥30% (gate hard). Stretch interno 40%.
- 0 warnings em 10 arquivos `lib/actions/` alvo.
- `/ready` p95 <150ms (cache 5min no LLM ping).
- Cache hit ratio >60% nos 4 endpoints novos (medido via Prometheus).
- 0 G706/G101/G124 warnings no gosec.

---

## 10. Plano de testes

- Unit: mocks `miniredis` + `pgx-mock` para cache/db; mocks `LLMProvider` para NLP.
- Integration (build tag): testcontainers PG + Redis + `TestMain` shared; cobre cache invalidation + `/ready` real.
- E2E API: `/api/v1/banking/connect` retorna 501 sem Pluggy; `/api/v1/banking/sync` retorna 200 com `FEATURE_BANK_SYNC=off`.
- PWA: `npm run lint` passa em 10 arquivos alvo.
- CI split: `test-unit` + `test-integration` paralelos.

---

## 11. Resolução das 10 questões v1 (recap)

| # | Questão v1 | Decisão FINAL v3 |
|---|------------|------------------|
| 1 | Cache pub/sub cross-instance | NÃO nesta fase. TTL + event-driven local. Fase 15 reavalia. |
| 2 | Coverage 28% vs 30% | 30% hard gate. 50% soft meta em docs. |
| 3 | Pluggy vs multi-provider | Pluggy concreto HTTP cru. Interface `BankProvider` Fase 14 (YAGNI). |
| 4 | PWA sprint 10 vs 20 arquivos | 10 arquivos. 8 sprints × 10. |
| 5 | gosec G124 A vs B | A confirmado. G706+G101 suprimidos com justificativa. G124 já fixado. `math/rand` audit vazio. |
| 6 | Worker docker-compose vs goroutine vs Fly Machine | **GitHub Action cron** (revisado v3 — mais simples). |
| 7 | LLM ping prompt real vs `/models` | NoOp default (`LLM_PING_DISABLED=true`). Toggle manual; TTL 5min. |
| 8 | ChatCompletion big-bang vs feature flag | Big-bang com `LLM_LEGACY_NOCONTEXT` como rollback. |
| 9 | `bank_transactions` Fase 13 vs 14 | Fase 13 (foundation completa). UX Fase 14. |
| 10 | Testcontainers vs mocks no CI | Ambos em paralelo. |

---

## 12. Detalhes técnicos

### 12.1. Schema `bank_accounts`

```sql
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('pluggy', 'belvo')),
    provider_account_id VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'investment')),
    balance_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_workspace_id ON bank_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_last_synced ON bank_accounts(last_synced_at) WHERE last_synced_at IS NOT NULL;

CREATE TRIGGER trg_bank_accounts_updated_at
    BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_iso_bank_accounts ON bank_accounts
    USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

### 12.2. Schema `bank_transactions`

```sql
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_transaction_id VARCHAR(255) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    description TEXT,
    category_hint VARCHAR(255),
    transaction_date DATE NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_workspace_date ON bank_transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions(bank_account_id);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_iso_bank_tx ON bank_transactions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

### 12.3. Migration path

- Arquivo: `laura-go/internal/migrations/000036_open_finance_foundation.up.sql`
- Down: `laura-go/internal/migrations/000036_open_finance_foundation.down.sql`
- Confirmado: última migration = `000035_security_hardening.up.sql`. 000036 livre.

### 12.4. Endpoint `/api/v1/banking/connect` stub

```go
// internal/handlers/banking.go
package handlers

import (
    "github.com/gofiber/fiber/v2"
)

type BankingHandler struct {
    deps   *Dependencies
    pluggy *pluggy.Client
}

func NewBankingHandler(deps *Dependencies, p *pluggy.Client) *BankingHandler {
    return &BankingHandler{deps: deps, pluggy: p}
}

func (h *BankingHandler) Connect(c *fiber.Ctx) error {
    if !h.pluggy.IsConfigured() {
        return c.Status(501).JSON(fiber.Map{
            "error":   "open_finance_not_configured",
            "standby": []string{"[PLUGGY-CLIENT-ID]", "[PLUGGY-CLIENT-SECRET]"},
        })
    }
    token, err := h.pluggy.CreateConnectToken(c.UserContext())
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": err.Error()})
    }
    return c.JSON(fiber.Map{"connect_token": token, "expires_in": 1800})
}

func (h *BankingHandler) Sync(c *fiber.Ctx) error {
    if c.Get("X-Ops-Token") != h.deps.Config.OpsToken {
        return c.SendStatus(401)
    }
    if h.deps.Config.FeatureBankSync != "on" {
        return c.JSON(fiber.Map{"status": "disabled", "reason": "FEATURE_BANK_SYNC=off"})
    }
    // Fase 14: iterar bank_accounts.last_synced_at > 6h, chamar Pluggy.FetchTransactions
    return c.JSON(fiber.Map{"status": "stub", "synced_accounts": 0})
}
```

### 12.4a. `PluggyClient` skeleton (HTTP cru, sem SDK)

```go
// internal/pluggy/client.go
package pluggy

import (
    "context"
    "errors"
    "net/http"
    "os"
    "time"
)

type Client struct {
    baseURL      string
    clientID     string
    clientSecret string
    http         *http.Client
}

func NewClient() *Client {
    return &Client{
        baseURL:      "https://api.pluggy.ai",
        clientID:     os.Getenv("PLUGGY_CLIENT_ID"),
        clientSecret: os.Getenv("PLUGGY_CLIENT_SECRET"),
        http:         &http.Client{Timeout: 10 * time.Second},
    }
}

func (c *Client) IsConfigured() bool {
    return c.clientID != "" && c.clientSecret != ""
}

// CreateConnectToken — STUB até [PLUGGY-CLIENT-ID/SECRET].
// Fase 14: implementar HTTP POST /auth (retorna apiKey) + POST /connect_token.
func (c *Client) CreateConnectToken(ctx context.Context) (string, error) {
    if !c.IsConfigured() {
        return "", errors.New("pluggy not configured — STANDBY")
    }
    return "STUB_CONNECT_TOKEN", nil
}

// FetchTransactions — STUB.
func (c *Client) FetchTransactions(ctx context.Context, accountID string) ([]Transaction, error) {
    if !c.IsConfigured() {
        return nil, errors.New("pluggy not configured — STANDBY")
    }
    return []Transaction{}, nil
}

type Transaction struct {
    ID          string
    AmountCents int64
    Currency    string
    Description string
    Category    string
    Date        time.Time
}
```

### 12.5. Worker bank-sync — GitHub Action cron

Path: `.github/workflows/bank-sync.yml`

```yaml
name: bank-sync
on:
  schedule:
    - cron: "0 5 * * *"  # diário 05:00 UTC
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync via API
        run: |
          HTTP_CODE=$(curl -sS -o /tmp/out.json -w "%{http_code}" \
            -X POST https://api.laura.finance/api/v1/banking/sync \
            -H "X-Ops-Token: ${{ secrets.BACKUP_OPS_TOKEN }}")
          echo "HTTP $HTTP_CODE"
          cat /tmp/out.json
          if [ "$HTTP_CODE" -ge 500 ]; then exit 1; fi
```

Mesma secret `BACKUP_OPS_TOKEN` do `backup-fly-pg.yml`. Zero config nova em `fly.toml`.

### 12.6. Cache invalidation helper

```go
// internal/cache/invalidate.go
package cache

import (
    "context"
    "fmt"
)

func (c *Cache) InvalidateWorkspace(ctx context.Context, wsID string, scopes []string) error {
    if len(scopes) == 0 {
        return c.InvalidatePattern(ctx, fmt.Sprintf("ws:%s:*", wsID))
    }
    for _, scope := range scopes {
        if err := c.InvalidatePattern(ctx, fmt.Sprintf("ws:%s:%s:*", wsID, scope)); err != nil {
            return err
        }
    }
    return nil
}

// jitter aplica ±10% ao TTL base.
func jitter(base time.Duration) time.Duration {
    maxJitter := int64(float64(base) * 0.1)
    if maxJitter <= 0 { return base }
    // crypto/rand para evitar gosec G404
    n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(2*maxJitter))
    if err != nil { return base }
    return base + time.Duration(n.Int64()-maxJitter)
}
```

Callsites de invalidation:
- `POST /transactions` → `InvalidateWorkspace(wsID, []string{"dashboard","score","reports"})`.
- `PATCH/DELETE /transactions/:id` → idem.
- `POST/PATCH/DELETE /categories` → `InvalidateWorkspace(wsID, []string{"categories","dashboard"})`.
- `POST /banking/accounts` → `InvalidateWorkspace(wsID, []string{"banking","dashboard"})`.

### 12.7. ChatCompletion ctx — inventário CONSOLIDADO

5 callsites (via `rg`, ver §14):

| # | Arquivo:linha | Tipo |
|---|---------------|------|
| 1 | `internal/services/llm.go:14` | interface `LLMProvider.ChatCompletion` |
| 2 | `internal/services/llm.go:177` | `GroqProvider.ChatCompletion` |
| 3 | `internal/services/llm.go:195` | `OpenAIProvider.ChatCompletion` |
| 4 | `internal/services/llm.go:220` | `GoogleProvider.ChatCompletion` |
| 5 | `internal/services/llm_helpers.go:32` | `groqChatCompletion` (helper) |
| 6 | `internal/services/nlp.go:70` | caller `provider.ChatCompletion(...)` |

Plan v1 terá **1 task por item**. Wrapper legacy com `LLM_LEGACY_NOCONTEXT` fica em `llm_helpers.go` delegando para chamada sem ctx.

### 12.8. Wrapper `whatsapp.Manager.IsConnected()` + `LastSeen()` — NOVO

Motivo: pacote `whatsapp` hoje só expõe `Client *whatsmeow.Client` (global). Não há tipo `Manager` com métodos de estado. Criar:

```go
// internal/whatsapp/manager.go
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

// IsConnected retorna true se o client whatsmeow está logado e a sessão ativa.
func (m *manager) IsConnected() bool {
    if Client == nil || Client.Store == nil || Client.Store.ID == nil {
        return false
    }
    return Client.IsConnected() && Client.IsLoggedIn()
}

// LastSeen retorna o timestamp da última conexão bem-sucedida.
func (m *manager) LastSeen() time.Time {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.lastSeen
}

// TouchLastSeen marca conexão bem-sucedida (chamar do event handler).
func (m *manager) TouchLastSeen() {
    m.mu.Lock()
    m.lastSeen = time.Now()
    m.mu.Unlock()
}
```

Hook em `client.go` — dentro do event handler `Connected`, chamar `Manager.TouchLastSeen()`.

### 12.9. `/ready` com 4 checks

```go
// internal/handlers/health.go
type ReadyResponse struct {
    Status string  `json:"status"`
    Checks []Check `json:"checks"`
}

func (h *HealthHandler) Ready(c *fiber.Ctx) error {
    ctx := c.UserContext()
    checks := []Check{
        h.dbCheck(ctx),
        h.redisCheck(ctx),
        h.whatsappCheck(),
        h.llmCheck(ctx),
    }
    overall := "ok"
    for _, ch := range checks {
        if ch.Status == "fail" { overall = "fail"; break }
        if ch.Status == "degraded" && overall != "fail" { overall = "degraded" }
    }
    code := 200
    if overall == "fail" { code = 503 }
    return c.Status(code).JSON(ReadyResponse{Status: overall, Checks: checks})
}

func (h *HealthHandler) redisCheck(ctx context.Context) Check {
    ctx2, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
    defer cancel()
    if err := h.deps.Redis.Ping(ctx2).Err(); err != nil {
        return Check{Name: "redis", Status: "fail", Reason: err.Error()}
    }
    return Check{Name: "redis", Status: "ok"}
}

func (h *HealthHandler) whatsappCheck() Check {
    c := Check{Name: "whatsmeow"}
    if whatsapp.Manager.IsConnected() {
        c.Status = "ok"
        c.LastSeenS = int(time.Since(whatsapp.Manager.LastSeen()).Seconds())
        if c.LastSeenS > 30 { c.Status = "degraded" }
    } else {
        c.Status = "fail"
    }
    return c
}
```

### 12.10. `/ready` LLM (NoOp default + cache 5min)

```go
var llmPingCache = struct {
    sync.Mutex
    at     time.Time
    result Check
}{}

func (h *HealthHandler) llmCheck(ctx context.Context) Check {
    if h.deps.Config.LLMPingDisabled {
        return Check{Name: "llm", Status: "skipped", Reason: "disabled"}
    }
    llmPingCache.Lock()
    defer llmPingCache.Unlock()
    if time.Since(llmPingCache.at) < 5*time.Minute {
        return llmPingCache.result
    }
    ctx2, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    start := time.Now()
    _, err := h.deps.LLM.ChatCompletion(ctx2, "ping", "ping")
    lat := time.Since(start).Milliseconds()
    c := Check{Name: "llm", LatencyMs: lat}
    switch {
    case err != nil:
        c.Status = "fail"
        c.Reason = err.Error()
    case lat > 1500:
        c.Status = "degraded"
    default:
        c.Status = "ok"
    }
    llmPingCache.at = time.Now()
    llmPingCache.result = c
    return c
}
```

### 12.11. PWA — comando de ordenação 10 arquivos

Duas variantes (fallback):

**Preferida (eslint):**
```sh
cd laura-pwa && npx eslint src/lib/actions --format json 2>/dev/null \
  | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
  | sort -k2 -nr | head -10
```

**Fallback (grep):**
```sh
cd laura-pwa && grep -rln ": any\b\| any\[\]\|<any>" src/lib/actions/*.ts \
  | xargs -I {} sh -c 'echo "$(grep -c "any" {})  {}"' \
  | sort -rn | head -10
```

---

## 13. Resolução review #2

| # | Item | Decisão v3 |
|---|------|------------|
| 1 | Última migration | Confirmada = `000035_security_hardening.up.sql`. Próxima = `000036_open_finance_foundation`. |
| 2 | `whatsapp.Manager.IsConnected/LastSeen` existem? | NÃO. Métodos ausentes — adicionar via wrapper em `internal/whatsapp/manager.go` (§12.8). |
| 3 | Fly Machine schedule sintaxe | ABANDONADA. Optar por **GitHub Action cron** (`.github/workflows/bank-sync.yml`, §12.5). |
| 4 | PWA 10 files cleanup script | Definido §12.11 (eslint + jq primário, grep fallback). |
| 5 | Pluggy SDK | Decisão: HTTP cru `net/http` + structs próprias. Sem SDK (não há oficial Go). Skeleton §12.4a. |
| 6 | Schema `bank_accounts` | Completo §12.1 com trigger `updated_at` + RLS + 2 índices. |
| 7 | Schema `bank_transactions` | Completo §12.2 com FK cascade + RLS + 2 índices. |
| 8 | `PluggyClient` skeleton | §12.4a — `IsConfigured()`, `CreateConnectToken` stub, `FetchTransactions` stub. |
| 9 | Worker bank-sync | GitHub Action cron disparando `POST /api/v1/banking/sync` com `X-Ops-Token` (§12.5). |
| 10 | `/ready` 4 checks | db (existe) + redis NOVO + whatsmeow real + llm (NoOp). Diff em §12.9. |
| 11 | ChatCompletion ctx callsites | Inventário 5 callsites + 1 caller (§12.7). Plan v1 = 1 task por callsite. |
| 12 | gosec A (crypto/rand) | `math/rand` audit em `internal/`: **vazio**. Nenhuma migração necessária. Apenas suprimir G706+G101. |

---

## 14. Apêndice — comandos canônicos

### 14.1. Inventário ChatCompletion

```sh
rg -n 'ChatCompletion\(' laura-go/internal/services/ laura-go/internal/handlers/ --type go
```

Esperado: 5-6 matches consolidados.

### 14.2. Última migration

```sh
ls laura-go/internal/migrations/*.up.sql | sort | tail -3
```

### 14.3. `math/rand` audit

```sh
grep -rn "math/rand" laura-go/internal/ | grep -v _test.go
```

Resultado v3: **vazio**.

### 14.4. PWA ordenação 10 arquivos

```sh
cd laura-pwa && npx eslint src/lib/actions --format json 2>/dev/null \
  | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
  | sort -k2 -nr | head -10
```

### 14.5. gosec run local

```sh
cd laura-go && gosec -conf .gosec.yml ./...
```

### 14.6. Coverage local

```sh
cd laura-go && go test -coverprofile=cover.out ./... \
  && go tool cover -func=cover.out | grep total
```

### 14.7. Trigger bank-sync manual

```sh
curl -X POST https://api.laura.finance/api/v1/banking/sync \
  -H "X-Ops-Token: $BACKUP_OPS_TOKEN" -v
```

---

## 15. Checklist consolidado de entregas

### A. Cache (6)
- [ ] `internal/cache/invalidate.go` — `InvalidateWorkspace` + `jitter`.
- [ ] Cache integrado em `GET /api/v1/score`.
- [ ] Cache integrado em `GET /api/v1/reports/monthly`.
- [ ] Cache integrado em `GET /api/v1/reports/categories`.
- [ ] Cache integrado em `GET /api/v1/banking/accounts` (stub).
- [ ] 4 invalidation hooks (transactions POST/PATCH/DELETE, categories, banking).

### B. ChatCompletion ctx (6)
- [ ] Rename interface `LLMProvider.ChatCompletion` para aceitar `ctx`.
- [ ] Callsite `GroqProvider.ChatCompletion` (llm.go:177).
- [ ] Callsite `OpenAIProvider.ChatCompletion` (llm.go:195).
- [ ] Callsite `GoogleProvider.ChatCompletion` (llm.go:220).
- [ ] Helper `groqChatCompletion` (llm_helpers.go:32).
- [ ] Caller `services/nlp.go:70`.

### C. Health `/ready` (5)
- [ ] `redisCheck` implementado.
- [ ] `whatsapp.Manager.IsConnected()` + `LastSeen()` + `TouchLastSeen` wrapper.
- [ ] Hook `TouchLastSeen` no event handler Connected.
- [ ] `whatsappCheck` real usa Manager.
- [ ] `llmCheck` com cache 5min + NoOp default + timeout 3s.

### D. Coverage (3)
- [ ] Gate hard 30% no CI (`.github/workflows/test.yml`).
- [ ] Testes novos handlers/services para atingir 30%.
- [ ] `docs/memory/coverage_roadmap.md` com meta soft 50%.

### E. PWA sprint 1 (3)
- [ ] Executar §14.4 para ordenar 10 arquivos.
- [ ] 10 arquivos tipados (0 warnings).
- [ ] `npm run lint` passa nos 10 alvo.

### F. Lint/gosec (3)
- [ ] `.gosec.yml` com G706 + G101 suprimidos + justificativa inline.
- [ ] `gosec ./...` retorna 0 issues.
- [ ] CI job gosec atualizado.

### G. Testcontainers (3)
- [ ] `internal/testutil/integration.go` com `TestMain` shared PG+Redis.
- [ ] Build tag `integration` em testes relevantes.
- [ ] CI split: `test-unit` + `test-integration` paralelos.

### H. Open Finance (8)
- [ ] Migration `000036_open_finance_foundation.up.sql`.
- [ ] Migration `000036_open_finance_foundation.down.sql`.
- [ ] `internal/pluggy/client.go` (skeleton §12.4a).
- [ ] `internal/handlers/banking.go` (`Connect` + `Sync` stubs).
- [ ] Rotas `POST /api/v1/banking/connect` + `POST /api/v1/banking/sync` registradas.
- [ ] `.github/workflows/bank-sync.yml`.
- [ ] Config vars `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `FEATURE_BANK_SYNC`, `OPS_TOKEN`.
- [ ] Testes handler banking (401 sem token, 200 disabled, 501 sem Pluggy).

### I. Tag/Docs (3)
- [ ] Update `docs/HANDOFF.md` com estado pós-Fase 13.
- [ ] `docs/memory/phase_13_complete.md`.
- [ ] Git tag `v1.13.0`.

**Total: 40 itens** agrupados em 9 categorias.

---

## 16. Referências

- v1: `docs/superpowers/specs/2026-04-15-fase-13-polish-foundation-v1.md`.
- v2: `docs/superpowers/specs/2026-04-15-fase-13-polish-foundation-v2.md`.
- `docs/memory/phase_12_complete.md`.
- `docs/memory/cache_pattern.md`.
- [Pluggy API docs](https://docs.pluggy.ai/).
- [GitHub Actions schedule](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule).
