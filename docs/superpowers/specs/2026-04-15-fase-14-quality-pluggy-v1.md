# Fase 14 — Quality Maturation + Pluggy Integration Real + PWA Typing (Spec v1)

> Versão: v1 (rascunho inicial)
> Data: 2026-04-15
> Autor: agente autônomo
> Status: rascunho — aguarda review #1

---

## 1. Objetivo

Fechar os 8 concerns deixados abertos pela Fase 13 (`phase_13_complete.md`), transformando "fundação preparada" em **fundação testada com integrações reais**. A Fase 14 tem três eixos paralelos:

1. **Quality maturation** — coverage Go para 30% (gate hard), testcontainers Redis real, CI split unit/integration, lint v2 reavaliação.
2. **Pluggy integration real** — substituir stubs de `CreateConnectToken` e `FetchTransactions` por chamadas HTTP reais contra o sandbox Pluggy, validar Open Finance end-to-end em dev.
3. **PWA typing sprint 1 real** — eliminar os 27 `any` em `lib/actions/adminConfig.ts` + 4 outros arquivos, introduzir zod schemas em endpoints críticos.

Entregável final: **tag `phase-14-prepared`** com CI verde (core + integration), coverage Go ≥ 30%, zero `no-explicit-any` em adminConfig.ts, Pluggy sandbox retornando `connect_token` e `transactions` reais em dev.

## 2. Contexto e motivação

As Fases 10–13 entregaram ~190 commits e 4 tags (`phase-10/11/12/13-prepared`), mas deliberadamente pararam em "preparado" para não bloquear o fluxo de trabalho com dependências externas e refactors invasivos. O `phase_13_complete.md` consolidou 8 concerns residuais:

- **PWA typing** — Fase 13 fez sprint 0 (types de domínio), sprint 1 (adminConfig) ficou de fora.
- **Testcontainers Redis** — testes de cache/queue usam InMemory fake; falta validar contra Redis real.
- **Coverage Go** — está ~18%; meta original era 30%, mas integration tests com DB real não foram escritos.
- **golangci-lint v2.x** — aguardando release estável; v1 com exclude flags continua.
- **Pluggy** — client skeleton existe, mas `CreateConnectToken` e `FetchTransactions` retornam mocks.
- **LLM_LEGACY_NOCONTEXT** — flag de emergência criada na Fase 12; remover após 30d de prod sem ativação.
- **ProcessMessageFlow ctx cascade** — goroutine do bot WA cria `context.Background()` em vez de propagar o ctx do handler HTTP, perdendo `request_id`, `user_id` e deadline.
- **Migration 000036** — pronta no repo, falta aplicar em prod real (bloqueada por deploy).

O débito é pequeno em linhas mas **alto em risco**: sem coverage real não temos confiança em refactor; sem Pluggy real a feature principal do produto (importação automática de transações) continua em stub.

## 3. Escopo

### 3.1. Dentro do escopo

1. PWA typing sprint 1 real — `adminConfig.ts` (27 `any`) + 4 arquivos complementares.
2. Testcontainers Redis + CI split `unit` / `integration` com retry policy.
3. Coverage Go ≥ 30% via integration tests em handlers/services (pgx pool real via testcontainers).
4. Pluggy HTTP client real (`POST /auth` + `POST /connect_tokens` + `GET /items/{id}/transactions`).
5. ProcessMessageFlow ctx cascade — propagar ctx com deadline 30s + valores `request_id`/`user_id`.
6. golangci-lint v2.x reavaliação (tentar upgrade; se indisponível, manter v1 e documentar).
7. `LLM_LEGACY_NOCONTEXT` flag removal — **preparado** com PR draft; merge condicionado a T+30d sem ativação em prod.
8. Migration 000036 — documentar procedimento de apply em prod real (`psql` no container db via Portainer).

### 3.2. Fora do escopo (Fase 15+)

- Pub/sub Redis cross-instance (requer refactor de realtime/notifications).
- Aplicativo mobile nativo (iOS/Android) — PWA continua como canal.
- Multi-region DB replication.
- Pluggy webhooks (`/webhooks/pluggy`) — só pull por enquanto.
- LLM context summarization avançada (TTL rolling window).
- Observabilidade SLO/error budget com alertas paginados.

## 4. Pendências detalhadas agrupadas

### 4.1. PWA typing sprint 1 real

