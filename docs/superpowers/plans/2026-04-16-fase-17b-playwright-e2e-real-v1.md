# Fase 17B — Playwright E2E real (plan v1)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps `- [ ]`.

**Goal:** Ativar Playwright E2E real em CI push/PR com seed determinístico + config flakeless + 5 testes passando e 8 com `test.fixme` (CI-broken pela ausência de data-testids — 17B.2).

**Architecture:** 7 sprints sequenciais. A (seed+compose) → B (playwright config) → C (URL fix API-only specs) → D (fixme 8 specs) → E (workflow real) → F (validação local) → G (docs+tag).

**Tech Stack:** Playwright 1.x, Docker Compose, Postgres 16, Next.js 16, Go 1.26, bcrypt.

**Branch:** trabalho direto em `master` (padrão Fases 10-17A).

---

## File Structure

| Arquivo | Motivo |
|---|---|
| `laura-go/cmd/e2e-seed-hash/main.go` | Novo — helper gerar bcrypt hashes |
| `scripts/e2e-seed.sql` | Novo — seed idempotente users+workspace |
| `docker-compose.ci.yml` | Modify — env fix `LAURA_GO_API_URL` + `SESSION_SECRET` + serviço `seed-e2e` |
| `laura-pwa/playwright.config.ts` | Modify — retries/workers CI, trace/video retain-on-failure, JUnit+HTML reporter |
| `laura-pwa/tests/error-shape.spec.ts` | Modify — URL absoluta via `API_URL` |
| `laura-pwa/tests/observability.spec.ts` | Modify — URL absoluta via `API_URL` |
| `laura-pwa/tests/auth.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/cards-invoices.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/goals.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/investments.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/reports.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/score.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/super-admin.spec.ts` | Modify — `test.fixme` |
| `laura-pwa/tests/transactions.spec.ts` | Modify — `test.fixme` |
| `.github/workflows/playwright.yml` | Rewrite — full stack real |
| `.github/workflows/playwright-full.yml` | Delete — consolidado em playwright.yml |
| `docs/architecture/adr/006-playwright-flakeless.md` | Novo |
| `docs/HANDOFF.md` | Modify — seção Fase 17B |
| Memory `phase_17b_complete.md` + `MEMORY.md` | Novo/update |

---

## Sprint A — Seed E2E infra

### Task A.0: Helper `e2e-seed-hash`

**Files:**
- Create: `laura-go/cmd/e2e-seed-hash/main.go`

- [ ] **Step 1: Criar diretório e arquivo**

```bash
mkdir -p "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go/cmd/e2e-seed-hash"
```

Usar Write tool em `laura-go/cmd/e2e-seed-hash/main.go`:

```go
// Helper CLI para gerar bcrypt hashes das senhas de seed E2E.
// Uso: go run ./cmd/e2e-seed-hash/
// Output: linhas "senha -> $2a$10$..." para colar em scripts/e2e-seed.sql.
package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	passwords := []string{"e2epass123!", "admin123!"}
	for _, pw := range passwords {
		h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s -> %s\n", pw, string(h))
	}
}
```

- [ ] **Step 2: Rodar helper e guardar output**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go run ./cmd/e2e-seed-hash/ | tee /tmp/e2e-hashes.txt
```

Esperado: 2 linhas, cada uma com hash `$2a$10$...` de 60 chars.

### Task A.1: Criar `scripts/e2e-seed.sql` com hashes reais

**Files:**
- Create: `scripts/e2e-seed.sql`

- [ ] **Step 1: Garantir diretório**

```bash
mkdir -p "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/scripts"
```

- [ ] **Step 2: Ler hashes do tmp**

```bash
cat /tmp/e2e-hashes.txt
```

Coletar as duas linhas. Linha 1 = hash de `e2epass123!`, linha 2 = hash de `admin123!`.

- [ ] **Step 3: Escrever SQL**

Usar Write tool em `scripts/e2e-seed.sql` com conteúdo:

```sql
-- scripts/e2e-seed.sql
-- Executado pelo serviço seed-e2e (docker-compose.ci.yml) após
-- api-go ficar healthy. Idempotente (ON CONFLICT DO NOTHING).
-- Requer migrations aplicadas via MIGRATE_ON_BOOT=true.

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
  '<HASH_E2E_DO_STEP_2>',
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
  '<HASH_ADMIN_DO_STEP_2>',
  'proprietário',
  TRUE, TRUE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;
