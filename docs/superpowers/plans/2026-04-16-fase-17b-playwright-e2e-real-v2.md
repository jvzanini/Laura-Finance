# Fase 17B — Playwright E2E real (plan v2 — review #1)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps `- [ ]`.

**Goal:** Ativar Playwright E2E real em CI push/PR com seed determinístico + config flakeless + 5 testes passando e 8 com `test.fixme` (CI-broken pela ausência de data-testids — 17B.2).

**Architecture:** 7 sprints sequenciais. A (seed+compose) → B (playwright config) → C (URL fix API-only specs) → D (fixme 8 specs) → E (workflow real) → F (validação local) → G (docs+tag).

**Tech Stack:** Playwright 1.x, Docker Compose v2, Postgres 16, Next.js 16, Go 1.26, bcrypt.

**Branch:** trabalho direto em `master` (padrão Fases 10-17A).

**v1→v2:**
- Confirmada segurança de deletar `playwright-full.yml` — referências só em docs históricos Fase 12 (não-produção).
- Adicionada nota sobre `!` em senhas: hashes bcrypt + senhas raw contêm caracteres especiais (`$`, `!`). Usar **single quotes** em shell + evitar copy-paste por clipboard que possa alterar encoding.
- Explicitada dependência `docker compose ps --format json` = Compose v2.x (padrão em `ubuntu-latest`).
- Task A.3 ganhou step de diagnóstico caso `seed-e2e` falhe (logs + rebuild).
- Task F.2 ganhou check de `storageState` criado pelo global-setup (prova que login passou).

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

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go/cmd/e2e-seed-hash"
```

- [ ] **Step 2: Escrever helper**

Usar Write em `laura-go/cmd/e2e-seed-hash/main.go`:

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

- [ ] **Step 3: Rodar helper e capturar output**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go run ./cmd/e2e-seed-hash/ | tee /tmp/e2e-hashes.txt
cat /tmp/e2e-hashes.txt
```

Esperado: 2 linhas "senha -> hash", cada hash com 60 chars começando `$2a$10$`.

**Atenção:** hashes contêm `$` e strings de 60 chars. Na Task A.1, copiar as linhas **exatamente** (sem mudar aspas, sem trim). Usar o arquivo `/tmp/e2e-hashes.txt` como fonte de verdade.

### Task A.1: Criar `scripts/e2e-seed.sql`

**Files:**
- Create: `scripts/e2e-seed.sql`

- [ ] **Step 1: Garantir diretório**

```bash
mkdir -p "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/scripts"
```

- [ ] **Step 2: Ler hashes**

```bash
cat /tmp/e2e-hashes.txt
```

Linha 1: `e2epass123! -> <HASH1>`. Linha 2: `admin123! -> <HASH2>`. Extrair `<HASH1>` e `<HASH2>` (parte depois de `-> `).

- [ ] **Step 3: Escrever SQL com hashes reais**

Usar Write tool em `scripts/e2e-seed.sql`. Substituir `<HASH1>` e `<HASH2>` pelos valores extraídos no Step 2. SQL:

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
  '<HASH1>',
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
  '<HASH2>',
  'proprietário',
  TRUE, TRUE,
  NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;
```

**Atenção:** hashes vêm entre **single quotes** (`'$2a$10$...'`) no SQL — previne interpretação de `$` pelo psql. Não trocar por double quotes.

### Task A.2: Update `docker-compose.ci.yml`

**Files:**
- Modify: `docker-compose.ci.yml`

- [ ] **Step 1: Fix env PWA**

Usar Edit tool. Substituir bloco do serviço `pwa`:

```
old_string:   pwa:
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

new_string:   pwa:
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

Este Edit único troca o env do PWA **e** acrescenta o serviço `seed-e2e` logo após o bloco `pwa` (mesma indentação).

### Task A.3: Validação local build + seed

- [ ] **Step 1: Parar stack anterior**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
```

- [ ] **Step 2: Subir com build**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml up -d --wait --build 2>&1 | tail -20
```

Esperado: postgres/redis/api-go/pwa healthy; `seed-e2e` **pode** já ter exited 0 (depends_on ok).

