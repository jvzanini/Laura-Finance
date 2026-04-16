# Fase 17B — Playwright E2E real + smoke coverage (spec v3 FINAL — review #2)

**Base:** decomposição da "Fase 17 Quality Final Sweep". 17A (lint sweep) entregue em `phase-17a-prepared`. 17C (mobile native foundation) e 17D (multi-region read replica) ficam para fases subsequentes.

**v1→v2 — mudança de escopo material:**
Auditoria descobriu dois gaps que inviabilizam o escopo v1: (i) zero `data-testid` no PWA (8 specs nunca rodariam); (ii) rotas `/rollovers` e `/banking` não existem no PWA. Escopo revisado: infra CI real + `test.fixme` nos 8 specs dependentes; adicionar testids + novos specs fica para 17B.2/17B.3.

**v2→v3 (FINAL):**
- **Schema `users` real** confirmado em migration `000002_create_users_workspaces.up.sql`: tem coluna `name VARCHAR(255) NOT NULL` (faltava no SQL v2). Também tem `email_verified` (mig 000023) e `is_super_admin` (mig 000024). Coluna `email_verified_at` opcional — omitida (default NULL aceita).
- **Bug env var PWA:** `docker-compose.ci.yml` atual define `NEXT_PUBLIC_API_URL=http://api-go:8080`, mas o PWA lê `LAURA_GO_API_URL` em `src/lib/apiClient.ts:14`. **Server actions do PWA nunca chamaram a API Go via docker-compose CI** — bug herdado desde Fase 12 quando o compose CI foi criado. Fix incluído no escopo.
- **Bug URL em `error-shape.spec.ts` + `observability.spec.ts`:** `request.post('/api/v1/...')` resolve via `baseURL=http://localhost:3000` (PWA, não api-go) → 404 → `test.skip` gracioso. Nunca rodaram de verdade. Fix: usar `process.env.API_URL` absoluto.
- Migration 000024 seed automático do 1º user → super_admin: sem conflito (nosso seed explicitamente seta flags corretas).
- Estimativa timing CI full-stack revisada: 12-18min (build Docker images ~5min + stack up ~2min + tests 5 × 30s + overhead).
- Clarificação reporter JUnit path: `results.xml` relativo ao `working-directory: laura-pwa` = `laura-pwa/results.xml`.

## Contexto e motivação

Auditoria do estado real do E2E em **2026-04-16**:

| Ponto | Estado |
|---|---|
| Specs Playwright | **11 arquivos, 16 declarações `test(...)`** (HANDOFF Fase 10 desatualizado) |
| `playwright.yml` (push + PR) | **Roda apenas `npx playwright test --list`** (parse validation). Success recente é ilusório. |
| `playwright-full.yml` | Full stack real, mas só PR + `workflow_dispatch`. Nunca ativou em master. |
| `data-testid` no PWA | **0 matches** em `laura-pwa/src/` |
| Specs **sem** testid (CI-ready após fix URL) | `mvp-flows` (3), `error-shape` (1, URL broken), `observability` (1, URL broken) = **5 testes** |
| Specs **com** testid ausente (CI-broken) | `auth` (5 testids), `transactions` (7), `cards-invoices` (7), `goals` (6), `investments` (5), `reports` (2), `score` (2), `super-admin` (1) = **8 specs, 8 testes** |
| Seed E2E user | Nenhum no código. `global-setup.ts` falha o login sem seed. |
| `docker-compose.ci.yml` PWA | Env `NEXT_PUBLIC_API_URL` (errada — PWA lê `LAURA_GO_API_URL`) |
| Schema users | `name NOT NULL` + `email_verified` + `is_super_admin` + `role` default 'membro' |

## Objetivos