```

Substituir `<HASH_E2E_DO_STEP_2>` e `<HASH_ADMIN_DO_STEP_2>` pelos valores reais do Step 2.

### Task A.2: Update `docker-compose.ci.yml`

**Files:**
- Modify: `docker-compose.ci.yml`

- [ ] **Step 1: Corrigir env PWA**

Usar Edit tool. Substituir bloco do serviço `pwa`:

```yaml
  pwa:
    build:
      context: ./laura-pwa
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://api-go:8080
      NEXT_PUBLIC_BUILD_SHA: ci
    depends_on:
      api-go:
        condition: service_healthy
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 5s
      timeout: 3s
      retries: 20
```

Por (Edit `old_string` → `new_string`):

```yaml
  pwa:
    build:
      context: ./laura-pwa
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      LAURA_GO_API_URL: http://api-go:8080
      SESSION_SECRET: ci-secret-not-real-32bytes-padding-x
      NEXT_PUBLIC_BUILD_SHA: ci
    depends_on:
      api-go:
        condition: service_healthy
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 5s
      timeout: 3s
      retries: 20
```

- [ ] **Step 2: Adicionar serviço `seed-e2e` ao final do compose**

Usar Edit — acrescentar antes do fim do arquivo (nova entrada depois do serviço `pwa`):

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

### Task A.3: Validação local build + seed

- [ ] **Step 1: Parar stack anterior se houver**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -5
```

- [ ] **Step 2: Subir stack com build**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml up -d --wait --build 2>&1 | tail -20
```

Esperado: todos os serviços healthy. `seed-e2e` pode já ter exited com código 0.

- [ ] **Step 3: Verificar seed-e2e completou com sucesso**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml logs seed-e2e 2>&1 | tail -20
docker compose -f docker-compose.ci.yml ps seed-e2e --format json
```

Esperado: logs mostram 3 linhas `INSERT 0 1` (workspaces, user e2e, user admin) OU `INSERT 0 0` se já existia. State `exited` com ExitCode `0`.

### Task A.4: Smoke login via curl

- [ ] **Step 1: Curl login E2E**

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e@laura.test","password":"e2epass123!"}' 2>&1 | head -20
```

Esperado: `HTTP/1.1 200 OK` + header `Set-Cookie` + body JSON com dados do user.

- [ ] **Step 2: Curl login admin**

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@laura.test","password":"admin123!"}' 2>&1 | head -20
```

Esperado: 200 + cookie.

- [ ] **Step 3: Se 401 (unauthorized)**

Investigar hash bcrypt — pode ter charcter problemático ao copiar. Regenerar Task A.0 Step 2 + repetir seed:
```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml restart seed-e2e
docker compose -f docker-compose.ci.yml logs seed-e2e --tail 20
```

### Task A.5: Commit Sprint A

- [ ] **Step 1: Stop stack (liberar recursos)**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/cmd/e2e-seed-hash/main.go scripts/e2e-seed.sql docker-compose.ci.yml
git commit -m "feat(e2e): seed determinístico + fix env LAURA_GO_API_URL no compose"
```

---

## Sprint B — Playwright config flakeless

### Task B.1: Atualizar `playwright.config.ts`

**Files:**
- Modify: `laura-pwa/playwright.config.ts`

- [ ] **Step 1: Ler atual**

Read tool em `laura-pwa/playwright.config.ts`.

- [ ] **Step 2: Sobrescrever com Write**

```ts
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

### Task B.2: Validar parse da config

- [ ] **Step 1: Listar tests (sem rodar)**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
SKIP_E2E_AUTH=1 npx playwright test --list 2>&1 | tail -5
```

Esperado: 16 tests listed (mvp-flows 3 + outros 13 testes). Sem erro de parse.

### Task B.3: Commit Sprint B

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-pwa/playwright.config.ts
git commit -m "test(pwa): playwright config flakeless (retries/trace/junit CI)"
```

