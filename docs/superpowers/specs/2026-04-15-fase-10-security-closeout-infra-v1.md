# Fase 10 — Security closeout + infraestrutura mínima de produção (Spec v1)

> Versão: v1 (rascunho inicial)
> Autor: agente autônomo
> Data: 2026-04-15
> Status: rascunho — será revisado em v2 e v3 antes da execução
> Projeto: Laura Finance (Vibe Coding)
> Fases anteriores: Epics 1-9 (MVP) + Super Admin Panel concluídos

---

## 1. Objetivo

Encerrar a trilha de "security hardening" pendente desde os Epics 8/9 e disponibilizar
a infraestrutura mínima necessária para colocar o Laura Finance em produção
pela primeira vez, de ponta a ponta, com pipeline automatizado (CI/CD),
observabilidade básica, secrets gerenciados, cobertura E2E razoável e
documentação operacional.

Em termos concretos, ao final da Fase 10 o projeto deve estar em um estado no
qual:

1. O histórico Git está limpo de qualquer segredo vazado (GROQ_API_KEY, em
   especial) e futuras regressões desse tipo são detectadas automaticamente
   via CI (`gitleaks` com baseline).
2. Todas as migrations em `infrastructure/migrations/` (até a 000035) estão
   aplicadas no Postgres local (docker compose) e há um caminho documentado
   e scriptado para aplicá-las em produção assim que o deploy existir.
3. Existe pipeline CI funcional tanto para o backend Go quanto para o PWA
   Next.js: build, lint, testes unitários, testes E2E (PWA), análise
   estática de segurança (`gosec`, `govulncheck`, `gitleaks`, `trivy` se
   houver Docker image).
4. A suíte E2E Playwright cobre os fluxos críticos (login, registro,
   transação, cartão, meta, investimento, empurrar fatura, score gauge,
   navegação 9-abas relatórios, ações de super admin) em vez dos 2 testes
   smoke atuais.