**Arquivo principal:** `app/src/lib/actions/adminConfig.ts` — 27 ocorrências de `any` detectadas pelo ESLint (`no-explicit-any`).

**Arquivos complementares (4):**
- `app/src/lib/services/settings-sync.ts` — 5 `any` em payloads de sync.
- `app/src/lib/hooks/useAdminForm.ts` — 4 `any` em handlers.
- `app/src/components/admin/ConfigTable.tsx` — 3 `any` em colunas dinâmicas.
- `app/src/lib/validators/adminSchemas.ts` — 2 `any` placeholders.

**Estratégia:**
- Extrair interfaces canônicas em `app/src/types/admin.ts` (`AdminConfigEntry`, `SettingPayload`, `AdminFormState`).
- Introduzir **zod schemas** em endpoints server action que recebem input não confiável (`updateAdminConfig`, `bulkUpdateSettings`).
- Onde a origem do dado é confiável (Prisma hydration), usar type assertion explícito com comentário `// safe: hydrated from prisma.adminConfig.findMany`.
- Habilitar `@typescript-eslint/no-explicit-any: error` no eslint.config desses arquivos (override per-file).

**Critério:** `pnpm lint` zero warnings `no-explicit-any` nos 5 arquivos; `pnpm typecheck` verde.

### 4.2. Testcontainers Redis + CI split unit/integration

**Hoje:** testes Go de cache/rate-limit/sessions usam `miniredis` in-process. Suficiente para unit, mas não cobre comportamento real de TTL, pipelining, cluster hashing.

**Proposta:**
- Novo pacote `internal/testsupport/tcredis` que expõe `Run(ctx) (*redis.Client, cleanup, error)` usando `github.com/testcontainers/testcontainers-go/modules/redis`.
- **Singleflight** para reuso de um único container por `TestMain` da suite (evita subir 50 containers).
- Build tag `//go:build integration` para separar testes lentos.
- CI GitHub Actions: dois jobs — `test-unit` (rápido, <2min) e `test-integration` (com Docker-in-Docker, timeout 10min, retry 2x em falha transitória de pull).
- Gate: PR precisa `test-unit` verde; `test-integration` é required na main (não em PR) para não bloquear por flakiness de docker-in-docker.

**Critério:** suite integration nova com ≥ 8 testes (rate-limiter TTL, session revoke, cache evict, pub/sub ping).

### 4.3. Coverage Go 30% (handlers + services integration tests)

**Hoje:** `go test ./... -cover` reporta ~18%. Handlers HTTP e services têm <10% porque dependem de pgx pool real.

**Proposta:**
- Novo `internal/testsupport/tcpg` análogo ao tcredis (testcontainers Postgres 16 + migrações via `golang-migrate` em init).
- Integration tests em `internal/handlers/*_integration_test.go` para os 6 handlers de maior valor: transactions, messages, users, sessions, admin, webhooks.
- Integration tests em `internal/services/*_integration_test.go` para services que tocam DB: transactionService, messageService, userService.
- Coverage merge de unit + integration via `-coverpkg=./...` e `go tool covdata`.
- Gate CI: `-covermode=atomic -coverprofile=coverage.out` e fail se total < 30%.

**Critério:** CI reporta ≥ 30% coverage total em Go; handlers/services core ≥ 40% cada.

### 4.4. Pluggy HTTP client real (CreateConnectToken + FetchTransactions)

**Estado atual (`internal/integrations/pluggy/client.go`):** struct `Client` com métodos stub que retornam `(nil, errors.New("not implemented"))`.

**API real (Pluggy docs):**
- `POST https://api.pluggy.ai/auth` com `{clientId, clientSecret}` → retorna `{apiKey}` (JWT, TTL 2h).
- `POST https://api.pluggy.ai/connect_tokens` com header `X-API-KEY` → retorna `{accessToken, expiresAt}` para widget client-side.
- `GET https://api.pluggy.ai/items/{id}/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD` → retorna `{results: Transaction[]}`.

