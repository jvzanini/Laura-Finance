# Laura Finance — Handoff

> ⚡ **Documento de continuidade do desenvolvimento autônomo.**
> Sempre que abrir nova sessão, leia primeiro `CLAUDE.md` na raiz e
> depois este arquivo. Atualizar a cada fase concluída.

## Histórico de atualizações

### 2026-04-17 — 🚀 DEPLOY PRODUÇÃO + Fase 17B.2 parcial

**Deploy em produção concluído** em `https://laura.nexusai360.com`.
Padrão seguido: Nexus AI Platform (Traefik + GHCR + rede_nexusAI).

**Infra entregue:**
- `.github/workflows/deploy-prod.yml` — build GHCR (api+pwa) + deploy
  Portainer API (swarm create/update stack) + health check pós rollout.
- `portainer-stack.yml` — 4 services (laura-api + laura-pwa +
  laura-postgres + laura-redis), hostnames explícitos, Traefik labels
  para HTTPS via Let's Encrypt.
- Removidos `deploy-api.yml` (Fly.io) e `deploy-pwa.yml` (Vercel)
  — substituídos.
- GitHub Secrets configurados: `PORTAINER_URL`, `PORTAINER_API_KEY`,
  `PORTAINER_ENDPOINT_ID`, `SWARM_ID`, `DOMAIN`, `DB_PASSWORD`
  (gerado), `SESSION_SECRET` (gerado), `RESEND_API_KEY` (reutilizado
  Nexus), `GROQ_API_KEY` (placeholder — pendente rotação real).
- Gitleaks: 421 commits escaneados, zero leaks confirmado antes do push
  final de prod. Repo Laura-Finance já era público.

**Bugs infra descobertos durante deploy (todos corrigidos):**
1. Docker Swarm hostname default usa underscore (`stack_service.slot`)
   → Next.js 16 rejeita URL → 500 em todas rotas. Fix: `hostname:`
   explícito (`laura-api`, `laura-pwa`, etc.) sem underscore.
2. Traefik rule inicial `PathPrefix(/api/)` capturava rotas PWA
   (`/api/auth/logout`, `/api/stripe/*`). Fix: rule refinada com lista
   explícita de prefixos api-go (`/api/v1/`, `/api/banking/`,
   `/api/ops/`, `/api/whatsapp/`, `/api/_debug/`, `/health`, `/ready`).
3. Stripe/DB lazy init via Proxy (throws top-level quebravam
   `next build`). Já corrigido em Fase 17B.
4. api-go Dockerfile distroless sem wget. Trocado para alpine+wget.
5. `global-setup.ts` esperava endpoint `/api/v1/auth/login` que nunca
   existiu no api-go (login é server action PWA). Reescrito.
6. Cookie HMAC: PWA gerava com `base64url + unix seconds`, api-go
   validava com `base64.StdEncoding + UnixMilli`. Decoder resiliente
   em `session.go` aceita ambos.
7. PWA `lib/db.ts` pool max=20 esgotava em CI E2E. Aumentado para 50.
8. api-go rate limiter 60/min esgotava com rajada PWA. `RATE_LIMIT_MAX`
   configurável via env.

**Smoke pós-deploy:**
- `GET https://laura.nexusai360.com` → 307 redirect (home→login) ✓
- `GET /login` → 200 ✓
- `GET /api/v1/health` → 200 `{"service":"laura-go","status":"ok"}` ✓
- `GET /api/auth/logout` → 307 (PWA handler; redireciona login) ✓
- TLS via Let's Encrypt OK.
- Migrations 000001–000037 aplicadas via `MIGRATE_ON_BOOT=true`.

**Fase 17B.2 — data-testids PWA (parcial):**
- ~30 data-testids adicionados em login, register, layout settings
  (logout), cards/CardWizard, invoices list, goals, investments,
  reports (9 tabs com ids string), score gauge, super-admin list.
- `global-setup.ts` faz login real via UI (Chromium headless) + salva
  storageState.