5. Os arquivos necessários para deploy em **Vercel (PWA)** + **Fly.io (API
   Go)** + **Fly Postgres (DB gerenciado)** estão todos criados e
   versionados: `Dockerfile`, `fly.toml`, `vercel.json`, workflows de
   deploy, `.env.example` completo. Execução efetiva do deploy fica em
   **STANDBY** aguardando credenciais do usuário (não-bloqueante pela LEI
   #1.3).
6. Existe documentação operacional mínima: `docs/HANDOFF.md` (na raiz),
   `docs/ops/security.md`, `docs/ops/deployment.md`.

Esta fase **não** pretende entregar observabilidade completa (métricas,
tracing, SLOs) nem multi-region. Isso fica para fases posteriores. O foco é
"mínimo viável seguro + pipeline verde + deploy preparado".

---

## 2. Contexto e motivação

O Laura Finance hoje está num estado "MVP completo em dev, sem prod".
Epics 1-9 entregaram toda a funcionalidade de negócio (contas,
transações, cartões, faturas, metas, investimentos, score, relatórios 9
abas, automações, super admin panel). O projeto roda localmente via
`docker compose` em `infrastructure/docker-compose.yml`.

A auditoria de segurança de 2026-04-15 (registrada no
`_bmad-output/implementation-artifacts/sprint-status.yaml`, seção
`security-hardening`) identificou 8 itens residuais que precisam ser
resolvidos antes de qualquer push para prod:

1. **Vazamento de segredo no histórico Git** — `GROQ_API_KEY` apareceu
   literalmente em commits (a partir de `bd88cfe`). Mesmo após remoção no
   HEAD, o valor continua recuperável por qualquer clone via
   `git log -p -S<trecho-da-key>`. Qualquer push do repo público
   (mesmo privado, se mudar visibilidade ou tiver colaborador futuro)
   mantém o vazamento. Ação obrigatória: **revogar** a key no console
   Groq e **rewrite** do histórico.

2. **Migration 000035** — a última migration criada (provavelmente durante
   Epic 9 ou Super Admin) não foi aplicada nos ambientes ativos. Em dev
   local, resolve-se com um `migrate up`; em prod, ainda não existe prod,
   mas o caminho precisa estar definido e testado.

3. **CI/CD Go ausente** — `.github/workflows/` tem apenas
   `playwright.yml` (dispara 2 testes E2E do PWA). Nenhum workflow
   exercita o código Go. Qualquer regressão (erro de compilação, race
   condition detectável por `go test -race`, vulnerabilidade de dep) só
   aparece no momento em que o dev roda localmente — o que pode não
   acontecer antes do deploy.

4. **CI/CD PWA incompleto** — o workflow existente só roda Playwright.
   Não há `typecheck`, `lint`, `build` isolado (separado do Playwright),
   nem teste de Vitest caso existam (verificar). Um erro de tipo em
   Next.js 16 pode passar despercebido.

5. **Cobertura E2E insuficiente** — 2 testes (nav landing + dashboard
   load) não cobrem os fluxos críticos. Se um commit quebrar a criação
   de transação, por exemplo, o CI não detecta.

6. **Deploy inexistente** — não há `Dockerfile` do backend Go, não há
   `fly.toml`, não há `vercel.json`, não há workflow de deploy, não há
   `.env.example` de produção. Tudo precisa ser criado nesta fase.

7. **Docker Compose de dev** — usa credenciais default (postgres/postgres),
   sem healthcheck em alguns serviços, sem restart policies. Aceitável em
   dev, mas vale revisar antes de documentar "pronto pra prod".

8. **Documentação operacional** — nenhum `HANDOFF.md` na raiz explicando
   estado atual, próximos passos, secrets esperados. Sem isso, retomar o
   projeto em novo terminal/nova sessão é doloroso.

Todos esses pontos somados são a barreira entre "MVP funcional" e "MVP
publicável". Fase 10 existe para derrubar essa barreira.

---

## 3. Escopo

### 3.1. Dentro do escopo

1. **Sanitização do histórico Git**
   - Revogação (STANDBY usuário) da GROQ_API_KEY exposta.
   - Rewrite de histórico com `git filter-repo` para remover o segredo de
     todos os commits.
   - Force push seguro (coordenado, documentado).
   - Adição de `.gitleaks.toml` + step CI que roda `gitleaks detect`.

2. **Migrations**
   - Aplicação da migration 000035 em dev local.
   - Revisão da ordem/idempotência de todas as migrations.
   - Escolha e documentação da ferramenta de migrations em prod
     (recomendação: `golang-migrate` v4).
   - Script shell `scripts/migrate.sh` que funciona em dev e em prod.

3. **CI/CD Go**
   - Novo workflow `.github/workflows/go.yml`:
     - matrix Go 1.23 (ou o que o projeto usa — ver `go.mod`).
     - steps: `go mod download`, `go vet ./...`, `golangci-lint run`,
       `gosec ./...`, `govulncheck ./...`, `go test -race -cover ./...`.
     - cache de módulos Go.
     - upload de cobertura para Codecov (opcional, STANDBY token).

4. **CI/CD PWA**
   - Workflow `.github/workflows/pwa.yml` (ou renomear/estender o
     `playwright.yml`):
     - `pnpm install --frozen-lockfile` (ou npm/yarn conforme projeto).
     - `pnpm typecheck` (`tsc --noEmit`).
     - `pnpm lint` (eslint).
     - `pnpm build` (next build).
     - `pnpm test` (vitest, se existir).
     - `pnpm playwright test` (atual, expandido).

5. **E2E Playwright expandido**
   - Novo arquivo `tests/auth.spec.ts` — login + registro + logout.
   - Novo arquivo `tests/transactions.spec.ts` — criar transação receita/
     despesa + editar + deletar.
   - Novo arquivo `tests/cards-invoices.spec.ts` — criar cartão + simular
     fatura + "empurrar fatura" (rollover).
   - Novo arquivo `tests/goals.spec.ts` — criar meta + atualizar progresso.
   - Novo arquivo `tests/investments.spec.ts` — criar investimento +
     atualizar preço.
   - Novo arquivo `tests/score.spec.ts` — ver score gauge + delta.
   - Novo arquivo `tests/reports.spec.ts` — navegação 9 abas de
     relatórios, carregamento sem erro.
   - Novo arquivo `tests/super-admin.spec.ts` — login super admin, ver
     lista de tenants, impersonate (read-only), toggle feature flag.
   - Fixture comum em `tests/fixtures/auth.ts` para autenticação via
     storageState.

6. **Deploy PWA — Vercel**
   - `vercel.json` na raiz do `apps/web/` (ou equivalente — confirmar
     estrutura do monorepo no v2 do spec).
   - Configuração de env vars (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_STRIPE_*,
     etc.) — STANDBY para valores reais.
   - Workflow `.github/workflows/deploy-pwa.yml` disparado em push `main`.
   - Link preview em PRs (automático via Vercel app GitHub).

7. **Deploy backend Go — Fly.io**
   - `Dockerfile` multi-stage no diretório do backend Go (provavelmente
     `services/api/` ou `backend/` — confirmar em v2):
     - stage 1: `golang:1.23-alpine` — build estático com
       `CGO_ENABLED=0`.
     - stage 2: `alpine:3.19` com `ca-certificates` + usuário não-root.
   - `fly.toml` com:
     - `primary_region = "gru"` (São Paulo, latência baixa pro Brasil).
     - `services` com http + http_checks em `/health`.
     - `[mounts]` para volume de sessão Whatsmeow (SQLite local da lib).
     - `[[vm]]` 1 CPU shared, 512MB RAM (free tier).
   - Workflow `.github/workflows/deploy-api.yml`:
     - gatilho push `main` com path filter no backend.
     - `flyctl deploy --remote-only`.

8. **Postgres gerenciado (Fly Postgres)**
   - Provisionar cluster `laura-finance-db` (STANDBY — requer CLI fly
     autenticada).
   - `fly postgres attach` ao app da API.
   - Documentar comandos de backup (`fly postgres backup list/create`).

9. **Secrets**
   - Matriz completa em `docs/ops/security.md`:
     - Quais secrets vão em Vercel env.
     - Quais secrets vão em Fly secrets.
     - Quais secrets vão em GitHub Actions secrets.
   - `.env.example` atualizado na raiz + em cada app, cobrindo 100% das
     vars referenciadas no código.
   - Integração `gitleaks` no pré-commit (via `lefthook` ou
     `pre-commit-hooks`) — opcional nesta fase, pode ficar STANDBY.

10. **Documentação operacional**
    - `docs/HANDOFF.md` na raiz — estado atual, migrations pendentes,
      secrets a configurar, próximos passos.
    - `docs/ops/security.md` — threat model mínimo, política de secrets,
      rotação, resposta a incidente (playbook p/ chave vazada).
    - `docs/ops/deployment.md` — passo-a-passo do primeiro deploy (Vercel
      + Fly), rollback, troubleshooting.

### 3.2. Fora do escopo (próximas fases)

- Observabilidade completa (Prometheus, Grafana, OpenTelemetry, Sentry
  com release tracking). Fica para **Fase 11 — Observabilidade**.
- Multi-region / leitura replicada no Postgres. Fase posterior.
- Disaster recovery automatizado (backups cifrados com age + S3). Fase
  posterior — a documentação desta fase mencionará o plano mas não o
  executará.
- WAF / rate-limit global (Cloudflare na frente). Fase posterior.
- Bug bounty / pentest externo. Fase posterior.
- Compliance LGPD formal (DPO, RoPA, avaliação de impacto). Fase
  posterior — esta fase só garante que logs não vazam PII em claro.

---

## 4. Pendências detalhadas

### 4.1. Sanitização do histórico Git (Groq key)

**Estado atual:**
- Commit `bd88cfe` (e possivelmente adjacentes) contém
  `GROQ_API_KEY=gsk_...` literal em algum arquivo (provavelmente
  `.env.example` ou `docker-compose.yml` de teste).
- HEAD atual já não contém a key, mas
  `git log -p -Sgsk_ --all` recupera o valor em segundos.
- Repo é privado hoje; qualquer mudança de visibilidade ou admissão de
  colaborador expõe o segredo.

**Ação proposta:**
1. **STANDBY-USER**: usuário loga em https://console.groq.com/keys,
   revoga a key antiga, gera nova, guarda em cofre.
2. Backup do repo antes do rewrite:
   ```sh
   cd "/Users/joaovitorzanini/Developer/Claude Code/"
   cp -R "Laura Finance (Vibe Coding)" "Laura Finance (Vibe Coding).bak-$(date +%Y%m%d)"
   ```
3. Instalar `git-filter-repo` (mais seguro e moderno que
   `git filter-branch`):
   ```sh
   brew install git-filter-repo
   ```
4. Criar arquivo `.git-secrets-to-purge.txt` com todas as strings a
   purgar (a key completa vazada + prefixo `gsk_` genérico NÃO — apenas o
   valor específico, senão vira falso-positivo):
   ```
   gsk_<valor-exato-que-vazou>==>REDACTED_GROQ_KEY
   ```
5. Rodar:
   ```sh
   git filter-repo --replace-text .git-secrets-to-purge.txt --force
   ```
6. Verificar:
   ```sh
   git log -p -Sgsk_ --all | head
   # não deve retornar nada do valor antigo
   ```
7. Force push coordenado (depois de avisar qualquer colaborador):
   ```sh
   git push --force-with-lease origin main
   git push --force-with-lease origin --tags
   ```
8. Todos os clones existentes devem ser apagados e reclonados.
   Documentar esse aviso em `docs/HANDOFF.md`.
9. Adicionar `gitleaks` no CI (ver 4.3) para impedir recorrência.
10. Adicionar `.gitleaks.toml` na raiz com regra para bloquear `gsk_*`,
    `sk_live_*` (Stripe), `re_*` (Resend), etc.

**Arquivos afetados:**
- `.git-secrets-to-purge.txt` (temporário, deletar após rewrite).
- `.gitleaks.toml` (novo, versionado).
- `.github/workflows/go.yml` ou workflow dedicado de security scan.
- `docs/ops/security.md` (novo).
- `docs/HANDOFF.md` (novo).

**Comandos shell:**
(ver passo-a-passo acima)

**Dependências externas (STANDBY):**
- Conta Groq do usuário para revogação.
- Coordenação com qualquer colaborador (provavelmente nenhum) antes do
  force push.

**Tempo estimado:** 45 min (execução) + tempo indefinido STANDBY.

---

### 4.2. Migration 000035 — aplicação local + prep prod

**Estado atual:**
- Arquivo existe em `infrastructure/migrations/000035_*.up.sql` (confirmar
  nome exato em v2).
- Migration anterior (000034) já aplicada em dev local.
- Em prod: N/A (sem prod).

**Ação proposta:**
1. Confirmar conteúdo da 000035 (possível criação de tabela relacionada a
   super admin, índices de performance, ou coluna nova em algo como
   `tenants` / `sessions`).
2. Se projeto já usa `golang-migrate`: rodar
   ```sh
   migrate -path infrastructure/migrations -database "$DATABASE_URL" up
   ```
3. Se não: introduzir `golang-migrate` como ferramenta oficial (bin no
   Docker multi-stage, CLI opcional local), criar `scripts/migrate.sh`:
   ```sh
   #!/usr/bin/env bash
   set -euo pipefail
   : "${DATABASE_URL:?DATABASE_URL required}"
   migrate -path infrastructure/migrations -database "$DATABASE_URL" "${@:-up}"
   ```
4. Documentar em `docs/ops/deployment.md` como aplicar em prod
   (opção A — rodar `migrate` manualmente via `fly ssh console`; opção B
   — entrypoint do container Go roda `migrate up` antes de iniciar o
   servidor, com lock via `pg_advisory_lock`).
   - Recomendação: **opção B**, com flag `MIGRATE_ON_BOOT=true` (default
     em prod, false em dev). Mais simples, menos error-prone.
5. Testar idempotência: rodar duas vezes em dev, esperar 0 mudanças na
   segunda.
6. Atualizar seed scripts (se houver em `scripts/seed.sh`) para contemplar
   quaisquer novas colunas da 000035.

**Arquivos afetados:**
- `scripts/migrate.sh` (novo ou atualizado).
- `services/api/cmd/api/main.go` ou equivalente (flag `MIGRATE_ON_BOOT`).
- `Dockerfile` (incluir bin `migrate`).
- `docs/ops/deployment.md`.

**Comandos shell:**
```sh
docker compose -f infrastructure/docker-compose.yml up -d db
DATABASE_URL="postgres://postgres:postgres@localhost:5432/laura?sslmode=disable" \
  migrate -path infrastructure/migrations -database "$DATABASE_URL" up
```

**Dependências externas:** nenhuma (dev local). Prod fica STANDBY.

**Tempo estimado:** 30 min.

---

### 4.3. CI/CD Go (build/test/lint/security)

**Estado atual:**
- `.github/workflows/` contém apenas `playwright.yml`.
- Go code nunca roda no CI.

**Ação proposta:**

Novo arquivo `.github/workflows/go.yml`:

```yaml
name: Go CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: laura_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache: true
      - name: go vet
        run: go vet ./...
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          version: v1.60
      - name: gosec
        uses: securego/gosec@master
        with:
          args: ./...
      - name: govulncheck
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...
      - name: migrations
        run: |
          go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
          migrate -path infrastructure/migrations \
            -database "postgres://postgres:postgres@localhost:5432/laura_test?sslmode=disable" up
      - name: test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/laura_test?sslmode=disable
        run: go test -race -covermode=atomic -coverprofile=coverage.out ./...
      - name: upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage.out
        continue-on-error: true

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_LICENSE: ""  # free para open source / privado
```

**Arquivos afetados:**
- `.github/workflows/go.yml` (novo).
- `.golangci.yml` (novo, se não existir — config de lint).
- `.gitleaks.toml` (novo).

**Dependências externas:**
- GitHub Actions (gratuito nos limites do plano).
- Codecov token (STANDBY — opcional).

**Tempo estimado:** 1h30.

---

### 4.4. CI/CD PWA expandido

**Estado atual:**
- `.github/workflows/playwright.yml` roda 2 testes após
  `npm ci && npx playwright install`.
- Sem typecheck, lint, build isolado.

**Ação proposta:**

Reescrever como `.github/workflows/pwa.yml`:

```yaml
name: PWA CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-type-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web  # confirmar em v2
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: apps/web/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8080
      - uses: actions/upload-artifact@v4
        with:
          name: pwa-build
          path: apps/web/.next
          retention-days: 3

  unit-tests:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm, cache-dependency-path: apps/web/pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --run  # vitest, se existir; skip-se-não-existir

  e2e:
    runs-on: ubuntu-latest
    needs: lint-type-build
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: laura_e2e }
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "1.23" }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm }
      - run: pnpm install --frozen-lockfile
        working-directory: apps/web
      - run: pnpm playwright install --with-deps chromium
        working-directory: apps/web
      - name: start api
        run: |
          go build -o /tmp/api ./services/api/cmd/api
          DATABASE_URL="postgres://postgres:postgres@localhost:5432/laura_e2e?sslmode=disable" \
            /tmp/api &
          npx wait-on http://localhost:8080/health
      - name: start pwa
        run: |
          cd apps/web
          pnpm build
          pnpm start &
          npx wait-on http://localhost:3000
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8080
      - run: pnpm playwright test
        working-directory: apps/web
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report
```

**Arquivos afetados:**
- `.github/workflows/pwa.yml` (novo, substitui `playwright.yml`).
- `apps/web/package.json` — adicionar scripts `typecheck`, `lint` se não
  existirem.
- Deletar `.github/workflows/playwright.yml` após confirmar que o novo
  funciona.

**Dependências externas:** nenhuma.

**Tempo estimado:** 2h.

---

### 4.5. E2E Playwright cobertura ampliada

**Estado atual:**
- `apps/web/tests/mvp-flows.spec.ts` com 2 testes (landing nav, dashboard
  load).

**Ação proposta:**

Criar fixture base `tests/fixtures/auth.ts`:

```ts
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto("/login");
    await page.fill("[data-testid=email]", "e2e@laura.test");
    await page.fill("[data-testid=password]", "e2e-password-123");
    await page.click("[data-testid=login-submit]");
    await expect(page).toHaveURL(/\/dashboard/);
    await use(page);
  },
});
export { expect };
```

**Novos specs:**

| Arquivo | Cobertura |
|--------|-----------|
| `tests/auth.spec.ts` | register happy path, login happy path, login wrong password, logout |
| `tests/transactions.spec.ts` | criar receita, criar despesa, editar, deletar, filtrar por mês |
| `tests/cards-invoices.spec.ts` | criar cartão, ver fatura atual, empurrar fatura (rollover), estornar |
| `tests/goals.spec.ts` | criar meta, atualizar progresso, concluir meta |
| `tests/investments.spec.ts` | criar investimento, atualizar preço, ver rentabilidade |
| `tests/score.spec.ts` | ver gauge, ver delta mês-a-mês, tooltip explicativo |
| `tests/reports.spec.ts` | navegar 9 abas (visão geral, fluxo caixa, categorias, cartões, metas, investimentos, score, comparativo, export), cada aba carrega sem erro |
| `tests/super-admin.spec.ts` | login super admin, listar tenants, toggle feature flag, impersonate read-only |

**Requisitos de dados:**
- Seed E2E específico em `scripts/seed-e2e.sh` criando:
  - 1 super admin (`e2e-admin@laura.test`).
  - 1 tenant + 1 user padrão (`e2e@laura.test`).
  - Dados mínimos (1 conta, 1 categoria receita, 1 categoria despesa).
- Rodar seed no CI antes do `playwright test`.

**Arquivos afetados:**
- `apps/web/tests/fixtures/auth.ts` (novo).
- `apps/web/tests/*.spec.ts` (8 novos).
- `scripts/seed-e2e.sh` (novo).
- `apps/web/playwright.config.ts` — adicionar `globalSetup` chamando o
  seed.

**Dependências externas:** nenhuma.

**Tempo estimado:** 4h (8 specs × 30 min médio).

---

### 4.6. Deploy PWA — Vercel

**Estado atual:** nenhum deploy configurado.

**Ação proposta:**

1. `apps/web/vercel.json`:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": "nextjs",
     "installCommand": "pnpm install --frozen-lockfile",
     "buildCommand": "pnpm build",
     "outputDirectory": ".next",
     "regions": ["gru1"],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
         ]
       }
     ]
   }
   ```

2. Variáveis de ambiente (configurar via Vercel dashboard — STANDBY):
   - `NEXT_PUBLIC_API_URL=https://api.laurafinance.app`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `NEXTAUTH_URL=https://app.laurafinance.app`
   - `NEXTAUTH_SECRET=<random 32 bytes>`
   - (lista completa em `.env.example` — ver 4.9)