**Proposta:**
- `authTokenCache` struct em memória com `sync.Mutex` + expiração (refresh 5min antes do `expiresAt`).
- Método privado `ensureAPIKey(ctx)` chamado por `CreateConnectToken` e `FetchTransactions`.
- Timeouts: `http.Client{Timeout: 15s}`; retry com backoff exponencial 3 tentativas em 5xx/timeout.
- Error mapping: `ErrPluggyUnauthorized`, `ErrPluggyRateLimit`, `ErrPluggyTransient`, `ErrPluggyClient`.
- Logs estruturados (sem PII; mascarar `clientSecret` e `accessToken`).
- Teste integration usa httptest.Server simulando Pluggy + smoke test manual contra sandbox real documentado em `docs/integrations/pluggy-sandbox-smoke.md`.

**Critério:** em dev com credenciais sandbox, `curl -X POST /api/pluggy/connect_token` retorna token válido; `curl /api/pluggy/items/{id}/sync` popula Transaction table.

### 4.5. ProcessMessageFlow ctx cascade

**Bug identificado:** `internal/bot/wa/processor.go` função `ProcessMessageFlow` dispara `go func() { /* processa */ }()` com `context.Background()` — perdendo:
- `request_id` (quebra correlação em logs).
- `user_id` propagado do middleware de auth.
- Deadline (risco de goroutine pendurada).

**Proposta:**
- Ao invés de `go func() { ... ctx := context.Background() ... }`, criar ctx derivado: `msgCtx, cancel := context.WithDeadline(context.WithoutCancel(ctx), time.Now().Add(30*time.Second))` + `defer cancel()`.
- `context.WithoutCancel` (Go 1.21+) preserva valores mas desacopla cancelamento do handler HTTP (que retorna 200 imediatamente).
- Testar que `request_id` propaga via log assertion em integration test.

**Critério:** todos os logs da goroutine do bot WA carregam `request_id` correlacionado ao webhook de entrada; deadline force-cancel após 30s.

### 4.6. golangci-lint v2.x reavaliação

**Hoje:** v1.60 com exclude flags para `depguard` e `gocognit`.

**Proposta:**
- Tentar `golangci-lint v2.0.x` (se já GA) — novo sistema de config `.golangci.v2.yml`.
- Rodar `lint --diff-from-base` para medir novo volume de issues.
- Se v2 traz <50 issues novos resolvíveis em <2h → migrar.
- Se v2 traz >200 issues ou crasha → abrir issue no repo upstream, manter v1, documentar.

**Critério:** decisão registrada em `docs/decisions/2026-04-XX-golangci-v2.md` (migrar ou adiar).

### 4.7. LLM_LEGACY_NOCONTEXT flag removal

**Criada em:** Fase 12 (2026-04-14) como kill-switch para o novo ChatCompletion com context rolling.

**Plano:**
- PR draft preparado (`chore: remove LLM_LEGACY_NOCONTEXT flag`) — remove branches `if flags.LLMLegacyNoContext {...}` de `chatService.go`.
- Merge condicionado a métrica `llm_legacy_nocontext_activations_total == 0` por 30d em prod (hoje +0d).
- Registrar data-alvo: 2026-05-14.

**Critério:** PR draft existe, ADR `docs/decisions/2026-04-XX-llm-flag-removal-plan.md` documenta critério objetivo.

### 4.8. Migration 000036 prod apply

**Status:** `migrations/000036_add_pluggy_item_table.up.sql` existe no repo, aplicada em dev/staging, **não aplicada em prod** (bloqueada por deploy da Fase 13).

**Procedimento documentado (`docs/operations/prod-migration-apply.md`):**
1. `docker exec -it laura_finance_db psql -U postgres -d laurafinance` via Portainer.
2. `\i /migrations/000036_add_pluggy_item_table.up.sql` (volume mount do /migrations).
3. Verificar `\dt pluggy_items` e `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`.
4. Rollback documentado (000036.down.sql).

**Critério:** doc existe; apply real depende de janela operacional (fora do escopo desta fase).

## 5. Decisões de arquitetura

### 5.1. PWA typing: assertion + zod

- Inputs de borda (server actions recebendo do client) → **zod parse** obrigatório.
- Hydration de DB (confiança alta) → **type assertion** com comentário curto justificando.
- Evitar `unknown` em props de componentes internos — sempre tipar explicitamente.

### 5.2. Testcontainers Redis singleflight

- `TestMain` compartilha 1 container por package de testes via `sync.Once`.
- Evita 1 container por `TestXxx` (explosão de tempo + recursos).
- Cleanup via `t.Cleanup(func(){ container.Terminate(ctx) })` no TestMain.
- Porta dinâmica (mapeada por testcontainers) — nunca hardcoded 6379.

