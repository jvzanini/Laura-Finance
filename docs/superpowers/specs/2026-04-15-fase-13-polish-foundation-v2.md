# Fase 13 — Performance Polish + Quality Hardening + Open Finance Foundation (Spec v2)

> Versão: v2 (review #1 aplicado)
> Data: 2026-04-15
> Autor: agente autônomo (arquiteto sênior)
> Status: pronto para writing-plans
> Supersedes: v1 (2026-04-15)

---

## 0. Mudanças vs v1

1. **Cache cross-instance definido** — TTL puro + event-driven local; pub/sub adiado p/ Fase 15 (só quando houver scaling horizontal real).
2. **Coverage threshold fixado** — 30% como CI gate (hard), 50% como meta soft documentada; sem faixa 28-30%.
3. **Pluggy direto (sem abstração)** — começamos com `pluggy.Client` concreto; interface `BankProvider` vira refactor da Fase 14 (YAGNI).
4. **PWA sprint size mantido em 10 arquivos** — total 74 / 10 ≈ 8 sprints, ordenados por densidade de `any`.
5. **gosec opção A confirmada** — exclude `G706 + G101` (falsos positivos com justificativa documentada); `G124` já foi fixado em `testutil/session.go`.
6. **Worker bank-sync = Fly Machine schedule** — NÃO embutido no app; modelo idêntico ao `backup-fly-pg` (cron in-process já saturado com reminders).
7. **LLM ping com NoOp default** — `LLM_PING_DISABLED=true` por padrão em prod; habilitação manual para validação, TTL 5min entre pings reais.
8. **ChatCompletion big-bang mantido** — mitigação via flag de rollback `LLM_LEGACY_NOCONTEXT` que já existe no código.
9. **Escopo `bank_transactions` confirmado dentro da Fase 13** — schema + sync stub + endpoint stub; UX fica Fase 14.
10. **Testcontainers + mocks paralelos no CI** — testcontainers (build tag `integration`) + mocks (unit default); CI job split.
11. **Novos STANDBYs explícitos** — `[PLUGGY-CLIENT-ID]`, `[PLUGGY-CLIENT-SECRET]`; `[REDIS-INSTANCE]` segue opcional.
12. **Seção 12 nova** — detalhes técnicos concretos (schemas DDL, path de migration, endpoint stub, invalidation helper, callsite inventory guideline).

---

## 1. Objetivo

Consolidar concerns herdados da Fase 12 e abrir o caminho estratégico de Open Finance. Três vetores:

1. **Performance Polish** — fechar ciclo de cache (POC dashboard → 4 endpoints full + invalidation event-driven) e finalizar `context.Context` no pipeline LLM.
2. **Quality Hardening** — coverage Go ~15% → ≥30% (gate CI), zero warnings PWA em `lib/api/` + `lib/services/`, health checks reais `/ready` (whatsmeow + LLM ping com NoOp default), testcontainers com `TestMain` compartilhado, cleanup gosec.
3. **Open Finance Foundation** — scaffolding mínimo (`bank_accounts` + `bank_transactions` + `PluggyClient` concreto + `/api/v1/banking/connect` stub + worker stub via Fly Machine schedule). Sem sync real; apenas esqueleto testável.

A fase **não** entrega Open Finance usável; entrega a base arquitetural para Fase 14+ focar em UX + categorização.

---

## 2. Contexto e motivação

### 2.1. Concerns herdados Fase 12

Idêntico à v1 (tabela 10 itens mantida — ver v1 §2.1).

### 2.2. Visão futura

- **Fase 14** — Open Finance UX (Pluggy Connect Widget) + categorização ML-light + refactor `BankProvider` interface + PWA sprint 2.
- **Fase 15** — PWA RUM Sentry Browser + Mobile React Native + cache pub/sub cross-instance (se scaling horizontal materializou).
- **Fase 16+** — Multi-region active-active.

---

## 3. Escopo

### 3.1. Dentro do escopo

Mesmos 11 itens da v1 §3.1, com ajustes:
- Item 11 (Open Finance): `PluggyClient` **concreto** (sem interface `BankProvider` ainda — fica Fase 14).
- Item 11: worker **Fly Machine schedule** (não service no docker-compose).
- Health check LLM: **NoOp por default** (`LLM_PING_DISABLED=true`) + TTL 5min entre pings reais.

### 3.2. Fora do escopo (Fase 14+)

Idêntico v1 §3.2, acrescido:
- Interface `BankProvider` abstrata — refactor Fase 14.
- Cache pub/sub multi-replica — Fase 15.
- Worker bank-sync embutido no app principal — rejeitado (Fly Machine schedule).

---

## 4. Pendências detalhadas

Mesma estrutura v1 §4.1–§4.10 com as seguintes substituições/adições:

### 4.1. Cache integração full — mantido v1.

**Decisão nova:** jitter ±10% no TTL via `cache.Set(key, val, ttl + rand(-10%,+10%))` para evitar miss storm.

### 4.2. ChatCompletion ctx — mantido v1.

**Decisão nova:** flag `LLM_LEGACY_NOCONTEXT` permanece no código 1 fase extra como rollback (remover só na Fase 14 após smoke).

### 4.3. Health checks reais — ajustado.

**Whatsmeow:** usar `whatsapp.Manager.IsConnected()` (já existe como singleton). Fail se disconnected >30s.

**LLM:** wrapper sobre `services.LLMProvider.Chat(ctx, pingPrompt)` com timeout 3s + **cache 5min** entre pings. Por padrão `LLM_PING_DISABLED=true` → retorna `{"status":"skipped","reason":"disabled"}`. Enable manual com env var.

### 4.4. Coverage 30% — ajustado.

Gate CI **hard 30%** (plan v3 §H consistente). Meta soft 50% documentada em `docs/memory/coverage_roadmap.md`.

### 4.5. PWA lint cleanup — ajustado.

Sprint 1: **10 arquivos** de `lib/actions/` ordenados por `any` desc (ver §12.10).

### 4.6–4.8. Mantidos v1.

### 4.9. Open Finance Foundation — ajustado.

- **Sem interface `BankProvider`** — `PluggyClient` concreto direto.
- **Worker = Fly Machine schedule** (`fly.toml` com `[[machines]] schedule = "0 */6 * * *"` ou similar) — não container docker-compose.
- Ver §12.1–§12.6 para schemas DDL e path exatos.

### 4.10. Invalidation hooks — integrado em 4.1.

---

## 5. Decisões de arquitetura (recap pós-review)

### 5.1. Cache invalidation

- TTL curto + jitter 10% + event-driven hooks (`POST/PATCH/DELETE` → `Cache.InvalidateWorkspace(ctx, wsID, scopes)`).
- **Não** pub/sub cross-instance nesta fase. Reavaliação Fase 15 se scaling horizontal materializou.

### 5.2. ChatCompletion big-bang

- Rename `ChatCompletionCtx` → `ChatCompletion(ctx, ...)`, ctx obrigatório.
- Flag `LLM_LEGACY_NOCONTEXT` **mantida** como rollback 1 fase extra.
- Rollback: `LLM_LEGACY_NOCONTEXT=true` → usa wrapper legacy.

### 5.3. Open Finance = Pluggy concreto

- Pluggy > Belvo (ver v1 §5.3 para tabela comparativa).
- **Sem interface** na Fase 13 — YAGNI. Interface vira refactor Fase 14 se Belvo/fallback entrar.

### 5.4. Coverage strategy

- Gate hard 30% CI. Meta soft 50% documentada.
- Foco: handlers, services/llm, cache, bootstrap.
- Excluir: `cmd/`, mocks, generated.

### 5.5. PWA sprint

- 10 arquivos/sprint em `lib/actions/` ordenados por `any` desc.
- 8 sprints até zerar (74 / 10).

### 5.6. Worker bank-sync deployment

- **Fly Machine schedule** (paralelo a `backup-fly-pg`).
- Binary separado (`cmd/worker-bank-sync/main.go`) — cron in-process do app já está saturado com reminders.
- Flag `FEATURE_BANK_SYNC=off` default; quando on, lê `bank_accounts.last_synced_at > 6h` e chama `PluggyClient.FetchTransactions`.

### 5.7. Testcontainers + mocks paralelos

- Unit tests (default) — mocks (`miniredis`, `pgx-mock`).
- Integration tests (build tag `integration`) — testcontainers com `TestMain` shared.
- CI split em dois jobs paralelos: `test-unit` (fast ~30s) + `test-integration` (slower ~90s).

---

## 6. Pré-requisitos e STANDBYs

| ID | Descrição | Bloqueia |
|----|-----------|----------|
| `[PLUGGY-CLIENT-ID]` | Pluggy sandbox + prod client id | Endpoint real (stub funciona sem) |
| `[PLUGGY-CLIENT-SECRET]` | Pluggy client secret | Idem |
| `[REDIS-INSTANCE]` | Upstash URL (opcional) | Cache em prod (fallback InMemory OK) |

STANDBYs herdados Fases 10/11/12 (16 IDs) permanecem.

---

## 7. Critérios de aceite (DoD)

Idênticos à v1 §7 com ajustes:
- **Coverage:** gate hard ≥30% (não 28%).
- **LLM ping:** `/ready` retorna `{"status":"skipped"}` por default em prod; toggle manual smoke valida caminho real.
- **Worker:** `cmd/worker-bank-sync` compila; `fly.toml` com machine schedule declarada; flag `FEATURE_BANK_SYNC=off` default.
- **Interface `BankProvider`:** **não** precisa existir (escopo Fase 14).

---

## 8. Riscos

Mantidos v1, com adições:
7. **Fly Machine schedule não-trivial** — primeiro worker que roda como machine schedule. **Mitigação:** espelhar `backup-fly-pg`.
8. **LLM ping disabled default mascara regressão** — operação pode esquecer de habilitar. **Mitigação:** job weekly em staging que força ping real + alerta.

---

## 9. Métricas de sucesso

Idênticas v1, com ajuste:
- **Coverage Go:** ≥30% (gate hard). Meta stretch interna 40%.

---

## 10. Plano de testes

Mesma estrutura v1 §10, com ajuste:
- CI split: `test-unit` (30% gate) + `test-integration` (build tag) rodam paralelos.

---

## 11. Resolução das 10 questões v1

| # | Questão v1 | Decisão v2 |
|---|------------|-----------|
| 1 | Cache pub/sub cross-instance | **NÃO** nesta fase. TTL + event-driven local. Fase 15 reavalia. |
| 2 | Coverage 28% vs 30% | **30% hard gate**. 50% soft meta em docs. |
| 3 | Pluggy vs multi-provider | **Pluggy concreto**. Interface `BankProvider` Fase 14 (YAGNI). |
| 4 | PWA sprint 10 vs 20 arquivos | **10 arquivos**. 8 sprints × 10. Menos risco de quebrar runtime. |
| 5 | gosec G124 A vs B | **A (crypto/rand)**. G706+G101 suprimidos com justificativa inline. G124 já fixado. |
| 6 | Worker docker-compose vs goroutine | **Fly Machine schedule** (separado, paralelo a `backup-fly-pg`). |
| 7 | LLM ping prompt real vs `/models` | **NoOp default** (`LLM_PING_DISABLED=true`). Toggle manual; TTL 5min entre pings reais. |
| 8 | ChatCompletion big-bang vs feature flag | **Big-bang** com `LLM_LEGACY_NOCONTEXT` mantido 1 fase extra como rollback. |
| 9 | `bank_transactions` Fase 13 vs 14 | **Fase 13** (foundation completa: schema + sync stub + endpoint stub). UX Fase 14. |
| 10 | Testcontainers vs mocks no CI | **Ambos em paralelo**. Unit = mocks, integration = testcontainers (build tag). |

---

## 12. Detalhes técnicos novos (review #1)

### 12.1. Schema `bank_accounts`

```sql
CREATE TABLE bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider              VARCHAR(32) NOT NULL DEFAULT 'pluggy',
  provider_account_id   VARCHAR(128) NOT NULL,
  bank_name             VARCHAR(128) NOT NULL,
  account_type          VARCHAR(16) NOT NULL CHECK (account_type IN ('checking','savings','credit_card')),
  balance_cents         BIGINT NOT NULL DEFAULT 0,
  currency              VARCHAR(3) NOT NULL DEFAULT 'BRL',
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX idx_bank_accounts_workspace ON bank_accounts (workspace_id);
CREATE INDEX idx_bank_accounts_last_synced ON bank_accounts (last_synced_at) WHERE last_synced_at IS NOT NULL;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_iso_bank_accounts ON bank_accounts
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

### 12.2. Schema `bank_transactions`

```sql
CREATE TABLE bank_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id           UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  workspace_id              UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_transaction_id   VARCHAR(128) NOT NULL,
  amount_cents              BIGINT NOT NULL,
  currency                  VARCHAR(3) NOT NULL DEFAULT 'BRL',
  description               TEXT,
  category_hint             VARCHAR(64),
  transaction_date          DATE NOT NULL,
  imported_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_transaction_id)
);

