# Fase 10 — Security closeout + infraestrutura mínima de produção (Spec v2)

> Versão: v2 (incorpora review #1)
> Data: 2026-04-15
> Autor: agente autônomo (review pelo arquiteto)
> Status: rascunho — ainda passa por review #2 antes da v3 final
> Projeto: Laura Finance (Vibe Coding)
> Fases anteriores: Epics 1-9 (MVP) + Super Admin Panel concluídos

## Mudanças principais vs v1

1. **Paths reais do monorepo corrigidos** — `laura-go/` (não `services/api/`) e `laura-pwa/` (não `apps/web/`). Sem subpasta `services/`.
2. **Versão Go corrigida** — `1.26.1` (de `go.mod`), não 1.23. Imagem base `golang:1.26-alpine`.
3. **Gerenciador de pacotes confirmado** — **npm** (`package-lock.json`), não pnpm. Todos os workflows usam `npm ci` / `npm run <script>`.
4. **Whatsmeow não precisa de volume persistente** — o projeto usa `sqlstore.New("postgres", dbURL, ...)`. Sessão vive no Postgres. `[[mounts]]` removido do `fly.toml`; seção 4.11 explica.
5. **Migration 000035 é destrutiva condicional** — faz `DELETE FROM ... WHERE workspace_id IS NULL` em 8 tabelas + adiciona CHECK constraints. Em prod com dados, exige backup pré-aplicação. Seção 4.2 expandida com validação automatizada (4.2-bis em CI).
6. **Cron in-process** — `robfig/cron/v3` roda no binário único; não há worker separado. Fly Machines com `min_machines_running = 1` + `auto_stop_machines = "suspend"` (não `"stop"`) para não matar cron. Nova seção 4.12.
7. **Novas subseções operacionais**: 4.10 backup Postgres + 4.11 whatsmeow session + 4.12 cron Fly + 5.6 custos + 5.7 rollback + 5.8 DNS + 6.X pre-commit gitleaks.
8. **LEI #5 / regras técnicas críticas** auditadas — moeda em centavos, HMAC sessão, whitelist SQL, context timeout, paridade Go↔PWA. Nenhuma é modificada nesta fase; seção 5.9 formaliza isso como invariante.
9. **Observabilidade pós-deploy** mínima incluída: `/health` e `/ready`, logs JSON, request-id, alerta Fly nativo. Métricas/Sentry ficam para Fase 11.
10. **Open Finance + WAF + DR automatizado + compliance LGPD formal** registrados em seção 11 (backlog) para não se perderem.

---

## 1. Objetivo

Encerrar a trilha de "security hardening" pendente desde os Epics 8/9 e disponibilizar a infraestrutura mínima necessária para colocar o Laura Finance em produção pela primeira vez, ponta a ponta, com pipeline automatizado (CI/CD), observabilidade básica, secrets gerenciados, cobertura E2E razoável e documentação operacional.

Em termos concretos, ao final da Fase 10 o projeto deve estar em um estado no qual:

1. O histórico Git está limpo de qualquer segredo vazado (`GROQ_API_KEY` em especial) e futuras regressões são detectadas automaticamente via CI (`gitleaks` com baseline) e via pre-commit hook opcional.
2. Todas as migrations em `infrastructure/migrations/` (até a `000035_security_hardening.sql`) estão aplicadas no Postgres local e há um caminho documentado, testado e **validado no CI** para aplicá-las em produção.
3. Existe pipeline CI funcional tanto para `laura-go/` quanto para `laura-pwa/`: build, lint, testes unitários, testes E2E (PWA), análise estática de segurança (`gosec`, `govulncheck`, `gitleaks`).
4. A suíte E2E Playwright cobre os fluxos críticos em vez dos testes smoke atuais.
5. Os arquivos necessários para deploy em **Vercel (PWA)** + **Fly.io (API Go)** + **Fly Postgres (DB gerenciado)** estão todos criados e versionados: `Dockerfile`, `fly.toml`, `vercel.json`, workflows de deploy, `.env.example` completo. Execução efetiva do deploy fica em **STANDBY** aguardando credenciais do usuário (não-bloqueante pela LEI #1.3).
6. Existe documentação operacional mínima: `docs/HANDOFF.md`, `docs/ops/security.md`, `docs/ops/deployment.md`, `docs/ops/runbooks/secrets-rotation.md`.
7. Plano de rollback explícito (API e PWA) está documentado e referenciado em `HANDOFF.md`.

Esta fase **não** pretende entregar observabilidade completa (métricas, tracing, SLOs, Sentry release tracking), multi-region, DR automatizado nem Open Finance. Fica para fases posteriores. Foco é "mínimo viável seguro + pipeline verde + deploy preparado + rollback testável".

---

## 2. Contexto e motivação

O Laura Finance hoje está em "MVP completo em dev, sem prod". Epics 1-9 entregaram toda a funcionalidade de negócio (contas, transações, cartões, faturas, metas, investimentos, score, relatórios 9 abas, automações, super admin panel). O projeto roda localmente via `docker compose` em `infrastructure/docker-compose.yml`.

A auditoria de segurança de 2026-04-15 (registrada no `_bmad-output/implementation-artifacts/sprint-status.yaml`, seção `security-hardening`) identificou 8 itens residuais que precisam ser resolvidos antes de qualquer push para prod:

1. **Vazamento de segredo no histórico Git** — `GROQ_API_KEY` apareceu literalmente em commits (a partir de `bd88cfe`). Mesmo após remoção no HEAD, o valor continua recuperável via `git log -p -S<trecho-da-key>`. Ação obrigatória: **revogar** a key no console Groq e **rewrite** do histórico.
2. **Migration 000035 (`000035_security_hardening.sql`)** — adiciona `NOT NULL`, `CHECK`, índices compostos e faz `DELETE FROM ... WHERE workspace_id IS NULL` em 8 tabelas. **Em dev local aplica-se direto; em prod futuro, precisa backup pré-execução** (impacto destrutivo condicional).
3. **CI/CD Go ausente** — `.github/workflows/` **sequer existe** hoje. Nenhum workflow exercita o código Go.
4. **CI/CD PWA ausente** — só existe `mvp-flows.spec.ts`; nenhum workflow garante typecheck, lint, build, test.
5. **Cobertura E2E insuficiente** — 2 testes smoke (landing + dashboard load) não cobrem fluxos críticos.
6. **Deploy inexistente** — não há `Dockerfile` do backend Go, não há `fly.toml`, não há `vercel.json`, não há workflow de deploy, não há `.env.example` de produção.
7. **Docker Compose de dev** — usa credenciais default (`postgres/postgres`), sem healthcheck em alguns serviços. Aceitável em dev, vale revisar antes de documentar "pronto pra prod".
8. **Documentação operacional** — nenhum `HANDOFF.md` explicando estado atual, próximos passos, secrets esperados.

Todos esses pontos são a barreira entre "MVP funcional" e "MVP publicável". Fase 10 existe para derrubá-la.

---

## 3. Escopo

### 3.1. Dentro do escopo

1. **Sanitização do histórico Git** — revogação (STANDBY) da `GROQ_API_KEY`, rewrite com `git filter-repo`, force push coordenado, `.gitleaks.toml` + step CI.
2. **Migrations** — aplicação da 000035 em dev, validação de idempotência em CI contra Postgres real, `scripts/migrate.sh`, entrypoint do container Go roda migrate up com `MIGRATE_ON_BOOT=true` e `pg_advisory_lock`.
3. **CI/CD Go** — `.github/workflows/go.yml` com `go vet`, `golangci-lint`, `gosec`, `govulncheck`, `go test -race`, `migrate up` contra Postgres de serviço.
4. **CI/CD PWA** — `.github/workflows/pwa.yml` com `npm ci`, `tsc --noEmit`, `eslint`, `next build`, `playwright test`.
5. **E2E Playwright expandido** — 8 novos specs (auth, transactions, cards-invoices, goals, investments, score, reports 9-abas, super-admin).
6. **Deploy PWA — Vercel** — `vercel.json`, env vars STANDBY, workflow `deploy-pwa.yml`.
7. **Deploy backend Go — Fly.io** — `Dockerfile` multi-stage Go 1.26, `fly.toml` com cron in-process preservado, workflow `deploy-api.yml`.
8. **Postgres gerenciado (Fly Postgres)** — `fly postgres create`, `attach`, `pgvector`, backup automático de 7 dias documentado.
9. **Secrets** — matriz em `docs/ops/security.md`, `.env.example` cobrindo 100% das vars, pre-commit hook gitleaks (opcional).
10. **Documentação operacional** — `HANDOFF.md`, `ops/security.md`, `ops/deployment.md`, `ops/runbooks/secrets-rotation.md`, `ops/runbooks/rollback.md`.
11. **Rollback documentado** — para API (Fly releases) e PWA (Vercel promote).
12. **Observabilidade mínima pós-deploy** — `/health`, `/ready`, request-id middleware, logs JSON em prod, alertas nativos Fly.

### 3.2. Fora do escopo (próximas fases)

- Observabilidade completa (Prometheus, Grafana, OpenTelemetry, Sentry release tracking) → Fase 11.
- Multi-region / leitura replicada no Postgres.
- DR automatizado (`pg_dump | age | s3`) — mencionado, não executado.
- WAF / rate-limit global (Cloudflare).
- Bug bounty / pentest externo.
- Compliance LGPD formal (DPO, RoPA, DPIA).
- **Open Finance / Pix API integrations** (item novo no backlog — ver seção 11).

---

## 4. Pendências detalhadas

### 4.1. Sanitização do histórico Git (Groq key)

**Estado atual:**
- Commit `bd88cfe` (e possivelmente adjacentes) contém `GROQ_API_KEY=gsk_...` literal.
- HEAD atual não contém mas `git log -p -Sgsk_ --all` recupera.
- Repo privado hoje; qualquer mudança de visibilidade ou admissão de colaborador expõe o segredo.

**Ação proposta:**
1. **STANDBY [GROQ-REVOKE]**: usuário loga em https://console.groq.com/keys, revoga a key antiga, gera nova, guarda em cofre.
2. Backup do repo antes do rewrite:
   ```sh
   cd "/Users/joaovitorzanini/Developer/Claude Code/"
   cp -R "Laura Finance (Vibe Coding)" "Laura Finance (Vibe Coding).bak-$(date +%Y%m%d)"
   ```
3. Instalar `git-filter-repo`: `brew install git-filter-repo`.
4. Criar `.git-secrets-to-purge.txt` com a key exata (não o prefixo genérico):
   ```
   gsk_<valor-exato-vazado>==>REDACTED_GROQ_KEY
   ```
5. `git filter-repo --replace-text .git-secrets-to-purge.txt --force`
6. Verificar: `git log -p -Sgsk_ --all | head` → vazio.
7. **STANDBY [FORCE-PUSH]**: force push coordenado: `git push --force-with-lease origin main && git push --force-with-lease origin --tags`.
8. Avisar em `HANDOFF.md` que clones antigos devem ser apagados e reclonados.
9. Adicionar `gitleaks` no CI (ver 4.3).
10. Adicionar `.gitleaks.toml` na raiz bloqueando `gsk_*`, `sk_live_*`, `re_*`, JWT HMAC keys, chaves privadas OpenSSH/PGP.
11. (Opcional) Pre-commit hook gitleaks — ver 6.X.

**Arquivos:** `.git-secrets-to-purge.txt` (temporário), `.gitleaks.toml` (novo), `.github/workflows/go.yml` (step gitleaks), `docs/ops/security.md`, `docs/HANDOFF.md`.

**Dependências externas:** STANDBY [GROQ-REVOKE], STANDBY [FORCE-PUSH].

**Tempo:** 45 min (execução).

---

### 4.2. Migration 000035 — aplicação local + prep prod

**Estado atual:**
- Arquivo existe: `infrastructure/migrations/000035_security_hardening.sql`.
- Conteúdo (confirmado nesta revisão):
  - `NOT NULL` em `workspace_id` de 8 tabelas, **precedido de `DELETE FROM <tabela> WHERE workspace_id IS NULL`** (destrutivo, condicional).
  - Comentário explícito `users.workspace_id` fica opcional porque super_admin pode não ter workspace.
  - `CHECK` constraints em `transactions.type`, `transactions.amount`, `financial_goals.*`, `invoices.status`, `debt_rollovers.status`, `cards.closing_day/due_day` (este último em `DO $$ ... END $$` defensivo).
  - Índices compostos `idx_trans_workspace_date`, `idx_trans_workspace_category`, `idx_trans_workspace_type` etc.
- Migration anterior (000034 `seed_real_categories.sql`) já aplicada em dev local.
- Em prod: N/A (sem prod).

**Ação proposta:**
1. Em dev: `migrate -path infrastructure/migrations -database "$DATABASE_URL" up`. Verificar `schema_migrations.version = 35`.
2. Introduzir `golang-migrate` v4 como ferramenta oficial (bin no multi-stage Docker, CLI local).
3. `scripts/migrate.sh`:
   ```sh
   #!/usr/bin/env bash
   set -euo pipefail
   : "${DATABASE_URL:?DATABASE_URL required}"
   migrate -path infrastructure/migrations -database "$DATABASE_URL" "${@:-up}"
   ```
4. Documentar em `ops/deployment.md` opção A (SSH manual) e opção B (entrypoint `MIGRATE_ON_BOOT=true`). **Recomendação: B**, com lock automático `pg_advisory_lock` da própria ferramenta (previne race em múltiplas instâncias).
5. Testar idempotência: rodar duas vezes em dev → segunda = no-op.
6. Atualizar seed scripts se necessário.

**4.2-bis — Validação automatizada de migration 035 no CI (novo em v2):**
- Job no `go.yml` que:
  1. Sobe Postgres 16 com `POSTGRES_DB=laura_test`.
  2. Baixa CLI `migrate`.
  3. Roda `migrate up` com todas as 35 migrations.
  4. Roda `migrate up` novamente → espera `no change`.
  5. Roda `go test -race ./...` contra esse DB (valida que schema bate com queries do código).
- Esse job garante que todo push que quebre idempotência é barrado.

**Arquivos:** `scripts/migrate.sh` (novo), `laura-go/main.go` (flag `MIGRATE_ON_BOOT`), `laura-go/Dockerfile` (incluir bin `migrate`), `scripts/entrypoint.sh` (novo), `docs/ops/deployment.md`.

**Dependências externas:** nenhuma em dev. Prod = STANDBY [FLY-DEPLOY].

**Tempo:** 45 min (inclui 4.2-bis).

---

### 4.3. CI/CD Go (build/test/lint/security)

**Estado atual:**
- `.github/workflows/` **não existe** (precisa ser criado).
- Go code nunca roda no CI.

**Ação proposta:** novo `.github/workflows/go.yml`:

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
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    defaults:
      run:
        working-directory: laura-go
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.26"
          cache: true
      - run: go vet ./...
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          version: v1.62
          working-directory: laura-go
      - name: gosec
        uses: securego/gosec@master
        with:
          args: ./...
      - name: govulncheck
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...
      - name: migrations (idempotência)
        working-directory: ${{ github.workspace }}
        run: |
          go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0
          migrate -path infrastructure/migrations \
            -database "postgres://postgres:postgres@localhost:5432/laura_test?sslmode=disable" up
          migrate -path infrastructure/migrations \
            -database "postgres://postgres:postgres@localhost:5432/laura_test?sslmode=disable" up
      - name: test -race
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/laura_test?sslmode=disable
        run: go test -race -covermode=atomic -coverprofile=coverage.out ./...
      - uses: codecov/codecov-action@v4
        with:
          files: laura-go/coverage.out
        continue-on-error: true

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_LICENSE: ""
```

**Arquivos:** `.github/workflows/go.yml` (novo), `laura-go/.golangci.yml` (novo), `.gitleaks.toml` (novo).

**Tempo:** 1h30.

---

### 4.4. CI/CD PWA expandido (npm, não pnpm)

**Estado atual:**
- Nenhum workflow PWA.
- Projeto usa **npm** (`laura-pwa/package-lock.json`).
- Scripts existentes: `dev`, `build`, `start`, `lint`. Falta `typecheck`.

**Ação proposta:**

1. Adicionar em `laura-pwa/package.json`:
   ```json
   "typecheck": "tsc --noEmit"
   ```

2. Novo `.github/workflows/pwa.yml`:

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
        working-directory: laura-pwa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: laura-pwa/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8080
      - uses: actions/upload-artifact@v4
        with:
          name: pwa-build
          path: laura-pwa/.next
          retention-days: 3

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
        with: { go-version: "1.26" }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm, cache-dependency-path: laura-pwa/package-lock.json }
      - name: apply migrations
        run: |
          go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0
          migrate -path infrastructure/migrations \
            -database "postgres://postgres:postgres@localhost:5432/laura_e2e?sslmode=disable" up
      - name: seed E2E
        env: { DATABASE_URL: "postgres://postgres:postgres@localhost:5432/laura_e2e?sslmode=disable" }
        run: bash scripts/seed-e2e.sh
      - name: start api
        working-directory: laura-go
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/laura_e2e?sslmode=disable
          SESSION_HMAC_KEY: e2e-hmac-key-32-bytes-padding--
          DISABLE_WHATSAPP: "true"
        run: |
          go build -o /tmp/api .
          /tmp/api &
          npx wait-on http://localhost:8080/health
      - name: start pwa
        working-directory: laura-pwa
        env: { NEXT_PUBLIC_API_URL: http://localhost:8080 }
        run: |
          npm ci
          npm run build
          npm start &
          npx wait-on http://localhost:3100
      - run: npx playwright install --with-deps chromium
        working-directory: laura-pwa
      - run: npx playwright test
        working-directory: laura-pwa
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: laura-pwa/playwright-report
```

Observação: PWA roda em porta **3100** (conforme `package.json: dev -p 3100`), API em 8080.

**Novo env flag:** `DISABLE_WHATSAPP=true` para pular inicialização Whatsmeow no CI (requer patch em `laura-go/internal/whatsapp/client.go` para respeitar a flag; se não existir, adicionar).

**Arquivos:** `.github/workflows/pwa.yml` (novo), `laura-pwa/package.json` (+script `typecheck`), `laura-go/internal/whatsapp/client.go` (guard `DISABLE_WHATSAPP`).

**Tempo:** 2h.

---

### 4.5. E2E Playwright cobertura ampliada

**Estado atual:**
- `laura-pwa/tests/mvp-flows.spec.ts` com 2 testes smoke.
- `playwright.config.ts` presente mas `baseURL` comentado.

**Ação proposta:**

Atualizar `playwright.config.ts` para:
```ts
use: {
  baseURL: process.env.BASE_URL ?? "http://localhost:3100",
  trace: "on-first-retry",
  screenshot: "only-on-failure",
},
```

Criar fixture `laura-pwa/tests/fixtures/auth.ts` (login via storageState).

**Novos specs:**

| Arquivo | Cobertura |
|--------|-----------|
| `auth.spec.ts` | register, login, wrong password, logout |
| `transactions.spec.ts` | criar receita/despesa, editar, deletar, filtrar mês |
| `cards-invoices.spec.ts` | criar cartão, fatura atual, empurrar fatura (rollover), estorno |
| `goals.spec.ts` | criar meta, atualizar progresso, concluir |
| `investments.spec.ts` | criar, atualizar preço, ver rentabilidade |
| `score.spec.ts` | gauge, delta mês-a-mês, tooltip |
| `reports.spec.ts` | navegar 9 abas (visão geral, fluxo caixa, categorias, cartões, metas, investimentos, score, comparativo, export) |
| `super-admin.spec.ts` | login, listar tenants, toggle feature flag, impersonate read-only |

**Seed E2E** em `scripts/seed-e2e.sh` cria super admin + tenant default + usuário padrão + 1 conta + categorias.

**Identidade visual (LEI #3):** specs NÃO devem introduzir mudanças visuais; usam apenas seletores `data-testid`. Sem screenshots de baseline nesta fase (fica para Fase 11 visual regression).

**Arquivos:** `laura-pwa/tests/fixtures/auth.ts` (novo), 8 specs novos, `scripts/seed-e2e.sh` (novo), `laura-pwa/playwright.config.ts` (patch baseURL + `globalSetup`).

**Tempo:** 4h.

---

### 4.6. Deploy PWA — Vercel

**Estado atual:** nenhum deploy configurado.

**Ação proposta:**

1. `laura-pwa/vercel.json`:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": "nextjs",
     "installCommand": "npm ci",
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "regions": ["gru1"],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
           { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
         ]
       }
     ]
   }
   ```

2. Env vars (STANDBY [VERCEL-ENV]):
   - `NEXT_PUBLIC_API_URL=https://api.laurafinance.app` (ou `.fly.dev` interim)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `NEXTAUTH_URL=https://app.laurafinance.app`
   - `NEXTAUTH_SECRET=<32-byte random hex>`
   - demais em `.env.example`.