- `reports.spec.ts` reescrito com ids string reais (dre, categorias,
  ...).
- `transactions.spec.ts` reescrito como smoke (UI de create não existe
  — transação via WhatsApp NLP).
- **CI Playwright**: 18/24 passed + 6 failed pendentes
  (goals/investments/reports/score/super-admin/transactions por
  conexão DB esgotando em cascata mesmo com pool 50 + rate 1000).
  Principais smoke (mvp-flows, auth, error-shape, observability,
  cards-invoices) ✓. **Tag não aplicada** — marcada como parcial;
  refinamentos pertencem a 17B.3.

**Pendências para próxima sessão (17B.3/18):**
- Refinar testes E2E falhando (pool/rate ainda insuficiente para rajada
  paralela de 6 server actions simultâneas no dashboard).
- Implementar UI create/edit transactions (hoje só WhatsApp).
- Rotacionar `GROQ_API_KEY` placeholder por chave real.
- Ajustar logout redirect (`http://localhost:3100/login` → `/login` relativo).
- Configurar Stripe real (`STRIPE_SECRET_KEY`) se monetização ativa.
- Migração 000035 já aplicada em prod via MIGRATE_ON_BOOT.

**Tags:**
- `phase-17-deployed` (produção ativa em `laura.nexusai360.com`).

### 2026-04-16 — Fase 17B preparada (Playwright E2E real + smoke) ✓

- **Playwright CI real** — `playwright.yml` reescrito: sobe
  `docker-compose.ci.yml` full stack (postgres + redis + api-go + pwa)
  com `up -d --build`, aguarda ready via `curl` poll manual no runner
  (`:8080/health` + `:3000`), roda seed one-shot
  (`docker compose --profile seed run --rm seed-e2e`), executa
  `npx playwright test`. Fim da ilusão de `--list`.
- **Resultado CI**: **16 passed + 8 skipped** em 8.5s. mvp-flows
  expandiu para 14 testes (rotas públicas + protegidas redirects) +
  error-shape + observability. 8 specs com `test.fixme` mantidos.
- **Seed E2E determinístico** — `scripts/e2e-seed.sql` + serviço
  `seed-e2e` (profile "seed", one-shot). 2 users (`e2e@laura.test`,
  `admin@laura.test` super_admin=TRUE) + 1 workspace. Bcrypt hashes
  gerados via helper `laura-go/cmd/e2e-seed-hash/`.
- **6 bugs herdados corrigidos durante execução:**
  (i) `docker-compose.ci.yml` env PWA `NEXT_PUBLIC_API_URL` →
    `LAURA_GO_API_URL` + `SESSION_SECRET` (PWA não lia a env errada).
  (ii) `error-shape` + `observability` com URL absoluta via
    `${API_URL}` (antes batiam em `baseURL=localhost:3000` → PWA 404
    → skip gracioso ilusório).
  (iii) `DISABLE_WHATSAPP=true` em api-go CI (QR scan bloqueava).
  (iv) `lib/stripe.ts` + `lib/db.ts` com lazy init via Proxy (throws
    top-level quebravam `next build` no Dockerfile production).
  (v) `laura-go/Dockerfile` trocado de distroless para alpine+wget
    (distroless não tinha wget — healthcheck nunca poderia funcionar).
  (vi) `global-setup.ts` simplificado — `POST /api/v1/auth/login`
    nunca existiu no api-go (login é server action no PWA); global
    setup agora só `waitHealthy` + storageState placeholder.
- **Workflow `docker compose up --wait`** substituído por poll manual
  via `curl` do runner (independe de healthcheck interno; mais
  debugável). Healthchecks dos containers api-go/pwa removidos.
- **Playwright config flakeless** — `retries: 2` CI, `workers: 1`,
  `trace/video: 'retain-on-failure'`, reporter JUnit + HTML (ADR 006).
- **8 specs com `test.fixme`** — auth, cards-invoices, goals,
  investments, reports, score, super-admin, transactions. Dependem
  de data-testids inexistentes no PWA (Fase 17B.2).