CREATE INDEX idx_bank_tx_account ON bank_transactions (bank_account_id);
CREATE INDEX idx_bank_tx_workspace_date ON bank_transactions (workspace_id, transaction_date DESC);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_iso_bank_tx ON bank_transactions
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

### 12.3. Migration path

`laura-go/internal/migrations/000036_open_finance_foundation.up.sql` (+ `.down.sql`).
Numeração segue consolidação pós-Fase 12. Se houver conflito com migration pendente no branch, renumerar para próxima livre.

### 12.4. Endpoint `/api/v1/banking/connect` stub

```go
// internal/handlers/banking.go
func (h *BankingHandler) Connect(c *fiber.Ctx) error {
    cfg := h.deps.Config
    if cfg.PluggyClientID == "" || cfg.PluggyClientSecret == "" {
        return c.Status(501).JSON(fiber.Map{
            "error": "open_finance_not_configured",
            "standby": []string{"[PLUGGY-CLIENT-ID]","[PLUGGY-CLIENT-SECRET]"},
        })
    }
    // Caminho real: chama h.pluggy.CreateConnectToken(ctx, userID)
    token, err := h.pluggy.CreateConnectToken(c.UserContext(), getUserID(c))
    if err != nil { return err }
    return c.JSON(fiber.Map{"connect_token": token, "expires_in": 1800})
}
```