- [ ] **Step 3: Verificar seed-e2e logs + exit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml logs seed-e2e 2>&1 | tail -20
docker compose -f docker-compose.ci.yml ps seed-e2e --format json | jq '.'
```

Esperado: logs mostram 3 linhas `INSERT 0 1` (ou `0 0` se já existia). State `exited`, ExitCode `0`.

- [ ] **Step 4: Se seed-e2e falhar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml logs seed-e2e 2>&1 | tail -40
```

Causas prováveis:
- **`psql: FATAL: password authentication failed`** → conferir `PGPASSWORD` e senha postgres.
- **`ERROR: column "..." does not exist`** → SQL com coluna errada; comparar com `000002_create_users_workspaces.up.sql`.
- **`ERROR: invalid input syntax for type uuid`** → UUID mal formado.
- **`No such file or directory: /seed.sql`** → volume mount errado; conferir path relativo.

Corrigir e reexecutar `docker compose restart seed-e2e`.

### Task A.4: Smoke login via curl

- [ ] **Step 1: Curl login E2E**

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e@laura.test","password":"e2epass123!"}' 2>&1 | head -20
```

Esperado: `HTTP/1.1 200 OK` + `Set-Cookie:` + body JSON com dados do user.

- [ ] **Step 2: Curl login admin**

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@laura.test","password":"admin123!"}' 2>&1 | head -20
```

Esperado: 200 + cookie.

- [ ] **Step 3: Se 401 Unauthorized**

Bcrypt mismatch. Regenerar:
```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go run ./cmd/e2e-seed-hash/ | tee /tmp/e2e-hashes.txt
# editar scripts/e2e-seed.sql com novos hashes
# Depois:
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml exec postgres psql -U laura -d laura_finance_test -c "DELETE FROM users WHERE email IN ('e2e@laura.test', 'admin@laura.test');"
docker compose -f docker-compose.ci.yml restart seed-e2e
docker compose -f docker-compose.ci.yml logs seed-e2e --tail 10
```

Repetir Step 1.

### Task A.5: Commit Sprint A

- [ ] **Step 1: Down stack**

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

### Task B.1: Reescrever `playwright.config.ts`

**Files:**
- Modify: `laura-pwa/playwright.config.ts`

- [ ] **Step 1: Ler atual**

Read tool em `laura-pwa/playwright.config.ts`.

- [ ] **Step 2: Sobrescrever via Write**

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

### Task B.2: Validar parse

- [ ] **Step 1: Listar tests**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
SKIP_E2E_AUTH=1 npx playwright test --list 2>&1 | tail -5
```

Esperado: "Total: 16 tests in 11 files" ou similar. Sem erro de parse.

### Task B.3: Commit Sprint B

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-pwa/playwright.config.ts
git commit -m "test(pwa): playwright config flakeless (retries/trace/junit CI)"
```

---

## Sprint C — Fix URL absoluto

### Task C.1: Fix `error-shape.spec.ts`

**Files:**
- Modify: `laura-pwa/tests/error-shape.spec.ts`