3. Workflow `.github/workflows/deploy-pwa.yml`:
   ```yaml
   name: Deploy PWA

   on:
     push:
       branches: [main]
       paths: ["apps/web/**", ".github/workflows/deploy-pwa.yml"]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: amondnet/vercel-action@v25
           with:
             vercel-token: ${{ secrets.VERCEL_TOKEN }}
             vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
             vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
             working-directory: ./apps/web
             vercel-args: "--prod"
   ```

4. Configurar domínio custom `app.laurafinance.app` (STANDBY — requer
   DNS do usuário).

**Arquivos afetados:**
- `apps/web/vercel.json` (novo).
- `.github/workflows/deploy-pwa.yml` (novo).
- `docs/ops/deployment.md`.

**Dependências externas (STANDBY):**
- Conta Vercel + `vercel login`.
- Token Vercel em GitHub secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`).
- Domínio custom apontado.

**Tempo estimado:** 1h execução + STANDBY externo.

---

### 4.7. Deploy backend Go — Fly.io

**Estado atual:** nenhum.

**Ação proposta:**

1. `services/api/Dockerfile` (caminho confirmar em v2):
   ```dockerfile
   # syntax=docker/dockerfile:1.7

   FROM golang:1.23-alpine AS builder
   WORKDIR /src
   RUN apk add --no-cache ca-certificates git
   COPY go.mod go.sum ./
   RUN go mod download
   COPY . .
   RUN CGO_ENABLED=0 GOOS=linux go build \
       -ldflags="-s -w -X main.version=$(git rev-parse --short HEAD)" \
       -o /out/api ./services/api/cmd/api
   RUN go install -tags 'postgres' \
       github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0

   FROM alpine:3.19
   RUN apk add --no-cache ca-certificates tzdata \
       && addgroup -S app && adduser -S app -G app
   WORKDIR /app
   COPY --from=builder /out/api /app/api
   COPY --from=builder /go/bin/migrate /usr/local/bin/migrate
   COPY infrastructure/migrations /app/migrations
   COPY scripts/entrypoint.sh /app/entrypoint.sh
   RUN chmod +x /app/entrypoint.sh && chown -R app:app /app
   USER app
   EXPOSE 8080
   HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
     CMD wget -qO- http://localhost:8080/health || exit 1
   ENTRYPOINT ["/app/entrypoint.sh"]
   ```

2. `scripts/entrypoint.sh`:
   ```sh
   #!/bin/sh
   set -eu
   if [ "${MIGRATE_ON_BOOT:-true}" = "true" ]; then
     migrate -path /app/migrations -database "$DATABASE_URL" up
   fi
   exec /app/api
   ```

3. `fly.toml`:
   ```toml
   app = "laura-finance-api"
   primary_region = "gru"
   kill_signal = "SIGTERM"
   kill_timeout = 30

   [build]
     dockerfile = "services/api/Dockerfile"

   [env]
     PORT = "8080"
     MIGRATE_ON_BOOT = "true"
     LOG_LEVEL = "info"

   [http_service]
     internal_port = 8080
     force_https = true
     auto_stop_machines = "stop"
     auto_start_machines = true
     min_machines_running = 1

     [[http_service.checks]]
       interval = "15s"
       timeout = "2s"
       grace_period = "10s"
       method = "GET"
       path = "/health"

   [[mounts]]
     source = "whatsmeow_data"
     destination = "/data"

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory = "512mb"
   ```

4. Secrets no Fly (STANDBY):
   ```sh
   fly secrets set \
     DATABASE_URL="postgres://..." \
     SESSION_HMAC_KEY="..." \
     GROQ_API_KEY="..." \
     STRIPE_SECRET_KEY="sk_live_..." \
     RESEND_API_KEY="re_..."
   ```

5. Workflow `.github/workflows/deploy-api.yml`:
   ```yaml
   name: Deploy API

   on:
     push:
       branches: [main]
       paths:
         - "services/api/**"
         - "infrastructure/migrations/**"
         - "fly.toml"
         - ".github/workflows/deploy-api.yml"

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: superfly/flyctl-actions/setup-flyctl@master
         - run: flyctl deploy --remote-only
           env:
             FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
   ```

**Arquivos afetados:**
- `services/api/Dockerfile` (novo).
- `scripts/entrypoint.sh` (novo).
- `fly.toml` (novo, raiz).
- `.github/workflows/deploy-api.yml` (novo).
- `.dockerignore` (novo, raiz).

**Dependências externas (STANDBY):**
- Conta Fly + `fly auth login`.
- Token Fly em `secrets.FLY_API_TOKEN`.
- Secrets via `fly secrets set`.

**Tempo estimado:** 2h execução + STANDBY externo.

---

### 4.8. Postgres gerenciado (Fly Postgres)

**Estado atual:** dev usa `postgres:16` via docker compose.

**Ação proposta:**

1. STANDBY-USER: provisionar cluster:
   ```sh
   fly postgres create \
     --name laura-finance-db \
     --region gru \
     --initial-cluster-size 1 \
     --vm-size shared-cpu-1x \
     --volume-size 10
   ```
2. Attach ao app:
   ```sh
   fly postgres attach laura-finance-db --app laura-finance-api
   ```
   Isso popula `DATABASE_URL` como secret automaticamente.

3. Habilitar pgvector:
   ```sh
   fly postgres connect -a laura-finance-db
   # dentro do psql:
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. Política de backup:
   - Fly Postgres faz snapshot automático diário (retenção 7 dias no
     plano free).
   - Documentar em `docs/ops/security.md` como restaurar:
     `fly postgres backup list -a laura-finance-db` +
     `fly postgres backup restore <id>`.
   - Para backup fora-de-site: cron `pg_dump | age -r <pubkey> | s3 cp`
     — fica para fase posterior.

