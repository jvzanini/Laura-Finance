# Fase 12 — Refactoring + Performance + Dívida Técnica (Spec v1)

> Versão: v1 (rascunho inicial)
> Data: 2026-04-15
> Autor: agente autônomo
> Spec canônica: (em evolução — v2, v3 a seguir)

---

## 1. Objetivo

Eliminar a dívida técnica acumulada nas fases 1–11 do Laura Finance, reorganizar o backend Go em módulos coesos, zerar erros/warnings de lint no PWA, introduzir camada de cache (Redis) para endpoints quentes, consolidar infraestrutura de migrations e publicar documentação de arquitetura — sem depender de credenciais externas bloqueadas (STANDBYs das fases 10–11).

Metas quantitativas mensuráveis:

- `laura-go/main.go` < 100 linhas (hoje ~200+).
- PWA `npm run lint` retorna **0 errors E 0 warnings**.
- Coverage Go em `internal/` > **30%** (hoje 8.6%).
- Cache-hit ratio nos endpoints `/dashboard`, `/score/snapshot`, `/reports/*` > **80%** após warm-up.
- E2E Playwright executando full stack em CI (não apenas `--list`).
- `docs/architecture.md` publicado com diagramas mermaid de fluxo de dados.

## 2. Contexto e motivação

As fases 10 (security closeout + infra) e 11 (observability/telemetria) foram marcadas como **prepared** (82+ commits) mas têm dependências externas (DSN Sentry, OTel collector endpoint, Redis managed, Fly volume) aguardando credenciais do usuário. Enquanto essas STANDBYs não destravam, acumulamos dívida técnica local que **pode e deve** ser endereçada:

- Código de bootstrap Go misturado no `main.go` dificulta testes e leitura.
- Testes E2E Go com build tag `e2e` estão vermelhos (401) — fixture de auth desalinhada do novo HMAC de sessão.
- 87 `no-explicit-any` + 14 warnings `react-hooks`/`react/no-unescaped-entities` no PWA foram rebaixados de error→warn para destravar CI; nunca foram corrigidos.
- Endpoints pesados (dashboard, score, reports) recalculam a cada hit — sem cache.
- Migrations duplicadas entre `infrastructure/migrations/` e `laura-go/internal/migrations/`.
- Coverage Go em 8.6% (threshold antigo) não dá confiança para refatorações maiores.

A Fase 12 trata essas dívidas em bloco para que as fases seguintes (13+: i18n, Open Finance, PWA RUM Sentry) partam de base limpa.

## 3. Escopo

### 3.1. Dentro do escopo (22 itens)

Agrupados em 7 blocos — detalhes na §4:

**Refactoring backend (4):**
1. Extrair bootstrap + health handlers de `main.go`.
5. Whatsmeow check real no `/ready`.
6. Ping real no provider LLM (substituir NoOp).
7. Propagar `context.Context` para chamadas LLM.

**Correção testes + lint (4):**
2. Corrigir fixture HMAC em `api_e2e_test.go` (build tag `e2e`).
3. Decisão sobre `golangci-lint` (manter desabilitado + tracking issue).
4. Corrigir 13 gosec G104 pré-existentes em handlers admin.
8. Tipar 87 `no-explicit-any` no PWA (priorizar `src/lib/actions/*`).
9. Corrigir 6 `react-hooks/*` + 8 `react/no-unescaped-entities`.

**Cache + Performance (3):**
11. Camada de cache para dashboard / score / reports.
12. Adicionar Redis container + `go-redis/v9` + helper `cache.Get/Set`.
13. Revisar pgx pool config (`MaxConns`, `MinConns`, `MaxConnLifetime`, `MaxConnIdleTime`).

**Infraestrutura (3):**
14. Unificar migrations (fonte canônica).
15. Validar `BUILD_SHA` / `BUILD_TIME` em Vercel + Fly.
16. Documentar rescan QR pós-restart Fly (whatsmeow em Postgres).

