# Fase 17B — Playwright E2E real + smoke coverage (spec v2 — review #1)

**Base:** decomposição da "Fase 17 Quality Final Sweep". 17A (lint sweep) entregue em `phase-17a-prepared`. 17C (mobile native foundation) e 17D (multi-region read replica) ficam para fases subsequentes.

**v1→v2 — mudança de escopo material:**
Auditoria aprofundada descobriu dois gaps que inviabilizam o escopo v1:

1. **Zero `data-testid` no código PWA** (grep completo em `laura-pwa/src/` → 0 matches). 8 dos 16 specs (`auth`, `cards-invoices`, `goals`, `investments`, `reports`, `score`, `super-admin`, `transactions`) usam `getByTestId(...)` com testids que **nunca foram adicionados ao código**. Esses testes nunca passariam no CI real.
2. **Rotas `/rollovers` e `/banking` não existem** no PWA (só cards/categories/dashboard/goals/invoices/investments/members/reports/settings/transactions existem em `(dashboard)/`). Backend tem handlers banking/rollover, mas não há UI pública. Spec `rollover.spec.ts` + `banking.spec.ts` via UI navigation não é viável.

**Escopo revisado:**
- 17B **foca em ativar CI E2E real** com os 5 testes que hoje são CI-compatíveis (sem testid): `mvp-flows.spec.ts` (×3), `error-shape.spec.ts`, `observability.spec.ts`.
- 8 specs que dependem de testids recebem `test.fixme(true, 'needs data-testid — Fase 17B.2')` com mensagem clara.
- **Adicionar os testids + reativar os 8 specs = Fase 17B.2** (próxima).
- Novos testes Tier 1 (cards-invoices lifecycle, banking API-only spec) = Fase 17B.3 ou posterior.

## Contexto e motivação

Auditoria do estado real do E2E em **2026-04-16**:

| Ponto | Estado |
|---|---|
| Specs Playwright | **11 arquivos, 16 declarações `test(...)`** (HANDOFF Fase 10 dizia "2 testes" — desatualizado desde Fases 11-15) |
| `playwright.yml` (push + PR) | **Roda apenas `npx playwright test --list`** (parse validation). Success recente é ilusório. |
| `playwright-full.yml` | Full stack real, mas só PR + `workflow_dispatch`. Desenvolvimento é em master → **nunca ativou**. |
| `data-testid` no PWA | **0 matches** em `laura-pwa/src/` |
| Specs **sem** testid (CI-ready hoje) | `mvp-flows.spec.ts` (3), `error-shape.spec.ts` (1), `observability.spec.ts` (1) = **5 testes** |
| Specs **com** testid ausente (CI-broken) | `auth` (5 testids), `transactions` (7), `cards-invoices` (7), `goals` (6), `investments` (5), `reports` (2), `score` (2), `super-admin` (1) = **8 specs, 8 testes** |
| Seed E2E user | `global-setup.ts` faz login em `e2e@laura.test` / `e2epass123!` via `/api/v1/auth/login`. Nenhum seed desse user no código. Em full-stack CI, login falha. |
| `super-admin.spec.ts` | Login em `admin@laura.test` / `admin123!` + `is_super_admin=TRUE` — segundo seed user |
| `playwright.config.ts` | `retries: 0`, `trace: 'on-first-retry'` (zero trace sem retries), reporter só `'list'` |

## Objetivos

1. **Playwright CI real em push+PR** — `playwright.yml` reescrito para rodar `docker-compose.ci.yml` + `npx playwright test` (não mais `--list`). `playwright-full.yml` consolidado/removido.
2. **Seed E2E determinístico** — 2 usuários criados via SQL após `MIGRATE_ON_BOOT` bootar: `e2e@laura.test` (auth padrão) e `admin@laura.test` (`is_super_admin=TRUE`). Senhas bcrypt-hashed. 1 workspace. Script idempotente.
3. **Config flakeless** — `retries: 2` em CI, `workers: 1` em CI, `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, reporter JUnit + HTML.
4. **8 specs com `test.fixme`** — os que dependem de testids inexistentes ganham skip explícito + mensagem `needs data-testid — Fase 17B.2`.
5. **5 testes CI-ready passam real** — `mvp-flows` (3) + `error-shape` (1) + `observability` (1).
6. **CI `Playwright Tests` verde** no push master final (sem ilusão de `--list`).
7. **ADR 006** — Playwright flakeless infra aceita.
8. **HANDOFF + memory** atualizados, incluindo roadmap 17B.2 (testids + revive specs).
9. **Tag `phase-17b-prepared`.**

## Non-goals

- **Adicionar data-testids no PWA** — escopo próprio de Fase 17B.2. Justificativa: são ~40 testids em ~15 componentes; misturar isso com infra CI cria fase gigante de risco alto.
- **Novos specs Tier 1** (cards-invoices lifecycle expansion, banking API-only, rollover) — Fase 17B.3 ou posterior.
- **Cross-browser matrix** (firefox/webkit) — só chromium.
- **Mobile viewport tests** — Fase 17C.
- **Visual regression** — fora de escopo.

## Arquitetura

### 1. Seed E2E

**Opção escolhida:** script SQL `scripts/e2e-seed.sql` executado por serviço `seed-e2e` no docker-compose.ci.yml `depends_on api-go service_healthy`.

Conteúdo:
```sql
-- scripts/e2e-seed.sql (idempotente)