3. Workflow `.github/workflows/deploy-pwa.yml`:
   ```yaml
   name: Deploy PWA
   on:
     push:
       branches: [main]
       paths: ["laura-pwa/**", ".github/workflows/deploy-pwa.yml"]
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
             working-directory: ./laura-pwa
             vercel-args: "--prod"
   ```

4. Domínio custom (STANDBY [DNS] — ver 5.8).

**Arquivos:** `laura-pwa/vercel.json` (novo), `.github/workflows/deploy-pwa.yml` (novo), `docs/ops/deployment.md`.

**Tempo:** 1h + STANDBY.

---

### 4.7. Deploy backend Go — Fly.io

**Estado atual:** nenhum. Binário único `laura-go/main.go`.

**Ação proposta:**

1. `laura-go/Dockerfile`:
   ```dockerfile
   # syntax=docker/dockerfile:1.7

   FROM golang:1.26-alpine AS builder
   WORKDIR /src
   RUN apk add --no-cache ca-certificates git
   COPY laura-go/go.mod laura-go/go.sum ./laura-go/
   WORKDIR /src/laura-go
   RUN go mod download
   COPY laura-go ./
   RUN CGO_ENABLED=0 GOOS=linux go build \
       -ldflags="-s -w -X main.version=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
       -o /out/api .
   RUN go install -tags 'postgres' \
       github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0

   FROM alpine:3.19
   RUN apk add --no-cache ca-certificates tzdata wget \
       && addgroup -S app && adduser -S app -G app
   WORKDIR /app
   COPY --from=builder /out/api /app/api
   COPY --from=builder /go/bin/migrate /usr/local/bin/migrate
   COPY infrastructure/migrations /app/migrations
   COPY scripts/entrypoint.sh /app/entrypoint.sh
   RUN chmod +x /app/entrypoint.sh && chown -R app:app /app
   USER app
   EXPOSE 8080
   HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
     CMD wget -qO- http://localhost:8080/health || exit 1
   ENTRYPOINT ["/app/entrypoint.sh"]
   ```

   > **Build context:** `.` (raiz do monorepo), porque `infrastructure/migrations/` e `scripts/` ficam fora de `laura-go/`. Ajustar `fly.toml` para `dockerfile = "laura-go/Dockerfile"` com context na raiz.