1. **Playwright CI real em push+PR** — `playwright.yml` reescrito para rodar `docker-compose.ci.yml` + `npx playwright test`. `playwright-full.yml` consolidado/removido.
2. **Seed E2E determinístico** — 2 usuários criados via SQL após `MIGRATE_ON_BOOT` bootar: `e2e@laura.test` (auth padrão) e `admin@laura.test` (`is_super_admin=TRUE`). Senhas bcrypt-hashed. 1 workspace. Script idempotente com coluna `name` obrigatória.
3. **docker-compose.ci.yml env fix** — trocar `NEXT_PUBLIC_API_URL` → `LAURA_GO_API_URL` no serviço `pwa`.
4. **Fix URL absoluto** em `error-shape.spec.ts` + `observability.spec.ts` para bater em `process.env.API_URL`.
5. **Config Playwright flakeless** — `retries: 2`, `workers: 1` CI, `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, reporter JUnit + HTML.
6. **8 specs com `test.fixme`** — mensagem `needs data-testid — Fase 17B.2`.
7. **5 testes CI-ready passam real** — mvp-flows (3) + error-shape corrigido (1) + observability corrigido (1).
8. **CI `Playwright Tests` verde** no push master final.
9. **ADR 006** — Playwright flakeless infra.
10. **HANDOFF + memory** atualizados, incluindo roadmap 17B.2 (testids) e 17B.3 (novos specs).
11. **Tag `phase-17b-prepared`.**

## Non-goals

- **Adicionar data-testids no PWA** — escopo de Fase 17B.2. ~40 testids em ~15 componentes.
- **Novos specs** (cards-invoices lifecycle, banking API-only, rollover) — Fase 17B.3 ou posterior.
- **Cross-browser matrix** — só chromium.
- **Mobile viewport tests** — Fase 17C.
- **Visual regression** — fora de escopo.

## Arquitetura

### 1. Seed E2E

**Script `scripts/e2e-seed.sql` (idempotente):**

```sql
-- scripts/e2e-seed.sql
-- Executado pelo serviço seed-e2e (docker-compose.ci.yml) após api-go healthy.
-- Requer migrations aplicadas (MIGRATE_ON_BOOT=true já cuida).

