# Fase 17B — Playwright E2E real + Tier 1 coverage (spec v1)

**Base:** decomposição da "Fase 17 Quality Final Sweep". 17A (lint sweep) entregue em `phase-17a-prepared`. 17C (mobile native foundation) e 17D (multi-region read replica) ficam para fases subsequentes.

## Contexto e motivação

Auditoria do estado real do E2E em **2026-04-16**:

| Ponto | Estado |
|---|---|
| Specs Playwright | **11 arquivos, 16 declarações `test(...)`** (não "2 testes" como HANDOFF Fase 10 dizia — specs foram adicionadas entre Fases 11-15 sem update do HANDOFF) |
| Workflow CI `playwright.yml` (push + PR) | **Roda apenas `npx playwright test --list`** (parse validation). "Success" dos runs recentes é ilusório — testes nunca passaram de verdade em push. |
| Workflow `playwright-full.yml` | Roda stack real (docker-compose.ci.yml + chromium), mas só em **PR** e `workflow_dispatch`. Como desenvolvimento é direto em master (sem PRs), **nunca foi ativado**. |
| `playwright.config.ts` | `retries: 0`, `trace: 'on-first-retry'` (zero trace sem retries), reporter só `'list'`, sem JUnit/HTML |
| Cobertura Tier 1 | Epic 8 (crisis/rollover) **ausente**. Epic 9 (cards/invoices) 1 spec de 14 linhas (só create card → fatura aparece). Banking/Pluggy **ausente**. |
| Seed E2E | `globalSetup` tenta login em `e2e@laura.test` / `e2epass123!` via `POST /api/v1/auth/login`. **Nenhum seed desse usuário no código** — login vai falhar no full stack CI. |

## Objetivos