2. `scripts/entrypoint.sh`:
   ```sh
   #!/bin/sh
   set -eu
   if [ "${MIGRATE_ON_BOOT:-true}" = "true" ]; then
     echo "[entrypoint] running migrations..."
     migrate -path /app/migrations -database "$DATABASE_URL" up
   fi
   exec /app/api
   ```

3. `fly.toml` (raiz do monorepo):
   ```toml
   app = "laura-finance-api"
   primary_region = "gru"
   kill_signal = "SIGTERM"
   kill_timeout = 30

   [build]
     dockerfile = "laura-go/Dockerfile"

   [env]
     PORT = "8080"
     MIGRATE_ON_BOOT = "true"
     LOG_LEVEL = "info"
     ENVIRONMENT = "production"

   [http_service]
     internal_port = 8080
     force_https = true
     # CRITICAL: cron in-process precisa VM sempre rodando. Ver 4.12.
     auto_stop_machines = "suspend"
     auto_start_machines = true
     min_machines_running = 1

     [[http_service.checks]]
       interval = "15s"
       timeout = "2s"
       grace_period = "15s"
       method = "GET"
       path = "/health"

   # Sem [[mounts]] — Whatsmeow persiste no Postgres, não em disco. Ver 4.11.

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory = "512mb"
   ```