-- 1 workspace compartilhado
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2E Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- e2e user (senha: e2epass123!)
INSERT INTO users (id, email, password_hash, email_verified, is_super_admin, workspace_id, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'e2e@laura.test',
  '$2a$10$<bcrypt_e2epass123!>',
  TRUE, FALSE,
  '00000000-0000-0000-0000-000000000001',
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;

-- admin user (senha: admin123!)
INSERT INTO users (id, email, password_hash, email_verified, is_super_admin, workspace_id, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'admin@laura.test',
  '$2a$10$<bcrypt_admin123!>',
  TRUE, TRUE,
  '00000000-0000-0000-0000-000000000001',
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;
```

**Geração dos hashes:** helper Go `laura-go/cmd/e2e-seed-hash/main.go` printa bcrypt das 2 senhas. Rodar uma vez local, colar valores no SQL. (Hardcode aceitável — senhas são públicas, só CI.)

**Docker compose adição:**
```yaml
seed-e2e:
  image: postgres:16-alpine
  depends_on:
    api-go:
      condition: service_healthy
  environment:
    PGPASSWORD: laura_test
  volumes:
    - ./scripts/e2e-seed.sql:/seed.sql:ro
  entrypoint: ["psql", "-h", "postgres", "-U", "laura", "-d", "laura_finance_test", "-v", "ON_ERROR_STOP=1", "-f", "/seed.sql"]
  restart: "no"
```

**Alternativa considerada:** seed via endpoint `/api/v1/admin/seed-e2e` gated por `APP_ENV=development`. **Rejeitada** porque adiciona rota no binário prod (mesmo gated) + acopla test infra ao código de negócio.

### 2. Playwright config

```ts
// laura-pwa/playwright.config.ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  globalSetup: './tests/global-setup.ts',
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'results.xml' }]]
    : [['list']],
});
```

### 3. Workflows

**`playwright.yml` reescrito:**
```yaml
name: Playwright Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    defaults:
      run:
        working-directory: laura-pwa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: laura-pwa/package-lock.json
      - name: Install deps
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Start full stack via docker-compose
        working-directory: ${{ github.workspace }}
        run: docker compose -f docker-compose.ci.yml up -d --wait --build
      - name: Run Playwright tests
        env:
          CI: "1"
          BASE_URL: http://localhost:3000
          API_URL: http://localhost:8080
        run: npx playwright test
      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            laura-pwa/playwright-report/
            laura-pwa/results.xml
            laura-pwa/test-results/
          retention-days: 14
      - name: Teardown stack
        if: always()
        working-directory: ${{ github.workspace }}
        run: docker compose -f docker-compose.ci.yml down -v
