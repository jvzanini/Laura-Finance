# Fase 15 — Quality Escalation (plan v1)

Base: spec v3 `docs/superpowers/specs/2026-04-15-fase-15-quality-escalation-v3.md`.

## Sprint A — Coverage handlers (≥25%)

### A.1 Setup
1. Criar `laura-go/internal/testutil/app.go` com `NewTestApp(t)` que
   retorna `*fiber.App` + deps + `workspace_id` seed.
2. Adicionar helper `NewAuthedRequest(method, path, body, session)` que
   usa `testutil.SignedSession`.
3. Rodar `go test ./internal/testutil/...` → verde.

### A.2 handlers/auth_test.go
4. `TestAuth_Login_Success` (200 + cookie).
5. `TestAuth_Login_InvalidCredentials` (401).
6. `TestAuth_Login_RateLimit` (429 após N).
7. `TestAuth_Logout` (200 + cookie cleared).
8. `TestAuth_Session_Refresh` (200).
9. `TestAuth_Session_Expired` (401).

### A.3 handlers/transactions_test.go
10. `TestTransactions_List_Empty`.
11. `TestTransactions_List_Paginated`.
12. `TestTransactions_Create_Valid`.
13. `TestTransactions_Create_InvalidAmount` (negative/zero).
14. `TestTransactions_Update`.
15. `TestTransactions_Delete`.
16. `TestTransactions_WorkspaceIsolation` (RLS).

### A.4 handlers/categories_test.go
17. `TestCategories_List`.
18. `TestCategories_Create`.
19. `TestCategories_Delete_WithTransactionsBlocked`.

### A.5 handlers/dashboard_test.go
20. `TestDashboard_Summary`.
21. `TestDashboard_Score`.
22. `TestDashboard_Cached` (second call hits cache).

### A.6 handlers/banking_test.go
23. `TestBanking_Connect_FeatureFlagOff` (501).
24. `TestBanking_Connect_Success`.
25. `TestBanking_Sync_OpsTokenMissing` (401).
26. `TestBanking_Sync_Success`.

### A.7 Run + verify
27. `go test ./internal/handlers/... -cover` → ≥25%.
28. Commit: `test(go): handlers coverage 25%+`.

## Sprint B — Coverage services (≥35%)

### B.1 services/score_test.go
29. `TestScore_AllWeights` (35/25/25/15 combinações).
30. `TestScore_Boundary_Zero`.
31. `TestScore_Boundary_Max`.
32. `TestScore_ParityWithPWA` (fixture shared opcional).

### B.2 services/nlp_test.go
33. `TestNLP_ParseExpense_Simple`.
34. `TestNLP_ParseIncome`.
35. `TestNLP_ParseAmbiguous_Fallback`.
36. `TestNLP_LLMError_GracefulDegrade`.

### B.3 services/rollover_test.go
37. `TestRollover_NoTransactions`.
38. `TestRollover_WithSurplus`.
39. `TestRollover_MonthBoundary`.

### B.4 services/workflow_test.go
40. `TestWorkflow_ContextTimeout`.
41. `TestWorkflow_NLPFailure_UserFriendlyMsg`.
42. `TestWorkflow_CacheInvalidation`.

### B.5 Run + verify
43. `go test ./internal/services/... -cover` → ≥35%.
44. Commit: `test(go): services coverage 35%+`.

## Sprint C — PWA typing 85 → 0

### C.1 Inventário
45. Rodar inventário ESLint JSON → top-20 arquivos.
46. Criar `src/types/admin.ts`, `financial.ts`, `billing.ts`, `banking.ts`.

### C.2 Batch 1 — lib/actions/admin/*
47. Tipar `lib/actions/admin/users.ts`.
48. Tipar `lib/actions/admin/workspaces.ts`.
49. Tipar `lib/actions/admin/analytics.ts`.
50. Commit: `fix(pwa): typing admin actions`.

### C.3 Batch 2 — components/features/admin/*
51. Tipar `components/features/admin/AdminDashboard.tsx`.
52. Tipar `components/features/admin/UserList.tsx`.
53. Tipar `components/features/admin/*` restante.
54. Commit: `fix(pwa): typing admin features`.

### C.4 Batch 3 — components/features/*
55. Tipar `components/features/banking/*`.
56. Tipar `components/features/transactions/*`.
57. Tipar `components/features/dashboard/*`.
58. Commit: `fix(pwa): typing features restantes`.

### C.5 Batch 4 — lib/api + utils
59. Tipar `lib/api/*` restante.
60. Tipar `lib/utils/*` restante.
61. Commit: `fix(pwa): typing lib/api + utils`.

### C.6 Gate
62. Expandir override em `eslint.config.mjs` para escopo completo.
63. Atualizar `pwa-ci.yml` com `--max-warnings=0` full.
64. Run `npx eslint src --max-warnings=0` → 0.
65. Commit: `ci(pwa): gate no-explicit-any full`.