4. Secrets no Fly (STANDBY [FLY-SECRETS]):
   ```sh
   fly secrets set \
     DATABASE_URL="..." \
     SESSION_HMAC_KEY="..." \
     GROQ_API_KEY="..." \
     STRIPE_SECRET_KEY="sk_live_..." \
     STRIPE_WEBHOOK_SECRET="whsec_..." \
     RESEND_API_KEY="re_..."
   ```

5. Workflow `.github/workflows/deploy-api.yml`:
   ```yaml
   name: Deploy API
   on:
     push:
       branches: [main]
       paths:
         - "laura-go/**"
         - "infrastructure/migrations/**"
         - "scripts/entrypoint.sh"
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

**Multi-arch?** Não nesta fase. Fly builda amd64 remoto nativo (`--remote-only`). ARM seria necessário só para dev Mac local — que já usa Go nativo, não container, então nada a fazer.

**Arquivos:** `laura-go/Dockerfile` (novo), `scripts/entrypoint.sh` (novo), `fly.toml` (novo, raiz), `.github/workflows/deploy-api.yml` (novo), `.dockerignore` (novo, raiz).

**Dependências externas:** STANDBY [FLY-AUTH], STANDBY [FLY-SECRETS].

**Tempo:** 2h + STANDBY.

---

### 4.8. Postgres gerenciado (Fly Postgres)

**Estado atual:** dev usa `postgres:16` via docker compose.

**Ação proposta:**

1. STANDBY [FLY-PG-CREATE]:
   ```sh
   fly postgres create \
     --name laura-finance-db \
     --region gru \
     --initial-cluster-size 1 \
     --vm-size shared-cpu-1x \
     --volume-size 10
   ```
2. Attach ao app: `fly postgres attach laura-finance-db --app laura-finance-api` → popula `DATABASE_URL` automaticamente.
3. Habilitar pgvector:
   ```sh
   fly postgres connect -a laura-finance-db
   # dentro do psql:
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Backup — ver 4.10.