-- 1 workspace compartilhado
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2E Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- e2e user (senha: e2epass123!)
INSERT INTO users (id, workspace_id, name, email, password_hash, role, email_verified, is_super_admin, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'E2E User',
  'e2e@laura.test',
  '$2a$10$<BCRYPT_HASH_E2E>',
  'proprietário',
  TRUE, FALSE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;

-- admin user (senha: admin123!)
INSERT INTO users (id, workspace_id, name, email, password_hash, role, email_verified, is_super_admin, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'E2E Admin',
  'admin@laura.test',
  '$2a$10$<BCRYPT_HASH_ADMIN>',
  'proprietário',
  TRUE, TRUE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;
```

**Geração de bcrypt hashes:** helper Go `laura-go/cmd/e2e-seed-hash/main.go`:
```go
package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	for _, pw := range []string{"e2epass123!", "admin123!"} {
		h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s -> %s\n", pw, string(h))
	}
}
```

Rodar `go run ./cmd/e2e-seed-hash/` local uma vez, substituir placeholders `<BCRYPT_HASH_E2E>` e `<BCRYPT_HASH_ADMIN>` em `scripts/e2e-seed.sql`. Commitar ambos.

**Serviço `seed-e2e` no `docker-compose.ci.yml`:**

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

### 2. docker-compose.ci.yml env fix

**Antes (bug):**
```yaml
pwa:
  environment:
    NEXT_PUBLIC_API_URL: http://api-go:8080
```

**Depois:**
```yaml
pwa:
  environment:
    LAURA_GO_API_URL: http://api-go:8080
    NEXT_PUBLIC_BUILD_SHA: ci
    SESSION_SECRET: ci-secret-not-real-32bytes-padding-x
    # manter NEXT_PUBLIC_API_URL apenas se client-side JS usar (atual: não)
```

**Nota:** `SESSION_SECRET` idêntico ao do api-go — PWA precisa pra assinar sessões HMAC (referencia `laura-pwa/src/lib/session.ts`). Hoje o compose não seta isso no pwa; se o PWA tentar assinar sem, crasha server actions.

### 3. Fix URL absoluto nos 2 specs

**`error-shape.spec.ts`:**
```ts
import { test, expect } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:8080";

test("login com credencial invalida retorna error shape canonico", async ({ request }) => {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: "x@x", password: "bad" },
  }).catch(() => null);
  // ... resto mantido
});
```

**`observability.spec.ts`:** mesmo padrão, `${API}/api/v1/health` absoluto.

### 4. Playwright config

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

### 5. Workflows

**`playwright.yml` reescrito (substitui conteúdo atual):**

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
    timeout-minutes: 30
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
      - name: Start full stack
        working-directory: ${{ github.workspace }}
        run: docker compose -f docker-compose.ci.yml up -d --wait --build
      - name: Wait for seed-e2e completion
        working-directory: ${{ github.workspace }}
        run: |
          for i in {1..30}; do
            state=$(docker compose -f docker-compose.ci.yml ps seed-e2e --format json | jq -r '.[0].State // empty')
            echo "seed-e2e state: $state"
            if [ "$state" = "exited" ]; then
              exit_code=$(docker compose -f docker-compose.ci.yml ps seed-e2e --format json | jq -r '.[0].ExitCode')
              if [ "$exit_code" = "0" ]; then exit 0; fi
              echo "seed-e2e failed with exit $exit_code"; exit 1
            fi
            sleep 2
          done
          echo "seed-e2e did not complete in 60s"; exit 1
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

**`playwright-full.yml`:** `git rm`.

### 6. `test.fixme` em specs com testids ausentes

Em cada um dos 8 specs, adicionar linha como **primeira instrução do body do test**:

```ts
test('nome do test', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  // corpo original mantido, NÃO remover
});
```

Alternativa mais limpa: `test.fixme('nome', ...)` ao nível do `test()` function call. Mas a assinatura `test.fixme(condition, reason)` dentro do body é oficial e mantém histórico `git blame` mais granular.

Arquivos-alvo (8):
- `auth.spec.ts`
- `cards-invoices.spec.ts`
- `goals.spec.ts`
- `investments.spec.ts`
- `reports.spec.ts`
- `score.spec.ts`
- `super-admin.spec.ts`
- `transactions.spec.ts`

### 7. ADR 006 — Playwright flakeless

`docs/architecture/adr/006-playwright-flakeless.md`:
- **Contexto:** CI E2E real habilita full stack. Flakes em schema compartilhado + timing exigem retries + traces.
- **Decisão:** `retries: 2` em CI, `workers: 1`, `trace/video: 'retain-on-failure'`, reporter JUnit + HTML.
- **Consequências:** runs ~20% mais lentos worst case, artifacts ~50MB, debug muito mais rápido quando flakea.
- **Alternativas:** retries=0 (rejeitado); mock agressivo (rejeitado).

## Ordem de execução

1. **Sprint A — Seed infra**:
   - A.0 Criar `laura-go/cmd/e2e-seed-hash/main.go` + gerar hashes.
   - A.1 `scripts/e2e-seed.sql` com hashes reais.
   - A.2 Update `docker-compose.ci.yml`: trocar `NEXT_PUBLIC_API_URL` → `LAURA_GO_API_URL` + add `SESSION_SECRET` + add serviço `seed-e2e`.
   - A.3 Validação local: `docker compose -f docker-compose.ci.yml up -d --wait --build` + `docker compose ps seed-e2e` → `exited (0)`.
   - A.4 Smoke login: `curl -X POST http://localhost:8080/api/v1/auth/login -d '{"email":"e2e@laura.test","password":"e2epass123!"}' -H 'Content-Type: application/json'` → 200 + cookie.
   - A.5 Commit.
2. **Sprint B — Playwright config flakeless** (playwright.config.ts + commit).
3. **Sprint C — Fix URL absoluto** em error-shape + observability (commit).
4. **Sprint D — `test.fixme` em 8 specs** (commit).
5. **Sprint E — Workflow consolidation** (playwright.yml rewrite + delete playwright-full.yml + commit).
6. **Sprint F — Validação local full**: `docker compose up -d --wait --build` + `CI=1 BASE_URL=http://localhost:3000 API_URL=http://localhost:8080 npx playwright test` → 5 PASS + 8 skipped.
7. **Sprint G — ADR 006 + HANDOFF + memory + push + aguardar CI verde + tag**.

## Critérios de aceite