**Observability follow-up (3):**
17. Métricas `workspace_id` para `/api/v1/reports/*`.
18. Sentry scope `tenant_id`.
19. Rate-limit explícito nas 3 regras Sentry (anti-fatigue).

**DX + Qualidade (3):**
20. Playwright CI rodar suíte real contra stack Docker Compose.
21. Subir coverage Go > 30% via testes de handlers críticos.
22. Publicar `docs/architecture.md`.

**Cleanup (1):**
10. Investigar + resolver `package-lock.json` modificado.

### 3.2. Fora do escopo

- **i18n** (Fase 13).
- **Open Finance / Pluggy-Belvo real** (Fase 14+ — depende de sandbox).
- **PWA RUM Sentry browser SDK** (Fase 13 — demanda DSN decidido).
- **Mobile nativo** (roadmap distante).
- **Rewrite de dashboards (UI)** — apenas cache; visual fica para Fase UX dedicada.
- **Migração para OpenTelemetry Collector hospedado** — ainda STANDBY.

## 4. Pendências detalhadas agrupadas

### 4.1. Refactoring backend (itens 1, 5, 6, 7)

#### Item 1 — Extrair bootstrap + health de `main.go`

- **Estado atual:** `laura-go/main.go` tem ~200+ linhas. Concentra: init Sentry, init OTel (tracer + meter providers), init slog, conexão pgx pool, registro de handlers `/health` e `/ready`, setup Fiber, setup whatsmeow manager, setup BullMQ equivalent (se houver), graceful shutdown.
- **Ação proposta:**
  - Criar `laura-go/internal/bootstrap/bootstrap.go` exportando `Init(ctx) (*App, error)` onde `App` encapsula Fiber, pool, sentry closer, otel shutdown, logger.
  - Criar `laura-go/internal/health/handler.go` com `HealthHandler(app *App) fiber.Handler` e `ReadyHandler(...)`.
  - `main.go` reduzido a: `app, err := bootstrap.Init(ctx); if err != nil {...}; defer app.Shutdown(); app.ListenAndServe()`.
- **Arquivos afetados:**
  - `laura-go/main.go` (redução ~200 → ~60 linhas).
  - `laura-go/internal/bootstrap/bootstrap.go` (novo).
  - `laura-go/internal/health/handler.go` (novo).
  - `laura-go/internal/health/handler_test.go` (novo — cobertura).
- **Tempo estimado:** 4h.

#### Item 5 — Whatsmeow check real no `/ready`

- **Estado atual:** handler `/ready` retorna `whatsmeow: "connected"` hardcoded.
- **Ação proposta:** injetar referência ao `*whatsmeow.Client` global via `App.WhatsApp` e chamar `client.IsConnected()`. Se false → `{"whatsmeow": "disconnected"}` + HTTP 503.
- **Arquivos afetados:** `internal/health/handler.go`, `internal/bootstrap/bootstrap.go`, `internal/whatsapp/manager.go`.
- **Tempo estimado:** 1h.

#### Item 6 — Ping real LLM provider

- **Estado atual:** `llm.Provider.Ping()` retorna `nil` (NoOp).
- **Ação proposta:** implementar Ping real fazendo completion curta (e.g., `"ping"`) com timeout 3s. Erro → retorna erro propagado. Log metric `llm_ping_duration_seconds`.
- **Arquivos afetados:** `internal/llm/provider.go`, `internal/llm/openai.go`, `internal/llm/anthropic.go` (se existir), `internal/health/handler.go` chama no /ready.
- **Tempo estimado:** 2h.

#### Item 7 — Propagar ctx em LLM