**Arquivos afetados:**
- `docs/ops/deployment.md`.
- `docs/ops/security.md`.

**Dependências externas (STANDBY):** conta Fly.

**Tempo estimado:** 1h (execução) + STANDBY.

---

### 4.9. Documentação operacional

**Estado atual:** sem `HANDOFF.md`, sem `docs/ops/`.

**Ação proposta:**

1. `docs/HANDOFF.md` (raiz do projeto):
   - Cabeçalho: estado atual da produção (inexistente → preparada).
   - Seção "Ao abrir nova sessão/terminal" — o que ler primeiro.
   - Seção "Pendências" — lista de itens STANDBY.
   - Seção "Secrets a configurar" — checklist.
   - Seção "Comandos úteis" — dev up, migrate, test.

2. `docs/ops/security.md`:
   - Threat model resumido (STRIDE simplificado).
   - Política de secrets (onde vive cada classe de secret).
   - Rotação de secrets (frequência recomendada).
   - Playbook de incidente (chave vazada):
     1. Revogar imediatamente na plataforma.
     2. Gerar nova.
     3. Se histórico git contém: `git filter-repo` + force push.
     4. Notificar usuários impactados se houver dado de terceiros.
   - Headers de segurança aplicados (CSP, HSTS, etc.).

3. `docs/ops/deployment.md`:
   - Primeiro deploy passo-a-passo:
     1. Fly auth + create app + create postgres + attach.
     2. `fly secrets set` com todos os secrets do `.env.example`.
     3. `fly deploy`.
     4. Vercel import project + env vars + deploy.
     5. DNS (A/AAAA para Fly, CNAME para Vercel).
   - Rollback:
     - API: `fly releases` + `fly deploy --image <sha>` de release
       anterior.
     - PWA: Vercel tem "Promote to Production" em qualquer deploy anterior.
   - Troubleshooting comum.