---

## Sprint C — Fix URL absoluto nos 2 specs

### Task C.1: Fix `error-shape.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/error-shape.spec.ts`

- [ ] **Step 1: Edit URL**

Usar Edit tool:

```
old_string: import { test, expect } from "@playwright/test";

test("login com credencial invalida retorna error shape canonico", async ({ request }) => {
  const res = await request.post("/api/v1/auth/login", {
    data: { email: "x@x", password: "bad" },
  }).catch(() => null);

new_string: import { test, expect } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:8080";

test("login com credencial invalida retorna error shape canonico", async ({ request }) => {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: "x@x", password: "bad" },
  }).catch(() => null);
```

### Task C.2: Fix `observability.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/observability.spec.ts`

- [ ] **Step 1: Edit URL**

Usar Edit:

```
old_string: import { test, expect } from "@playwright/test";

test("X-Request-Id header presente em responses /api/v1", async ({ request }) => {
  // Smoke contra healthcheck publico — nao requer auth.
  const res = await request.get("/api/v1/health").catch(() => null);

new_string: import { test, expect } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:8080";

test("X-Request-Id header presente em responses /api/v1", async ({ request }) => {
  // Smoke contra healthcheck publico — nao requer auth.
  const res = await request.get(`${API}/api/v1/health`).catch(() => null);
```