- **Estado atual:** `Provider.ChatCompletion(messages, opts)` não recebe `ctx`, usa `context.Background()` internamente → spans LLM órfãos, sem trace-id pai.
- **Ação proposta:** mudança de assinatura para `ChatCompletion(ctx context.Context, messages, opts)`. Atualizar todos os call-sites (grep `ChatCompletion(`). Span criado com `tracer.Start(ctx, "llm.chat")`.
- **Arquivos afetados:** `internal/llm/provider.go` (interface), implementações, todos os handlers que chamam (agent, analyzer, etc.).
- **Tempo estimado:** 3h.

### 4.2. Correção testes + lint (itens 2, 3, 4, 8, 9)

#### Item 2 — Fixture HMAC em `api_e2e_test.go`

- **Estado atual:** build tag `e2e` presente. Ao executar `go test -tags=e2e ./...` todos retornam 401 — fixture emite JWT antigo; sessão migrou para HMAC-signed cookie.
- **Ação proposta:**
  - Criar helper `testutil.SignedSession(userID, workspaceID) (cookieValue string)` usando mesmo algoritmo da produção.
  - Substituir fixture no `api_e2e_test.go`.
  - Remover build tag `e2e` — testes passam a rodar em `go test ./...` normal (desde que existam docker services ou mocks).
- **Arquivos afetados:** `laura-go/internal/testutil/session.go` (novo), `laura-go/api_e2e_test.go`.
- **Tempo estimado:** 3h.

#### Item 3 — Decisão golangci-lint

- **Estado atual:** desabilitado porque lib v2 ainda não suporta Go 1.26 oficialmente.
- **Ação proposta:** **manter desabilitado**, mas:
  - Abrir issue upstream `golangci/golangci-lint#XXXX` (rastreamento).
  - Adicionar comentário em `.golangci.yml` e `.github/workflows/ci.yml` documentando o porquê + link do issue.
  - Substituir por combinação `go vet ./...` + `gosec ./...` + `staticcheck ./...` como gate no CI (cobre ~80% das regras relevantes).
- **Decisão alternativa avaliada:** downgrade Go para 1.24.x → **rejeitada** (perderíamos generics improvements + novos iteradores usados em `internal/agent`).
- **Arquivos afetados:** `.github/workflows/ci.yml`, `.golangci.yml` (comentário).
- **Tempo estimado:** 1h.

#### Item 4 — 13 gosec G104 em admin handlers

- **Estado atual:** `whatsapp.Manager.CreateInstance(...)`, `db.Pool.Exec(...)` etc. com erros ignorados.
- **Ação proposta:** wrapping de cada chamada com:
  ```go
  if err := mgr.CreateInstance(ctx, id); err != nil {
      slog.ErrorContext(ctx, "create instance failed", "err", err)
      return fiber.NewError(fiber.StatusInternalServerError, "create failed")
  }
  ```
- **Arquivos afetados:** `internal/admin/*.go` (13 ocorrências — grep `G104`).
- **Tempo estimado:** 2h.

#### Item 8 — 87 `no-explicit-any` no PWA

- **Estado atual:** regra rebaixada a warn. 87 ocorrências distribuídas.
- **Ação proposta:** priorizar top-10 arquivos de `src/lib/actions/*` (maior densidade). Substituir `any` por tipos reais:
  - Retornos Prisma → usar `Prisma.<Model>GetPayload<{ include: ... }>`.
  - Payloads de Server Actions → criar `types/actions.ts`.
  - Responses de fetch → criar `types/api.ts`.
- **Meta incremental:** Fase 12 zera os 87; regra promove de volta a `error`.
- **Arquivos afetados:** `src/lib/actions/*.ts`, `src/lib/services/*.ts`, `src/types/*.ts` (possíveis novos), `.eslintrc.*`.
- **Tempo estimado:** 8h.

#### Item 9 — 6 react-hooks + 8 unescaped entities