- [ ] `docker compose -f docker-compose.ci.yml up -d --wait --build` local sobe stack healthy (postgres, redis, api-go, pwa, seed-e2e `exited (0)`).
- [ ] `curl` login `e2e@laura.test` retorna 200.
- [ ] `CI=1 npx playwright test` local: **5 passed, 8 skipped (fixme)**.
- [ ] `playwright.yml` push/PR roda full stack (não `--list`).
- [ ] CI `Playwright Tests` verde no push master final.
- [ ] Artifacts `playwright-report/` + `results.xml` + `test-results/` presentes.
- [ ] `playwright-full.yml` deletado.
- [ ] ADR 006 commitado.
- [ ] HANDOFF seção 17B + roadmap 17B.2 (testids) + 17B.3 (new specs).
- [ ] Memory `phase_17b_complete.md` gravada.
- [ ] Tag `phase-17b-prepared` no remoto.

## STANDBYs

Nenhum novo.

## Documentação entregável

- `docs/architecture/adr/006-playwright-flakeless.md` (novo)
- `scripts/e2e-seed.sql` (novo)
- `laura-go/cmd/e2e-seed-hash/main.go` (novo)
- `docker-compose.ci.yml` (modified: env pwa + seed-e2e service)
- `.github/workflows/playwright.yml` (rewritten)
- `.github/workflows/playwright-full.yml` (deleted)
- `laura-pwa/playwright.config.ts` (modified)
- `laura-pwa/tests/error-shape.spec.ts` (URL absoluta)
- `laura-pwa/tests/observability.spec.ts` (URL absoluta)
- `laura-pwa/tests/{auth,cards-invoices,goals,investments,reports,score,super-admin,transactions}.spec.ts` (+ `test.fixme`)
- `docs/HANDOFF.md` (Fase 17B section)
- Memory `phase_17b_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dockerfile laura-go ou laura-pwa quebrado — build CI falha | Sprint A.3 valida localmente antes de push. laura-pwa Dockerfile existe, já rodou em Fase 12. |
| Seed E2E conflita com schema (unique, FK) | SQL `ON CONFLICT DO NOTHING` + IDs explícitos + seed depois de `api-go healthy`. Colunas confirmadas em migration 000002+023+024. |
| bcrypt hash inválido / cost mismatch | Helper Go gera com `bcrypt.DefaultCost=10`. Login API não distingue cost (bcrypt auto-detecta). Smoke Sprint A.4 confirma. |
| `mvp-flows` flaky em CI full stack | Retries 2 amortiza; traces retidos em failure. |
| Docker compose build > timeout 30min | Timeout 30min; estimativa 12-18min. Se extrapolar, investigar cache npm/Go. |
| `global-setup` timeout 30s pro api-go healthy | Seed-e2e `depends_on api-go:service_healthy` + wait step no workflow já cobre. Se healthcheck api-go retry=20 × 5s = 100s, pode estourar. Mitigação: aumentar `deadline` em global-setup para 60s. |
| PWA server action crash sem `SESSION_SECRET` | Incluído no docker-compose.ci.yml. |
| NEXT_PUBLIC build-time inlining — mudar LAURA_GO_API_URL em runtime não afeta JS bundle | `LAURA_GO_API_URL` é server-side only (não `NEXT_PUBLIC_*`). OK. |
| migration 000024 auto-seed "primeiro user super_admin" conflita | Não conflita: migrations rodam antes do seed-e2e (via MIGRATE_ON_BOOT); banco vazio → UPDATE não seleciona ninguém. Nosso seed explicitamente seta flags. |
| Workflow `wait for seed-e2e` com jq não instalado | Runners ubuntu-latest têm jq pré-instalado. |

## Métricas de sucesso

- **Testes Playwright rodando de verdade em CI push/PR**: 0 → 5 PASS + 8 fixme (skip explícito).
- **Retries CI:** 0 → 2.
- **Artifacts:** playwright-report + JUnit + traces/videos por run.
- **Bugs de infra corrigidos:** `NEXT_PUBLIC_API_URL` → `LAURA_GO_API_URL`, URL absoluta em 2 specs API-only, `SESSION_SECRET` no PWA container.
- **Roadmap 17B.2/17B.3 documentado** no HANDOFF.
