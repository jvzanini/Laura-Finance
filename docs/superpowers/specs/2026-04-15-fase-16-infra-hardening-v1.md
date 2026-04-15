# Fase 16 — Infra Hardening + Cobertura total (spec v1)

**Data:** 2026-04-15
**Contexto:** Fase 15 preparada (tag `phase-15-prepared`). Deploy real
bloqueado por STANDBYs. Fase 16 ataca dívidas técnicas da lista de
concerns deixada pela Fase 15.

## Objetivos

1. **CI gate coverage full** — integrar job `test-integration` no
   gate (hoje só short-mode). Bump para 30%.
2. **WhatsApp package coverage** — 1% → ≥20%. Priorizar
   `instance_manager.go` e `client.go` com mocks de whatsmeow.
3. **Webhook signing rotation automation** — cron interno (cron-go
   existente) que alerta 24h antes de `PLUGGY_WEBHOOK_SECRET`
   completar 90d + runbook de rotação.
4. **Migration rollback drill** — workflow CI que aplica up→down→up
   em DB ephemeral para validar todas as migrations reversíveis.
5. **Golangci-lint v2** — pesquisar se já há release com Go 1.26
   (ADR 001 bloqueio). Se disponível, habilitar.
6. **ADR 003 + runbook** — documentar decisões (estratégia cobertura,
   migration drill).

## Non-goals

- Mobile native Capacitor (Fase 17 — depende de decisão produto).
- Multi-region read replica (Fase 17 — depende de Fly Postgres em
  prod primeiro).
- Deploy real ou qualquer STANDBY externa.
- Features de produto novas.

## Escopo detalhado

### 1. CI gate coverage full

- Job `test-integration` em `.github/workflows/go-ci.yml` já existe
  mas não alimenta o gate.
- Baixar `coverage.out` do job integration, merge com short-mode via
  `gocovmerge` ou `go tool cover -func`.
- Gate passa a exigir ≥30%.
- Alternativa simples: definir step final `coverage-gate` que baixa
  dois artifacts (coverage-short + coverage-int) e combina.

### 2. WhatsApp coverage

- `internal/whatsapp/` tem 1% hoje.
- Prioridade:
  - `instance_manager.go`: fluxos de lifecycle (Create, Connect,
    Disconnect, IsConnected, LastSeen, TouchLastSeen).
  - `client.go`: sending/receiving flow.
- Estratégia: mockar `whatsmeow.Client` via interface. Testes
  table-driven sem container real.
- Testes de regressão (LastSeen, auto-upgrade gate, DISABLE_WHATSAPP).

### 3. Webhook signing rotation automation

- Cron job existente (`robfig/cron/v3`) ganha nova entrada
  `pluggy-webhook-secret-age` diário.
- Storage: `system_config` tabela (já existe) guarda
  `pluggy_webhook_secret_set_at` timestamp.
- Handler admin PUT `/admin/system_config` já existe — adicionar
  validação para registrar set_at quando secret mudar.
- Cron verifica: `now() - set_at > 85d` → warning slog + Sentry.
  `> 89d` → error + alerta Sentry error.
- Runbook: `docs/ops/pluggy-webhooks.md` ganha seção "rotação
  automática".

### 4. Migration rollback drill

- Novo workflow `.github/workflows/migration-drill.yml` cron semanal.
- Steps: spin postgres pgvector → aplicar todas up → aplicar todas
  down (em ordem reversa) → reaplicar up.
- Falha se qualquer step falhar.
- Escopo: valida migration 000001..000037. Permite catch rápido de
  down.sql quebrado.

### 5. Golangci-lint v2

- Pesquisar release mais recente (via `gh release list` + docs).
- Se suportar Go 1.26: habilitar em `.github/workflows/go-ci.yml`
  + `.golangci.yml` config.
- Se não: documentar no ADR 001 (atualizar data de recheck).

### 6. ADR 003 + runbook

- `docs/architecture/adr/003-coverage-strategy-short-vs-integration.md`:
  decisão sobre separação short-mode (PR) vs integration (main) +
  merge no gate.
- Atualizar `docs/ops/pluggy-webhooks.md` com rotação automática.

## Critérios de aceite

- [ ] Go total coverage ≥30% com gate único (merged short+int).
- [ ] WhatsApp package ≥20% coverage.
- [ ] Cron rotation secret check roda + alerta.
- [ ] Migration drill workflow verde na semana.
- [ ] Golangci-lint ligado OU ADR 001 atualizado.
- [ ] ADR 003 commitado.
- [ ] CI 4/4 core verdes.
- [ ] Tag `phase-16-prepared`.

## Riscos

| Risco | Mitigação |
|-|-|
| Down.sql quebrada | Drill workflow detecta cedo |
| Mock whatsmeow invasivo | Preferir wrapper interface thin; se inviável, pular |
| golangci-lint v2 ainda não pronto | Manter ADR 001 e continuar |
| Coverage merge complica CI | Fallback: só short-mode gate, integration separado |