### 12.5. Worker bank-sync stub

Path: `laura-go/cmd/worker-bank-sync/main.go` (binary separado).
Fly Machine schedule em `fly.toml`:

```toml
[[machines]]
  name = "bank-sync"
  schedule = "0 */6 * * *"
  auto_destroy = true
  processes = ["worker-bank-sync"]
```

Conteúdo stub:
```go
func main() {
    logger := observability.NewLogger()
    if os.Getenv("FEATURE_BANK_SYNC") != "on" {
        logger.Info("bank-sync disabled via flag; exiting")
        return
    }
    logger.Info("bank-sync stub: no real sync yet")
    // Fase 14: carregar contas com last_synced_at > 6h, chamar Pluggy.FetchTransactions
}
```

### 12.6. Cache invalidation helper

```go
// internal/cache/invalidate.go
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
```

Callsites obrigatórios:
- `POST /transactions` → `InvalidateWorkspace(wsID, []string{"dashboard","score","reports"})`.
- `PATCH/DELETE /transactions/:id` → idem.
- `POST/PATCH/DELETE /categories` → `InvalidateWorkspace(wsID, []string{"categories","dashboard"})`.

### 12.7. ChatCompletion ctx — callsite inventory guideline

Plan deve ter **1 task por callsite**. Obter lista real com:

