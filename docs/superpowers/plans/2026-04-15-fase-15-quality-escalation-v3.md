# Fase 15 — Quality Escalation (plan v3 FINAL — review #2)

**Refinamentos v1→v2:** coverage verify incremental; deps testutil;
graceful shutdown; 404 webhook; rollback migration; go vet+race;
PWA batch incremental.

**Refinamentos v2→v3:**
- Ordem webhook handler: parse JSON ENTRE HMAC verify e workspace
  resolve (fix ordem v2 task 113→116).
- `superpowers:verification-before-completion` invocado em cada gate.
- `superpowers:requesting-code-review` após cada Sprint (A, B, D, E).
- Corrigir go vet pre-existente antes de ligar `-race` no CI.
- Tests pub/sub usam `testutil.SharedRedisURL` + testcontainers.
- Vitest PWA incluído no verify (se houver suite).
- Skill `superpowers:test-driven-development` em cada novo teste
  (red → green → refactor).
- Skill `ui-ux-pro-max` NÃO aplicável (Fase 15 não tem UI nova).

Base: spec v3.

## Sprint A — Coverage handlers 2.8% → ≥25%

### A.0 Baseline
1. `cd laura-go && go test ./internal/handlers/... -cover` (record baseline).

### A.1 Infra de testes
2. Criar `laura-go/internal/testutil/app.go` com:
   - `NewTestApp(t *testing.T) (*fiber.App, *AppDeps)`.
   - `AppDeps` contém `*pgxpool.Pool`, `cache.Cache`, mock services.
   - Usa build tag `integration`; testcontainers pgvector.
   - Seed: 1 workspace + 1 user + 1 session válida.
3. `testutil/requests.go` helper `NewAuthedRequest(method, path, body)`
   retornando `*http.Request` com cookie assinado (`SignedSession`).
4. `testutil/fixtures.go`: categorias, transactions seed.
5. Run `go test ./internal/testutil/... -tags=integration` → verde.
6. Commit: `test(go): testutil.NewTestApp + request helpers`.

### A.2 auth_test.go
7. `TestAuth_Login_Success` (200 + session cookie).
8. `TestAuth_Login_InvalidPassword` (401).
9. `TestAuth_Login_InvalidEmail` (401).
10. `TestAuth_Login_RateLimit` (429).
11. `TestAuth_Logout_Success` (200 + cookie expired).
12. `TestAuth_Session_Expired` (401 em rota protegida).
13. `go test ./internal/handlers/ -run TestAuth -cover` verify.
14. Commit: `test(go): handlers/auth cobertura`.

### A.3 transactions_test.go
15. `TestTx_List_Empty`, `TestTx_List_Paginated`.
16. `TestTx_Create_Valid`, `TestTx_Create_InvalidAmount`,
    `TestTx_Create_InvalidCategory`.
17. `TestTx_Update_Success`, `TestTx_Update_NotFound`.
18. `TestTx_Delete_Success`.
19. `TestTx_WorkspaceIsolation` (outro workspace não vê).
20. Verify + commit: `test(go): handlers/transactions cobertura`.

### A.4 categories_test.go
21. `TestCat_List`, `TestCat_Create`, `TestCat_Delete_Blocked`.
22. Verify + commit.

### A.5 dashboard_test.go
23. `TestDash_Summary`, `TestDash_Score`, `TestDash_Cached`.
24. Verify + commit.

### A.6 banking_test.go
25. `TestBank_Connect_FlagOff`, `TestBank_Connect_Success`.
26. `TestBank_Sync_MissingToken`, `TestBank_Sync_Success`.
27. Verify + commit.

### A.7 Gate
28. `go test ./internal/handlers/... -cover -tags=integration` → ≥25%.
29. Se abaixo: adicionar testes complementares em endpoint underscored.

## Sprint B — Coverage services 19.8% → ≥35%

### B.0 Baseline
30. `go test ./internal/services/... -cover` record.