1. **Playwright CI real em push+PR** — `playwright.yml` roda full stack (docker-compose.ci.yml) + testes reais. `playwright-full.yml` consolidado/removido.
2. **Seed E2E determinístico** — `e2e@laura.test` + workspace + categorias default criados após migrations bootarem. SQL idempotente executado via serviço `seed-e2e` no docker-compose.ci.yml (ou step CI explícito).
3. **Config flakeless** — `retries: 2` em CI, `workers: 1` no CI (evita race em schema compartilhado), `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, reporter JUnit + HTML.
4. **Cobertura Tier 1 expandida:**
   - **cards-invoices lifecycle**: create card → add parceled expense (3×) → invoice do mês tem 3 parcelas → pay 1st installment → invoice status change → next invoice open.
   - **rollover/crisis (epic 8)**: novo spec `rollover.spec.ts` — empty state + seed 1 rollover via SQL → aparece em `/rollovers` com valores corretos + status.
   - **banking (Pluggy STANDBY)**: novo spec `banking.spec.ts` — `/banking/accounts` empty state; `/banking/connect` retorna 501; `/banking/sync` sem `X-Ops-Token` retorna 401.
5. **Todos os 16 testes atuais continuam PASS** no novo CI real (sem regressão).
6. **ADR 006** — Playwright flakeless infra aceita.
7. **HANDOFF + memory** atualizados.
8. **Tag `phase-17b-prepared`.**

## Non-goals

- Tier 2 expansion (goals/investments/super-admin deeper) — fica para Fase 17B.2.
- Cross-browser matrix (firefox/webkit) — só chromium.
- Mobile viewport tests — fica para 17C.
- Visual regression (snapshot testing) — fora de escopo.
- Rewrite `mvp-flows.spec.ts` (já cobre smoke de rotas decentemente).

## Arquitetura

### 1. Seed E2E

**Opção escolhida:** script SQL `scripts/e2e-seed.sql` executado no docker-compose.ci.yml como serviço `seed-e2e` depends-on api-go healthy.

Conteúdo esperado do seed:
```sql
-- idempotente: ON CONFLICT DO NOTHING
INSERT INTO workspaces (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2E Workspace', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, email_verified, is_super_admin, workspace_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'e2e@laura.test',
  '$2a$10$<bcrypt-hash-of-e2epass123!>',  -- placeholder, gerar via script helper
  TRUE,
  FALSE,
  '00000000-0000-0000-0000-000000000001',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Optional: 1 categoria default
INSERT INTO categories (workspace_id, name, emoji, type, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'Alimentação', '🍽️', 'expense', TRUE)
ON CONFLICT DO NOTHING;
```

**Geração do bcrypt hash:** Go helper script `laura-go/cmd/e2e-seed-hash/main.go` que gera o hash da senha conhecida e atualiza o SQL. Hash fixo hardcoded é aceitável (senha é pública — "e2epass123!" apenas em CI).

**Trigger do seed no docker-compose.ci.yml:**
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
  command: ["psql", "-h", "postgres", "-U", "laura", "-d", "laura_finance_test", "-f", "/seed.sql"]
  restart: "no"
```

### 2. Playwright config

```ts
// playwright.config.ts (CI/local condicional)
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

### 3. Unificação workflows

`playwright.yml` reescrito:
- Trigger: push + PR em master/main (igual hoje).
- Steps:
  1. Checkout + setup-node 20.
  2. `npm ci` em `laura-pwa`.
  3. `npx playwright install --with-deps chromium`.
  4. `docker compose -f docker-compose.ci.yml up -d --wait --build` (sobe postgres + redis + api-go + pwa + seed-e2e).
  5. `BASE_URL=http://localhost:3000 API_URL=http://localhost:8080 npx playwright test`.
  6. Upload `playwright-report/` + `results.xml` + `test-results/` (traces/videos de retries).
  7. `docker compose down -v` em always.

`playwright-full.yml` **deletado** (conteúdo absorvido).

### 4. Tier 1 coverage expansions

**`cards-invoices.spec.ts` — expandir para lifecycle completo:**
- Create card (já existe).
- Add expense parcelada 3× (`btn-new-expense` + `checkbox-parcelado` + `input-installments=3`).
- Navigate `/invoices` → ver fatura do mês atual → listar 3 parcelas com valores divididos.
- Pay 1st installment (`btn-pay-installment[0]`) → invoice status changes → assertion.
- Fast-forward: verificar próxima fatura aberta pro mês seguinte (pode usar API direto se UI não oferece).

**Novo `rollover.spec.ts` (epic 8):**
- `/rollovers` empty state com workspace fresh.
- Seed 1 debt_rollover via API helper ou SQL direto no teste (fixture).
- Navigate `/rollovers` → table mostra 1 linha com valores + `status=active`.
- Click linha → detail page → valores batem.

**Novo `banking.spec.ts`:**
- `/banking/accounts` → empty state.
- POST `/banking/connect` via `page.request.post` → response `501` (feature flag off).
- POST `/banking/sync` sem X-Ops-Token → `401`.

### 5. ADR 006 — Playwright flakeless

`docs/architecture/adr/006-playwright-flakeless.md`:
- **Contexto:** CI E2E real habilita full stack. Flakes em infra compartilhada exigem retries + traces.
- **Decisão:** `retries: 2` em CI, `workers: 1`, `trace: 'retain-on-failure'`, reporter JUnit + HTML.
- **Consequências:** runs ~20% mais lentos (worst case 3× rodadas), artifacts maior (~50MB), mas debug muito mais rápido quando quebra.
- **Alternativas consideradas:** retries=0 (rejeitado, flakes reais existem); mock mais agressivo (rejeitado, perde confiança de ponta-a-ponta).

## Ordem de execução

1. **Sprint A — Seed E2E** (bcrypt helper + seed.sql + docker-compose.ci.yml update).
2. **Sprint B — Playwright config flakeless** (retries/trace/reporter).
3. **Sprint C — Workflow consolidation** (playwright.yml full stack; delete playwright-full.yml).
4. **Sprint D — cards-invoices lifecycle**.
5. **Sprint E — rollover.spec.ts + banking.spec.ts**.
6. **Sprint F — ADR 006 + HANDOFF + memory + tag + push + CI verde**.

## Critérios de aceite

- [ ] `playwright.yml` em push/PR roda full stack (não `--list`).
- [ ] Todos os 16 tests atuais PASS no CI novo.
- [ ] +7 testes novos min (cards-invoices expansion 4, rollover 2, banking 3 = 9 novos).
- [ ] CI `Playwright Tests` verde no push master.
- [ ] `playwright-full.yml` deletado (consolidação).
- [ ] Seed E2E idempotente documentado.
- [ ] ADR 006 commitado.
- [ ] `phase-17b-prepared` tag aplicada no remoto.
- [ ] HANDOFF + memory `phase_17b_complete.md` gravados.

## STANDBYs

- Nenhum novo. Banking/Pluggy já tem STANDBY herdado (`PLUGGY-CLIENT-ID/SECRET`).

## Documentação entregável

- `docs/architecture/adr/006-playwright-flakeless.md` (novo)
- `scripts/e2e-seed.sql` (novo)
- `laura-go/cmd/e2e-seed-hash/main.go` (novo, helper bcrypt gen)
- `docker-compose.ci.yml` (modified, adiciona serviço seed-e2e)
- `.github/workflows/playwright.yml` (rewritten)
- `.github/workflows/playwright-full.yml` (deleted)
- `laura-pwa/playwright.config.ts` (modified)
- `laura-pwa/tests/cards-invoices.spec.ts` (expanded)
- `laura-pwa/tests/rollover.spec.ts` (new)
- `laura-pwa/tests/banking.spec.ts` (new)
- `docs/HANDOFF.md` (seção Fase 17B)
- Memory `phase_17b_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dockerfile laura-go ou laura-pwa quebrado — build CI falha | Validar `docker compose -f docker-compose.ci.yml up -d --build` local antes de push |
| Seed E2E conflita com migration (email_verified, workspaces unique) | SQL idempotente (`ON CONFLICT DO NOTHING`); seed roda após `api-go` healthy (migrations já aplicadas) |
| bcrypt hash hardcoded desatualizado se senha mudar | Helper Go gera hash on-demand; testar e commitar hash junto com senha |
| Flakes intermitentes mesmo com retries 2 | Retain-on-failure trace/video → debug; se >5% flake rate, revisitar waits |
| Stack build + tests > timeout CI 25min | Playwright-full atual tem 25min timeout, já passou com 1min29s (mas era só list). Estimar 10-15min com stack real. Aumentar timeout se necessário |
| Rollover UI não existe ou muda estrutura | Seed via SQL direto + navegação GET; usar `page.goto` + assertion de texto simples, não flows complexos |
| `playwright.config.ts` `retries: 2` causa timeouts totais excessivos | Timeout per-test mantém 30s; CI total timeout 25min cobre 3× runs |

## Métricas de sucesso

- **Testes Playwright reais rodando em CI**: 0 → 16 atuais + 9 novos = 25 total.
- **Cobertura epics:** epic 8 0% → 2 testes; epic 9 (cards) 1 → 5 testes; banking 0% → 3 testes.
- **Retries config:** 0 → 2 em CI.
- **Artifacts:** playwright-report + JUnit + traces disponíveis em cada run.