```sh
rg -n 'ChatCompletion\(' laura-go/internal/ --type go -g '!*_test.go'
```

Esperado: ~10 matches. Cada task do plan vira: "refactor callsite X para ChatCompletion(ctx, prompt)".

### 12.8. `/ready` whatsmeow

```go
// internal/handlers/health.go
whatsCheck := Check{Name: "whatsmeow"}
if whatsapp.Manager.IsConnected() {
    whatsCheck.Status = "ok"
    whatsCheck.LastSeenS = int(time.Since(whatsapp.Manager.LastSeen()).Seconds())
} else {
    whatsCheck.Status = "fail"
}
```

### 12.9. `/ready` LLM (NoOp default + cache 5min)

```go
// internal/handlers/health.go
var llmPingCache = struct{
    sync.Mutex
    at time.Time
    result Check
}{}

func llmCheck(ctx context.Context, cfg Config, svc services.LLMProvider) Check {
    if cfg.LLMPingDisabled {
        return Check{Name:"llm", Status:"skipped", Reason:"disabled"}
    }
    llmPingCache.Lock(); defer llmPingCache.Unlock()
    if time.Since(llmPingCache.at) < 5*time.Minute {
        return llmPingCache.result
    }
    ctx2, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    start := time.Now()
    _, err := svc.Chat(ctx2, "ping")
    lat := time.Since(start).Milliseconds()
    c := Check{Name:"llm", LatencyMs:lat}
    switch {
    case err != nil: c.Status = "fail"
    case lat > 1500: c.Status = "degraded"
    default: c.Status = "ok"
    }
    llmPingCache.at = time.Now()
    llmPingCache.result = c
    return c
}
```

### 12.10. PWA 10 primeiros arquivos a tipar

Ordenar via:
```sh
cd pwa && npx eslint lib/actions --format json \
  | jq -r '.[] | select(.warningCount>0) | [.filePath, .warningCount] | @tsv' \
  | sort -k2 -n -r | head -10
```

Lista concreta será derivada no kickoff do plan; esperado que inclua os arquivos de maior densidade de `any` em actions (normalmente `transactions.ts`, `score.ts`, `reports.ts`, `chat.ts`, `banking.ts`).

---

## 13. Referências

- v1: `docs/superpowers/specs/2026-04-15-fase-13-polish-foundation-v1.md`.
- `docs/memory/phase_12_complete.md`.
- `docs/memory/cache_pattern.md`.
- [Pluggy docs](https://docs.pluggy.ai/).
- [Fly Machine schedules](https://fly.io/docs/machines/).