- **Workflow consolidado** — `playwright-full.yml` deletado.
- **ADR 006** Playwright flakeless aceito.
- **Commits Fase 17B**: 18.
- **Tag**: `phase-17b-prepared` aplicada e pushada.

- **Concerns Fase 17B.2+**:
  - 17B.2: adicionar ~40 data-testids em ~15 componentes PWA +
    fazer login real (via form submit na page `/login` com testids)
    + remover `test.fixme`.
  - 17B.3: novos specs (cards-invoices lifecycle, banking API-only,
    rollover quando UI existir).
  - 17C: mobile native foundation.
  - 17D: multi-region read replica (aguarda deploy ativo).

- **Alerta ambiente local:** Docker Desktop do usuário precisa
  **factory reset** — corrupção containerd
  (`/var/lib/desktop-containerd/.../blobs/sha256/...` I/O error)
  impediu validação local durante a fase (CI GitHub validou tudo
  em ambiente limpo). Afeta outros projetos Docker do usuário.

### 2026-04-16 — Fase 17A preparada (lint sweep final)

- **errcheck 38 → 0** — 7 fixes prod (`pluggy/client.go`,
  `services/llm_helpers.go`, `services/rollover.go`,
  `handlers/categories.go`) + 31 fixes test (cache,
  `services/llm_extra_test.go`, bootstrap, obs, whatsapp).
- **staticcheck 16 → 0** — SA1019 migração whatsmeow
  `binary/proto` → `proto/waE2E` (5 callsites em `client.go` +
  `instance_manager.go`); 10 fixes 1-liner (ST1005 ×3, SA9003 ×2,
  QF1003 ×2, SA1012, S1039, S1025, QF1007).
- **revive habilitado** com perfil seletivo inline no
  `.golangci.yml` (14 regras, dry-run inicial 1 warning fixado,
  final **0 warnings**). ADR 005.
- **`.golangci.yml` destravado** — supressões 14 → 6 (−57%);
  permanecem apenas ST1000/ST1003/ST1020-1022 + QF1008 com motivo
  inline.
- **ADRs**: 001 encerrado (golangci-lint v2 wait resolvido), 004
  aceito (whatsmeow proto migration), 005 aceito (revive profile).
- **Smoke whatsmeow**: `TestSQLStoreNew_AutoCreatesWhatsmeowTables`
  PASS com `TEST_DATABASE_URL` local; cobertura mantida 16.3%.
- **Commits Fase 17A**: 16 (lint por arquivo + ADRs + docs).
- **Tag**: `phase-17a-prepared`.
- **Concerns Fase 17B+**: mobile native foundation, multi-region
  read replica, PWA E2E expansão, ST1003 PT-BR acronyms reavaliar,
  `exported`/`package-comments` doc comments se projeto virar SDK.

### 2026-04-15 — Fase 16 preparada (infra hardening)

- **golangci-lint v2.11.4 habilitado** — Go 1.26 support. Config
  `.golangci.yml` v2 (govet + ineffassign + staticcheck com checks
  seletivos). ADR 001 resolvido. Pre-existing ST1005/QF*/SA1019
  (whatsmeow upstream) silenciados para Fase 17 sweep.
- **CI coverage merge** — jobs `test` + `test-integration` uploadam
  artifacts separados (`go-coverage-short`, `go-coverage-integration`).
  Novo job `coverage-gate` (main only) merge via gocovmerge + gate
  30%. ADR 003 aceito.
- **Migration rollback drill** — workflow
  `.github/workflows/migration-drill.yml` cron semanal + dispatch:
  aplica 37 ups → 37 downs (reverso) → 37 ups. Slack notify failure.
- **Webhook secret rotation automation** — cron entry `@04:00`
  diário em `services.CheckWebhookSecretAge` (query `system_config`
  key `pluggy_webhook_secret_set_at`, gauge
  `laura_webhook_secret_age_days`, thresholds 85d warn / 89d error
  com Sentry capture). Seed idempotente em boot.