### 5.3. Coverage strategy: pgx real

- NÃO usar mocks de pgx (pgxmock) — testcontainers Postgres é barato e revela bugs reais de SQL.
- Schema setup via `migrate.New(fileSource, pgxConnString)` no `TestMain`.
- Fixture isolation: cada teste roda em **transaction com rollback** no defer (não TRUNCATE).

### 5.4. Pluggy auth cache

- `authTokenCache` in-memory (sync.Mutex) — aceitável porque token TTL 2h e client roda dentro de 1 processo Go.
- Em ambiente multi-instance (futuro), mover para Redis — fora do escopo Fase 14.
- Refresh 5min antes de expirar (não on-demand 401 retry) para reduzir latência cold-path.

### 5.5. ProcessMessageFlow ctx

- Usar `context.WithoutCancel` (Go 1.21+) em vez de `context.Background()`.
- Deadline 30s (empírico: 99p de processamento de mensagem WA é <8s).
- Se deadline expirar, log `level=warn msg="wa message processing deadline exceeded" request_id=...`.

### 5.6. golangci-lint fallback

- Tentar v2 em branch isolada primeiro.
- Fallback explícito: se v2 não pronta até fim da fase, continua v1 e registra em ADR.

## 6. Pré-requisitos / dependências externas (STANDBY)

**Herdados da Fase 13, agora bloqueantes para item 4.4:**

- `[PLUGGY-CLIENT-ID]` — ID do cliente sandbox Pluggy (env `PLUGGY_CLIENT_ID`).
- `[PLUGGY-CLIENT-SECRET]` — secret correspondente (env `PLUGGY_CLIENT_SECRET`, salvar em Portainer secrets).

**Não bloqueantes (continuam STANDBY):**

- `[REDIS-INSTANCE]` Upstash — **opcional**; testcontainers cobre dev/CI, prod pode usar InMemory fallback até Fase 15.
- Demais STANDBYs das Fases 10–13 (Sentry DSN, UptimeRobot, etc.) continuam pendentes mas não bloqueiam Fase 14.

**Impacto se Pluggy não for provisionado:**

- Item 4.4 entregue como **"client pronto, smoke test contra httptest, marcado PENDING-CREDS"**.
- Tag `phase-14-prepared` sai mesmo assim; item 4.4 migra para Fase 15 com label `blocked:creds`.

## 7. Critérios de aceite (DoD)

- [ ] `pnpm lint` zero warnings `no-explicit-any` em `adminConfig.ts` + 4 arquivos listados.
- [ ] `pnpm typecheck` verde.
- [ ] `go test ./... -tags=integration -coverprofile=coverage.out` verde em CI.
- [ ] Coverage Go total ≥ 30% (gate hard, CI falha abaixo disso).
- [ ] Testcontainers Redis singleflight integrado; suite integration com ≥ 8 testes.
- [ ] CI split `test-unit` + `test-integration` ambos verdes em main.
- [ ] Pluggy `CreateConnectToken` retorna token real (contra sandbox, se creds) ou httptest mock (se não).
- [ ] Pluggy `FetchTransactions` retorna lista real ou stub httptest.
- [ ] ProcessMessageFlow: assertion de `request_id` no log da goroutine verde em teste.
- [ ] golangci-lint: decisão registrada (v2 migrado OU ADR documentando adiamento).
- [ ] PR draft `LLM_LEGACY_NOCONTEXT` removal aberto + ADR critério 30d.
- [ ] `docs/operations/prod-migration-apply.md` existe e foi revisado.
- [ ] Tag `phase-14-prepared` criada + push.
- [ ] Runbook atualizado (`docs/runbooks/phase-14.md`).

## 8. Riscos