4. `.env.example` na raiz (se já existir, completar):
   ```
   # Core
   ENVIRONMENT=development
   LOG_LEVEL=debug

   # Database
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/laura?sslmode=disable

   # Session / Auth
   SESSION_HMAC_KEY=<32-byte random hex>
   NEXTAUTH_SECRET=<32-byte random hex>
   NEXTAUTH_URL=http://localhost:3000

   # AI providers
   GROQ_API_KEY=
   OPENAI_API_KEY=     # opcional
   GOOGLE_AI_API_KEY=  # opcional

   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

   # Email
   RESEND_API_KEY=

   # Frontend
   NEXT_PUBLIC_API_URL=http://localhost:8080

   # Feature flags
   MIGRATE_ON_BOOT=false
   ```

**Arquivos afetados:**
- `docs/HANDOFF.md` (novo).
- `docs/ops/security.md` (novo).
- `docs/ops/deployment.md` (novo).
- `.env.example` (atualizar).

**Dependências externas:** nenhuma.

**Tempo estimado:** 2h.

---

## 5. Decisões de arquitetura

### 5.1. Por que Vercel para PWA

- **Ergonomia Next.js**: Vercel é o criador do Next. Zero-config para
  App Router, RSC, Edge Runtime, ISR.
- **Preview deploys**: cada PR ganha URL isolada (crítico para QA
  visual).