### B.1 score_test.go (prioridade paridade PWA)
31. `TestScore_AllWeights` table-driven (20+ combos pesos 35/25/25/15).
32. `TestScore_Boundary_Zero`, `TestScore_Boundary_Max`.
33. `TestScore_NegativeBalance` (edge).
34. Verify + commit.

### B.2 nlp_test.go
35. `TestNLP_ParseExpense_Simple`, `TestNLP_ParseIncome`.
36. `TestNLP_LLMError_Fallback`.
37. `TestNLP_AmbiguousAmount` (R$ 10 vs 10 reais).
38. Mock `ChatCompletioner` via interface já existente.
39. Verify + commit.

### B.3 rollover_test.go
40. `TestRollover_NoTx`, `TestRollover_Surplus`, `TestRollover_MonthBoundary`.
41. Verify + commit.

### B.4 workflow_test.go
42. `TestWorkflow_CtxTimeout`.
43. `TestWorkflow_NLPError_UserMsg`.
44. `TestWorkflow_CacheInvalidation`.
45. Verify + commit.

### B.5 Gate
46. `go test ./internal/services/... -cover` → ≥35%.
47. Se abaixo: complementar.

## Sprint C — PWA typing

### C.0 Baseline + setup
48. `cd laura-pwa && npx eslint src --ext .ts,.tsx --format json
    -o /tmp/eslint.json`.
49. Gerar top-20: `jq -r '.[] | select(.warningCount>0) |
    "\(.warningCount)\t\(.filePath)"' /tmp/eslint.json | sort -rn | head -20`.
50. Criar `src/types/admin.ts` (se não existir, extender).
51. Criar `src/types/financial.ts`, `billing.ts`, `banking.ts`.
52. Criar `src/lib/typeGuards.ts` base.

### C.1 Batch 1 — lib/actions/admin
53. Tipar `lib/actions/admin/users.ts`.
54. Tipar `lib/actions/admin/workspaces.ts`.
55. Tipar `lib/actions/admin/analytics.ts` (se houver).
56. Run `npx eslint src/lib/actions/admin/ --max-warnings=0`.
57. Commit: `fix(pwa): typing lib/actions/admin`.

### C.2 Batch 2 — components/features/admin
58. Tipar componentes admin (um commit por 2-3 arquivos se grande).
59. Run eslint escopo.
60. Commit.

### C.3 Batch 3 — components/features/*
61. Tipar banking, transactions, dashboard features.
62. Run eslint.
63. Commit.

### C.4 Batch 4 — lib/api + utils
64. Tipar `lib/api/*` restante.
65. Tipar `lib/utils/*` restante.
66. Commit.

### C.5 Gate full
67. Atualizar `eslint.config.mjs` com override
    `no-explicit-any: error` para todo `src/`.
68. `npx eslint src --max-warnings=0` → 0 warnings.
69. Atualizar `.github/workflows/pwa-ci.yml` para rodar com
    `--max-warnings=0` em todo `src/`.
70. Commit: `ci(pwa): gate no-explicit-any full`.

## Sprint D — Cache pub/sub

### D.1 Instance UUID
71. Em `bootstrap/cache.go`: gerar `instanceID` uma vez.
72. Passar para `NewRedisCache(url, instanceID)`.
73. Campo `instanceID string` em `RedisCache`.

### D.2 Subscriber
74. Método `RedisCache.Start(ctx context.Context) error`.
75. Goroutine: `pubsub := client.PSubscribe(ctx, channel)`.
76. Loop: `msg := <-pubsub.Channel()`.
77. Unmarshal, ignorar self-publish (`instance_id == r.instanceID`).
78. Delete keys por `pattern`.
79. Respeitar `ctx.Done()` → graceful shutdown.
80. Retry backoff exponential em erro (1s, 2s, 4s, 8s, 16s max).
81. Sentry warn após 5 falhas consecutivas.