## Sprint D — Cache pub/sub

### D.1 Instance UUID
66. `bootstrap/cache.go`: gerar `uuid.New().String()` em `NewRedisCache`.
67. Store em struct: `instanceID string`.

### D.2 Subscribe
68. Implementar `RedisCache.Start(ctx)` com goroutine `PSubscribe`.
69. Handler: unmarshal, ignorar self, deletar local keys.
70. Retry exponential backoff + Sentry warn após 5 retries.

### D.3 Publish
71. `RedisCache.publishInvalidate(ctx, payload)` helper.
72. Integrar em `InvalidateWorkspace` (após delete local).
73. Respeitar `CACHE_PUBSUB_DISABLED`.

### D.4 Metrics + spans
74. Registrar counters `cache_pubsub_publishes_total`,
    `cache_pubsub_receives_total` em `obs/metrics.go`.
75. Adicionar spans `cache.pubsub.publish|apply`.

### D.5 Testes
76. `cache/redis_pubsub_test.go`: 2 instâncias, invalidation cross.
77. Teste: self-publish ignorado.
78. Teste: `CACHE_PUBSUB_DISABLED` → no-op.
79. Run integration.

### D.6 ADR + commit
80. Escrever `docs/adr/002-cache-pubsub-cross-instance.md`.
81. Commit: `feat(cache): pub/sub cross-instance invalidation`.

## Sprint E — Pluggy webhooks

### E.1 Migration
82. `laura-go/internal/migrations/000037_bank_webhook_events.sql`.
83. `go:embed` + aplicar local.
84. Testar rollback SQL.

### E.2 HMAC verify
85. `pluggy/webhook_signature.go` com `VerifySignature(body, header,
    secrets []string)`.
86. Suporte dual-secret (primary + old).
87. Testes unit.

### E.3 Handler
88. `handlers/banking_webhook.go` com `POST /api/banking/webhooks/pluggy`.
89. Rate limit 100/min IP (Redis).
90. Body size 64KB cap.
91. Feature flag `FEATURE_PLUGGY_WEBHOOKS`.
92. HMAC verify.
93. Clock guard (se timestamp).
94. Resolve workspace via `bank_accounts.item_id`.
95. Compute `payload_hash = sha256(body)`.
96. `INSERT ... ON CONFLICT DO NOTHING`.
97. Response 202.
98. Metric `pluggy_webhook_received_total`.

### E.4 Worker
99. `banking/webhook_worker.go` com `Run(ctx)` loop ticker 30s.
100. Query `FOR UPDATE SKIP LOCKED LIMIT 50`.
101. Para cada: `SET LOCAL app.workspace_id`.
102. Advisory lock `pg_try_advisory_xact_lock(hashtext(item_id))`.
103. Dispatch:
     - `item/updated`, `transactions/created` → `SyncWorkspace`.
     - `item/error` → Sentry + log.
     - default → mark processed.
104. Retry backoff até 5x.
105. Gauge `pluggy_webhook_queue_depth`.
106. Span OTel `pluggy.webhook.process`.

### E.5 Bootstrap
107. `bootstrap/worker.go` inicia worker em goroutine se flag on.
108. Integrar em `main.go`.

### E.6 Testes
109. Unit: HMAC dual-secret.
110. Handler httptest: valid/invalid/dedupe/flag-off/rate-limit.
111. Worker: dispatch + retry + lock.
112. E2E Playwright smoke webhook.

### E.7 Runbook + commit
113. `docs/ops/pluggy-webhooks.md`.
114. Commit: `feat(banking): pluggy webhooks + worker async`.

## Sprint F — Fechamento

### F.1 CI gate
115. `go-ci.yml`: `COVERAGE_MIN=25`.
116. Commit: `ci(go): coverage gate 25%`.

### F.2 .env.example
117. Adicionar `PLUGGY_WEBHOOK_SECRET`,
     `PLUGGY_WEBHOOK_SECRET_OLD`, `FEATURE_PLUGGY_WEBHOOKS`,
     `CACHE_PUBSUB_DISABLED`.

### F.3 Docs
118. Atualizar `docs/HANDOFF.md` com seção Fase 15.
119. Atualizar `_bmad-output/project-context.md` snapshot.

### F.4 Memory
120. Criar `phase_15_complete.md` em memory dir.
121. Atualizar `session_state_2026_04_15_final.md`.

### F.5 Tag + push
122. `git tag phase-15-prepared -m "..."`.
123. `git push origin master --tags`.

### F.6 CI watch
124. Monitorar 4 workflows core.
125. Corrigir falhas em hotfix commits.

## Dependências

- A, B, C independentes (paralelizáveis).
- D depende do cache package existente.
- E depende de A (handlers test pattern), D (metrics pattern).
- F depende de todos.
</content>
</invoke>