- **Estado atual:** rebaixados a warn.
- **Ação proposta:** para `react-hooks/exhaustive-deps` decidir caso-a-caso — adicionar dep ou `// eslint-disable-next-line react-hooks/exhaustive-deps` com justificativa. Para `unescaped-entities`: trocar `'` por `&apos;` ou `&#39;` e `"` por `&quot;`.
- **Arquivos afetados:** ~10 componentes em `src/components/**` e `src/app/**`.
- **Tempo estimado:** 2h.

### 4.3. Cache + Performance (itens 11, 12, 13)

#### Item 12 — Adicionar Redis ao stack

- **Estado atual:** Redis **ausente** do `docker-compose.yml`. App usa apenas pgx + memória.
- **Ação proposta:**
  - Adicionar serviço `redis:7-alpine` ao `docker-compose.yml` (dev) + `fly.toml` via Upstash attach (prod).
  - Dependência `github.com/redis/go-redis/v9`.
  - Helper `internal/cache/redis.go` com interface:
    ```go
    type Cache interface {
        Get(ctx, key) ([]byte, bool, error)
        Set(ctx, key, val, ttl) error
        Invalidate(ctx, pattern) error
    }
    ```
  - Fallback in-memory (LRU via `hashicorp/golang-lru`) para ambiente de teste sem Redis.
- **Arquivos afetados:** `docker-compose.yml`, `fly.toml`, `internal/cache/*.go` (novo), `internal/bootstrap/bootstrap.go` (injeta cache no App).
- **Tempo estimado:** 4h.
- **STANDBY:** `[REDIS-INSTANCE]` — se escolha for Upstash managed em prod, precisa URL + token do usuário.

#### Item 11 — Cache nos endpoints quentes

- **Estado atual:** `/dashboard`, `/score/snapshot`, `/reports/{monthly,categorical,cashflow}` recalculam a cada hit (consultas agregadas pesadas).
- **Ação proposta:**
  - Chave por `workspace_id + endpoint + params_hash + date_bucket`.
  - TTL **60s** para dashboard, **300s** para score snapshot, **600s** para reports históricos (dados de meses fechados).
  - Header `X-Cache: HIT|MISS` para debug.
  - Invalidation: event-driven (ao criar/editar/deletar transação) invalida `workspace:{id}:*` via `Cache.Invalidate`.
- **Arquivos afetados:** handlers `internal/dashboard/`, `internal/score/`, `internal/reports/`.
- **Tempo estimado:** 6h.

#### Item 13 — pgx pool tuning

- **Estado atual:** config default pgx (`MaxConns=4` implícito por CPU count em `pgxpool.ParseConfig`).
- **Ação proposta:** explicitar via env vars:
  - `PG_MAX_CONNS=25` (prod) / `5` (dev).
  - `PG_MIN_CONNS=5` / `1`.
  - `PG_MAX_CONN_LIFETIME=1h`.
  - `PG_MAX_CONN_IDLE_TIME=30m`.
  - `PG_HEALTH_CHECK_PERIOD=1m`.
- **Arquivos afetados:** `internal/bootstrap/bootstrap.go`, `internal/config/config.go`, `.env.example`, `fly.toml`.
- **Tempo estimado:** 1h.

### 4.4. Infraestrutura (itens 14, 15, 16)

#### Item 14 — Unificar migrations

- **Estado atual:** SQLs vivem em `infrastructure/migrations/*.sql` e são **copiadas** para `laura-go/internal/migrations/` via `COPY` no Dockerfile. Risco de drift.
- **Ação proposta:** **adotar `laura-go/internal/migrations/` como canônica** (fica junto ao binário que roda). Remover `infrastructure/migrations/` ou converter em symlink documentado. Alternativa: manter `infrastructure/migrations/` como canônica + embed via `//go:embed ../../infrastructure/migrations/*.sql` no Go.
- **Recomendação:** embed via `go:embed` (evita COPY no Dockerfile, simplifica build).
- **Arquivos afetados:** `laura-go/internal/migrations/migrations.go` (go:embed), `laura-go/Dockerfile` (remover COPY).
- **Tempo estimado:** 2h.