- **Custo**: free tier cobre MVP (100GB bandwidth, deploy ilimitado).
- **Edge global**: CDN automático.
- **Alternativas descartadas**:
  - Cloudflare Pages: suporte Next 16 ainda é desigual para RSC.
  - Self-host Docker: overhead operacional desnecessário nesta fase.

### 5.2. Por que Fly.io para Go (websockets)

- **Websockets persistentes**: Whatsmeow requer conexão TCP/WS longa. Fly
  permite (Cloud Run tem timeout de 60min, Vercel serverless não suporta).
- **Volume persistente**: `[[mounts]]` para SQLite local do Whatsmeow
  (state de sessão). Cloud Run não tem; Railway tem mas é mais caro.
- **Região gru**: São Paulo, latência ~30ms pro usuário final.
- **Free tier útil**: 3 shared-cpu-1x + 256MB/mês grátis (suficiente pro
  início).
- **Docker nativo**: `Dockerfile` já é a unidade de deploy. Sem surpresa.
- **Alternativas descartadas**:
  - **Cloud Run**: timeout + sem volume persistente → morte do
    Whatsmeow. Só serviria se separássemos worker Whatsmeow em outra
    infra.
  - **Railway**: bom dev UX mas sem free tier permanente e menos
    controle de região.
  - **Render**: pricing menos favorável para websockets.