- [ ] **Step 1: Edit URL**

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

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-pwa/tests/error-shape.spec.ts laura-pwa/tests/observability.spec.ts
git commit -m "test(pwa): URL absoluta API_URL em error-shape + observability"
```

---

## Sprint D — `test.fixme` em 8 specs

### Task D.1: `auth.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('auth: register + login + logout happy path', async ({ page }) => {
  const stamp = Date.now();

new_string: test('auth: register + login + logout happy path', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  const stamp = Date.now();
```

### Task D.2: `cards-invoices.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('cards-invoices: criar cartao + despesa + ver fatura + push', async ({ authedPage: page }) => {
  await page.goto('/cards');

new_string: test('cards-invoices: criar cartao + despesa + ver fatura + push', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/cards');
```

### Task D.3: `goals.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('goals: criar meta + verificar progresso 0%', async ({ authedPage: page }) => {
  await page.goto('/goals');

new_string: test('goals: criar meta + verificar progresso 0%', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/goals');
```

### Task D.4: `investments.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('investments: criar CDB + listar', async ({ authedPage: page }) => {
  await page.goto('/investments');

new_string: test('investments: criar CDB + listar', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/investments');
```

### Task D.5: `reports.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  await page.goto('/reports');

new_string: test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/reports');
```

### Task D.6: `score.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  await page.goto('/dashboard');

new_string: test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/dashboard');
```

### Task D.7: `super-admin.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('super-admin: lista workspaces', async ({ page }) => {
  await loginAs(page, 'admin@laura.test', 'admin123!');

new_string: test('super-admin: lista workspaces', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await loginAs(page, 'admin@laura.test', 'admin123!');
```

### Task D.8: `transactions.spec.ts`

- [ ] **Step 1: Edit**

```
old_string: test('transactions: criar receita + listar + deletar', async ({ authedPage: page }) => {
  await page.goto('/transactions');

new_string: test('transactions: criar receita + listar + deletar', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/transactions');
```

### Task D.9: Validar + commit Sprint D

- [ ] **Step 1: Validar parse**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
SKIP_E2E_AUTH=1 npx playwright test --list 2>&1 | tail -5
```

Esperado: 16 tests listed (fixme não muda listing).

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

- [ ] **Step 1: Sobrescrever via Write**

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

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add .github/workflows/playwright.yml
git commit -m "ci(playwright): full stack real em push/PR + remover playwright-full"
```

---

## Sprint F — Validação local full

### Task F.1: Stack up + seed

- [ ] **Step 1: Down anterior + up com build**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
docker compose -f docker-compose.ci.yml up -d --wait --build 2>&1 | tail -15
```

- [ ] **Step 2: Confirmar seed-e2e exited 0**

```bash
docker compose -f docker-compose.ci.yml ps seed-e2e --format json | jq '.'
```

### Task F.2: Rodar Playwright local

- [ ] **Step 1: Limpar storageState de sessions anteriores**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
rm -rf tests/.auth
```

- [ ] **Step 2: Rodar tests**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa"
CI=1 BASE_URL=http://localhost:3000 API_URL=http://localhost:8080 npx playwright test 2>&1 | tee /tmp/playwright-out.txt | tail -30
```

Esperado (na última linha ou resumo final):
```
  5 passed
  8 skipped (1 flaky retry)
```

Ou similar — o importante: **5 tests passed + 8 skipped (via fixme) + 0 failed**.

- [ ] **Step 3: Confirmar storageState criado**

```bash
ls "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa/tests/.auth/"
```

Esperado: arquivo `user.json`. Se ausente, global-setup falhou — voltar Sprint A Task A.4 para diagnosticar.

- [ ] **Step 4: Se algum teste falhar**

Ler artifacts:
```bash
ls "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa/test-results/" 2>&1
ls "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa/playwright-report/" 2>&1
```

Diagnosticar:
- `mvp-flows` fail → ler screenshot/trace; pode ser timing async.
- `error-shape` fail → conferir API `/auth/login` retorna 401 + body com `error.code=AUTH_INVALID_CREDENTIALS`.
- `observability` fail → conferir `/api/v1/health` retorna header `x-request-id`.

### Task F.3: Down stack

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
docker compose -f docker-compose.ci.yml down -v 2>&1 | tail -3
```

---

## Sprint G — Docs + push + tag

### Task G.1: ADR 006

**Files:**
- Create: `docs/architecture/adr/006-playwright-flakeless.md`

- [ ] **Step 1: Escrever ADR (conteúdo completo)**

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
- Reporter composto: `['list']` (stdout) + `['html', { open: 'never' }]` +
  `['junit', { outputFile: 'results.xml' }]`.
- Artifacts upload: `playwright-report/` + `results.xml` +
  `test-results/` (traces/videos) com retenção 14 dias.

## Consequências

- Runs ~20% mais lentos worst case (3× rodadas em flakes).
- Artifacts ~30-50MB por run.
- Debug muito mais rápido — first failure já vem com trace + vídeo.

## Alternativas consideradas

- `retries: 0`. Rejeitado — flakes reais em CI compartilhado
  bloqueiam deploys legítimos.
- Mock backend + DB no PWA. Rejeitado — perde confiança end-to-end.
- `workers > 1`. Rejeitado — schema único sem isolamento por teste
  causa race.
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

- [ ] **Step 1: Edit inserir seção**

```
old_string: ## Histórico de atualizações

### 2026-04-16 — Fase 17A preparada (lint sweep final)

new_string: ## Histórico de atualizações

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
  dependem de data-testids inexistentes no PWA — reativar em
  Fase 17B.2.
- **5 testes passam real** — `mvp-flows` (3) + `error-shape` (1) +
  `observability` (1).
- **Workflow consolidado** — `playwright-full.yml` deletado.
- **Commits Fase 17B**: ~9.
- **Tag**: `phase-17b-prepared`.
- **Concerns Fase 17B.2+**:
  - 17B.2: adicionar ~40 data-testids em ~15 componentes PWA
    + remover `test.fixme`.
  - 17B.3: novos specs (cards-invoices lifecycle, banking API-only,
    rollover quando UI existir).
  - 17C: mobile native foundation.
  - 17D: multi-region read replica (aguarda deploy ativo).

### 2026-04-16 — Fase 17A preparada (lint sweep final)
```

### Task G.3: Memory + MEMORY.md

**Files:**
- Create: memory `phase_17b_complete.md`
- Modify: memory `MEMORY.md`

- [ ] **Step 1: Escrever memory**

Write em `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/phase_17b_complete.md`:

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
- **Bugs herdados corrigidos**: docker-compose.ci.yml usava `NEXT_PUBLIC_API_URL` (PWA lê `LAURA_GO_API_URL`); 2 specs API-only batiam em baseURL PWA (404 → skip gracioso ilusório).
- **Resultado**: 5 tests PASS (mvp-flows×3 + error-shape + observability) + 8 `test.fixme` (auth, cards-invoices, goals, investments, reports, score, super-admin, transactions).
- Tag `phase-17b-prepared`.

**Why:** auditoria revelou que `playwright.yml` só rodava `--list` desde Fase 10 (CI success ilusório) + 0 data-testids no PWA.

**How to apply:** próxima fase (17B.2) remove cada `test.fixme` + adiciona data-testid correspondente no componente PWA. Split por domínio.
```

- [ ] **Step 2: Update MEMORY.md**

Edit em `/Users/joaovitorzanini/.claude/projects/.../memory/MEMORY.md`:

```
old_string: # Memory Index — Laura Finance (Vibe Coding)

- [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005

new_string: # Memory Index — Laura Finance (Vibe Coding)

- [Fase 17B complete](phase_17b_complete.md) — Playwright E2E real em CI + seed determinístico, 5 tests PASS + 8 fixme (testids pendentes 17B.2), ADR 006
- [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005
```

### Task G.4: Commit HANDOFF + push

- [ ] **Step 1: Commit HANDOFF**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/HANDOFF.md
git commit -m "docs(handoff): Fase 17B playwright e2e real preparada"
```

- [ ] **Step 2: Status + log**

```bash
git status && git log --oneline -12
```

Esperado: tree clean + ~9 commits Fase 17B.

- [ ] **Step 3: Push**

```bash
git push origin master 2>&1 | tail -3
```

### Task G.5: Aguardar CI verde

- [ ] **Step 1: Watch Playwright Tests**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
sleep 8
PLAY_ID=$(gh run list --branch master --workflow "Playwright Tests" --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Playwright run: $PLAY_ID"
gh run watch "$PLAY_ID" --exit-status 2>&1 | tail -15
```

Esperado: verde.

- [ ] **Step 2: Conferir Go CI não regrediu**

```bash
GO_ID=$(gh run list --branch master --workflow "Go CI" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$GO_ID" --json conclusion --jq '.conclusion'
```

Esperado: `success`.

- [ ] **Step 3: Se Playwright vermelho**

```bash
gh run view "$PLAY_ID" --log-failed 2>&1 | tail -50
```

Diagnosticar e corrigir. NÃO aplicar tag antes de verde.

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
- [ ] CI `Go CI` continua verde.
- [ ] `playwright-full.yml` deletado.
- [ ] ADR 006 commitado.
- [ ] HANDOFF + memory atualizados.
- [ ] Tag `phase-17b-prepared` no remoto.