### D.3 Publisher
82. Helper `publishInvalidate(ctx, payload InvalidatePayload)`.
83. `InvalidateWorkspace`: after delete local → publish.
84. Se `CACHE_PUBSUB_DISABLED=true`: skip publish.

### D.4 Bootstrap wiring
85. Em `main.go` após `NewRedisCache`: `go cache.Start(ctx)`.
86. Shutdown: ctx cancel propaga.

### D.5 Metrics + spans
87. Registrar counters em `obs/metrics.go`.
88. `cache_pubsub_publishes_total{pattern_kind}`.
89. `cache_pubsub_receives_total{outcome}`.
90. Spans `cache.pubsub.publish` (child) e `cache.pubsub.apply` (root).

### D.6 Testes
91. `cache/redis_pubsub_test.go` build tag integration.
92. Setup: 2 `RedisCache` compartilhando testcontainer Redis.
93. Test: `InvalidateWorkspace` em A → chaves somem em B <500ms.
94. Test: self-publish de A ignorado por A.
95. Test: `CACHE_PUBSUB_DISABLED=true` → publish no-op.
96. Test: graceful shutdown em ctx cancel.
97. Run integration.

### D.7 ADR + commit
98. Escrever `docs/adr/002-cache-pubsub-cross-instance.md`.
99. Commit: `feat(cache): pub/sub cross-instance invalidation`.

## Sprint E — Pluggy webhooks

### E.1 Migration
100. Escrever `laura-go/internal/migrations/000037_bank_webhook_events.sql`
     (CREATE TABLE + INDEX + RLS + POLICY).
101. DOWN section em comentário (runbook).
102. Aplicar local: `docker compose exec postgres psql ...` ou `go run
     ./cmd/migrate up`.
103. Verificar rollback SQL em ambiente scratch.

### E.2 HMAC verify
104. `pluggy/webhook_signature.go`:
     `func VerifySignature(body []byte, header string, secrets []string) bool`.
105. Parse `sha256=<hex>`, HMAC-SHA256, constant-time compare.
106. Teste unit dual-secret.

### E.3 Handler
107. `handlers/banking_webhook.go` handler `POST
     /api/banking/webhooks/pluggy`.
108. Rota pública em `main.go` (fora do `requireSession`).
109. Rate limit: helper existente (`middleware/ratelimit`) chave
     `rl:webhook:pluggy:<ip>` 100/min.
110. Body size limit 64KB (`app.BodyLimit` ou check manual).
111. Feature flag `FEATURE_PLUGGY_WEBHOOKS`: se false → 503.
112. Ler body raw (precisa para HMAC).
113. Verify HMAC via `VerifySignature` (primary + old secret).
114. Clock guard: se payload tem `timestamp` e delta >15min → 401.
115. Parse JSON payload.
116. Resolve `workspace_id` via `SELECT workspace_id FROM bank_accounts
     WHERE item_id = $1 LIMIT 1`. Não achou → 404 warn log.
117. Compute `payload_hash = hex(sha256(body))`.
118. INSERT `bank_webhook_events` `ON CONFLICT (item_id, event_type,
     payload_hash) DO NOTHING`.
119. Metric `pluggy_webhook_received_total{event,outcome}`.
120. Response 202.

### E.4 Worker
121. `banking/webhook_worker.go` `func Run(ctx context.Context) error`.
122. Ticker 30s (`time.NewTicker`).
123. On tick: query `FOR UPDATE SKIP LOCKED LIMIT 50` das
     unprocessed com `retry_count < 5`.
124. Para cada evento (tx separada):
     - `SET LOCAL app.workspace_id = '<uuid>'`.
     - Advisory lock: `SELECT pg_try_advisory_xact_lock(hashtext($item_id))`.
       Se false → skip.
     - Dispatch por event_type:
       - `item/updated`, `transactions/created` → `pluggy.SyncWorkspace`.
       - `item/error` → Sentry capture + log.
       - default → mark processed.
     - On success: `UPDATE SET processed_at = now()`.
     - On error: `UPDATE SET retry_count += 1, error_message = $1`;
       se retry_count >=5 → `processed_at = now()` (dead-letter).