**Tempo:** 1h + STANDBY.

---

### 4.9. Documentação operacional

**Estado atual:** sem `HANDOFF.md`, sem `docs/ops/`.

**Ação proposta:**

1. `docs/HANDOFF.md` (raiz `docs/`) — estado prod, pendências STANDBY, secrets, comandos úteis, rollback rápido.
2. `docs/ops/security.md` — threat model STRIDE, política de secrets, rotação, playbook chave vazada, headers aplicados.
3. `docs/ops/deployment.md` — primeiro deploy passo-a-passo, rollback, troubleshooting.
4. `docs/ops/runbooks/secrets-rotation.md` — runbook geral de rotação (Groq, Stripe, Resend, NEXTAUTH_SECRET, SESSION_HMAC_KEY), frequência recomendada (90d), zero-downtime (dual-key window para SESSION_HMAC).
5. `docs/ops/runbooks/rollback.md` — ver 5.7.
6. `.env.example` na raiz:
   ```
   # Core
   ENVIRONMENT=development
   LOG_LEVEL=debug

   # Database
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/laura?sslmode=disable

   # Session / Auth
   SESSION_HMAC_KEY=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=http://localhost:3100

   # AI providers
   GROQ_API_KEY=
   OPENAI_API_KEY=
   GOOGLE_AI_API_KEY=

   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

   # Email
   RESEND_API_KEY=

   # Frontend
   NEXT_PUBLIC_API_URL=http://localhost:8080

   # Runtime flags
   MIGRATE_ON_BOOT=false
   DISABLE_WHATSAPP=false
   ```

**Tempo:** 2h30 (inclui runbooks).

---

### 4.10. Backup do Postgres prod (novo em v2)

**Camada 1 — Fly nativo (default nesta fase):**
- Fly Postgres faz snapshot diário automático, retenção 7 dias (free tier).
- Comandos: `fly postgres backup list -a laura-finance-db`, `fly postgres backup restore <id>`.
- Documentar em `ops/security.md` + `ops/runbooks/rollback.md`.

**Camada 2 — backup off-site (fase posterior):**
- `pg_dump` + `age -r <pubkey>` + `aws s3 cp` em cron.
- Mencionado mas NÃO executado na Fase 10 (ver 3.2).

**Drill:**
- Incluir em `ops/runbooks/rollback.md` exercício de restore contra DB descartável (staging futuro).

**Tempo:** 30 min (docs + comandos).

---

### 4.11. Whatsmeow session persistence (novo em v2)

**Descoberta crítica de review #1:**
Diferente do padrão comum da lib (SQLite local), o projeto **já** usa o Postgres como store via:
```go
container, err := sqlstore.New(context.Background(), "postgres", dbURL, dbLog)
```
em `laura-go/internal/whatsapp/client.go`. A sessão (pre-keys, identity, signal store) vive em tabelas `whatsmeow_*` geradas pela própria lib no Postgres.

**Implicações:**
- **NÃO precisa** `[[mounts]]` no `fly.toml` (v1 estava errado).
- O Fly Postgres já armazena a sessão — resiliência herdada do backup do DB.
- Cold start em nova VM reconecta automaticamente usando credenciais persistidas.
- Se `DATABASE_URL` mudar (ex: troca de cluster), sessão é perdida → novo QR scan necessário. Documentar em `ops/deployment.md`.

**Ação:**
- Remover `[[mounts]]` do `fly.toml`.
- Adicionar parágrafo em `ops/deployment.md` explicando persistência + recuperação pós-restore de backup.
- Confirmar que `CREATE EXTENSION IF NOT EXISTS ...` do whatsmeow roda em boot (já roda via `sqlstore.New`).

**Tempo:** 15 min (remoção + docs).

---

### 4.12. Cron jobs no Fly (novo em v2)

**Estado descoberto:**
`laura-go/internal/services/cron.go` usa `robfig/cron/v3` **in-process**, rodando 3 jobs:
- `0 20 * * *` — budget check
- `0 3 * * *` — score snapshot (`runDailyScoreSnapshot`)
- `15 3 * * *` — score band nudges

**Implicação crítica:**
- Cron vive dentro do binário da API; se Fly suspender a VM (autosleep), cron não dispara.
- **Ação:** usar `auto_stop_machines = "suspend"` (NÃO `"stop"`) + `min_machines_running = 1` no `fly.toml`. Suspend mantém estado, stop destrói. Cron in-process continua rodando.
- Fuso horário: container alpine vem UTC. Cron roda "server time". Para jobs 20:00/03:00 "horário Brasil", precisa `TZ=America/Sao_Paulo` no ambiente OU ajustar cron para UTC-3:
  - 20:00 BRT = 23:00 UTC → `0 23 * * *`
  - 03:00 BRT = 06:00 UTC → `0 6 * * *`
  - 03:15 BRT = 06:15 UTC → `15 6 * * *`
- **Recomendação:** setar `TZ=America/Sao_Paulo` no `[env]` do `fly.toml` (tzdata já está no Dockerfile) — mais seguro que refatorar strings cron.

**Ação:**
- Adicionar `TZ = "America/Sao_Paulo"` no `[env]` do `fly.toml`.
- Documentar comportamento em `ops/deployment.md`.
- Alternativa futura (Fase 11+): extrair cron para **Fly Machines scheduled** (`fly m run ... --schedule daily`) ou worker separado. Hoje, overkill.

