# Fase 10 — Security closeout + infraestrutura mínima de produção (Spec v3 FINAL)

> Versão: v3 (FINAL — base para o plan)
> Data: 2026-04-15
> Autor: agente autônomo (após review #2)
> Status: **congelado para início do plan v1**
> Projeto: Laura Finance (Vibe Coding)
> Fases anteriores: Epics 1-9 (MVP) + Super Admin Panel concluídos

## Mudanças principais vs v2

1. **Migration 000035 ganhou etapa de dry-run obrigatória** antes do `BEGIN` real em prod: `SELECT COUNT(*) WHERE workspace_id IS NULL` em cada uma das 8 tabelas, com thresholds e procedimento de rollback pré-scripted (seção 4.2 + 4.2-ter).
2. **`sqlstore.Container.Upgrade(ctx)` é chamada explícita obrigatória** — a auditoria do código confirmou que `sqlstore.New` é chamado (`whatsapp/client.go:47` e `whatsapp/instance_manager.go:110`) **mas `Container.Upgrade` NÃO é invocado**. Sem isso, o primeiro boot em prod falha ao tentar ler tabelas `whatsmeow_*` inexistentes. Novo patch em 4.11 adiciona `container.Upgrade(ctx)` após `sqlstore.New`.
3. **Request-ID middleware é tarefa nova no escopo** — auditoria confirmou ausência total (`grep RequestID|X-Request-Id` = 0 matches). Adicionado a 4.13 (nova seção).
4. **Handler `/ready` é tarefa nova no escopo** — `/health` existe (em `main.go:39` string e em `router.go:45` JSON via `/api/v1/health`), mas `/ready` (readiness probe com ping em DB + Redis se aplicável) não existe. Adicionado a 4.13.
5. **`DISABLE_WHATSAPP` precisa ser implementado** — auditoria do código confirmou que a flag não existe em nenhum lugar (`grep` = 0 matches). Patch em `main.go` e `whatsapp/client.go` listado como entrega explícita em 4.4 e 4.11.
6. **Dockerfile Go ganha build-tag `timetzdata`** (`go build -tags timetzdata`) para não depender de `/etc/localtime`. Validado para cenário `distroless/static` ou `alpine:3.19` sem tzdata. Ver 4.7.
7. **Migrations embutidas via `embed.FS`** no binário Go — `infrastructure/migrations/*.sql` é empacotado no binário e aplicado via `github.com/golang-migrate/migrate/v4` com source `iofs`. Flag `MIGRATE_ON_BOOT=true` controla. Substitui cópia via Dockerfile (mais robusto, elimina descompasso binário↔pasta). Detalhes em 4.2 e 4.7.
8. **Race de deploy multi-máquina resolvida explicitamente** — `golang-migrate` já usa `pg_advisory_lock`, mas reforçamos que **apenas 1 máquina Fly deve rodar** neste MVP (`max_machines_count = 1` + `min_machines_running = 1`). Cron in-process não suporta múltiplas réplicas sem leader-election. Ver 4.12 e 5.10.
9. **Escolha definitiva de tooling de migration: `golang-migrate/migrate` v4** (biblioteca + CLI). Justificativa, alternativa descartada (goose) e uso duplo (boot do binário + CLI standalone em scripts) em 5.4.
10. **Ordem operacional de STANDBY [GROQ-REVOKE] + [FORCE-PUSH] formalizada passo-a-passo** (6 passos, do revoke até push), com observação explícita de que Fly/Vercel não são impactados por force push (4.1).
11. **Sentry empurrado para Fase 11** como `STANDBY [SENTRY-DSN]` registrado no backlog — nada na Fase 10.
12. **Rate limiter confirmado ativo** em `router.go:21` (Fiber `limiter.New`, 60 req/min). Nada a mudar; apenas documentar pós-deploy em 4.13.
13. **Nova seção 13** resolve as 6 questões abertas deixadas no rodapé da v2.
14. **Nova seção 14** lista pré-condições para o plan v1 assumir.
15. **Nova seção 15** consolida checklist numerado 1:1 de todas as entregas.

---

## 1. Objetivo

Encerrar a trilha de "security hardening" pendente desde os Epics 8/9 e disponibilizar a infraestrutura mínima necessária para colocar o Laura Finance em produção pela primeira vez, ponta a ponta, com pipeline automatizado (CI/CD), observabilidade básica, secrets gerenciados, cobertura E2E razoável e documentação operacional.

Em termos concretos, ao final da Fase 10 o projeto deve estar em um estado no qual:

1. O histórico Git está limpo de qualquer segredo vazado (`GROQ_API_KEY` em especial) e futuras regressões são detectadas automaticamente via CI (`gitleaks` com baseline) e via pre-commit hook opcional.
2. Todas as migrations em `infrastructure/migrations/` (até a `000035_security_hardening.sql`) estão aplicadas no Postgres local e há um caminho documentado, testado, **validado no CI** e **com procedimento de dry-run destrutivo pré-prod** para aplicá-las em produção.
3. Existe pipeline CI funcional tanto para `laura-go/` quanto para `laura-pwa/`: build, lint, testes unitários, testes E2E (PWA), análise estática de segurança (`gosec`, `govulncheck`, `gitleaks`).
4. A suíte E2E Playwright cobre os fluxos críticos em vez dos testes smoke atuais.
5. Os arquivos necessários para deploy em **Vercel (PWA)** + **Fly.io (API Go)** + **Fly Postgres (DB gerenciado)** estão todos criados e versionados: `Dockerfile`, `fly.toml`, `vercel.json`, workflows de deploy, `.env.example` completo. Execução efetiva do deploy fica em **STANDBY** aguardando credenciais do usuário.
6. Existe documentação operacional mínima: `docs/HANDOFF.md`, `docs/ops/security.md`, `docs/ops/deployment.md`, `docs/ops/runbooks/secrets-rotation.md`, `docs/ops/runbooks/rollback.md`.
7. Plano de rollback explícito (API e PWA) está documentado e referenciado em `HANDOFF.md`.
8. Middleware `request-id` + handler `/ready` + `Container.Upgrade()` do Whatsmeow + guard `DISABLE_WHATSAPP` existem no código (4 patches mínimos em `laura-go`).

Esta fase **não** pretende entregar observabilidade completa (métricas, tracing, SLOs, Sentry release tracking), multi-region, DR automatizado nem Open Finance. Fica para fases posteriores.

---

## 2. Contexto e motivação

O Laura Finance hoje está em "MVP completo em dev, sem prod". Epics 1-9 entregaram toda a funcionalidade de negócio (contas, transações, cartões, faturas, metas, investimentos, score, relatórios 9 abas, automações, super admin panel). O projeto roda localmente via `docker compose` em `infrastructure/docker-compose.yml`.

A auditoria de segurança de 2026-04-15 identificou 8 itens residuais que precisam ser resolvidos antes de qualquer push para prod:

1. **Vazamento de segredo no histórico Git** — `GROQ_API_KEY` aparece literalmente em commits (a partir de `bd88cfe`).
2. **Migration 000035** — destrutiva condicional.
3. **CI/CD Go ausente** — `.github/workflows/` não existe hoje.
4. **CI/CD PWA ausente** — só 2 testes smoke.
5. **Cobertura E2E insuficiente**.
6. **Deploy inexistente** — sem `Dockerfile`, sem `fly.toml`, sem `vercel.json`.
7. **Docker Compose de dev** — credenciais default.
8. **Documentação operacional** — sem `HANDOFF.md`.

Adicionados via review #2:

9. **`Container.Upgrade()` do Whatsmeow ausente** — código chama `sqlstore.New` mas não chama `Upgrade`. Primeiro boot em prod falha.
10. **Request-ID middleware ausente** — nenhum `X-Request-Id` hoje.
11. **`/ready` ausente** — só há `/health` simples.
12. **`DISABLE_WHATSAPP` flag ausente** — bloqueador para CI headless.

---

## 3. Escopo

### 3.1. Dentro do escopo

1. Sanitização do histórico Git (revoke + filter-repo + force-push coordenado).
2. Aplicação + validação CI + procedimento dry-run prod da migration 000035.
3. CI/CD Go (`go.yml`): vet, golangci-lint, gosec, govulncheck, migrate up (idempotência), go test -race, gitleaks.
4. CI/CD PWA (`pwa.yml`): typecheck, lint, build, E2E Playwright.
5. E2E Playwright expandido (8 novos specs).
6. Deploy PWA — Vercel (`vercel.json` + workflow + headers + HSTS).
7. Deploy backend Go — Fly.io (`Dockerfile` + `fly.toml` + entrypoint + workflow).
8. Postgres gerenciado (Fly Postgres + pgvector + backup 7d).
9. Secrets matrix + `.env.example` cobrindo 100% + pre-commit lefthook.
10. Documentação operacional completa.
11. Rollback documentado + drill.
12. **Patches em `laura-go` (4 itens):**
    - `Container.Upgrade(ctx)` após `sqlstore.New` em `internal/whatsapp/{client,instance_manager}.go`.
    - `DISABLE_WHATSAPP=true` guard em `InitWhatsmeow` / `NewClient`.
    - Middleware `fiber/middleware/requestid` antes de logger/recover em `main.go`.
    - Handler `/ready` com ping DB (e Redis se aplicável).
13. Migrations embutidas via `embed.FS` no binário Go.

### 3.2. Fora do escopo (próximas fases)

- Observabilidade completa (Prometheus/Grafana/OTEL, Sentry release tracking) → Fase 11.
- Multi-region / read replica.
- DR automatizado (`pg_dump | age | s3`).
- WAF / rate-limit global (Cloudflare).
- Bug bounty / pentest.
- Compliance LGPD formal (DPO, RoPA, DPIA).
- Open Finance / Pix API.
- Visual regression Playwright.
- Fly Machines scheduled para cron (extração).
- Logger estruturado (migração `log.Printf` → `zap`/`slog`).
- Semver + release engineering formal.
- Multi-réplica com leader-election para cron.

---

## 4. Pendências detalhadas

### 4.1. Sanitização do histórico Git (Groq key)

**Estado atual:**
- Commit `bd88cfe` e adjacentes contêm `GROQ_API_KEY=gsk_...` literal.
- `git log -p -Sgsk_ --all` recupera o valor.
- Repo privado hoje; qualquer mudança de visibilidade expõe.

**Ordem operacional canônica (STANDBY [GROQ-REVOKE] + [FORCE-PUSH]):**

1. **Usuário**: revoga a key antiga em https://console.groq.com/keys.
2. **Usuário**: gera nova key, guarda no cofre local.
3. **Agente**: atualiza GitHub secret `GROQ_API_KEY` (workflows) e Fly secret (`fly secrets set GROQ_API_KEY=...`). Vercel não usa Groq key diretamente (PWA consome via API).
4. **Agente**: backup do repo local antes do rewrite:
   ```sh
   cd "/Users/joaovitorzanini/Developer/Claude Code/"
   cp -R "Laura Finance (Vibe Coding)" "Laura Finance (Vibe Coding).bak-$(date +%Y%m%d)"
   ```
5. **Agente**: instala `git-filter-repo` (`brew install git-filter-repo`), cria `.git-secrets-to-purge.txt` com a key EXATA vazada, roda:
   ```sh
   git filter-repo --replace-text .git-secrets-to-purge.txt --force
   git log -p -Sgsk_ --all | head   # deve sair vazio
   ```
6. **Agente → Usuário**: confirma força push:
   ```sh
   git push --force --all
   git push --force --tags
   ```
   **Observação:** Fly e Vercel são deploy-por-SHA (puxam a HEAD atual quando o workflow dispara); force push NÃO os quebra. Apenas clones locais de outros devs ficam inválidos (não há hoje).

**Guardas automatizadas pós-rewrite:**
- `.gitleaks.toml` na raiz bloqueando `gsk_*`, `sk_live_*`, `re_*`, `whsec_*`, JWT HMAC, chaves OpenSSH/PGP.
- Step `gitleaks` no `go.yml`.
- `lefthook.yml` com `gitleaks protect --staged` (opcional, documentado em HANDOFF).

**Arquivos:** `.git-secrets-to-purge.txt` (temporário, não versionar), `.gitleaks.toml` (novo), `.github/workflows/go.yml` (step gitleaks), `lefthook.yml` (novo), `docs/ops/security.md`, `docs/HANDOFF.md`.

**Dependências externas:** STANDBY [GROQ-REVOKE], STANDBY [FORCE-PUSH].

**Tempo:** 45 min.

---

### 4.2. Migration 000035 — aplicação local + prep prod (com dry-run obrigatório)

**Estado atual:**
- Arquivo existe: `infrastructure/migrations/000035_security_hardening.sql`.
- 8 `DELETE FROM <tabela> WHERE workspace_id IS NULL` + NOT NULL + CHECK constraints + índices compostos.
- Dev local em `schema_migrations.version = 34`.
- Prod: N/A (sem prod).

**Ação proposta:**

1. Em dev: rodar `migrate up` → version = 35.
2. Ferramenta oficial: `github.com/golang-migrate/migrate/v4`.
   - Embutida no binário via `embed.FS` (ver 4.7).
   - CLI instalável via `go install -tags postgres .../cmd/migrate@v4.17.0` para scripts locais.
3. `scripts/migrate.sh` — wrapper fino para CLI migrar DB local.
4. Documentar em `ops/deployment.md` as duas opções:
   - **A — entrypoint on-boot (default recomendado).** Controlado por `MIGRATE_ON_BOOT=true` no Fly env. `pg_advisory_lock` (nativo do `golang-migrate`) previne race entre máquinas.
   - **B — SSH manual (rollback + edge cases).**
5. Testar idempotência: rodar `migrate up` 2× → segunda = `no change`.
6. Atualizar seed scripts (E2E) conforme necessário.

**4.2-bis — Validação automatizada no CI (Go workflow):**
- Sobe Postgres 16.
- Baixa CLI `migrate`.
- Roda `migrate up` → aplica 35.
- Roda `migrate up` de novo → espera `no change`.
- Roda `go test -race ./...` contra esse DB.

**4.2-ter — Dry-run destrutivo obrigatório ANTES do primeiro deploy prod (novo em v3):**

Antes de executar `MIGRATE_ON_BOOT=true` no Fly pela primeira vez, rodar dry-run no Fly Postgres via `fly postgres connect`:

```sql
-- Dry-run destrutivo: quantos registros serão removidos por 000035?
SELECT 'transactions' AS tabela, COUNT(*) AS rows_to_delete FROM transactions WHERE workspace_id IS NULL
UNION ALL SELECT 'accounts',          COUNT(*) FROM accounts          WHERE workspace_id IS NULL
UNION ALL SELECT 'categories',        COUNT(*) FROM categories        WHERE workspace_id IS NULL
UNION ALL SELECT 'cards',             COUNT(*) FROM cards             WHERE workspace_id IS NULL
UNION ALL SELECT 'invoices',          COUNT(*) FROM invoices          WHERE workspace_id IS NULL
UNION ALL SELECT 'financial_goals',   COUNT(*) FROM financial_goals   WHERE workspace_id IS NULL
UNION ALL SELECT 'investments',       COUNT(*) FROM investments       WHERE workspace_id IS NULL
UNION ALL SELECT 'debt_rollovers',    COUNT(*) FROM debt_rollovers    WHERE workspace_id IS NULL;
```

**Threshold de decisão:**
- **Todos = 0 linhas** → prosseguir, boot com `MIGRATE_ON_BOOT=true` sem risco.
- **>0 em qualquer tabela** → PARAR. Investigar origem. Opções:
  - Backfill manual (ex: atribuir a um tenant "órfão").
  - Soft-archive (mover pra tabela `*_archived_pre_000035`).
  - Aceitar perda explicitamente (documentar no HANDOFF + aprovação usuário).
- Nunca prosseguir com perda silenciosa.

**Rollback script (caso DELETE atinja registros indevidos):**
- Pré-migration: `pg_dump --table=transactions --table=accounts ... > /tmp/pre-000035.dump`.
- Se identificar perda após `migrate up`: restaurar tabelas individuais via `pg_restore --data-only --table=...`. Runbook completo em `docs/ops/runbooks/rollback.md` seção "Rollback de migration 000035".

**Arquivos:** `scripts/migrate.sh` (novo), `scripts/dry-run-000035.sql` (novo), `laura-go/main.go` (flag `MIGRATE_ON_BOOT` + chamada `migrate.Up()` via embed.FS), `scripts/entrypoint.sh` (novo), `docs/ops/deployment.md`, `docs/ops/runbooks/rollback.md`.

**Dependências externas:** STANDBY [FLY-PG-CREATE] (para rodar dry-run).

**Tempo:** 1h (inclui 4.2-bis + 4.2-ter).

---

### 4.3. CI/CD Go (build/test/lint/security)

**Estado atual:** `.github/workflows/` não existe.

**Ação proposta:** novo `.github/workflows/go.yml` com jobs:
- `build-test`: setup-go 1.26, go vet, golangci-lint, gosec, govulncheck, migrate idempotência, go test -race, coverage upload (opcional).
- `security-scan`: gitleaks.

Detalhes idênticos à v2 seção 4.3 (YAML completo mantido).

**Arquivos:** `.github/workflows/go.yml` (novo), `laura-go/.golangci.yml` (novo), `.gitleaks.toml` (novo).

**Tempo:** 1h30.

---

### 4.4. CI/CD PWA expandido

**Estado atual:** nenhum workflow PWA; projeto usa **npm**; scripts `dev`, `build`, `start`, `lint`; falta `typecheck`.

**Ação proposta:**
1. Adicionar `"typecheck": "tsc --noEmit"` em `laura-pwa/package.json`.
2. Novo `.github/workflows/pwa.yml` com jobs `lint-type-build` + `e2e`.
3. E2E sobe Postgres 16, aplica todas migrations, seed E2E, binário Go com `DISABLE_WHATSAPP=true`, PWA em port 3100, roda Playwright.

PWA roda em porta **3100** (package.json: `dev -p 3100`), API em 8080.

**Novo env flag `DISABLE_WHATSAPP=true`** — guard a ser adicionado em `main.go` (`if os.Getenv("DISABLE_WHATSAPP") != "true" { whatsapp.InitWhatsmeow() }`) e em `internal/whatsapp/client.go` (early-return em `InitWhatsmeow` se flag setada). **Confirmado via auditoria que não existe hoje.**

**Arquivos:** `.github/workflows/pwa.yml` (novo), `laura-pwa/package.json` (+ script), `laura-go/main.go` (guard), `laura-go/internal/whatsapp/client.go` (early-return).

**Tempo:** 2h.

---

### 4.5. E2E Playwright cobertura ampliada

Idêntico à v2 seção 4.5. 8 specs novos: `auth`, `transactions`, `cards-invoices`, `goals`, `investments`, `score`, `reports`, `super-admin`. Fixture `auth.ts` com storageState. Seed em `scripts/seed-e2e.sh`. Sem visual regression nesta fase.

**Tempo:** 4h.

---

### 4.6. Deploy PWA — Vercel

Idêntico à v2 seção 4.6. `vercel.json` com headers segurança (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS preload), region `gru1`, workflow `deploy-pwa.yml` via `amondnet/vercel-action@v25`.

**Arquivos:** `laura-pwa/vercel.json`, `.github/workflows/deploy-pwa.yml`, `docs/ops/deployment.md`.

**Dependências:** STANDBY [VERCEL-AUTH], STANDBY [VERCEL-ENV], STANDBY [DNS].

**Tempo:** 1h + STANDBY.

---

### 4.7. Deploy backend Go — Fly.io (Dockerfile + embed.FS + tzdata)

**Estado atual:** nenhum. Binário único.

**Ação proposta:**

1. **Migrations embutidas via `embed.FS`** — novo arquivo `laura-go/internal/migrations/embed.go`:
   ```go
   package migrations

   import "embed"

   //go:embed *.sql
   var FS embed.FS
   ```
   + copiar `infrastructure/migrations/*.sql` para `laura-go/internal/migrations/` via `go generate` OU via passo no Dockerfile build (COPY antes de `go build`). **Recomendação: symlink durante build** (`COPY infrastructure/migrations laura-go/internal/migrations` dentro do builder, fora do git).

2. `main.go` ganha bloco:
   ```go
   if os.Getenv("MIGRATE_ON_BOOT") == "true" {
       if err := runMigrations(); err != nil { log.Fatal(err) }
   }
   ```
   usando `github.com/golang-migrate/migrate/v4` + `source/iofs` com a `embed.FS`.

3. **Dockerfile** — base alpine (já que tzdata é necessário; distroless/static não traz tzdata):
   ```dockerfile
   # syntax=docker/dockerfile:1.7
   FROM golang:1.26-alpine AS builder
   WORKDIR /src
   RUN apk add --no-cache ca-certificates git
   COPY laura-go/go.mod laura-go/go.sum ./laura-go/
   WORKDIR /src/laura-go
   RUN go mod download
   COPY laura-go ./
   COPY infrastructure/migrations ./internal/migrations
   RUN CGO_ENABLED=0 GOOS=linux go build \
       -tags "timetzdata" \
       -ldflags="-s -w -X main.version=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
       -o /out/api .

   FROM alpine:3.19
   RUN apk add --no-cache ca-certificates tzdata wget \
       && addgroup -S app && adduser -S app -G app
   ENV TZ=America/Sao_Paulo
   WORKDIR /app
   COPY --from=builder /out/api /app/api
   USER app
   EXPOSE 8080
   HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
     CMD wget -qO- http://localhost:8080/health || exit 1
   ENTRYPOINT ["/app/api"]
   ```
   - `-tags timetzdata` embute zoneinfo no binário (Go 1.20+). Redundante com `tzdata` do alpine, mas barato e blinda ambiente.
   - Migrations via `embed.FS` eliminam cópia `/app/migrations` e `scripts/entrypoint.sh` → binário auto-suficiente.

4. `fly.toml` (raiz):
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
     TZ = "America/Sao_Paulo"

   [http_service]
     internal_port = 8080
     force_https = true
     auto_stop_machines = "suspend"
     auto_start_machines = true
     min_machines_running = 1

     [[http_service.checks]]
       interval = "15s"
       timeout = "2s"
       grace_period = "15s"
       method = "GET"
       path = "/health"

     [[http_service.checks]]
       interval = "30s"
       timeout = "5s"
       grace_period = "30s"
       method = "GET"
       path = "/ready"

   # Single-machine deploy — cron in-process. Ver 4.12/5.10.
   # max_machines_count é imposto via `fly scale count 1 --max-per-region 1`.

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory = "512mb"
   ```

5. Secrets Fly (STANDBY [FLY-SECRETS]) — lista mantida da v2 (DATABASE_URL, SESSION_HMAC_KEY, GROQ_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY).

6. Workflow `.github/workflows/deploy-api.yml` idêntico à v2.

**Arquivos:** `laura-go/Dockerfile` (novo), `laura-go/internal/migrations/embed.go` (novo), `laura-go/main.go` (patch: runMigrations), `fly.toml` (novo), `.github/workflows/deploy-api.yml` (novo), `.dockerignore` (novo).

**Dependências:** STANDBY [FLY-AUTH], STANDBY [FLY-SECRETS], STANDBY [FLY-CARD] (Fly free tier agora exige cartão registrado mesmo no free — 2024+).

**Tempo:** 2h30 (inclui embed.FS + patch main.go).

---

### 4.8. Postgres gerenciado (Fly Postgres)

Idêntico à v2: `fly postgres create`, attach, `CREATE EXTENSION vector`.

**Validação:** tamanho esperado das tabelas `whatsmeow_*` no Postgres — auth tokens/prekeys crescem linearmente com contatos. Para 1 conta WA + ~500 contatos, estimado <20MB. **Não separar em DB próprio nesta fase** (low traffic); se cluster crescer >5GB na tabela `whatsmeow_message` (raro), migrar para DB dedicado em Fase 12+. Documentar em `ops/deployment.md`.

**Tempo:** 1h + STANDBY.

---

### 4.9. Documentação operacional

Idêntico à v2 + adições:
- `docs/HANDOFF.md` — **já existe** (criado no bootstrap). v3 explicita que será **atualizado a cada commit relevante da Fase 10** (seção "Histórico de atualizações" no topo do arquivo).
- `docs/ops/security.md`, `docs/ops/deployment.md`, `docs/ops/runbooks/secrets-rotation.md`, `docs/ops/runbooks/rollback.md` — novos.
- `.env.example` na raiz (mantido da v2).

**Tempo:** 2h30.

---

### 4.10. Backup do Postgres prod

Idêntico à v2: Fly snapshot nativo 7 dias + drill em runbook + camada 2 (off-site age+s3) explicitamente em Fase 12.

**Tempo:** 30 min.

---

### 4.11. Whatsmeow session persistence + `Container.Upgrade()` (crítico)

**Estado auditado:**
- `sqlstore.New(ctx, "postgres", dbURL, dbLog)` chamado em `internal/whatsapp/client.go:47` e `internal/whatsapp/instance_manager.go:110`. ✅
- **`container.Upgrade(ctx)` NÃO é chamado.** ❌ Primeiro boot em prod falhará ao tentar ler tabelas `whatsmeow_*` (que a lib cria apenas durante `Upgrade`).

**Ação:**
1. Patch em `client.go` e `instance_manager.go` após `sqlstore.New(...)`:
   ```go
   if err := container.Upgrade(context.Background()); err != nil {
       return nil, fmt.Errorf("whatsmeow upgrade: %w", err)
   }
   ```
2. Em dev: rodar API uma vez → verificar `\dt whatsmeow_*` no psql (deve listar tabelas).
3. Adicionar ao `DISABLE_WHATSAPP` guard: se flag setada, skip `sqlstore.New` + `Upgrade` inteiros.
4. Documentar em `ops/deployment.md`: mudança de `DATABASE_URL` (ex: troca de cluster) invalida sessão → novo QR scan.
5. `[[mounts]]` continua ausente (Whatsmeow em Postgres).

**Arquivos:** `laura-go/internal/whatsapp/client.go`, `laura-go/internal/whatsapp/instance_manager.go`, `docs/ops/deployment.md`.

**Tempo:** 30 min.

---

### 4.12. Cron jobs no Fly + impedimento de multi-réplica

**Estado auditado:** `cron.New()` em `internal/services/cron.go:14`. 3 jobs in-process (`0 20 * * *`, `0 3 * * *`, `15 3 * * *`).

**Ação:**
- `fly.toml`: `auto_stop_machines = "suspend"` + `min_machines_running = 1` + `TZ = "America/Sao_Paulo"` (ver 4.7).
- **Escala limitada a 1 máquina** (`fly scale count 1` + `--max-per-region 1` quando disponível, ou enforcement manual via `[deploy] strategy = "immediate"` + documentação).
- Runbook explicita: **NUNCA rodar 2+ máquinas sem implementar leader-election** (cron duplicaria `runDailyScoreSnapshot` → inserts duplicados em `score_snapshots`).
- Alternativa futura (Fase 17): extrair cron para `fly machines run --schedule daily` separado.

**Tempo:** 20 min.

---

### 4.13. Observabilidade mínima — `/ready`, request-id, logs JSON (novo em v3)

**Estado auditado:**
- `/health` existe 2x: `main.go:39` (texto) e `router.go:45` (JSON sob `/api/v1/health`). ✅
- `/ready` **NÃO existe.** ❌
- Request-ID middleware **NÃO existe** (`grep RequestID|X-Request-Id` = 0). ❌
- Rate limiter Fiber **ATIVO** em `router.go:21` (Max=60/min). ✅
- Security headers **ATIVOS** em `router.go:38-44`. ✅
- Logger atual: Fiber `logger.New()` em `main.go:36` + `log.Printf` espalhado. Estruturado (slog/zap) fica para Fase 11.

**Ação:**

1. **Middleware request-id** — em `main.go`, antes de `logger.New()`:
   ```go
   import "github.com/gofiber/fiber/v2/middleware/requestid"
   ...
   app.Use(requestid.New(requestid.Config{
       Header:     "X-Request-Id",
       Generator:  utils.UUIDv4,
       ContextKey: "requestid",
   }))
   ```
   Logger passa a incluir `${locals:requestid}` no formato (config `Format` do logger).

2. **Handler `/ready`** — em `main.go` (público, fora do `/api/v1`):
   ```go
   app.Get("/ready", func(c *fiber.Ctx) error {
       // ping DB (sqlx ou pgx pool)
       if err := db.PingContext(c.Context()); err != nil {
           return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": err.Error()})
       }
       return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
   })
   ```
   Fly toml ganha check adicional em `/ready` (ver 4.7).

3. **Logs JSON em prod** — Fiber logger config condicional:
   ```go
   if os.Getenv("ENVIRONMENT") == "production" {
       app.Use(logger.New(logger.Config{
           Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","requestid":"${locals:requestid}"}` + "\n",
       }))
   } else {
       app.Use(logger.New())
   }
   ```

**Arquivos:** `laura-go/main.go` (patch).

**Tempo:** 1h.

---

## 5. Decisões de arquitetura

### 5.1. Por que Vercel para PWA
Idêntico à v2.

### 5.2. Por que Fly.io para Go
Idêntico à v2.

### 5.3. Por que Fly Postgres
Idêntico à v2.

### 5.4. Estratégia de migrations em prod (FIXADA em v3)

**Ferramenta oficial: `github.com/golang-migrate/migrate/v4`.**

- Uso 1 — boot do binário: `embed.FS` + driver `iofs` + `migrate.NewWithSourceInstance(...)` + `m.Up()`. Chamada gated por `MIGRATE_ON_BOOT=true`.
- Uso 2 — CLI standalone (local dev, manutenção): binário `migrate` via `go install -tags postgres github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0`.
- Lock: `pg_advisory_lock` nativo. Única máquina Fly → sem disputa, mas lock é cinto-e-suspensório.
- Forward-only. Rollback = nova migration compensatória.
- CI valida idempotência (4.2-bis).

**Alternativa descartada: `pressly/goose`.** Motivos: golang-migrate é mais usado no ecossistema Fly/Supabase/Atlas, tem mais drivers, lock transparente, CLI já conhecida pelo time.

### 5.5. Estratégia de secrets
Idêntico à v2 (tabela Fly secrets + Vercel env + GitHub secrets).

### 5.6. Custos esperados
Idêntico à v2 (~US$0-10/mês MVP).

**Observação nova:** Fly free tier desde 2024 exige cartão registrado mesmo no plano gratuito. Registrado como `STANDBY [FLY-CARD]`.

### 5.7. Estratégia de rollback
Idêntico à v2 (API: `fly releases rollback`; PWA: Vercel promote; DB: `fly postgres backup restore`). Runbook em `docs/ops/runbooks/rollback.md`.

### 5.8. Estratégia de DNS
Idêntico à v2. Decisão STANDBY [DNS]: começar com (B) `*.fly.dev` + `*.vercel.app`, migrar para domínio próprio pré-beta.

### 5.9. Invariantes técnicas preservadas
Idêntico à v2 — moeda em centavos, HMAC sessão, whitelist SQL, context timeout, paridade Go↔PWA.

### 5.10. Single-máquina enforcement (novo em v3)

Por causa do cron in-process, **Fase 10 roda com exatamente 1 máquina Fly**. Aplicar via:
- `fly scale count 1` pós-deploy.
- Runbook explícito: "escala >1 requer extração de cron (Fase 17) ANTES".
- Alerta Fly nativo para `machine_count > 1` (opcional).
- Backlog: leader-election via `pg_advisory_lock` em worker loop (não bloqueia Fase 10).

---

## 6. Pré-requisitos / dependências externas (STANDBY)

| ID | Item | Bloqueia |
|----|------|----------|
| **STANDBY [GROQ-REVOKE]** | Revogar+regenerar GROQ_API_KEY | fim de 4.1 |
| **STANDBY [FORCE-PUSH]** | Confirmar force push em main | 4.1 final |
| **STANDBY [VERCEL-AUTH]** | Conta Vercel + tokens | deploy 4.6 |
| **STANDBY [VERCEL-ENV]** | Env vars prod Vercel | build PWA |
| **STANDBY [FLY-AUTH]** | Conta Fly + token | deploy 4.7 |
| **STANDBY [FLY-CARD]** | Cartão registrado no Fly (req. free tier 2024+) | criação app |
| **STANDBY [FLY-SECRETS]** | `fly secrets set ...` | API funcional |
| **STANDBY [FLY-PG-CREATE]** | Criar+attach Fly Postgres + pgvector | DB prod 4.8 |
| **STANDBY [STRIPE-LIVE]** | Stripe live keys | cobrança real |
| **STANDBY [RESEND-DOMAIN]** | Resend key + domínio verificado | e-mail prod |
| **STANDBY [DNS]** | Decisão (A) domínio próprio vs (B) interim | URLs finais |
| **STANDBY [CODECOV-TOKEN]** | Token Codecov | coverage upload (opcional) |
| **STANDBY [SENTRY-DSN]** *(Fase 11)* | DSN Sentry | error tracking futuro |

### 6.X. Pre-commit hook
Usar **lefthook** (Go-native, rápido). `lefthook.yml` com step `gitleaks protect --staged`. Instrução em HANDOFF.

### 6.Y. `.gitignore` e `.dockerignore`
Idêntico à v2.

---

## 7. Critérios de aceite (DoD)

1. **Segurança**
   - [ ] `git log -p -S<trecho-groq> --all` = vazio
   - [ ] `.gitleaks.toml` presente + CI limpo
   - [ ] `gosec` + `govulncheck` sem issues HIGH
   - [ ] `.env.example` cobre 100%
   - [ ] lefthook instalável

2. **Migrations**
   - [ ] `migrate up` idempotente (2× = no change)
   - [ ] Binário Go aplica via `embed.FS` com `MIGRATE_ON_BOOT=true`
   - [ ] CI valida idempotência + schema-vs-código
   - [ ] Script `dry-run-000035.sql` presente e documentado

3. **Código Go — patches mínimos**
   - [ ] `container.Upgrade(ctx)` chamado após `sqlstore.New` (2 lugares)
   - [ ] `DISABLE_WHATSAPP=true` guard em `main.go` + `client.go`
   - [ ] Middleware `requestid` ativo + logs incluem request-id
   - [ ] Handler `/ready` com ping DB + configurado no `fly.toml`
   - [ ] Logs JSON quando `ENVIRONMENT=production`

4. **CI/CD**
   - [ ] PR dispara `go.yml`, `pwa.yml`, gitleaks
   - [ ] Workflows verdes em PR teste
   - [ ] `deploy-api.yml` + `deploy-pwa.yml` passam `actionlint`

5. **E2E**
   - [ ] 8 specs implementados
   - [ ] Suíte <10 min no CI
   - [ ] 0 flakes em 3 execuções

6. **Deploy prep**
   - [ ] `docker build` local: imagem <80MB, `/health` 200
   - [ ] `fly config validate` OK
   - [ ] `vercel inspect` OK
   - [ ] Deploy real: STANDBY

7. **Rollback**
   - [ ] `rollback.md` cobre API + PWA + DB + migration 000035

8. **Docs**
   - [ ] HANDOFF, security, deployment, 2 runbooks presentes
   - [ ] HANDOFF tem histórico de atualização da fase

9. **Commit + memory**
   - [ ] Commits PT-BR
   - [ ] Entrada em memory index
   - [ ] Spec v3 + plan v1 arquivados

---

## 8. Riscos

Idênticos à v2 **+ novos**:

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| `Container.Upgrade()` esquecido no patch, primeiro boot prod falha | média (se não auditarmos) | alto | Item explícito no DoD (#3) + teste dev pós-patch |
| Dry-run 000035 revela dados órfãos e ninguém investiga | média | alto | Runbook com thresholds e opções de backfill/archive |
| `embed.FS` não acha migrations (path errado) | baixa | alto | CI job roda binário com `MIGRATE_ON_BOOT=true` contra Postgres service |
| Force push invalida clone local do usuário no Mac | baixa | médio | Backup antes + HANDOFF explica reclone |
| `TZ=America/Sao_Paulo` não tem efeito porque `timetzdata` não foi embutido | baixa | médio | `-tags timetzdata` no build + teste `date` no container |

---

## 9. Métricas de sucesso

Idênticas à v2:
- CI full PR → <12 min
- Deploy API → <5 min
- Deploy PWA → <3 min
- Cobertura E2E ≥80% fluxos críticos
- `gosec` HIGH = 0
- `govulncheck` direct-deps = 0
- Segredos no histórico = 0
- Tempo para retomar projeto (novo HANDOFF) <5 min
- Custo mensal <US$15

---

## 10. Plano de testes

Idêntico à v2 **+**:

### 10.10. Patches Go (novo em v3)
- **Upgrade Whatsmeow:** antes do patch, derrubar dev DB, subir, rodar API → esperar erro `relation "whatsmeow_device" does not exist`. Aplicar patch. Repetir → boot OK, `\dt whatsmeow_*` lista tabelas.
- **DISABLE_WHATSAPP:** `DISABLE_WHATSAPP=true go run .` → API sobe sem tentar conectar WA. Sem a flag, comportamento atual.
- **Request-ID:** `curl -i localhost:8080/health` → header `X-Request-Id: <uuid>` presente. Log correspondente inclui o mesmo ID.
- **/ready:** `curl localhost:8080/ready` com DB ok → 200 `{"status":"ready"}`. Com DB parado → 503.

---

## 11. Backlog (fora do escopo da Fase 10)

- **Fase 11 — Observabilidade:** Prometheus/Grafana/OTEL, Sentry + release tracking, SLOs.
- **Fase 12 — DR/HA:** backup off-site (pg_dump+age+s3), multi-region read replica, DR drill.
- **Fase 13 — WAF/CDN:** Cloudflare, rate-limit global, bot mitigation.
- **Fase 14 — Compliance LGPD:** DPO, RoPA, DPIA, retenção formal.
- **Fase 15 — Open Finance / Pix API:** integração Open Finance Brasil.
- **Fase 16 — Visual regression Playwright.**
- **Fase 17 — Fly Machines scheduled:** extrair cron da API HTTP, permite multi-réplica.
- **Fase 18 — Bug bounty / pentest.**
- **Fase 19 — Logger estruturado** (slog/zap) + correlation-id transaccional.
- **Fase 20 — Semver + release engineering** formal.
- **Fase 21 — STANDBY [SENTRY-DSN]** integrado como parte da Fase 11.
- **Fase 22 — Separar whatsmeow_* em DB dedicado** se crescer >5GB.

---

## 12. Glossário e referências

Idêntico à v2. Referências adicionais:
- `laura-go/main.go:39` (health handler atual).
- `laura-go/internal/handlers/router.go:21` (rate limiter ativo).
- `laura-go/internal/whatsapp/client.go:47` (sqlstore.New sem Upgrade).
- `laura-go/internal/services/cron.go:14` (cron.New in-process).

---

## 13. Resolução de questões abertas da v2 (novo em v3)

| # | Questão da v2 | Resolução v3 |
|---|---------------|--------------|
| 1 | Runbook rollback passou em drill? | Drill listado em 10.8 (staging fake). Deve ser executado durante a fase, não antes. Registrado como critério de aceite #7. |
| 2 | `DISABLE_WHATSAPP` guard existe? | **NÃO.** Auditoria (`grep DISABLE_WHATSAPP` = 0) confirmou. Implementação é escopo explícito (4.4 + 4.11). |
| 3 | Decisão DNS (A vs B)? | Começar com **(B) interim** (`.fly.dev` + `.vercel.app`) — zero bloqueio. Migração para (A) domínio próprio pré-beta, tratada em STANDBY [DNS]. |
| 4 | Custo Fly pós-free-tier aceitável? | Sim: ~US$5-10/mês total. Com `STANDBY [FLY-CARD]` registrado; usuário deve cadastrar cartão. Se estourar, reavaliar memória (512mb → 256mb). |
| 5 | lefthook vs pre-commit framework? | **lefthook**, decisão fixada (Go-native, alinhado ao backend, zero dep Python). |
| 6 | Observabilidade mínima já existe? | Parcialmente. `/health` sim (2 endpoints). `/ready`, request-id, logs JSON: **não existem**, escopo da Fase 10 (seção 4.13). Rate limiter + security headers já ativos em `router.go`. |

---

## 14. Pré-condições para o plan v1 (novo em v3)

O plan v1 deve assumir como dado:

1. **Monorepo:** raiz `Laura Finance (Vibe Coding)/`, com `laura-go/` (Go 1.26.1, Fiber v2), `laura-pwa/` (Next 16.1.6, React 19.2.3, **npm**, porta dev 3100), `infrastructure/migrations/` (35 migrations SQL), `infrastructure/docker-compose.yml`.
2. **Postgres:** imagem `postgres:16` com extensão `pgvector` (Fly Postgres em prod, compose em dev).
3. **Whatsmeow persiste no Postgres** via `sqlstore.New(..., "postgres", ...)`; **patch `Container.Upgrade(ctx)` obrigatório** (2 arquivos).
4. **Cron in-process** via `robfig/cron/v3` — binário único, single-machine Fly, `TZ=America/Sao_Paulo`.
5. **Migrations aplicadas via `embed.FS` + `golang-migrate/migrate` v4** no boot (`MIGRATE_ON_BOOT=true`).
6. **Handlers `/health` (existe) + `/ready` (a criar)** públicos em `main.go`.
7. **Middleware `requestid` (a criar)** antes de logger em `main.go`.
8. **Rate limiter Fiber + security headers já ativos** em `router.go` — não mexer.
9. **Flag `DISABLE_WHATSAPP=true` (a criar)** bloqueia init WA em CI.
10. **Ordem de STANDBY externos documentada** em 4.1 (Groq revoke → force push) e matriz seção 6.
11. **Fly runs com 1 máquina apenas** (cron); extração cron é Fase 17.
12. **CI em GitHub Actions** — não existe hoje; criado do zero (`.github/workflows/`).
13. **Deploy strategy:** push main → `deploy-api.yml` (se `laura-go/` ou migrations mudou) + `deploy-pwa.yml` (se `laura-pwa/` mudou). Blue/green: não aplicável (1 máquina).
14. **Documentação nova em `docs/`:** HANDOFF (já existe, atualizar), `ops/security.md`, `ops/deployment.md`, `ops/runbooks/secrets-rotation.md`, `ops/runbooks/rollback.md`.
15. **Tag `phase-10-deployed`:** aplicada somente após smoke prod 200 OK em `/health`, `/ready`, login real via PWA. Não em push main.
16. **Sentry, multi-region, DR off-site, Open Finance, logger estruturado:** explicitamente **fora do escopo**.

---

## 15. Checklist consolidado de entregas (base 1:1 para o plan v1)

### A. Sanitização Git
1. Backup local do repo antes do rewrite.
2. `.gitleaks.toml` na raiz com patterns (`gsk_*`, `sk_live_*`, `re_*`, `whsec_*`, JWT, OpenSSH, PGP).
3. Execução `git filter-repo --replace-text` + validação `git log -p -Sgsk_` = vazio.
4. Force push coordenado (STANDBY [GROQ-REVOKE] + [FORCE-PUSH]).
5. Atualização dos secrets no GitHub Actions + Fly para nova Groq key.
6. `lefthook.yml` com step `gitleaks protect --staged`.
7. `.gitignore` raiz garantindo `.env`, `.env.*`, `secrets/`, `pgdata/`, `node_modules/`, etc.

### B. Migrations
8. `scripts/migrate.sh` wrapper CLI.
9. `scripts/dry-run-000035.sql` com 8 `SELECT COUNT(*)`.
10. `laura-go/internal/migrations/embed.go` com `//go:embed *.sql`.
11. Dockerfile copia `infrastructure/migrations` para dentro do package no build.
12. Patch em `main.go`: `runMigrations()` gated por `MIGRATE_ON_BOOT=true`.
13. Job CI (`go.yml`) aplicando todas 35 migrations 2× contra Postgres service (idempotência).
14. `docs/ops/runbooks/rollback.md` — seção "Rollback migration 000035" com `pg_dump` + `pg_restore --data-only` passo-a-passo.

### C. Patches Go (laura-go)
15. `internal/whatsapp/client.go`: `container.Upgrade(ctx)` após `sqlstore.New`.
16. `internal/whatsapp/instance_manager.go`: idem.
17. `main.go`: guard `if os.Getenv("DISABLE_WHATSAPP") != "true" { whatsapp.InitWhatsmeow() }`.
18. `internal/whatsapp/client.go`: early-return em `InitWhatsmeow` se `DISABLE_WHATSAPP=true`.
19. `main.go`: `app.Use(requestid.New(...))` antes de logger.
20. `main.go`: Fiber logger com `Format` JSON condicional por `ENVIRONMENT=production`.
21. `main.go`: `app.Get("/ready", ...)` com ping DB.

### D. CI
22. `.github/workflows/go.yml` (build-test + security-scan).
23. `.github/workflows/pwa.yml` (lint-type-build + e2e).
24. `laura-go/.golangci.yml`.
25. `laura-pwa/package.json`: adicionar script `typecheck`.
26. Validar workflows via `actionlint` local + PR teste.

### E. Testes E2E
27. `laura-pwa/playwright.config.ts` patch baseURL + globalSetup.
28. `laura-pwa/tests/fixtures/auth.ts`.
29. 8 specs novos: `auth`, `transactions`, `cards-invoices`, `goals`, `investments`, `score`, `reports`, `super-admin`.
30. `scripts/seed-e2e.sh`.

### F. Containers
31. `laura-go/Dockerfile` multi-stage (builder alpine + runtime alpine, `-tags timetzdata`).
32. `.dockerignore` raiz.
33. Build local: imagem <80MB, `/health` 200, `/ready` 200.

### G. Fly
34. `fly.toml` raiz com `[build]`, `[env]` (TZ=SP, MIGRATE_ON_BOOT=true), `[http_service]` com checks `/health` e `/ready`, `[[vm]]` 512mb.
35. `.github/workflows/deploy-api.yml`.
36. STANDBY [FLY-AUTH], [FLY-CARD], [FLY-SECRETS], [FLY-PG-CREATE] documentados em HANDOFF.
37. Pós-deploy: `fly scale count 1`.

### H. Vercel
38. `laura-pwa/vercel.json` com headers segurança + HSTS.
39. `.github/workflows/deploy-pwa.yml`.
40. STANDBY [VERCEL-AUTH] + [VERCEL-ENV] em HANDOFF.

### I. Postgres prod
41. Comandos documentados em `ops/deployment.md`: `fly postgres create`, `attach`, `CREATE EXTENSION vector`.
42. Dry-run 000035 executado antes do primeiro `MIGRATE_ON_BOOT=true`.

### J. Documentação
43. `docs/HANDOFF.md` atualizado a cada commit relevante.
44. `docs/ops/security.md` — threat model, secrets matrix, playbook key vazada.
45. `docs/ops/deployment.md` — primeiro deploy, rollback, troubleshooting, whatsmeow reconnect.
46. `docs/ops/runbooks/secrets-rotation.md`.
47. `docs/ops/runbooks/rollback.md`.
48. `.env.example` raiz cobrindo 100% das vars de Go + PWA.

### K. Tags + memory
49. Tag `phase-10-deployed` aplicada APÓS smoke prod.
50. Entrada em memory index (`~/.claude/projects/.../memory/MEMORY.md`) com snapshot da fase.

### L. Drills
51. Drill rollback fake em staging (conforme 10.8).
52. Drill restore Fly Postgres backup em DB descartável.

---

**Fim do Spec v3 (FINAL).** Base direta para o plan v1.