### 5.3. Por que Fly Postgres

- **Co-localização**: mesma região da API → latência <1ms.
- **Attach automático**: `fly postgres attach` já injeta `DATABASE_URL`.
- **pgvector disponível**: extensão oficial, basta `CREATE EXTENSION`.
- **Backup automático**: 7 dias no free.
- **Alternativas consideradas**:
  - **Supabase**: ótimo mas adiciona latência cross-provider. Útil se
    quisermos auth/storage deles — hoje não precisamos.
  - **Neon**: serverless Postgres com branching excelente, mas branching
    não é prioridade ainda.
  - **Managed RDS AWS**: overkill para MVP.

### 5.4. Estratégia de migrations em prod

**Escolha:** `golang-migrate` v4 rodado no entrypoint do container
(`MIGRATE_ON_BOOT=true`), com lock via `pg_advisory_lock` automático da
própria ferramenta.

**Alternativas descartadas:**
- **sqlc migrations**: sqlc é query codegen, não gerencia migrations.
- **Manual via psql**: rápido no começo, vira pesadelo com multi-instance.
- **Atlas**: excelente mas adiciona ferramenta nova. Fica para fase
  posterior se quisermos declarative migrations.

**Rollback de migration:** manual. `migrate` suporta `down` mas em prod
preferimos migrations forward-only. Rollback de schema = nova migration
compensatória.

### 5.5. Estratégia de secrets

| Secret | Vive em | Injetado em |
|--------|---------|-------------|
| `DATABASE_URL` | Fly secrets (auto via attach) | container API |
| `SESSION_HMAC_KEY` | Fly secrets | container API |
| `GROQ_API_KEY` | Fly secrets | container API |
| `STRIPE_SECRET_KEY` | Fly secrets | container API |
| `STRIPE_WEBHOOK_SECRET` | Fly secrets | container API |
| `RESEND_API_KEY` | Fly secrets | container API |
| `NEXTAUTH_SECRET` | Vercel env | build PWA |
| `NEXT_PUBLIC_*` | Vercel env (build-time) | bundle PWA |
| `FLY_API_TOKEN` | GitHub secrets | workflow deploy-api |
| `VERCEL_TOKEN` etc. | GitHub secrets | workflow deploy-pwa |
| `CODECOV_TOKEN` | GitHub secrets | workflow go CI (opcional) |

**Regras:**
- Nenhum secret em `.env.example` (apenas placeholders).
- Nenhum secret em commit — CI impõe via `gitleaks`.
- Rotação: a cada 90 dias para keys de plataforma; imediata em vazamento.

---

## 6. Pré-requisitos / dependências externas (STANDBY)

Estes itens dependem de ação do usuário e ficam em **STANDBY** conforme
LEI #1.3. A execução da fase **não bloqueia neles** — preparamos todos os
arquivos versionados e a execução remota fica pendente até o usuário
fornecer credenciais/autorizar.

| # | Item | Bloqueia o quê |
|---|------|----------------|
| 1 | Revogar GROQ_API_KEY antiga + gerar nova | fim da sanitização 4.1 |
| 2 | Conta Vercel + `vercel login` + token | deploy efetivo 4.6 |
| 3 | Conta Fly.io + `fly auth login` + token | deploy efetivo 4.7 |
| 4 | `fly postgres create` | ativação do DB prod 4.8 |
| 5 | Stripe live keys (hoje temos test) | cobrança real em prod |
| 6 | Conta Resend + key + domínio verificado | envio de e-mail em prod |
| 7 | Domínios `app.laurafinance.app` + `api.laurafinance.app` com DNS acessível | URLs finais de prod |
| 8 | Confirmação para force push em main | passo final da 4.1 |

Enquanto esses itens não chegam, marcamos como "prepared / awaiting
activation" e seguimos em frente com tudo que é executável localmente.

---

## 7. Critérios de aceite (DoD da fase)

1. **Segurança**
   - [ ] `git log -p -S<trecho-groq> --all` retorna vazio.
   - [ ] `.gitleaks.toml` presente e CI passa clean.
   - [ ] `gosec` + `govulncheck` rodam no CI sem issues críticos (HIGH).
   - [ ] `.env.example` cobre 100% das variáveis referenciadas no código
     (`rg -o 'process\.env\.[A-Z_]+' | sort -u` + `rg -o 'os.Getenv\("[A-Z_]+"\)'`).

2. **Migrations**
   - [ ] `migrate -database $DATABASE_URL up` é idempotente (segunda
     execução = no-op).
   - [ ] Entrypoint do container Go roda migrations com `MIGRATE_ON_BOOT=true`.
   - [ ] CI aplica migrations em Postgres de teste antes dos testes.

3. **CI/CD**
   - [ ] PR no GitHub dispara: `go.yml`, `pwa.yml`, `gitleaks`.
   - [ ] Todos verdes em um PR de teste.
   - [ ] Workflows de deploy (`deploy-api.yml`, `deploy-pwa.yml`)
     existem e validam sintaxe (dry-run via `act` ou
     `actionlint`).

4. **E2E**
   - [ ] 8 novos specs Playwright implementados.
   - [ ] Suíte completa roda em <10 min no CI.
   - [ ] Zero flakes em 3 execuções consecutivas.