**Tempo:** 20 min.

---

## 5. Decisões de arquitetura

### 5.1. Por que Vercel para PWA

Idêntico à v1 (ergonomia Next 16, preview deploys, free tier, edge global).

### 5.2. Por que Fly.io para Go (websockets + cron)

- Websockets persistentes (Whatsmeow conecta com `gws://` longo).
- Cron in-process: `auto_stop_machines = "suspend"` + `min_machines_running = 1` preserva processo.
- Região `gru` (São Paulo).
- Free tier útil.
- Alternativas descartadas idênticas à v1.

### 5.3. Por que Fly Postgres

Idêntico à v1 (co-localização, attach, pgvector, backup 7d).

### 5.4. Estratégia de migrations em prod

`golang-migrate` v4 via entrypoint (`MIGRATE_ON_BOOT=true`). Lock via `pg_advisory_lock` automático. Forward-only; rollback = nova migration compensatória. CI valida idempotência (4.2-bis).

### 5.5. Estratégia de secrets

| Secret | Vive em | Injetado em |
|--------|---------|-------------|
| `DATABASE_URL` | Fly secrets (auto via attach) | container API |
| `SESSION_HMAC_KEY` | Fly secrets | container API |
| `GROQ_API_KEY` | Fly secrets | container API |
| `STRIPE_SECRET_KEY` | Fly secrets | container API |
| `STRIPE_WEBHOOK_SECRET` | Fly secrets | container API |
| `RESEND_API_KEY` | Fly secrets | container API |
| `NEXTAUTH_SECRET` | Vercel env | runtime/build PWA |
| `NEXT_PUBLIC_*` | Vercel env (build-time) | bundle PWA |
| `FLY_API_TOKEN` | GitHub secrets | workflow deploy-api |
| `VERCEL_TOKEN/ORG_ID/PROJECT_ID` | GitHub secrets | workflow deploy-pwa |
| `CODECOV_TOKEN` | GitHub secrets | workflow go CI (opcional) |

Rotação: 90 dias (rotina); imediata (vazamento). Runbook em `ops/runbooks/secrets-rotation.md`.

### 5.6. Custos esperados (novo em v2)

**Free tier de partida (MVP sem tráfego real):**
- **Vercel Hobby:** 100GB bandwidth/mês, builds ilimitados, preview deploys. Gratuito.
- **Fly.io:** 3× shared-cpu-1x / 256MB (obs: config sugerida usa 512MB → consome 2 "unidades" free; ainda dentro do plano "pay-as-you-go" com ~US$1.94/mês se passar do free). Com `min_machines_running = 1`, fica sempre on, aproximadamente US$5-7/mês em shared-1x/512MB no cenário pós free tier. **Realista: ~US$5/mês.**
- **Fly Postgres shared-cpu-1x / 10GB volume:** ~US$2/mês volume + CPU free tier (1 cluster). **Realista: ~US$2-4/mês.**
- **Groq:** free tier generoso (rate-limited); se exceder, pay-as-you-go (~US$0.05-0.79/M tokens).
- **Resend:** 100 emails/dia grátis, 3k/mês free tier.
- **Stripe:** sem custo fixo; taxa por transação.

**Total esperado MVP low-traffic:** US$0-10/mês. Se tráfego crescer, reavaliar (principal pressão virá de Fly VM + Fly Postgres quando precisar de dedicated-cpu).

**Trigger de upgrade:**
- >1000 DAU → avaliar `dedicated-cpu-1x` + `performance-2x` memory.
- Groq latência ou rate-limit incomodando → plano pago.

### 5.7. Estratégia de rollback (novo em v2)

**API (Fly):**
1. `fly releases -a laura-finance-api` — ver lista.
2. `fly deploy --image registry.fly.io/laura-finance-api:deployment-<sha-anterior>` OU `fly releases rollback <version>`.
3. Validar `/health` → 200.
4. Se rollback inclui reversão de schema: **nova migration compensatória** (nunca `migrate down` em prod; forward-only).

**PWA (Vercel):**
1. Dashboard → Deployments → selecionar anterior → "Promote to Production".
2. CLI alternativa: `vercel promote <deployment-url>`.
3. Validação: abrir URL prod + smoke-test manual (login, dashboard).

**Banco:**
- Se migration da release atual corrompeu dados: `fly postgres backup restore <id-pre-release>`. **Downtime** durante restore (aceito no MVP).

**Runbook completo:** `docs/ops/runbooks/rollback.md` com step-by-step + critérios para decidir entre rollback vs. hotfix-forward.

### 5.8. Estratégia de DNS (novo em v2)

**MVP (STANDBY [DNS]):**
- Usuário decide entre:
  - **(A)** domínio próprio (`laurafinance.app`): PWA em `app.laurafinance.app` (CNAME → Vercel), API em `api.laurafinance.app` (CNAME → `.fly.dev`).
  - **(B)** interim sem domínio: `laura-finance.vercel.app` + `laura-finance-api.fly.dev`. Bom pra launch rápido; problema: `NEXT_PUBLIC_API_URL` passa a apontar pro `.fly.dev` até migrar.

**Recomendação:** começar com (B) e migrar para (A) antes de comunicar beta fechado. DNS cutover é simples (um env var por superfície + propagação).

**TLS:** Fly e Vercel provisionam Let's Encrypt automático.

**HSTS preload:** incluído em `vercel.json`; API Go pode adicionar header via middleware (task menor; não-bloqueante nesta fase).

### 5.9. Invariantes técnicas preservadas (LEI #5 — novo em v2)

Esta fase é **infra + CI/CD + docs**, não toca código de domínio. Invariantes do CLAUDE.md que permanecem intactas:

- **Moeda em centavos** (`amount_cents`, `target_cents`, `current_cents`, `monthly_limit_cents`) — migration 035 **reforça** com `CHECK (amount > 0)` etc.
- **HMAC sessão** (`SESSION_HMAC_KEY`) — continua em env var única; runbook de rotação adiciona dual-key window.
- **Whitelist SQL** — nada muda.
- **Context timeout** — nada muda.
- **Paridade Go↔PWA** — nada muda; E2E apenas valida caminhos já implementados.

Qualquer divergência observada durante execução da fase deve parar o trabalho e consultar `nexus-blueprint` + revisão humana.

---

## 6. Pré-requisitos / dependências externas (STANDBY)