1. **Pluggy sandbox rate limits** — docs mencionam 60 req/min; integration tests podem estourar. Mitigação: singleflight no token + fixture share.
2. **Refactor cascade ProcessMessageFlow** — propagar ctx pode revelar outras goroutines com `Background()`; risco de escopo explodir. Mitigação: limitar a WA; outros canais ficam Fase 15.
3. **Docker-in-Docker flaky no GitHub Actions** — testcontainers conhecido por timeout aleatório em runners ubuntu. Mitigação: retry 2x + timeout 10min + label `flaky:docker` em issues.
4. **Coverage 30% pode exigir testar código legado ruim** — tentação de escrever testes ruins só pra subir métrica. Mitigação: code review exige asserts significativos, não só "call and check no error".
5. **golangci-lint v2 ainda não GA** — provável adiamento; documentar OK.
6. **PWA typing sprint 1 pode revelar API contract drift** — tipos podem não bater com retorno real do Prisma; possível necessidade de migration adicional. Mitigação: rodar `prisma generate` antes e validar.
7. **Credenciais Pluggy podem demorar** — usuário precisa criar conta + app no dashboard Pluggy. Mitigação: plano B (httptest mock) já previsto.
8. **Migration 000036 em prod requer janela** — não é bloqueador, mas se dev/staging divergirem muito o apply pode falhar. Mitigação: documentar `pg_dump` pré-apply.

## 9. Métricas de sucesso

- **Cobertura Go:** ≥ 30% (de ~18% atual).
- **Lint warnings PWA:** de ~40 `no-explicit-any` para ≤ 5 (fora dos 5 arquivos alvo).
- **Pluggy sandbox smoke:** 1 `connect_token` + ≥ 1 transação real importada em dev.
- **CI pipeline duration:** `test-unit` ≤ 3min (hoje ~2min), `test-integration` ≤ 10min.
- **ProcessMessageFlow log correlation:** 100% das mensagens WA têm `request_id` rastreável.
- **Débito técnico:** 8 concerns → 0 concerns abertos (ou migrados explicitamente para Fase 15).

## 10. Plano de testes

**Unit (já existe, expandir):**
- `adminConfig.test.ts` — cobre zod schemas + type guards novos.
- `client_test.go` Pluggy — mock httptest simulando 200/401/429/5xx.

**Integration (novo):**
- `internal/handlers/transactions_integration_test.go` — POST + GET com pgx real.
- `internal/handlers/messages_integration_test.go` — fluxo WA webhook → processamento → assert log request_id.
- `internal/services/transactionService_integration_test.go`.
- `internal/integrations/pluggy/client_integration_test.go` — httptest server simulando API Pluggy completa.
- `internal/cache/redis_integration_test.go` — TTL, pipeline, pub/sub com testcontainers.
- `internal/ratelimit/redis_integration_test.go` — sliding window real.
- `internal/sessions/revoke_integration_test.go`.

**E2E smoke (manual, dev):**
- Se creds Pluggy disponíveis: conectar conta sandbox + sincronizar transações + ver no UI.
- Se não: executar fluxo contra httptest server + checklist manual.

**Load (opcional, nice-to-have):**
- `k6` script 100 VUs × 5min contra `/api/messages/webhook` para validar ctx cascade sob carga.

---

## Questões abertas para review #1

1. **Coverage 30% é realista nesta fase?** Se chegarmos em 25% com todos os testes escritos, aceitamos entrega parcial ou segura até 30%?
2. **testcontainers em CI:** vamos aceitar `test-integration` como required na main mesmo com risco de flakiness docker-in-docker? Ou só gate em PR opcional?
3. **Pluggy sandbox:** vale investir em smoke test automatizado no CI (requer secrets no GH) ou deixar como doc manual para dev?
4. **`LLM_LEGACY_NOCONTEXT`:** 30d é o período certo? Ou já podemos remover agora já que ninguém ativou em 1 semana de prod?
5. **PWA typing:** devemos aproveitar para adotar `tRPC` ou `hono/zod-openapi` nos endpoints reviewed, ou manter Server Actions Next puras?
6. **ProcessMessageFlow ctx:** deadline 30s é suficiente? E se a chamada OpenAI demorar 45s (já vimos p99 ~18s)?
7. **golangci-lint v2:** se não estiver GA até 2026-04-22, adiamos para Fase 15 sem mais discussão?
8. **Migration 000036 prod apply:** queremos que a Fase 14 inclua o apply real (requer janela) ou só documentação?
9. **Integration tests fixture isolation:** transaction-rollback por teste vs. TRUNCATE vs. docker restart — qual a preferência do time?
10. **Pluggy error taxonomy:** `ErrPluggyTransient` deve acionar retry automático do lado do caller ou retry interno do client? (impacta idempotência de FetchTransactions).

---

**Fim do Spec v1 Fase 14** — aguarda review #1 antes de avançar para v2.