- **WhatsApp coverage 1% → 16.2%** — plan B (sem mock whatsmeow):
  cobre `InstanceManager` pure helpers (IsConnected nil-safe,
  LastSeen/TouchLastSeen concurrent, CRUD lookups, error paths).
- **Commits Fase 16**: 6 (golangci, drill, merge+cron+rotation,
  whatsapp).
- **Tag**: `phase-16-prepared`.
- **Concerns Fase 17**: errcheck cleanup (>38 warnings), revive
  enable, SA1019 upstream whatsmeow, mobile native foundation,
  multi-region read replica, PWA e2e tests expandidos.

### 2026-04-15 — Fase 15 preparada (quality escalation)

- **Coverage Go handlers**: 2.8% → **57.1%** (+54pp). 23 testes novos
  em auth/transactions/categories/dashboard/banking. Nova infra
  `testutil.NewTestApp` (Fiber+pgxpool+cache InMem+cookie assinado).
  Fix crítico: `api_e2e_test.go` apontava para migrations inexistentes,
  destravando ~55pp sozinho.
- **Coverage Go services**: 19.8% → **53.8%** (+34pp). Testes em
  score.go (paridade pesos 35/25/25/15, boundary), nlp.go (mock LLM
  injetável), rollover.go (month boundary), workflow.go (hooks
  injetáveis), llm_provider.go (httptest matrix). ~50 casos novos.
- **Coverage total Go**: 16.6% → **47.5%** (com tag integration).
  Sem tag: ~22% (short-mode).
- **PWA typing**: 85 → **0** warnings `no-explicit-any`. Gate ESLint
  `no-explicit-any: error` em todo `src/` + `pwa-ci.yml` exige
  `--quiet` zero. Batches: admin (14 arquivos usando `JsonValue`) +
  dashboard features.
- **Cache pub/sub cross-instance**: `RedisCache` ganha `instanceID`
  UUID + canal `laura:cache:invalidate`. `Invalidate` publica payload,
  subscriber goroutine aplica em outras instâncias (ignora self).
  Retry backoff 1s→16s, kill-switch `CACHE_PUBSUB_DISABLED`. 3 testes
  integration (cross/self/disabled). Metrics Prometheus
  `cache_pubsub_publishes/receives_total`. ADR 002 aceito.
- **Pluggy webhooks**: migration 000037 (`bank_webhook_events` dedupe
  por item+event+hash, RLS, `bank_accounts.item_id`). Handler
  `POST /api/banking/webhooks/pluggy` (pública, HMAC dual-secret,
  feature flag `FEATURE_PLUGGY_WEBHOOKS`, rate limit, 64KB cap).
  Worker `banking.WebhookWorker` polling 30s + `FOR UPDATE SKIP
  LOCKED` + advisory lock por item + retry max 5 + dead-letter.
  Metrics received/processed/queue_depth. 4 testes worker +
  5 unit HMAC. Runbook `docs/ops/pluggy-webhooks.md`.
- **CI gate Go**: 15% → **20%** (baseline short-mode 21.9%). Meta
  30% em Fase 16 após integração do job test-integration no gate.
- **STANDBYs Fase 15**: `PLUGGY_WEBHOOK_SECRET` (placeholder), demais
  herdados das fases anteriores.
- **Commits Fase 15**: 10+ (ver `git log --oneline`).
- **Tag**: `phase-15-prepared`.
- **Concerns Fase 16**: integrar test-integration no gate coverage,
  golangci-lint v2, mobile native foundation, multi-region read
  replica, webhook signing rotation automation, whatsapp package
  coverage (1%).

### 2026-04-15 — Fase 14 preparada (quality maturation + Pluggy real + PWA typing)