125. Gauge `pluggy_webhook_queue_depth` atualizado a cada tick.
126. Span OTel `pluggy.webhook.process`.
127. Respeita `ctx.Done()`.
128. Kill-switch: `FEATURE_PLUGGY_WEBHOOKS=false` → ticker dorme.

### E.5 Bootstrap wiring
129. `bootstrap/worker.go` expõe `StartWebhookWorker(ctx, deps)`.
130. `main.go` chama em goroutine.
131. `errgroup` para agregar shutdown.

### E.6 Testes
132. Unit HMAC: valid/invalid/malformed/dual-secret.
133. Handler httptest:
     - HMAC válido → 202.
     - HMAC inválido → 401.
     - Ausente header → 401.
     - Feature flag off → 503.
     - Body > 64KB → 413.
     - Rate limit → 429.
     - Item não resolve → 404.
     - Dedupe (mesmo hash) → 202 idempotente.
134. Worker table-driven dispatch por event_type.
135. Worker retry backoff após error.
136. Worker advisory lock evita duplo processamento.
137. Worker RLS enforcement (`SET LOCAL app.workspace_id`).
138. E2E Playwright smoke: POST mock webhook, verify 202.
139. Commit progressivo por conjunto de testes.

### E.7 Runbook + final commit
140. `docs/ops/pluggy-webhooks.md` cobrindo config, rotação dual-secret,
     SQL inspeção, replay, troubleshooting.
141. Commit: `feat(banking): pluggy webhooks + worker assíncrono`.

## Sprint F — Fechamento

### F.1 CI gates
142. `go-ci.yml`: `COVERAGE_MIN=25` (de 15).
143. Run local `go test ./... -cover` e `go vet ./...` e
     `go test ./... -race -short` — zero erros.
144. Commit: `ci(go): gate coverage 25% + race`.

### F.2 .env.example
145. Adicionar:
     - `PLUGGY_WEBHOOK_SECRET=__placeholder__`
     - `PLUGGY_WEBHOOK_SECRET_OLD=`
     - `FEATURE_PLUGGY_WEBHOOKS=false`
     - `CACHE_PUBSUB_DISABLED=false`
146. Commit: `docs(env): vars Fase 15`.

### F.3 Documentação
147. `docs/HANDOFF.md`: nova seção "2026-04-15 — Fase 15 preparada".
148. `_bmad-output/project-context.md`: snapshot atualizado.
149. `docs/architecture.md`: incluir pub/sub + webhook flow
     (atualizar diagrama se necessário).
150. Commit: `docs(handoff): Fase 15 preparada`.

### F.4 Memory
151. Criar `phase_15_complete.md` em
     `.claude/projects/.../memory/`.
152. Atualizar `session_state_2026_04_15_final.md` com resumo Fase 15.
153. Atualizar `MEMORY.md` índice.

### F.5 Tag + push
154. `git tag phase-15-prepared -m "Fase 15 quality escalation"`.
155. `git push origin master --tags`.

### F.6 CI watch
156. Monitorar 4 workflows core: go-ci, pwa-ci, playwright, security.
157. Hotfix se vermelho.

## Verification commands (cheatsheet)

```bash
# Go
cd laura-go
go test ./... -cover
go test ./... -tags=integration -cover
go vet ./...
go test ./... -race -short

# PWA
cd laura-pwa
npx eslint src --ext .ts,.tsx --max-warnings=0
npm run build

# Full stack
docker compose -f docker-compose.ci.yml up -d
```

## Dependências

- A e B independentes (podem rodar paralelo via agentes).
- C independente.
- D depende do cache package (já existe).
- E depende de A (padrão httptest) e D (padrão metrics).
- F depende de todos.
</content>
</invoke>