```

**`playwright-full.yml`:** `git rm`. Comentário de deprecação no commit message.

### 4. `test.fixme` em specs com testids ausentes

Cada um dos 8 specs recebe **uma linha nova no topo** do test:

```ts
test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
```

Exemplo `auth.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('auth: register + login + logout happy path', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  // ... resto mantido intacto
});
```

Playwright `test.fixme(true, reason)` marca o teste como skipped com reason visível no report. Código não roda, mas spec continua "compilável" e o plano da 17B.2 (remover linha `fixme`) é cirúrgico.

### 5. ADR 006 — Playwright flakeless

`docs/architecture/adr/006-playwright-flakeless.md`:
- **Contexto:** CI E2E real habilita full stack. Flakes em schema compartilhado + timing exigem retries + traces.
- **Decisão:** `retries: 2` em CI, `workers: 1`, `trace: 'retain-on-failure'`, reporter JUnit + HTML.
- **Consequências:** runs ~20% mais lentos worst case (3× rodadas), artifacts ~50MB, mas debug muito mais rápido quando flakea.
- **Alternativas:** retries=0 (rejeitado, flakes reais existem); mock agressivo (rejeitado, perde confiança end-to-end).

## Ordem de execução

1. **Sprint A — Seed infra** (helper `e2e-seed-hash` + `scripts/e2e-seed.sql` + docker-compose.ci.yml update + validação local `docker compose up`).
2. **Sprint B — Playwright config flakeless** (retries/trace/reporter/workers).
3. **Sprint C — `test.fixme` em 8 specs** (auth, cards-invoices, goals, investments, reports, score, super-admin, transactions).
4. **Sprint D — Workflow consolidation** (playwright.yml real + delete playwright-full.yml).
5. **Sprint E — Validação local** (`docker compose -f docker-compose.ci.yml up -d --wait` + `npx playwright test`) — confirma 5 testes PASS + 8 skipped.
6. **Sprint F — ADR 006 + HANDOFF + memory + tag + push + CI verde**.

## Critérios de aceite

- [ ] `docker compose -f docker-compose.ci.yml up -d --wait --build` local sobe stack completa healthy (postgres + redis + api-go + pwa + seed-e2e complete).
- [ ] `npx playwright test` local (com CI=1) passa: 5 tests passed, 8 skipped (fixme).
- [ ] `playwright.yml` em push/PR roda full stack real (não `--list`).
- [ ] CI `Playwright Tests` verde no push master final; artifacts `playwright-report/` + `results.xml` + `test-results/` presentes.
- [ ] `playwright-full.yml` deletado (consolidação).
- [ ] 8 specs com `test.fixme` + mensagem clara.
- [ ] ADR 006 commitado.
- [ ] HANDOFF seção Fase 17B + lista concerns 17B.2/17B.3.
- [ ] Memory `phase_17b_complete.md` gravada.
- [ ] Tag `phase-17b-prepared` aplicada no remoto.

## STANDBYs

Nenhum novo. Herdados (`PLUGGY-CLIENT-ID/SECRET` para futuros testes banking full).

## Documentação entregável

- `docs/architecture/adr/006-playwright-flakeless.md` (novo)
- `scripts/e2e-seed.sql` (novo)
- `laura-go/cmd/e2e-seed-hash/main.go` (novo, helper)
- `docker-compose.ci.yml` (modified)
- `.github/workflows/playwright.yml` (rewritten)
- `.github/workflows/playwright-full.yml` (deleted)
- `laura-pwa/playwright.config.ts` (modified)
- `laura-pwa/tests/auth.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/cards-invoices.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/goals.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/investments.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/reports.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/score.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/super-admin.spec.ts` (+ `test.fixme`)
- `laura-pwa/tests/transactions.spec.ts` (+ `test.fixme`)
- `docs/HANDOFF.md` (seção Fase 17B)
- Memory `phase_17b_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dockerfile laura-go ou laura-pwa quebrado — build CI falha | Validar `docker compose up --build` local no Sprint E antes de push |
| Seed E2E conflita com schema (unique, FK) | SQL `ON CONFLICT DO NOTHING`, IDs explícitos, seed roda após `api-go healthy` (migrations done) |
| bcrypt hash hardcoded pode falhar com diferentes rounds | Helper gera hash compatível com `bcrypt.DefaultCost=10`; teste local confirma login API-side antes de push |
| `mvp-flows.spec.ts` falha em CI full stack (UI carrega async) | Já usa `waitForURL` com timeout 10s; CI real expõe novos timing issues — retries 2 amortiza |
| Docker compose build + stack up > timeout CI 25min | `playwright-full.yml` atual com 25min tinha margem; estimar 10-15min com full stack real |
| `global-setup.ts` falha em 30s de wait healthcheck | Aumentar deadline para 60s se necessário; depends healthcheck já cobre postgres/redis/api-go |
| `playwright.config.ts` `retries: 2` causa timeout total excessivo | Per-test 30s × 3 × 5 tests = 450s pior caso = 7.5min, bem dentro do 25min |
| PWA env CI aponta `NEXT_PUBLIC_API_URL=http://api-go:8080` (interno container), mas testes batem em `localhost:8080` | `playwright.yml` expõe `API_URL=http://localhost:8080` — mas PWA SSR precisa resolver. Conferir no Sprint E. Pode precisar de `NEXT_PUBLIC_API_URL=http://localhost:8080` no docker-compose.ci.yml para SSR bater em localhost (que no container do pwa é `api-go`, resolvido via compose network). |

## Métricas de sucesso

- **Testes Playwright rodando de verdade em CI push/PR**: 0 → 5 PASS + 8 fixme.
- **Retries:** 0 → 2 (CI only).
- **Artifacts:** playwright-report + JUnit + traces/videos disponíveis.
- **Roadmap 17B.2 claro:** remover `test.fixme` + adicionar ~40 testids nos 15 componentes.