### Task C.3: Commit Sprint C

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-pwa/tests/error-shape.spec.ts laura-pwa/tests/observability.spec.ts
git commit -m "test(pwa): URL absoluta API_URL em error-shape + observability"
```

---

## Sprint D — `test.fixme` em 8 specs

### Task D.1: `test.fixme` em `auth.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/auth.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('auth: register + login + logout happy path', async ({ page }) => {
  const stamp = Date.now();

new_string: test('auth: register + login + logout happy path', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  const stamp = Date.now();
```

### Task D.2: `test.fixme` em `cards-invoices.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/cards-invoices.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('cards-invoices: criar cartao + despesa + ver fatura + push', async ({ authedPage: page }) => {
  await page.goto('/cards');

new_string: test('cards-invoices: criar cartao + despesa + ver fatura + push', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/cards');
```

### Task D.3: `test.fixme` em `goals.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/goals.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('goals: criar meta + verificar progresso 0%', async ({ authedPage: page }) => {
  await page.goto('/goals');

new_string: test('goals: criar meta + verificar progresso 0%', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/goals');
```

### Task D.4: `test.fixme` em `investments.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/investments.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('investments: criar CDB + listar', async ({ authedPage: page }) => {
  await page.goto('/investments');

new_string: test('investments: criar CDB + listar', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/investments');
```

### Task D.5: `test.fixme` em `reports.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/reports.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  await page.goto('/reports');

new_string: test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/reports');
```

### Task D.6: `test.fixme` em `score.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/score.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  await page.goto('/dashboard');

new_string: test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/dashboard');
```

### Task D.7: `test.fixme` em `super-admin.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/super-admin.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('super-admin: lista workspaces', async ({ page }) => {
  await loginAs(page, 'admin@laura.test', 'admin123!');

new_string: test('super-admin: lista workspaces', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await loginAs(page, 'admin@laura.test', 'admin123!');
```

### Task D.8: `test.fixme` em `transactions.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/transactions.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('transactions: criar receita + listar + deletar', async ({ authedPage: page }) => {
  await page.goto('/transactions');

new_string: test('transactions: criar receita + listar + deletar', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/transactions');
```

### Task D.9: Validar + commit Sprint D

- [ ] **Step 1: Confirmar parse**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
SKIP_E2E_AUTH=1 npx playwright test --list 2>&1 | tail -5
```

Esperado: 16 tests listed OK (fixme não afeta listing).

- [ ] **Step 2: Commit combinado**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-pwa/tests/auth.spec.ts \
        laura-pwa/tests/cards-invoices.spec.ts \
        laura-pwa/tests/goals.spec.ts \
        laura-pwa/tests/investments.spec.ts \
        laura-pwa/tests/reports.spec.ts \
        laura-pwa/tests/score.spec.ts \
        laura-pwa/tests/super-admin.spec.ts \
        laura-pwa/tests/transactions.spec.ts
git commit -m "test(pwa): fixme nos 8 specs que dependem de data-testid (Fase 17B.2)"
```

---

## Sprint E — Workflow consolidation

### Task E.1: Reescrever `playwright.yml`

**Files:**
- Modify: `.github/workflows/playwright.yml`

- [ ] **Step 1: Sobrescrever com Write**

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
              echo "seed-e2e failed with exit $exit_code"
              docker compose -f docker-compose.ci.yml logs seed-e2e
              exit 1
            fi
            sleep 2
          done
          echo "seed-e2e did not complete in 60s"
          docker compose -f docker-compose.ci.yml logs seed-e2e
          exit 1
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

### Task E.2: Deletar `playwright-full.yml`

- [ ] **Step 1: Delete**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git rm .github/workflows/playwright-full.yml
```

### Task E.3: Commit Sprint E

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add .github/workflows/playwright.yml
git commit -m "ci(playwright): full stack real em push/PR + remover playwright-full"
```

---

## Sprint F — Validação local full

### Task F.1: Stack up + seed

- [ ] **Step 1: Subir stack**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
docker compose -f docker-compose.ci.yml up -d --wait --build 2>&1 | tail -15
```

Esperado: todos healthy; `seed-e2e` exited 0.

- [ ] **Step 2: Confirmar seed-e2e exited 0**

```bash
docker compose -f docker-compose.ci.yml ps seed-e2e --format json | jq '.'
```

Esperado: `"State": "exited"`, `"ExitCode": 0`.

### Task F.2: Rodar Playwright local

- [ ] **Step 1: Rodar tests com CI=1**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
CI=1 BASE_URL=http://localhost:3000 API_URL=http://localhost:8080 npx playwright test 2>&1 | tail -20
```

Esperado: 
```
  5 passed
  8 skipped
```

(ou 13 total reported com 5 PASS + 8 skipped).

- [ ] **Step 2: Se algum dos 5 falhar**

Ler trace/screenshot artifact:
```bash
ls laura-pwa/test-results/ 2>&1
ls laura-pwa/playwright-report/ 2>&1
```

Diagnosticar caso-a-caso:
- `mvp-flows` fail: possivelmente timeout do wait-healthy — aumentar deadline em global-setup.
- `error-shape` fail: request 401 chegou? Verificar body.error.code.
- `observability` fail: header X-Request-Id presente? Verificar middleware laura-go.

### Task F.3: Down stack

- [ ] **Step 1: Parar stack**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
```

---

## Sprint G — Docs + push + tag

### Task G.1: ADR 006

**Files:**
- Create: `docs/architecture/adr/006-playwright-flakeless.md`

- [ ] **Step 1: Escrever ADR**

Write tool:

```markdown
# ADR 006 — Playwright E2E flakeless infra

**Data:** 2026-04-16
**Status:** ACEITO (Fase 17B).

## Contexto

Fase 17B ativa Playwright E2E real em CI push/PR (substitui
validação apenas `--list`). Stack full com Postgres + Redis + Go
API + Next.js PWA + seed introduz pontos de flake: timing de
schema compartilhado, network containers, SSR carregando async.

## Decisão

- `retries: 2` em CI (não em local dev).
- `workers: 1` em CI (evita race em schema single-tenant compartilhado).
- `trace: 'retain-on-failure'` + `video: 'retain-on-failure'` —
  debugger completo em cada falha.
- Reporter composto: `['list']` (log stdout) + `['html', { open: 'never' }]`
  (report interativo) + `['junit', { outputFile: 'results.xml' }]`
  (CI annotations + histórico).
- Artifacts upload: `playwright-report/` + `results.xml` +
  `test-results/` (traces/videos) com retenção 14 dias.

## Consequências

- Runs ~20% mais lentos worst case (3× rodadas em flakes).
- Artifacts ~30-50MB por run (traces grandes).
- Debug muito mais rápido — first failure já vem com trace +
  vídeo em vez de só stacktrace.

## Alternativas consideradas

- `retries: 0`. Rejeitado — flakes reais em CI compartilhado
  vão bloquear deploys legítimos.
- Mock mais agressivo (backend + DB mocks no PWA). Rejeitado —
  perde confiança end-to-end.
- `workers > 1`. Rejeitado — schema único sem isolamento por
  teste causa race em INSERT/UPDATE.
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/architecture/adr/006-playwright-flakeless.md
git commit -m "docs(adr): ADR 006 Playwright flakeless infra aceito"
```

### Task G.2: Atualizar `HANDOFF.md`

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Inserir seção após "Histórico de atualizações"**

Usar Edit tool para inserir bloco logo abaixo do header, antes da entrada Fase 17A:

```markdown
### 2026-04-16 — Fase 17B preparada (Playwright E2E real + smoke)

- **Playwright CI real** — `playwright.yml` reescrito para rodar
  `docker-compose.ci.yml` full stack (postgres + redis + api-go + pwa
  + seed-e2e) + `npx playwright test`. Fim da ilusão de `--list`.
- **Seed E2E determinístico** — `scripts/e2e-seed.sql` + serviço
  `seed-e2e` no compose. 2 users (`e2e@laura.test`, `admin@laura.test`
  super_admin=TRUE) + 1 workspace. Bcrypt hashes gerados via helper
  `laura-go/cmd/e2e-seed-hash/`.
- **Bugs herdados corrigidos:** (i) `docker-compose.ci.yml` env PWA
  trocado de `NEXT_PUBLIC_API_URL` (não lido) para `LAURA_GO_API_URL`
  (correto) + adicionado `SESSION_SECRET`; (ii) `error-shape.spec.ts`
  e `observability.spec.ts` usavam `request.post('/api/v1/...')` via
  `baseURL=http://localhost:3000` (PWA, 404). Fix: URL absoluta
  `${API_URL}/api/v1/...`.
- **Playwright config flakeless** — `retries: 2` CI, `workers: 1`,
  `trace/video: 'retain-on-failure'`, reporter JUnit + HTML (ADR 006).
- **8 specs com `test.fixme`** — auth, cards-invoices, goals,
  investments, reports, score, super-admin, transactions. Todos
  dependem de data-testids inexistentes no código PWA — reativar em
  Fase 17B.2.
- **5 testes passam real** — `mvp-flows` (3) + `error-shape` (1) +
  `observability` (1). Validado local + CI.
- **Workflow consolidado** — `playwright-full.yml` deletado.
- **Commits Fase 17B**: ~7.
- **Tag**: `phase-17b-prepared`.
- **Concerns Fase 17B.2+**:
  - 17B.2: adicionar ~40 data-testids em ~15 componentes PWA
    (auth/input, cards, goals, investments, transactions, reports
    tabs, score gauge, admin list) + remover `test.fixme` + tests
    todos rodando real no CI.
  - 17B.3: novos specs (cards-invoices lifecycle expanded,
    banking API-only com STANDBYs, talvez rollover se UI for
    criada).
  - 17C: mobile native foundation.
  - 17D: multi-region read replica (aguarda deploy ativo).
```

### Task G.3: Memory + MEMORY.md

**Files:**
- Create: `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/phase_17b_complete.md`
- Modify: `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/MEMORY.md`

- [ ] **Step 1: Escrever memory**

Write em `phase_17b_complete.md`:

```markdown
---
name: phase_17b_complete
description: Fase 17B (Playwright E2E real) preparada 2026-04-16 com CI full stack + seed E2E + 5 tests PASS + 8 fixme
type: project
---

Fase 17B entregue em 2026-04-16. Playwright E2E real em CI push/PR:

- **Seed E2E determinístico** — `scripts/e2e-seed.sql` (2 users + 1 workspace, idempotente, bcrypt via `cmd/e2e-seed-hash/`).
- **Workflow consolidado** — `playwright.yml` sobe `docker-compose.ci.yml` full stack (postgres/redis/api-go/pwa/seed-e2e) + `npx playwright test`. `playwright-full.yml` deletado.
- **Config flakeless** — retries 2 CI, workers 1 CI, trace/video retain-on-failure, reporter JUnit + HTML (ADR 006).
- **Bugs herdados corrigidos**: docker-compose.ci.yml usava `NEXT_PUBLIC_API_URL` (não lido pelo PWA — usa `LAURA_GO_API_URL`); 2 specs API-only batiam em baseURL PWA (404 → skip gracioso ilusório). Todos corrigidos.
- **Resultado**: 5 tests PASS (mvp-flows×3 + error-shape + observability) + 8 `test.fixme` (auth, cards-invoices, goals, investments, reports, score, super-admin, transactions — dependem de data-testids que não existem no PWA).
- Tag `phase-17b-prepared`.

**Why:** auditoria descobriu que `playwright.yml` só rodava `--list` desde Fase 10 (CI success ilusório). Data-testids nunca foram adicionados no PWA — 8 specs nunca passariam no CI real. Fase 17B entrega infra + cobertura honesta; 17B.2 adiciona testids.

**How to apply:** próxima fase (17B.2) remove cada `test.fixme` + adiciona data-testid correspondente no componente PWA. Split por domínio (auth, transactions, goals, investments, cards, reports, score, super-admin).
```

- [ ] **Step 2: Update MEMORY.md**

Usar Edit tool para adicionar linha no MEMORY.md:

```
old_string: # Memory Index — Laura Finance (Vibe Coding)

- [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005

new_string: # Memory Index — Laura Finance (Vibe Coding)

- [Fase 17B complete](phase_17b_complete.md) — Playwright E2E real em CI + seed determinístico, 5 tests PASS + 8 fixme (testids pendentes 17B.2), ADR 006
- [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005
```

### Task G.4: Commit HANDOFF + Push

- [ ] **Step 1: Commit HANDOFF**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/HANDOFF.md
git commit -m "docs(handoff): Fase 17B playwright e2e real preparada"
```

- [ ] **Step 2: Status limpo + log**

```bash
git status && git log --oneline -15
```

Esperado: clean tree, ~8 commits Fase 17B.

- [ ] **Step 3: Push**

```bash
git push origin master 2>&1 | tail -3
```

### Task G.5: Aguardar CI verde

- [ ] **Step 1: Watch Go CI + Playwright**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
sleep 8
PLAY_ID=$(gh run list --branch master --workflow "Playwright Tests" --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Playwright run: $PLAY_ID"
gh run watch "$PLAY_ID" --exit-status 2>&1 | tail -15
```

Esperado: verde.

- [ ] **Step 2: Se vermelho**

Ler logs:
```bash
gh run view "$PLAY_ID" --log-failed 2>&1 | tail -40
```

Diagnosticar e corrigir. NÃO aplicar tag antes de verde.

- [ ] **Step 3: Validar coverage merged continua ≥30% (Go CI herdado)**

```bash
GO_ID=$(gh run list --branch master --workflow "Go CI" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$GO_ID" --log 2>&1 | grep -E "merged coverage" | tail -3
```

Esperado: `merged coverage: >=30%`.

### Task G.6: Aplicar tag

- [ ] **Step 1: Tag**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git tag phase-17b-prepared
git push origin phase-17b-prepared
git tag --list "phase-17b*"
```

Esperado: `phase-17b-prepared` local + remoto.

---

## Critérios globais de conclusão

- [ ] `docker compose -f docker-compose.ci.yml up -d --wait --build` local OK.
- [ ] `seed-e2e` exited 0, `curl login` retorna 200.
- [ ] `CI=1 npx playwright test` local: 5 passed + 8 skipped.
- [ ] CI `Playwright Tests` verde no push master.
- [ ] CI `Go CI` continua verde (coverage ≥30%).
- [ ] `playwright-full.yml` deletado.
- [ ] ADR 006 commitado.
- [ ] HANDOFF + memory atualizados.
- [ ] Tag `phase-17b-prepared` no remoto.
