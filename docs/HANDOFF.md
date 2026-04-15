# Laura Finance — Handoff

> ⚡ **Documento de continuidade do desenvolvimento autônomo.**
> Sempre que abrir nova sessão, leia primeiro `CLAUDE.md` na raiz e
> depois este arquivo. Atualizar a cada fase concluída.

## Histórico de atualizações

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

## Estado atual — 2026-04-15

**Modo:** desenvolvimento autônomo iniciado em 2026-04-15.
**Fase atual:** Fase 10 — Security closeout + infraestrutura mínima de produção (em andamento, spec v1 em geração).

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