#### Item 15 — Validar BUILD_SHA / BUILD_TIME multi-plataforma

- **Estado atual:** build args vêm de `fly.toml [build.args]`. Em Vercel (PWA) podem chegar como `undefined` no client bundle.
- **Ação proposta:**
  - Para Go: confirmar injeção via `-ldflags "-X main.buildSHA=$(git rev-parse HEAD) -X main.buildTime=$(date -u +%FT%TZ)"` no Dockerfile (independente de fly.toml).
  - Para PWA (Next.js): usar `NEXT_PUBLIC_BUILD_SHA` / `NEXT_PUBLIC_BUILD_TIME` injetado em Vercel via env vars preset (`VERCEL_GIT_COMMIT_SHA`).
- **Arquivos afetados:** `laura-go/Dockerfile`, `apps/web/next.config.ts`, `vercel.json` (env mapping).
- **Tempo estimado:** 1.5h.

#### Item 16 — Documentar rescan QR pós-restart Fly

- **Estado atual:** `[mounts]` removido de `fly.toml`. Whatsmeow persiste auth em Postgres (tabela `whatsmeow_device`), então **não** deveria precisar rescan. Mas há janela onde sessão pode ficar inválida (token TTL ou restart durante handshake).
- **Ação proposta:** adicionar seção em `docs/runbooks/whatsmeow.md` com: (a) como detectar sessão inválida (`/ready` → `disconnected`), (b) passo-a-passo de rescan via admin UI, (c) como fazer restart zero-downtime.
- **Arquivos afetados:** `docs/runbooks/whatsmeow.md` (novo).
- **Tempo estimado:** 1h.

### 4.5. Observability follow-up (itens 17, 18, 19)

#### Item 17 — Métricas workspace_id em `/api/v1/reports/*`

- **Estado atual:** middleware de métricas cobre 5 endpoints (dashboard, score, transactions, categories, whatsapp/webhook). Falta expandir para subtipos de reports (monthly, categorical, cashflow).
- **Ação proposta:** mover registro de métricas para middleware global que cubra `/api/v1/*`, extraindo `workspace_id` do contexto de auth. Label: `route`, `workspace_id`, `status`.
- **Arquivos afetados:** `internal/middleware/metrics.go`.
- **Tempo estimado:** 1.5h.

#### Item 18 — Sentry scope `tenant_id`

- **Estado atual:** scope captura `user_id` via middleware, mas `tenant_id` (= `workspace_id`) não é setado → eventos Sentry aparecem sem agrupamento por cliente.
- **Ação proposta:** no middleware Sentry, após extrair sessão, chamar `scope.SetTag("tenant_id", workspaceID)` e `scope.SetContext("tenant", map{"id": workspaceID, "name": ...})`.
- **Arquivos afetados:** `internal/middleware/sentry.go`.
- **Tempo estimado:** 0.5h.

#### Item 19 — Rate-limit regras Sentry (anti-fatigue)

- **Estado atual:** 3 regras propostas (error-rate, latency-p95, 5xx-spike) sem rate-limit; risco de spam em incidente.
- **Ação proposta:**
  - Cada regra recebe `frequency: 1 notification per 30 minutes per project` (configuração Sentry Alerts).
  - Adicionar `environment:production` filter (dev/staging não dispara).
  - Documentar em `docs/runbooks/sentry-alerts.md`.
- **Arquivos afetados:** `docs/runbooks/sentry-alerts.md`, configuração Sentry (fora do repo — doc).
- **Tempo estimado:** 1h.

### 4.6. DX + Qualidade (itens 20, 21, 22)

#### Item 20 — Playwright full stack em CI

- **Estado atual:** workflow executa apenas `npx playwright test --list` (smoke que sequer roda os testes).
- **Ação proposta:**
  - Adicionar job `e2e-full` que: (a) sobe stack via `docker compose up -d` (app + db + redis), (b) aguarda `/ready` via `wait-on`, (c) roda `npx playwright test` completo, (d) publica trace/videos em artifacts.
  - Matrix: chromium (sempre), firefox/webkit opcional em nightly.