| ID | Item | Bloqueia o quê |
|----|------|----------------|
| **STANDBY [GROQ-REVOKE]** | Revogar GROQ_API_KEY antiga + gerar nova | fim de 4.1 |
| **STANDBY [FORCE-PUSH]** | Confirmação para force push em main | passo final de 4.1 |
| **STANDBY [VERCEL-AUTH]** | Conta Vercel + `vercel login` + tokens | deploy 4.6 |
| **STANDBY [VERCEL-ENV]** | Preencher env vars prod Vercel | build prod PWA |
| **STANDBY [FLY-AUTH]** | Conta Fly + `fly auth login` + token | deploy 4.7 |
| **STANDBY [FLY-SECRETS]** | `fly secrets set ...` | API prod funcional |
| **STANDBY [FLY-PG-CREATE]** | `fly postgres create` + attach + `CREATE EXTENSION vector` | DB prod 4.8 |
| **STANDBY [STRIPE-LIVE]** | Stripe live keys (hoje temos test) | cobrança real |
| **STANDBY [RESEND-DOMAIN]** | Resend key + domínio verificado | envio e-mail prod |
| **STANDBY [DNS]** | Decisão domínio (A próprio vs B interim) + registros DNS | URLs finais |
| **STANDBY [CODECOV-TOKEN]** | Token Codecov | coverage upload (opcional) |

Enquanto esses itens não chegam, marcamos como "prepared / awaiting activation".

### 6.X. Pre-commit hook gitleaks (opcional, novo em v2)

**Recomendação:** adicionar hook **local** para bloquear commit com segredo antes do push.

**Opções:**
- (A) `lefthook` (Go binary, rápido): `lefthook.yml` com step `gitleaks protect --staged`.
- (B) `pre-commit` framework (Python): `.pre-commit-config.yaml` com `gitleaks/gitleaks`.

**Recomendação: (A) lefthook** — instalação `brew install lefthook && lefthook install` na raiz. Zero dep Python; Go-native alinhado ao backend.

**Arquivos:** `lefthook.yml` (novo), instrução em `docs/HANDOFF.md` para novos devs rodarem `lefthook install`.

**Tempo:** 15 min.

### 6.Y. `.gitignore` e `.dockerignore` (novo em v2)

Garantir cobertura:
```
# .gitignore raiz
.env
.env.*
!.env.example
secrets/
*.local
bin/
pgdata/
node_modules/
.next/
*.log
coverage.out
playwright-report/
test-results/
```
`.dockerignore` raiz deve excluir `.git`, `node_modules`, `laura-pwa/`, `.github/`, `docs/`, `_bmad*`, `*.log` para reduzir build context do Go.

---

## 7. Critérios de aceite (DoD da fase)

1. **Segurança**
   - [ ] `git log -p -S<trecho-groq> --all` retorna vazio.
   - [ ] `.gitleaks.toml` presente e CI passa clean.
   - [ ] `gosec` + `govulncheck` rodam no CI sem issues HIGH.
   - [ ] `.env.example` cobre 100% das variáveis (`rg -o 'os.Getenv\("[A-Z_]+"\)' laura-go` + `rg -o 'process\.env\.[A-Z_]+' laura-pwa`).
   - [ ] Pre-commit lefthook instalável (documentado em HANDOFF).

2. **Migrations**
   - [ ] `migrate up` idempotente (segunda exec = no change).
   - [ ] Entrypoint roda migrations com `MIGRATE_ON_BOOT=true`.
   - [ ] CI aplica TODAS as 35 migrations em Postgres de teste antes dos testes Go.
   - [ ] Job dedicado valida idempotência de 000035.

3. **CI/CD**
   - [ ] PR dispara: `go.yml`, `pwa.yml`, gitleaks (embutido no go.yml).
   - [ ] Todos verdes em um PR de teste.
   - [ ] `deploy-api.yml` + `deploy-pwa.yml` validam em `actionlint`.

4. **E2E**
   - [ ] 8 novos specs implementados.
   - [ ] Suíte completa <10 min no CI.
   - [ ] Zero flakes em 3 execuções consecutivas.

5. **Deploy prep**
   - [ ] `docker build` da API local: imagem <80MB, `/health` 200.
   - [ ] `fly config validate` OK.
   - [ ] `vercel inspect` OK.
   - [ ] Deploy real: STANDBY.

6. **Observabilidade mínima**
   - [ ] `/health` e `/ready` implementados (se não existem; verificar `laura-go`).
   - [ ] Middleware `request-id` propagando header `X-Request-Id`.
   - [ ] Logs em JSON quando `ENVIRONMENT=production`.

7. **Rollback**
   - [ ] `ops/runbooks/rollback.md` documenta rollback API + PWA + DB.

8. **Docs**
   - [ ] `HANDOFF.md`, `security.md`, `deployment.md`, `runbooks/secrets-rotation.md`, `runbooks/rollback.md` presentes e populados.

9. **Commit + memory**
   - [ ] Commits PT-BR estilo repo.
   - [ ] Nova entrada em memory index.
   - [ ] Specs/plans v3 finais arquivados.

---

## 8. Riscos

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| `git filter-repo` corrompe repo local | baixa | alto | Backup antes; validar clone limpo antes de force push |
| Force push quebra clones de colab | média | médio | Sem colab hoje; aviso em HANDOFF |
| Migration 000035 não é idempotente | baixa | alto | `DELETE` tem `IF EXISTS` implícito; `CREATE INDEX IF NOT EXISTS`; `DO $$` defensivo. 4.2-bis valida no CI |
| Migration 000035 destrói dados legítimos ao aplicar `DELETE ... WHERE workspace_id IS NULL` em prod | **média** | **alto** | **Pré-deploy em prod: `SELECT COUNT(*) WHERE workspace_id IS NULL` em cada tabela; se >0, investigar antes** |
| Whatsmeow reconecta em loop após deploy (mudança de DATABASE_URL) | baixa | médio | Documentar no runbook; se mudar cluster, QR scan novo |
| `auto_stop_machines = "stop"` mata cron | alta se mal configurado | alto | Forçar `"suspend"` + `min_machines_running = 1` |
| Fuso horário errado → cron dispara 3h mais cedo/tarde | média | médio | `TZ=America/Sao_Paulo` no `[env]` do fly.toml |
| Free tier Fly insuficiente para warm-start contínuo | média | baixo | `min_machines_running = 1` — aceitar ~US$5/mês se sair do free |
| Playwright flaky em CI | alta | médio | `retries: 2` + `wait-on` + screenshots on-failure |
| Vercel build diff dev↔prod | média | médio | Validar build local com `NODE_ENV=production` |
| `gosec`/`govulncheck` falso-positivo bloqueia CI | média | baixo | Começar com `continue-on-error: true` em `gosec` → promover após baseline |
| pgvector não sobe em Fly Postgres | baixa | alto | `CREATE EXTENSION` explícito no runbook + teste no primeiro deploy |
| Usuário esquece de revogar Groq key | média | alto | HANDOFF destaca; item #1 visível |
| `DISABLE_WHATSAPP=true` em CI quebra handlers dependentes | média | médio | Guard em `client.go` + testes mockam `Client` com stub |

