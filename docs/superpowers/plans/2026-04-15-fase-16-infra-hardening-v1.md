# Fase 16 — Infra Hardening (plan v1)

Base: spec v3.

## Sprint A — whatsapp coverage

### A.0 Baseline
1. `go test ./internal/whatsapp/... -cover` → registrar baseline.
2. `grep -c "^func" laura-go/internal/whatsapp/*.go` → mapear funções.

### A.1 Code puro
3. Testar `DISABLE_WHATSAPP` flag em `Start()` (skip conexão).
4. Testar env parsing (WHATSAPP_*).
5. Testar timing helpers (LastSeen getter/setter thread-safe).

### A.2 Wrapper (se viável)
6. Extrair interface `whatsmeowSession` com métodos usados (Connect,
   IsConnected, Disconnect, SendMessage, etc.).
7. Refactor `InstanceManager` para depender da interface.
8. Stub para testes.
9. Testes lifecycle.

### A.3 Gate
10. Coverage ≥10% (stretch ≥20%).
11. Commit: `test(whatsapp): cobertura baseline + lifecycle`.

## Sprint B — Cron rotation

### B.1 Storage
12. Identificar handler admin `PUT /admin/system_config`.
13. Atualizar caller/ops runbook para incluir
    `pluggy_webhook_secret_set_at`.

### B.2 Bootstrap seed
14. Em `bootstrap/` criar `InitWebhookSecretSeed()` — insert
    set_at=NOW() se key ausente.
15. Chamar em main.go após InitCache.

### B.3 Cron entry
16. Adicionar `WebhookSecretAgeCheck(ctx)` service.
17. Registrar `@daily` em `services/cron.go`.
18. Implementar query + thresholds 85d/89d + log + Sentry.
19. Metric `laura_webhook_secret_age_days`.
20. Testes unit (table-driven: idades 0/60/86/90 → outcomes).

### B.4 Commit
21. `feat(webhooks): rotacao automatica pluggy secret + cron`.

## Sprint C — Migration drill

### C.1 Workflow
22. Criar `.github/workflows/migration-drill.yml`.
23. Trigger: cron semanal (seg 06:00 UTC) + workflow_dispatch.
24. Step 1: checkout + setup postgres pgvector service.
25. Step 2: apply all up.sql em ordem.
26. Step 3: apply all down.sql em ordem reversa.
27. Step 4: apply all up.sql de novo.
28. Step 5: falha workflow em qualquer erro.
29. Slack notify em failure (webhook secret).

### C.2 Dry-run local
30. Rodar drill local via docker compose para validar.
31. Corrigir qualquer down.sql quebrada.

### C.3 Commit
32. `ci(migrations): weekly rollback drill workflow`.

## Sprint D — Coverage merge CI

### D.1 Jobs output
33. `go-ci.yml` job `test`: artifact `go-coverage-short`.
34. Job `test-integration`: artifact `go-coverage-integration`.
35. Relaxar gates individuais para 15% (não-bloqueante).

### D.2 coverage-gate job
36. Novo job `coverage-gate` needs [test, test-integration].
37. Install `gocovmerge`.
38. Merge + gate 30%.

### D.3 Commit
39. `ci(go): coverage merge short+integration gate 30%`.

## Sprint E — Golangci-lint v2

### E.1 Research
40. `gh release list golangci/golangci-lint --limit 5`.
41. Verificar se v2 tem Go 1.26 support.

### E.2.a Se disponível
42. Criar `.golangci.yml` mínimo.
43. Habilitar step em go-ci.yml.
44. Fix warnings críticos.
45. Commit.

### E.2.b Se não
46. Atualizar `docs/architecture/adr/001-golangci-lint-aguarda-v2.md`
    com próxima data de recheck (+30d).
47. Commit: `docs(adr): ADR 001 recheck 2026-05-15`.

## Sprint F — Fechamento

### F.1 ADR 003
48. `docs/architecture/adr/003-coverage-strategy.md`.
49. Commit.

### F.2 Runbook
50. `docs/ops/pluggy-webhooks.md` seção "rotação automática".
51. Commit.

### F.3 HANDOFF + memory
52. Atualizar `docs/HANDOFF.md`.
53. Criar `phase_16_complete.md` memory.
54. Atualizar MEMORY.md.

### F.4 Tag
55. `git tag phase-16-prepared -m "..."` + push.

### F.5 CI watch
56. Monitorar 4+1 workflows (core + drill).

## Dependências

- A, B, C, D, E todos independentes.
- F depende de todos.