- **PWA typing sprint 1**: 71→42 warnings (−41%). 4 arquivos tipados (adminConfig/categories/userProfile/phones). `src/types/admin.ts` centraliza types compartilhados.
- **Testcontainers Redis + CI split**: TestMain estende com SharedRedis. CI split `test-unit` PR + `test-integration` main com `nick-fields/retry@v3` 3x 30s.
- **Coverage Go**: 15.6% → 16.6%. Gate progressivo 15% (meta 30% Fase 15).
- **Pluggy HTTP real**: auth cache 1h50m + double-check, 4 sentinelas `ErrPluggy*`, retry 3x backoff 200ms/500ms/1s, CreateConnectToken + FetchTransactions HTTP real. 10 testes httptest mock.
- **ProcessMessageFlow ctx cascade**: assinatura `(ctx, workspaceID, phoneNumber, text, audioBytes, replyFunc) error`. Caller com `WithTimeout(30s)`. Span OTel `laura/workflow`.
- **ADR 001**: golangci-lint aguarda v2.x com suporte Go 1.26.
- **Runbooks**: LLM_LEGACY_NOCONTEXT removal schedule 2026-05-15. Migration 000036 prod apply.
- **Workflow pluggy-smoke**: manual dispatch (sandbox/prod gated).
- **Lefthook commit-msg**: validate-scope regex.
- **STANDBYs Fase 14**: `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` (parcialmente desbloqueados via httptest).
- **Tag**: `phase-14-prepared` @ `b6c98c8`.
- **Total commits Fase 14**: ~25.
- **Concerns Fase 15**: coverage 30% full via integration, PWA cleanup restante (42 warnings em admin/*), pub/sub cache cross-instance, mobile native foundation.

### 2026-04-15 — Fase 13 preparada (polish + Open Finance Foundation)

- **Cache full integration**: 4 endpoints (dashboard/score/reports/categories) + invalidation hooks em mutations + helper InvalidateWorkspace + stub /banking/accounts.
- **ChatCompletion(ctx) propagation**: interface + 3 providers (Groq/OpenAI/Google) + helper interno + caller. Spans OTel reusam ctx. Flag rollback `LLM_LEGACY_NOCONTEXT` + wrapper `ChatCompletionLegacyAware`.
- **Health checks reais em /ready**: db + redis (Cache Ping interface) + whatsmeow (Manager.IsConnected/LastSeen/TouchLastSeen) + llm (cache 5min, default disabled). 4 checks paralelos errgroup timeout 3s.
- **Coverage Go**: 12.4% → 13.6% (+1.5pp). Gate progressivo 12.5%, meta 30% Fase 14.
- **gosec config canônico**: `.gosec.yml` com G706+G101 supressos.
- **Testcontainers pgvector** TestMain compartilhado (build tag `integration`).
- **Open Finance Foundation**: migration 000036 (bank_accounts + bank_transactions + RLS), PluggyClient skeleton, handlers /banking/connect (501 STANDBY) + /sync (X-Ops-Token + feature flag), workflow `bank-sync.yml` cron diário, runbook open-finance.md, 12 testes PASS.
- **STANDBYs Fase 13**: `[PLUGGY-CLIENT-ID]` + `[PLUGGY-CLIENT-SECRET]` (novos) + `[REDIS-INSTANCE]` herdado.
- **Tag**: `phase-13-prepared` @ `6b4ac3a`.
- **Total commits Fase 13**: ~39.
- **Concerns Fase 14**: PWA cleanup real (27 any em adminConfig.ts), testcontainers Redis + CI split, golangci-lint v2.x, coverage→30%, Pluggy impl real, ProcessMessageFlow ctx cascade.

### 2026-04-15 — Fase 12 preparada (refactoring + performance + dívida técnica)

- **main.go: 284 → 134 linhas.** Pacote `internal/bootstrap/` com 7 arquivos (db, logger, sentry, otel, metrics, cache, app), cada com test smoke. Pacote `internal/health/` com Liveness + Readiness errgroup + interfaces injetáveis.
- **Cache layer**: interface `Cache` + `GetOrCompute[T]` com singleflight. `RedisCache` (go-redis/v9) + `InMemoryCache` (golang-lru/v2 + TTL). Hit ratio 80% em bench. Kill-switch `CACHE_DISABLED`. Integração POC em dashboard.
- **Lint cleanup**: gosec G104 zerado (12 ocorrências corrigidas em 4 arquivos: handlers/admin_whatsapp.go, whatsapp/instance_manager.go + client.go, services/workflow.go + rollover.go). PWA: ESLint override `lib/api/` com `no-explicit-any: error` (gate CI `--max-warnings=0`).
- **Migrations consolidadas**: `infrastructure/migrations/` deletada. Path canônico agora é `laura-go/internal/migrations/` via `go:embed`. Dockerfile sem COPY.
- **Infra CI**: `docker-compose.ci.yml` (postgres pgvector + redis + api-go + pwa). `laura-pwa/Dockerfile` multi-stage Next standalone. Workflow `playwright-full.yml` orquestra docker-compose.
- **HMAC fixture** `internal/testutil/SignedSession` para E2E + `.env.test` determinístico.
- **Observability follow-up**: workspace_id em 9 endpoints (incluindo subtipos reports). Sentry scope com tenant_id (alias workspace_id). Tabela rate-limit por regra Sentry. Alerta LLM_LEGACY_NOCONTEXT TTL 30d.
- **Architecture.md PT-BR** com 5 diagramas mermaid (request-flow, persistence, observability, deploy, multi-tenant) + cross-links bidirecionais para 4 runbooks novos (migrations, sentry-alerts, whatsapp, workspace-isolation) + 4 cross-links reversos em runbooks existentes.
- **Coverage Go**: soft 5% no CI (meta 30% Fase 13).
- **STANDBYs Fase 12**: apenas `[REDIS-INSTANCE]` (Upstash opcional, fallback InMemory cobre).
- **Tag**: `phase-12-prepared` (local; aguarda `phase-12-deployed` pós-STANDBY).
- **Total commits Fase 12**: ~56.
- **Concerns Fase 13**: cache integração restante (3 endpoints), ChatCompletion(ctx) ~10 callsites, whatsmeow/LLM ping reais em /ready, 74 `no-explicit-any` em PWA `lib/actions/`, gosec G124 em testutil, golangci-lint v2.x aguardar, testcontainers full, Open Finance.

### 2026-04-15 — Fase 11 preparada (observabilidade completa)

- **slog** structured logger com handler JSON em prod + ContextHandler injeta `request_id`/`trace_id`/`span_id` automaticamente. 25 arquivos migrados (`log.Printf` → `slog.*`).
- **Error response padronizado**: 11 códigos canônicos + helper `RespondError` + Fiber global ErrorHandler classifica erros (pgx, fiber.Error, deadline).
- **Sentry SDK** Go (gated por `SENTRY_DSN_API`, NoOp vazio) + Fiber adapter + slog hook (Error → CaptureException, Warn → CaptureMessage) + scope enrichment (request_id/workspace_id/user_id). PWA `@sentry/nextjs` com `withSentryConfig` + source maps via CI secret.
- **Prometheus metrics** em port `:9090` separada (não exposta pelo HTTP service principal); 12 collectors customizados (pgxpool, llm, cron, backup) + 5 endpoints com label `workspace_id` (cardinalidade controlada).
- **OpenTelemetry tracing**: TracerProvider NoOp graceful (vazio = no-op) + otelfiber middleware + otelpgx no pgxpool + spans manuais em llm/whatsapp/cron.
- **Health enriquecido**: `/ready` com errgroup + 3 checks paralelos (db Ping 500ms + whatsmeow + llm) + timeout global 3s. `/health` com `version`/`build_time`/`uptime_seconds` via `-ldflags`.
- **Backup automation**: `POST /api/ops/backup` com X-Ops-Token + workflow semanal `backup-fly-pg.yml` + drill quinzenal `backup-drill.yml` (DB ephemeral `laura-drill-<sha>` + smoke 6 tabelas + destroy regex guard + Slack notify).
- **Alertas**: 3 regras Sentry documentadas + Slack notify em failure de deploys + pool exhaustion monitor + LLM timeout >10s warn.
- **Dashboards Grafana**: 4 stubs JSON + README de import.
- **Runbooks**: rollback, secrets-rotation, incident-response (SEV1/2/3), error-debugging, alerts, backup, observability.
- **STANDBYs Fase 11**: SENTRY-DSN-API, SENTRY-DSN-PWA, SENTRY-AUTH-TOKEN, SLACK-WEBHOOK, GRAFANA-CLOUD, OTEL-COLLECTOR-URL, FLY-API-TOKEN-BACKUP, PAGERDUTY (opt).
- **Tag**: `phase-11-prepared` (local; aguarda `phase-11-deployed` pós-STANDBYs).
- **Total commits Fase 11**: ~50.

### 2026-04-15 — Sanitização git + repo público (LEI #1.2 ativada)

- GitHub bloqueou Actions por billing em repo PRIVATE.
- Audit 3-pass de segurança executado: gitleaks Pass 1 detectou GROQ_API_KEY no histórico, Pass 2 grep manual confirmou apenas placeholders no working tree, Pass 3 executou `git filter-repo --replace-text` + force push.
- Repo tornado PÚBLICO via `gh repo edit --visibility public`.
- Backup bundle salvo em `../laura-finance-pre-sanitize-20260415-032841.bundle`.
- STANDBY [GROQ-REVOKE] continua ativo (chave precisa ser revogada no console Groq mesmo após sanitização).

### 2026-04-15 — golangci-lint desabilitado (CI fix)
- golangci-lint v1.64.8 (built with Go 1.24) não suporta Go 1.26. Reabilitar quando v2.x sair com suporte.

### 2026-04-15 — Fase 10 preparada

- CI/CD Go + PWA scaffolds (go-ci, pwa-ci, playwright, security).
- Dockerfile distroless + `-tags timetzdata` + embed migrations.
- fly.toml single-machine + healthchecks /health + /ready.
- Patches Go: DISABLE_WHATSAPP guard, requestid middleware, logger JSON, /ready handler. Teste regressão whatsmeow auto-upgrade.
- lefthook canônico + `.githooks/` removido.
- Migration 000035 validada local (já aplicada); procedimento prod em `docs/ops/migrations.md`.
- STANDBYs ativos: GROQ-REVOKE, FORCE-PUSH, VERCEL-AUTH, VERCEL-ENV, FLY-AUTH, FLY-CARD, FLY-SECRETS, FLY-PG-CREATE, STRIPE-LIVE, RESEND-DOMAIN, DNS.

## Estado atual — 2026-04-15 (final da sessão)

**Modo:** desenvolvimento autônomo 2026-04-15.
**Fases concluídas:** 10, 11, 12, 13, 14 (todas "preparadas", 5 tags).
**Commits da sessão:** ~218.
**CI:** 4/4 core verdes. Deploys ❌ (esperado por STANDBYs externos).

**Próxima ação — 3 opções:**

1. **Ativar deploy real** — usuário fornece credenciais Vercel + Fly + Groq (revogada) → agente executa LEI #1.2 sanitize + deploy + tags `*-deployed`.
2. **Fase 15 — Quality Escalation** — sem credenciais, agente ataca: coverage 30% full, PWA cleanup restante, cache pub/sub, mobile foundation, multi-region, Pluggy webhooks.
3. **Outro projeto** — usuário pode redirecionar foco.

**Artefatos de retomada:**
- `CLAUDE.md` (raiz) — 5 LEIS ABSOLUTAS.
- Este `HANDOFF.md` — histórico completo.
- Memory: `phase_{10,11,12,13,14}_complete.md` + `session_state_2026_04_15_final.md`.
- Specs + plans v3 em `docs/superpowers/`.

## Pendências bloqueadas (STANDBY — aguardando input do usuário)

> Estas tarefas estão preparadas até onde dá; o usuário precisa fornecer
> credencial / executar ação manual para liberar. Estão anotadas em
> `.claude/projects/.../memory/standby_*.md` para retomada futura.

### 1. Revogação da chave GROQ_API_KEY exposta

- **Status:** Chave `gsk_Vk3IAz4n...` foi removida do HEAD em commit
  bd88cfe (2026-04-12) mas continua no histórico git.
- **Ação do usuário:** revogar a chave no console Groq
  (https://console.groq.com/keys) e gerar nova chave.
- **Ação do agente após revogação:** rodar `git filter-repo` para
  expurgar a chave do histórico, force push em `main`, atualizar
  `.env.example` com placeholder e novo template.
- **Standby memory:** `standby_groq_key_rotation.md`.

### 2. Deploy produção — credenciais externas

- **Status:** todos os artefatos (Dockerfile multi-stage, fly.toml,
  vercel.json, workflow CI/CD) serão preparados pelo agente.
- **Ação do usuário:** criar contas e fornecer tokens via secrets:
  - Vercel: `VERCEL_TOKEN`
  - Fly.io: `FLY_API_TOKEN`
  - Groq nova: `GROQ_API_KEY`
  - Stripe live (se for produção real): `STRIPE_SECRET_KEY`,
    `STRIPE_WEBHOOK_SECRET`
  - Resend: `RESEND_API_KEY`
- **Ação do agente após tokens:** `vercel link` + `fly deploy`,
  rodar primeiros deploys e tag `phase-10-deployed`.
- **Standby memory:** `standby_deploy_credentials.md`.

### 3. Migration 000035 em ambientes não-locais

- **Status:** será aplicada no Postgres local via docker compose pelo
  agente nesta fase. Em prod fica pendente até deploy existir.
- **Ação após deploy ativo:** rodar `psql -f
  infrastructure/migrations/000035_security_hardening.sql` no Postgres
  de produção.

## Histórico de fases

### Epics 1–9 + Super Admin (BMAD legado, 2026-03 → 2026-04)
✅ Done — ver `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### Security hardening parcial (2026-04-12)
✅ Done — HMAC sessão, rate limit, headers, whitelist SQL, context
timeout, migration 035 escrita. Pendências viraram Fase 10.

### Fase 10 — Security closeout + infra mínima (2026-04-15, em andamento)
🟡 Em execução. Spec v1 sendo gerada.

## Próximos passos imediatos do agente

Fase 10 preparada — todos os artefatos internos estão prontos. A execução
do deploy real depende das STANDBYs externas. Ordem sugerida:

1. **STANDBY [GROQ-REVOKE]** — usuário revoga a chave `gsk_Vk3IAz4n...`
   no console Groq + gera nova chave.
2. Agente executa `scripts/sanitize-history.sh` (playbook em
   `docs/ops/security.md` §"Playbook: chave vazada no histórico git").
3. **STANDBY [FORCE-PUSH]** — agente force-push em `master`.
4. **STANDBY [VERCEL-AUTH]** — usuário adiciona `VERCEL_TOKEN` nos GH
   Secrets.
5. **STANDBY [FLY-AUTH]** + `[FLY-CARD]` — usuário adiciona
   `FLY_API_TOKEN` + cartão na Fly.
6. **STANDBY [FLY-PG-CREATE]** — provisionar Fly Postgres (gru) + attach
   em `laura-finance-api`.
7. **STANDBY [FLY-SECRETS]** — `fly secrets set` para GROQ, OPENAI,
   GOOGLE, STRIPE, RESEND, SESSION_SECRET.
8. Triggers `deploy-api.yml` + `deploy-pwa.yml`.
9. Aplicar migration 000035 em prod (ver `docs/ops/migrations.md`).
10. Smoke prod (`/health`, `/ready`, login).
11. Tag `phase-10-deployed` + próxima fase.