---

## 9. Métricas de sucesso

- **CI full (PR → verde):** <12 min (Go + PWA + E2E paralelos).
- **Deploy API (push → live):** <5 min.
- **Deploy PWA (push → live):** <3 min.
- **Cobertura E2E:** ≥80% dos fluxos críticos (9/11).
- **`gosec` HIGH:** 0.
- **`govulncheck` findings:** 0 em deps diretas.
- **Segredos no histórico:** 0 (`gitleaks detect --log-opts '--all'` limpo).
- **Tempo para retomar projeto em nova sessão:** <5 min lendo `HANDOFF.md`.
- **Custo mensal produção (MVP):** <US$15/mês.

---

## 10. Plano de testes

### 10.1. Sanitização git
- Pós `git filter-repo`: `git log -p -S<key> --all | wc -l` → 0.
- Clone fresco do remote: mesmo resultado.
- `gitleaks detect --source . --log-opts '--all'` → sai 0.

### 10.2. Migrations
- `docker compose down -v && up -d db` → DB zerado.
- `./scripts/migrate.sh up` → sucesso (35 migrations aplicadas).
- `./scripts/migrate.sh up` novamente → `no change`.
- Job CI 4.2-bis replica os dois passos.
- **Teste destrutivo controlado:** em DB dev com `INSERT INTO transactions (workspace_id) VALUES (NULL)`; rodar `migrate up` → linha removida; validar `SELECT * FROM transactions WHERE workspace_id IS NULL` = 0 linhas.

### 10.3. CI
- Abrir PR `test/fase-10-ci` com commit trivial.
- Observar 2 workflows: `go.yml`, `pwa.yml`.
- Forçar falha (`fmt.Prinln` typo) → CI pega.

### 10.4. E2E
- `npx playwright test` local → 8 specs verdes.
- Rodar 3× → zero flakes.
- CI: baixar `playwright-report` artifact em run de falha proposital.

### 10.5. Dockerfile Go
- `docker build -f laura-go/Dockerfile -t laura-api:test .` (context = raiz).
- Imagem final <80MB.
- `docker run --rm -e DATABASE_URL=... -e DISABLE_WHATSAPP=true -p 8080:8080 laura-api:test` → `/health` 200.

### 10.6. Fly config
- `fly config validate` → ok.
- Verificar `TZ=America/Sao_Paulo` injetado.
- STANDBY: deploy real em app descartável (`laura-finance-api-stg`).

### 10.7. Vercel config
- `vercel build` local em `laura-pwa/` → verde.
- STANDBY: deploy preview.

### 10.8. Rollback drill (novo em v2)
- Deploy fake de uma "release quebrada" (binário trivial que retorna 500) em app de staging.
- Executar rollback via runbook → `/health` 200 em <2 min.

### 10.9. Documentação
- Agente em fresh session lê `HANDOFF.md` + runbooks e reproduz ambiente dev em <10 min.

---

## 11. Backlog (fora do escopo da Fase 10)

Registrado aqui para não se perder:

- **Fase 11 — Observabilidade:** Prometheus/Grafana/OTEL, Sentry com release tracking, SLOs, alertas granulares.
- **Fase 12 — DR/HA:** backup off-site (`pg_dump | age | s3`), multi-region read replica, disaster recovery drill.
- **Fase 13 — WAF/CDN:** Cloudflare na frente, rate-limit global, bot mitigation.
- **Fase 14 — Compliance LGPD:** DPO, RoPA, DPIA, política de retenção formalizada.
- **Fase 15 — Open Finance / Pix API:** integração com bancos via Open Finance Brasil, ingestão automática de transações, categorização via IA.
- **Fase 16 — Visual regression Playwright:** snapshots + diff baseline darwin/linux (hoje segurado até Fase 11).
- **Fase 17 — Fly Machines scheduled para cron:** extrair jobs para machines dedicadas com `--schedule`, desacoplando da API HTTP.
- **Fase 18 — Bug bounty / pentest externo:** após launch fechado.

---

## 12. Glossário e referências

| Termo | Significado |
|-------|-------------|
| PWA | Progressive Web App (`laura-pwa/`) |
| API | Backend Go Fiber v2 (`laura-go/`) |
| STANDBY [<id>] | Item aguardando ação externa do usuário (LEI #1.3 CLAUDE.md) |
| pgvector | Extensão Postgres para embeddings vetoriais |
| `fly m` | `flyctl machines` |
| BRT | Brasília Time (UTC-3) |
| HMAC | Hash-based Message Authentication Code (usado em sessão) |

**Referências:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (seção `security-hardening`).
- `infrastructure/migrations/000035_security_hardening.sql` (conteúdo real inspecionado).
- `laura-go/internal/services/cron.go` (3 jobs cron in-process).
- `laura-go/internal/whatsapp/client.go` (Whatsmeow via Postgres `sqlstore`).
- `laura-pwa/package.json` (Next 16.1.6 + React 19.2.3 + npm).
- `laura-go/go.mod` (Go 1.26.1).
- CLAUDE.md LEI #1 (debug via logs), #3 (identidade visual), #5 (invariantes técnicas).
- Nexus Blueprint `/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/` — patterns de dashboard, settings, deploy.

---

**Fim do Spec v2.** Revisão v2 deve validar:
- Runbook rollback passou em drill?
- `DISABLE_WHATSAPP` guard realmente existe ou precisa ser implementado?
- Decisão DNS (A vs B) — usuário respondeu?
- Custo Fly pós-free-tier é aceitável (<US$10/mês) ou precisa ajustar memória?
- Pre-commit hook lefthook vs pre-commit: qual o usuário prefere?
- Observabilidade mínima (health/ready/request-id) já existe no código hoje ou precisa PR?