5. **Deploy prep**
   - [ ] `Dockerfile` Go builda local (`docker build`) e imagem <80MB.
   - [ ] `fly.toml` valida via `fly config validate`.
   - [ ] `vercel.json` valida via `vercel inspect` (se CLI disponível).
   - [ ] Deploy real: STANDBY (não-bloqueante para DoD da fase).

6. **Docs**
   - [ ] `docs/HANDOFF.md`, `docs/ops/security.md`,
     `docs/ops/deployment.md` presentes.
   - [ ] Cada um tem índice + seções populadas (sem TODOs abertos).

7. **Commit + memory**
   - [ ] Commit(s) em PT-BR seguindo estilo do repo.
   - [ ] Entrada nova em memory index (`.claude/memory/...`) resumindo a
     fase.
   - [ ] `docs/superpowers/specs/` e `plans/` com v3 finais arquivados.

---

## 8. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| `git filter-repo` corrompe repo local | baixa | alto | Backup do diretório antes; `--force` só depois de validar clone limpo |
| Force push quebra clones de colaboradores | média | médio | Nenhum colab hoje; documentar aviso em HANDOFF |
| Migration 000035 não é idempotente | média | alto | Revisar SQL, adicionar `IF NOT EXISTS`; testar em DB zerado e em DB com dados |
| Whatsmeow perde estado ao mudar Fly VM | alta se não configurar volume | alto | `[[mounts]]` garantido no `fly.toml` |
| Free tier Fly insuficiente para warm-start | média | baixo | `min_machines_running = 1` evita cold-start; se custo subir, reavaliar |
| Playwright flaky em CI (timing) | alta | médio | `test.retry(2)` + `wait-on` + screenshots em falha |
| Vercel build falha por diff env dev↔prod | média | médio | Validar build local com `NODE_ENV=production` antes |
| `gosec` / `govulncheck` acusam falso-positivo bloqueando CI | média | baixo | Começar com `continue-on-error: true`, promover a bloqueante após baseline |
| Schema pgvector não sobe em Fly Postgres | baixa | alto | Migration 000001 tem `CREATE EXTENSION IF NOT EXISTS vector`; testar no primeiro deploy |
| Usuário esquece de revogar Groq key | média | alto | Item #1 do HANDOFF destacado, comunicação ativa |

---

## 9. Métricas de sucesso

- **Tempo CI full (PR → verde)**: alvo <12 min (Go + PWA + E2E paralelos).
- **Tempo deploy API (push → live)**: alvo <5 min.
- **Tempo deploy PWA (push → live)**: alvo <3 min.
- **Cobertura E2E**: ≥80% dos fluxos críticos (9/11 do inventário).
- **Issues `gosec` HIGH**: 0.
- **`govulncheck` findings**: 0 em deps diretas.
- **Segredos em histórico git**: 0 (`gitleaks detect --log-opts '--all'`
  sai limpo).
- **Tempo para retomar projeto em nova sessão** (subjetivo): <5 min
  lendo `HANDOFF.md`.

---

## 10. Plano de testes

### 10.1. Sanitização git
- Após `git filter-repo`: `git log -p -S<key> --all | wc -l` → 0.
- Clone fresco do remote: mesmo resultado.

### 10.2. Migrations
- `docker compose down -v && docker compose up -d db` (DB zerado).
- `./scripts/migrate.sh up` → sucesso.
- `./scripts/migrate.sh up` novamente → no-op.
- Aplicar manualmente uma migration a menos, rodar up → aplica só a
  faltante.

### 10.3. CI
- Abrir PR de teste (branch `test/fase-10-ci`) com commit trivial.
- Observar 3 workflows dispararem: `go.yml`, `pwa.yml`, `gitleaks`.
- Forçar falha proposital (e.g., `fmt.Prinln` typo) → CI deve pegar.

### 10.4. E2E
- `pnpm playwright test` local → 8 specs + fixtures rodam verdes.
- Rodar 3× seguidas → zero flakes.
- CI: baixar `playwright-report` artifact em run de falha intencional,
  confirmar screenshots gerados.

### 10.5. Dockerfile Go
- `docker build -f services/api/Dockerfile -t laura-api:test .`
- Imagem final <80MB (`docker images`).
- `docker run --rm -e DATABASE_URL=... -p 8080:8080 laura-api:test`
  sobe + `/health` retorna 200.

### 10.6. Fly config
- `fly config validate` → ok.
- (STANDBY) Deploy real em app de staging descartável (ex:
  `laura-finance-api-stg`) antes do prod.

### 10.7. Vercel config
- `vercel build` local na pasta `apps/web` → build verde.
- (STANDBY) Import no dashboard + deploy preview.

### 10.8. Documentação
- Abrir `docs/HANDOFF.md`, `docs/ops/security.md`,
  `docs/ops/deployment.md` em fresh eyes (próxima sessão do agente) e
  seguir instruções — deve ser possível reproduzir ambiente dev em
  <10 min.

---

**Fim do Spec v1.** Revisão v2 deve validar:
- Estrutura de monorepo real (paths `apps/web`, `services/api`,
  `infrastructure/migrations` estão corretos?).
- Gerenciador de pacotes JS real (pnpm vs npm vs yarn).
- Versão Go exata em `go.mod`.
- Nome real da migration 000035 + conteúdo.
- Lista real de env vars vs hipotética neste v1.
- Existência (ou não) de testes vitest no PWA.
- Se há worker separado (além da API) que também precisa deploy.
