# Fase 16 — Infra Hardening (spec v3 FINAL — review #2)

**v1→v2:** system_config confirmado, drill weekly+dispatch,
gocovmerge, plano B whatsmeow.

**v2→v3:**
- Verificado 37 up.sql + 37 down.sql.
- Cron existente em `services/cron.go`.
- Semente inicial set_at = now() no primeiro boot se ausente.
- whatsmeow: meta ≥10%; stretch ≥20%.

## Objetivos (refinados)

1. **CI coverage total ≥30%** — merge short + integration via
   gocovmerge. Gate único.
2. **whatsapp coverage ≥20%** (ou ≥10% com plano B).
3. **Rotação automática webhook secret** — cron diário + Sentry.
4. **Migration rollback drill** — workflow cron semanal.
5. **Golangci-lint v2** — ligar se existir suporte Go 1.26; senão
   atualizar ADR 001.
6. **ADR 003** estratégia coverage short/integration.

## Non-goals

Mobile, multi-region, deploy, features de produto.

## Escopo detalhado

### 1. CI coverage merge

**Implementação:**
```yaml
# go-ci.yml — novo job coverage-gate
coverage-gate:
  needs: [test, test-integration]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with: { name: go-coverage-short, path: ./short }
    - uses: actions/download-artifact@v4
      with: { name: go-coverage-integration, path: ./int }
    - run: go install github.com/wadey/gocovmerge@latest
    - run: gocovmerge short/coverage.out int/coverage.out > merged.out
    - run: |
        pct=$(go tool cover -func=merged.out | grep total | awk '{print $3}' | tr -d '%')
        echo "merged coverage: $pct%"
        awk -v v="$pct" 'BEGIN{if (v+0 < 30.0) exit 1}'
```

- Job `test` renomear output para `go-coverage-short`.
- Job `test-integration` passa a uploadar `go-coverage-integration`.
- Gate individual dos jobs relaxado para 15% (evita falha precoce);
  gate real fica em `coverage-gate`.

### 2. whatsapp coverage

**Alvos priorizados:**

a. `instance_manager.go`:
   - `IsConnected()` — stub `Client.IsConnected()`.
   - `LastSeen()`, `TouchLastSeen()` — map thread-safe.
   - Lifecycle: table-driven sem container.

b. `client.go`:
   - Parse de handlers (eventos que chegam do whatsmeow).
   - Mocks via interface `whatsmeowClient` thin.

**Plano B** (se wrapping for invasivo):
- Cobrir apenas: `DISABLE_WHATSAPP` flag, env parsing, timing
  helpers, auto-upgrade test de regressão (já existe).
- Meta reduzida: ≥10%.

### 3. Rotação webhook secret

**Storage:**
- `system_config` ganha key `pluggy_webhook_secret_set_at` (ISO timestamp).
- Handler admin atualiza ao mudar secret via PUT `/admin/system_config`.

**Cron:**
- `services/cron/webhook_secret_age.go`:
  - Entry `@daily` via robfig/cron.
  - Query set_at.
  - `age > 85d` → slog warn + Sentry warn.
  - `age > 89d` → slog error + Sentry error.
  - Se `set_at` ausente: log info + metric (não errror — deploy antigo).

**Metric:**
- `laura_webhook_secret_age_days` gauge.

**Runbook update:**
- Seção "rotação automática" em `docs/ops/pluggy-webhooks.md`.

### 4. Migration drill

**Arquivo:** `.github/workflows/migration-drill.yml`
- Trigger: `schedule: '0 6 * * 1'` + `workflow_dispatch`.
- Steps:
  1. Setup postgres pgvector via services.
  2. Apply all `up.sql` em ordem.
  3. Apply all `down.sql` em ordem reversa.
  4. Apply all `up.sql` de novo.
  5. Falha se qualquer step falhar.
  6. Slack notify em failure (via webhook existente).

### 5. Golangci-lint

- Verificar última release (golangci-lint v1.64.8 era a bloqueada).
- Se ≥v2.0 existe com Go 1.26 support: habilitar com `.golangci.yml`
  mínimo (linters: govet, staticcheck, errcheck, ineffassign,
  goimports).
- Senão: update ADR 001 com próxima data de recheck (+30d).

### 6. ADR 003

`docs/architecture/adr/003-coverage-strategy.md`:
- Contexto: jobs `test` (short-mode PR) e `test-integration` (main
  com testcontainers). Gate aplica a ambos.
- Decisão: merge via gocovmerge, gate único ≥30%.
- Consequências: PR pode reprovar por gate sem ter roda integration;
  necessário ter ambos jobs green + merge.

## Ordem de execução

1. Sprint A — WhatsApp coverage.
2. Sprint B — Cron rotation.
3. Sprint C — Migration drill workflow.
4. Sprint D — Coverage merge CI.
5. Sprint E — Golangci-lint check + ADR update.
6. Sprint F — ADR 003, HANDOFF, memory, tag.

## Critérios de aceite

- [ ] Gate CI `coverage-gate` >= 30% verde.
- [ ] whatsapp coverage ≥20% (ou ≥10% com ADR plano-B).
- [ ] Cron rotation entry registrado + teste unit.
- [ ] migration-drill.yml verde no primeiro run manual.
- [ ] golangci-lint ligado OU ADR 001 atualizado com próximo recheck.
- [ ] ADR 003 + runbook atualizado.
- [ ] Tag `phase-16-prepared`.

## STANDBYs

- Nenhuma nova. Herdadas.

## Documentação entregável

- `docs/architecture/adr/003-coverage-strategy.md`
- `docs/ops/pluggy-webhooks.md` (seção rotação automática)
- `docs/HANDOFF.md` (seção Fase 16)
- `_bmad-output/project-context.md` (snapshot)
- `phase_16_complete.md` em memory
</content>
</invoke>