- **Arquivos afetados:** `.github/workflows/ci.yml`, `playwright.config.ts`, `docker-compose.ci.yml` (novo, se necessário).
- **Tempo estimado:** 4h.

#### Item 21 — Coverage Go > 30%

- **Estado atual:** 8.6% — concentrado em `internal/config` e `internal/llm` (stubs).
- **Ação proposta:** testes para handlers críticos:
  - `internal/transactions/handler_test.go` (CRUD + listagem filtrada).
  - `internal/dashboard/handler_test.go` (agregações).
  - `internal/score/handler_test.go`.
  - `internal/webhook/whatsapp_test.go` (validação HMAC + roteamento intent).
  - `internal/health/handler_test.go` (feito no item 1).
  - Usar `httptest` + pool postgres em container (testcontainers-go) ou mock via `pgxmock`.
- **Meta intermediária:** 20% ao final da subfase 4.2, 30% ao final da fase.
- **Arquivos afetados:** ~6 arquivos `*_test.go` novos.
- **Tempo estimado:** 10h.

#### Item 22 — `docs/architecture.md`

- **Estado atual:** existem `docs/superpowers/specs/` mas nenhum documento de arquitetura single-pager.
- **Ação proposta:** criar `docs/architecture.md` com:
  - Diagrama mermaid de componentes (PWA ↔ Go API ↔ Postgres ↔ Redis ↔ WhatsApp ↔ LLM).
  - Diagrama mermaid de fluxo de mensagem (webhook WA → intent → agente → resposta).
  - Diagrama mermaid de fluxo de score (trigger → cálculo → snapshot).
  - Tabela de endpoints principais.
  - Princípios arquiteturais (multi-tenant via workspace_id, cache TTL-based, etc.).
- **Arquivos afetados:** `docs/architecture.md` (novo).
- **Tempo estimado:** 3h.

### 4.7. Cleanup (item 10)

#### Item 10 — `package-lock.json` modificado

- **Estado atual:** `git status` mostra `package-lock.json` com modificação não commitada desde antes da Fase 10.
- **Ação proposta:** `git diff package-lock.json` para inspecionar. Se for apenas reorder determinístico (npm version drift), commitar. Se for mudança substantiva de versões → rodar `npm install` limpo + testar build/test localmente + commitar.
- **Arquivos afetados:** `package-lock.json`.
- **Tempo estimado:** 0.5h.

## 5. Decisões de arquitetura

### 5.1. Redis vs in-memory LRU

**Recomendação: Redis.**

Motivos:
- Laura Finance já roda 1+ réplica em Fly (futura escala horizontal). In-memory LRU daria inconsistência entre réplicas (hit numa, miss noutra).
- Ecossistema Nexus (CRM, Roteador) já usa Redis — familiaridade.
- Invalidação event-driven fica trivial (`DEL workspace:{id}:*`).
- Fallback in-memory permanece para testes unitários.

Trade-off: +1 container em dev, +1 serviço em prod. Mitigação: Upstash gratuito (10k commands/day) cobre dev + smoke.

### 5.2. golangci-lint

**Recomendação: manter desabilitado + substituto (`go vet` + `gosec` + `staticcheck`) + issue upstream.**

Downgrade Go 1.26 → 1.24 rejeitado (perderíamos iteradores usados em `internal/agent`).

### 5.3. Extração de handlers

**Padrão adotado:**
- `internal/<domain>/handler.go` — handlers Fiber.
- `internal/<domain>/service.go` — lógica de negócio (testável sem HTTP).
- `internal/<domain>/repository.go` — acesso ao DB.
- `internal/<domain>/types.go` — DTOs.
- Construtor: `New(deps Deps) *Handler`.

Aplicado a: health, transactions, dashboard, score, reports. Incremental — não reescrever tudo de uma vez.

### 5.4. Cache invalidation

**Recomendação: TTL curto (60–600s) para MVP.**

Event-driven invalidation implementado apenas para "hard invalidations" (ex.: exclusão de transação invalida dashboard). Resto confia no TTL. Simples, previsível, mensurável.

Evolução futura (fora do escopo): pub/sub Redis para invalidação cross-instance.

### 5.5. Propagação de ctx em LLM

**Decisão: breaking change interno na assinatura `ChatCompletion`.**

Afeta ~8 call-sites, todos dentro do monorepo. Benefícios (trace completo, timeout propagado, cancelamento) superam custo (1 commit atômico grande).

## 6. Pré-requisitos / dependências externas (STANDBY)

- **`[REDIS-INSTANCE]`** — URL + token Redis para produção. Opções:
  - Upstash attach via Fly (`fly redis create`) — recomendado.
  - Redis self-hosted em Fly (app separada).
  - **Bloqueio:** dev roda sem STANDBY (container local). Prod bloqueia apenas o rollout da subfase 4.3 (cache) — demais subfases independem.

Demais STANDBYs de fases 10–11 (SENTRY_DSN, OTEL_EXPORTER_OTLP_ENDPOINT, FLY_VOLUME_ID) **não são pré-requisito** para Fase 12.

## 7. Critérios de aceite (DoD)

- [ ] `laura-go/main.go` < 100 linhas (medição: `wc -l main.go`).
- [ ] `go vet ./... && gosec -quiet ./... && staticcheck ./...` **zero issues** em `internal/`.
- [ ] PWA `npm run lint` → **0 errors, 0 warnings**.
- [ ] Coverage Go > 30% (`go test -cover ./internal/...`).
- [ ] `/dashboard`, `/score/snapshot`, `/reports/*` com header `X-Cache: HIT` em >80% das requests após warm-up de 30s em load test (`k6 run`).
- [ ] E2E Playwright full-suite executando em CI em <10min, PR bloqueia se vermelho.
- [ ] `docs/architecture.md` publicado + 3 diagramas mermaid renderizando no GitHub.
- [ ] `api_e2e_test.go` sem build tag `e2e`, passa em `go test ./...` normal.
- [ ] Migrations unificadas — um único lugar canônico, embed go:embed no binário.
- [ ] Sentry scope com `tenant_id` em 100% dos eventos captured (amostra inspecionada).
- [ ] Tag git `phase-12-complete` aplicada pós-merge.

## 8. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Extração de bootstrap quebra flags de CLI existentes | Média | Alto | Testes de smoke em `main_test.go` antes e depois; rollback via tag. |
| R2 | Mudança assinatura LLM quebra build em call-site esquecido | Média | Médio | `go build ./...` obrigatório antes do commit; grep `ChatCompletion(` pré-refactor. |
| R3 | Cache com TTL inconsistente causa dado stale em dashboard | Baixa | Médio | Header `X-Cache` + documentar TTL em OpenAPI; botão "refresh" no PWA força bypass via `Cache-Control: no-cache`. |
| R4 | pgx pool muito alto sobrecarrega Postgres Fly | Média | Alto | `MaxConns=25` conservador; monitorar via Sentry + pg_stat_activity. |
| R5 | Playwright CI flaky (timing) | Alta | Baixo | `retries: 2` em CI; trace + video sempre. |
| R6 | Redis Upstash rate-limit (10k/day free) | Média | Médio | Métricas de hits/misses; upgrade para plano pago se necessário. |
| R7 | Tipagem `no-explicit-any` revela bugs escondidos | Média | Médio (desejável) | Cobrir com testes antes de promover regra de volta a error. |
| R8 | Coverage 30% exige testcontainers-go em CI (pesado) | Média | Médio | Cache de imagens Docker; matrix Go test separado em job dedicado. |

## 9. Métricas de sucesso

Medidas em T0 (início Fase 12) vs T1 (fim):

| Métrica | T0 | Meta T1 |
|---------|-----|---------|
| Linhas `main.go` | ~200 | <100 |
| Lint errors PWA | 0 (mas 101 warnings) | 0 / 0 |
| Coverage Go `internal/` | 8.6% | >30% |
| Dashboard p95 latency | ~400ms (estimado) | <100ms (com cache warm) |
| Cache hit ratio | 0% | >80% |
| E2E CI full run | só `--list` | `test` completo <10min |
| Migrations duplicadas | 2 locais | 1 local canônico |
| gosec issues `internal/` | 13 (G104) | 0 |
| `no-explicit-any` PWA | 87 | 0 |

## 10. Plano de testes

### 10.1. Unit (Go)

- Cada novo arquivo em `internal/health/`, `internal/cache/`, `internal/bootstrap/` acompanha `*_test.go`.
- Handlers críticos: transactions, dashboard, score, reports, whatsapp webhook.
- Mocks: `pgxmock/v3`, `redismock/v9`, interfaces para LLM.
- Target: 30% overall, 70% para módulos novos.

### 10.2. Integration (Go)

- `testcontainers-go` para subir Postgres + Redis real nos testes de integração.
- Migrations aplicadas via `//go:embed`.
- Rodar em job separado no CI (labeled `integration`), mais lento.

### 10.3. E2E (Playwright)

- Smoke suite (atual): login → dashboard → transaction create → score visible.
- Nova suite: reports monthly/categorical, cache hit visual (header inspection).
- Roda em PR (chromium only) e nightly (chromium + firefox + webkit).

### 10.4. Load test (k6)

- Script `tests/load/dashboard.js` — 100 VUs × 1min contra `/dashboard`.
- Métricas: p95, p99, cache hit ratio (via header).
- Executado localmente antes de merge da subfase cache.

### 10.5. Regression

- Antes de cada merge da Fase 12: `npm run lint` + `npm run test` + `go test ./...` + `go vet` + `gosec` + `staticcheck` + smoke Playwright. CI gate obrigatório.

---

## Self-review — questões abertas para review #1

1. **Redis managed ou self-hosted em produção?** Upstash é mais simples mas tem cota; self-hosted via Fly é +1 VM a manter. Qual preferência do usuário?
2. **Promover `no-explicit-any` a error imediatamente ao zerar?** Ou manter warn por 1 fase para evitar regressão em PRs concorrentes?
3. **Migrations: adotar `go:embed` (binário gordo) ou manter SQL externo e COPY no Dockerfile?** Decisão afeta pipeline de hotfix de schema.
4. **Coverage 30% é meta certa?** Indústria recomenda 60–80%. 30% já é leap de 8.6%, mas pode ser conservador demais — considerar 50% para módulos novos.
5. **Playwright full stack no CI: usar `docker compose` do repo ou GitHub Services?** Services é mais rápido mas duplica config de container.
6. **Breaking change em `ChatCompletion(ctx, ...)`: fazer em 1 commit big-bang ou introduzir `ChatCompletionCtx` e deprecar o antigo?** Big-bang é mais limpo se todos call-sites estão no monorepo.
7. **Event-driven cache invalidation já na Fase 12 ou deixar só TTL?** Spec recomenda só TTL — confirmar com stakeholder.
8. **`docs/architecture.md` único ou separar em `architecture/{overview,data-flow,deploy}.md`?** Single-pager mais fácil de linkar, multi-file escala melhor.
9. **Rate-limit Sentry: configurar via UI ou Terraform?** Laura ainda não tem IaC para Sentry; adicionar escopo?
10. **Fase 12 deve incluir kill-switch para cache (env `CACHE_DISABLED=true`)?** Útil para debug em prod, +5min de trabalho.

---
