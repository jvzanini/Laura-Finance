# Fase 10 — Security closeout + infraestrutura mínima de produção (Plan v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Data:** 2026-04-15
**Versão:** v2 (pós review #1 — fecha 13 GAPs v1 + reconciliação de decisões divergentes)
**Spec canônica:** `docs/superpowers/specs/2026-04-15-fase-10-security-closeout-infra-v3.md`
**Plan v1 (histórico preservado):** `docs/superpowers/plans/2026-04-15-fase-10-security-closeout-infra-v1.md`

**Goal:** Fechar pendências de segurança (sanitização git, secrets) e habilitar deploy contínuo do Laura Finance (PWA→Vercel, Go→Fly.io, Postgres gerenciado), com CI/CD completo, E2E Playwright expandido (8 fluxos + fixture auth), runbooks operacionais e workflows de deploy automático.

**Architecture:** PWA Next.js 16 → Vercel (gru1). Go 1.26.1 (Fiber v2 + Whatsmeow + cron) → Fly.io single-machine gru com Fly Postgres gerenciado. Migrations via `embed.FS` + `golang-migrate/migrate v4` gated por `MIGRATE_ON_BOOT=true`. CI GitHub Actions (go-ci, pwa-ci, playwright, security/gitleaks). Deploy gated por STANDBYs externos.

**Tech Stack:** Go 1.26.1, Fiber v2, pgx/v5, whatsmeow+sqlstore PG, robfig/cron/v3, golang-migrate/migrate v4 + iofs; Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Playwright; Postgres 16 + pgvector; Docker (distroless static nonroot + `-tags timetzdata`); Fly.io + Vercel; gitleaks + lefthook.

---

## Mudanças principais vs. Plan v1

1. **Runtime Docker revertido para distroless/static nonroot** (v1 propunha `alpine:3.19` por causa de `wget` + `tzdata`). Justificativa: (a) `-tags timetzdata` já embute zoneinfo no binário Go (redundante ter tzdata do SO); (b) Fly healthcheck usa `[[http_service.checks]]` via rede Fly, não `HEALTHCHECK` Docker, portanto `wget` é dispensável; (c) distroless reduz superfície de ataque, tamanho da imagem e alinha com spec v3 §4.7 original antes do soft-deviation. A diretiva `HEALTHCHECK` do Dockerfile é removida.
2. **lefthook como canônico + remoção de `.githooks/`** (v1 mantinha ambos). Decisão: evitar duplicação silenciosa. `.githooks/pre-commit` é removido no commit do lefthook; instrução de instalação centrada no README.
3. **fly.toml memory confirmada em 512mb** (spec v3) — v1 já aplicava isso; reafirmado com justificativa explícita: whatsmeow + cron in-process + Go runtime + pgxpool margeiam 256mb; 512mb dá folga sem custo material (Fly cobra por MB-hora; ~US$1-2/mês a diferença).
4. **Nova Parte J — Runbooks operacionais** (`rollback.md`, `secrets-rotation.md`) — fecha GAPs 46-47 do v1.
5. **Nova Parte K — E2E expandido** com `tests/fixtures/auth.ts` + 8 specs + `scripts/seed-e2e.sh` — fecha GAPs 27-30. Selectors estáveis via `data-testid`, fixtures respeitam dark-mode (UI default do projeto).
6. **Nova Parte L — Workflows de deploy automático** (`deploy-api.yml`, `deploy-pwa.yml`) criados e gateados por STANDBY de tokens (`FLY_API_TOKEN`, `VERCEL_TOKEN`). Arquivos versionados; deploy real só quando tokens entrarem nos GitHub secrets.
7. **Nova Parte M — `.env.example` raiz consolidado** Go+PWA — fecha GAP 48.
8. **Task típica quebrada em sub-steps** (C.2 e F.2 em particular) para respeitar janela de 2-5 min por task.
9. **Script `typecheck` adicionado explicitamente ao `laura-pwa/package.json`** — verificado ausente (scripts atuais: `dev`, `build`, `start`, `lint`).
10. **Self-review 1:1 reescrita** cobrindo todos os 52 itens da spec v3 §15 → mapeamento direto task-ID → item, sem GAPs remanescentes exceto deferidos legítimos (itens 4, 5 STANDBY externo; 49 tag deployed).

---

## Observações globais

- **Workdir absoluto:** `/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/`.
- **Branch:** `main` (solo dev).
- **Commits** em PT-BR, formato conventional: `feat(<scope>):`, `fix(<scope>):`, `chore(<scope>):`, `docs(<scope>):`, `test(<scope>):`, `build(<scope>):`, onde `<scope>` ∈ {go, pwa, infra, ci, ops, db, security, migrations, hooks, docker, fly, vercel, e2e}.
- **STANDBY** marcados com prefixo `STANDBY [<ID>]` — não bloqueia progresso, apenas anota pendência externa.
- **Ordem TDD nos patches Go (B.*):** test (FAIL) → implement → test (PASS) → commit — cada etapa em sub-step separado.
- **Working directory** em cada `Run:` indicado explicitamente (`cd laura-go && ...` ou equivalente).
- **Selectors E2E:** todos os novos specs usam `data-testid` estável + respeitam tema dark default.

---

## Parte 0 — Pré-condições e validações

### Task 0.1 — Confirmar artefatos do agente B e sintaxe base
**Files:** Read: `.github/workflows/{go-ci,pwa-ci,playwright,security}.yml`, `.gitleaks.toml`, `.golangci.yml`, `.githooks/pre-commit`, `laura-go/{Dockerfile,fly.toml,.dockerignore,.env.example}`, `laura-pwa/vercel.json`, `docs/ops/{security,deployment}.md`, `laura-pwa/tests/mvp-flows.spec.ts`.

**Steps:**
- [ ] 1. `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && git status --short` — confirmar arquivos `M`/`??` esperados.
- [ ] 2. `python3 -c "import yaml; [yaml.safe_load(open(f'.github/workflows/{f}')) for f in ['go-ci.yml','pwa-ci.yml','security.yml','playwright.yml']]; print('yaml ok')"` — Expected: `yaml ok`.
- [ ] 3. `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"` — Expected: `toml ok`.
- [ ] 4. `which actionlint && actionlint .github/workflows/*.yml || echo "actionlint ausente (skip, validar em PR)"`.
- [ ] 5. Sem commit — apenas registra baseline.

---

## Parte A — Validação explícita dos artefatos do agente B

> Cada task A lê arquivo + confirma cobertura pontual de itens da spec. Se gap: anotado em `NOTES.tmp.md` (não versionado) e resolvido em task dedicada posterior. A.final commita os artefatos.

### Task A.1 — Revisar `.github/workflows/go-ci.yml`
**Files:** Read `.github/workflows/go-ci.yml`.
**Steps:**
- [ ] 1. Ler arquivo.
- [ ] 2. Confirmar jobs/steps: `setup-go@v5` Go 1.26, `go vet ./...` em `laura-go/`, `golangci-lint` action, `gosec` (HIGH), `govulncheck`, service `pgvector/pgvector:pg16` com healthcheck, step migrations (psql ou `migrate up`), `go test -race ./...`, `go build`.
- [ ] 3. Confirmar job CI aplica migrations 2× (idempotência) — se ausente, registrar gap → Task A.final resolve via patch no workflow.
- [ ] 4. Sem commit.

### Task A.2 — Revisar `pwa-ci.yml` + `playwright.yml`
**Files:** Read `.github/workflows/{pwa-ci,playwright}.yml`, `laura-pwa/package.json`.
**Steps:**
- [ ] 1. Confirmar `pwa-ci.yml`: `npm ci`, `tsc --noEmit` (depende de script `typecheck` — **confirmado ausente** em `laura-pwa/package.json`; será adicionado em Task D.1), `npm run lint`, `npm run build`.
- [ ] 2. Confirmar `playwright.yml`: `npm ci`, `npx playwright install --with-deps`, `npx playwright test` com `working-directory: laura-pwa`, env `DISABLE_WHATSAPP=true` no job.
- [ ] 3. Sem commit.

### Task A.3 — Revisar `security.yml` + `.gitleaks.toml`
**Files:** Read `.github/workflows/security.yml`, `.gitleaks.toml`.
**Steps:**
- [ ] 1. Confirmar `security.yml` roda `gitleaks detect --source . --config .gitleaks.toml --redact`.
- [ ] 2. Confirmar `.gitleaks.toml` tem `extend.useDefault = true` + regras para `gsk_*`, `sk_live_*`, `re_*`, `whsec_*`.
- [ ] 3. Sem commit.

### Task A.4 — Revisar `laura-go/Dockerfile` + `.dockerignore`
**Files:** Read `laura-go/Dockerfile`, `laura-go/.dockerignore`.
**Steps:**
- [ ] 1. Confirmar builder `golang:1.26-alpine` + `CGO_ENABLED=0`.
- [ ] 2. Anotar: `-tags timetzdata` **ausente** → corrigido em Task C.3. Runtime distroless ou alpine → reescrito em Task C.3 para distroless.
- [ ] 3. Confirmar `.dockerignore` exclui `*.md`, `.git/`, `tests/`, `bin/`, `.env*`.
- [ ] 4. Anotar: `.dockerignore` na raiz do repo **não existe** (confirmado via `ls`). Será criado em Task M.2.
- [ ] 5. Sem commit.

### Task A.5 — Revisar `laura-go/fly.toml`
**Files:** Read `laura-go/fly.toml`.
**Steps:**
- [ ] 1. Ler arquivo.
- [ ] 2. Confirmar divergências (spec v3 §4.7): `[mounts]` presente (remover), `memory_mb=256` (→ `memory="512mb"` em `[[vm]]`), `auto_stop_machines="stop"` (→ `"suspend"`), falta `[[http_service.checks]]` `/ready`, falta `TZ`, falta `MIGRATE_ON_BOOT`, falta `kill_signal`/`kill_timeout`. Task D.1 corrige tudo.
- [ ] 3. Sem commit.

### Task A.6 — Revisar `laura-pwa/vercel.json` + `laura-go/.env.example`
**Files:** Read `laura-pwa/vercel.json`, `laura-go/.env.example`.
**Steps:**
- [ ] 1. Confirmar `vercel.json` tem `regions: ["gru1"]` + headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS preload).
- [ ] 2. Confirmar `.env.example` cobre `DATABASE_URL`, `SESSION_HMAC_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_ENV`, `PORT`, `ENVIRONMENT`.
- [ ] 3. Registrar ausentes (`MIGRATE_ON_BOOT`, `DISABLE_WHATSAPP`) — patch em B.2/C.2.
- [ ] 4. Sem commit.

### Task A.final — Commit scaffold agente B
**Steps:**
- [ ] 1. `git add .github/ .gitleaks.toml .golangci.yml laura-go/Dockerfile laura-go/.dockerignore laura-go/fly.toml laura-go/.env.example laura-pwa/vercel.json docs/ CLAUDE.md README.md laura-pwa/tests/mvp-flows.spec.ts laura-pwa/package-lock.json`.
- [ ] 2. `git rm -f laura-pwa/.github/workflows/playwright.yml 2>/dev/null || true` (se arquivo antigo foi movido para raiz).
- [ ] 3. `git status --short` — confirmar staging limpa.
- [ ] 4. Commit:
  ```sh
  git commit -m "chore(infra): scaffold inicial CI/CD + Docker/Fly/Vercel (agente B)

  CI workflows, Dockerfile template, fly.toml template, vercel.json com headers,
  gitleaks + golangci configs, docs ops/security + ops/deployment, .env.example
  expandido. Ajustes finos (timetzdata, /ready checks, fly memory) virao em tasks
  C.3/D.1."
  ```
- [ ] 5. `git log -1 --oneline` — confirmar commit.

---

## Parte B — Patches Go (TDD estrito)

> Ordem: write failing test → run (FAIL) → implement → run (PASS) → commit. Cada fase em sub-step separado.

### Task B.1 — `Container.Upgrade(ctx)` em whatsmeow (TDD)
**Files:**
- Modify: `laura-go/internal/whatsapp/client.go`, `laura-go/internal/whatsapp/instance_manager.go`
- Create: `laura-go/internal/whatsapp/client_test.go`

**Steps:**
- [ ] 1. `cd laura-go && grep -n "sqlstore.New" internal/whatsapp/client.go internal/whatsapp/instance_manager.go` — anotar linhas.
- [ ] 2. Criar `laura-go/internal/whatsapp/client_test.go` com `TestContainerUpgrade_CreatesWhatsmeowTables` (valida `whatsmeow_device` após `InitWhatsmeow`; skip se `TEST_DATABASE_URL` ausente). Código literal ver plan v1 Task B.1 step 2.
- [ ] 3. Run (FAIL): `cd laura-go && TEST_DATABASE_URL=postgres://laura:laura@localhost:5432/laura_test?sslmode=disable go test ./internal/whatsapp/... -run TestContainerUpgrade -v`. Expected: FAIL (`relation whatsmeow_device does not exist`).
- [ ] 4. Patch `client.go` após `sqlstore.New(...)`:
  ```go
  if err := container.Upgrade(ctx); err != nil {
      return nil, fmt.Errorf("whatsmeow upgrade: %w", err)
  }
  ```
- [ ] 5. Patch idêntico em `instance_manager.go`.
- [ ] 6. Run (PASS): `cd laura-go && go build ./... && TEST_DATABASE_URL=... go test ./internal/whatsapp/... -run TestContainerUpgrade -v`. Expected: PASS.
- [ ] 7. Commit:
  ```sh
  git add laura-go/internal/whatsapp/{client.go,instance_manager.go,client_test.go}
  git commit -m "fix(go): chamar Container.Upgrade(ctx) apos sqlstore.New

  Sem Upgrade, primeiro boot em prod falha ao ler tabelas whatsmeow_*.
  Aplicado nos 2 call sites. Teste valida criacao de whatsmeow_device."
  ```

### Task B.2 — Guard `DISABLE_WHATSAPP` (TDD)
**Files:**
- Modify: `laura-go/main.go`, `laura-go/internal/whatsapp/client.go`, `laura-go/.env.example`
- Create: `laura-go/internal/whatsapp/disable_test.go`

**Steps:**
- [ ] 1. Criar `disable_test.go` — `TestInitWhatsmeow_DisableFlag_SkipsInit` (seta env `DISABLE_WHATSAPP=true` + DB URL bogus; espera nil error). Código literal: plan v1 Task B.2 step 1.
- [ ] 2. Run (FAIL): `cd laura-go && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v`. Expected: FAIL (dial error).
- [ ] 3. Patch `client.go` no início de `InitWhatsmeow`:
  ```go
  if os.Getenv("DISABLE_WHATSAPP") == "true" {
      log.Printf("DISABLE_WHATSAPP=true -- whatsmeow init skipped")
      return nil
  }
  ```
- [ ] 4. Patch `main.go` envolvendo chamada `whatsapp.InitWhatsmeow(...)` com mesmo guard + log alternativo.
- [ ] 5. Patch `laura-go/.env.example` adicionar:
  ```
  # DISABLE_WHATSAPP=true desabilita init whatsmeow (CI E2E).
  DISABLE_WHATSAPP=false
  ```
- [ ] 6. Run (PASS): `cd laura-go && go build ./... && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v`. Expected: PASS.
- [ ] 7. Smoke manual: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . 2>&1 | head -20`. Esperar log "whatsmeow init skipped".
- [ ] 8. Commit:
  ```sh
  git add laura-go/main.go laura-go/internal/whatsapp/{client.go,disable_test.go} laura-go/.env.example
  git commit -m "feat(go): guard DISABLE_WHATSAPP para CI/dev sem WA

  Flag gate sqlstore.New + Upgrade + conexao WA. Necessaria para E2E headless."
  ```

### Task B.3 — Middleware `requestid` + logger JSON (TDD)
**Files:**
- Modify: `laura-go/main.go`, `laura-go/go.mod`, `laura-go/go.sum`
- Create: `laura-go/main_test.go`

**Steps:**
- [ ] 1. Criar `main_test.go` com `TestRequestIDMiddleware_AddsHeader` (contrato Fiber middleware). Código: plan v1 Task B.3 step 1.
- [ ] 2. Run: `cd laura-go && go test -run TestRequestIDMiddleware -v`. Expected: PASS isolado (contrato).
- [ ] 3. Patch `main.go` — imports `requestid` + `utils`; `app.Use(requestid.New(...))` antes de `logger.New()`; logger com `Format` JSON condicional por `ENVIRONMENT=production`. Código: plan v1 Task B.3 step 3.
- [ ] 4. `cd laura-go && go mod tidy && go build ./...`. Expected: sem erros.
- [ ] 5. Smoke: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=... go run . &`; `sleep 2; curl -i http://localhost:8080/health | grep -i x-request-id`; `kill %1`. Expected: header presente (UUID v4).
- [ ] 6. Commit:
  ```sh
  git add laura-go/{main.go,main_test.go,go.mod,go.sum}
  git commit -m "feat(go): middleware requestid + logs JSON em production

  X-Request-Id (UUIDv4) propagado. Logger Fiber emite JSON quando
  ENVIRONMENT=production (Fly). Facilita correlacao em logs."
  ```

### Task B.4 — Handler `/ready` com ping DB (TDD)
**Files:**
- Modify: `laura-go/main.go`, `laura-go/main_test.go` (patch)

**Steps:**
- [ ] 1. `cd laura-go && grep -n '"/health"' main.go internal/handlers/router.go` — confirmar presença (`main.go:39` per spec).
- [ ] 2. Adicionar `TestReadyHandler_ReturnsReadyWhenDBOK` em `main_test.go`. Código: plan v1 Task B.4 step 2.
- [ ] 3. Run: `cd laura-go && go test -run TestReadyHandler -v`. Expected: PASS (contrato).
- [ ] 4. Patch `main.go` registrando `app.Get("/ready", ...)` com `db.PingContext` (503 on error, 200 on ok). Ajustar identificador do pool conforme código real (`pgxpool` → `db.Ping(ctx)`). Código: plan v1 Task B.4 step 4.
- [ ] 5. Run build: `cd laura-go && go build ./...`. Expected: sem erros.
- [ ] 6. Smoke positivo: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . &`; `sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ready`. Expected: `200`. `kill %1`.
- [ ] 7. Smoke negativo: `docker compose -f infrastructure/docker-compose.yml stop db`; `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=... go run . &`; `sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ready`. Expected: `503`. `kill %1 && docker compose -f infrastructure/docker-compose.yml start db`.
- [ ] 8. Commit:
  ```sh
  git add laura-go/{main.go,main_test.go}
  git commit -m "feat(go): handler /ready com ping DB

  200 quando DB responde, 503 em falha. Fly healthchecks ganham /ready alem
  de /health (ver fly.toml task D.1)."
  ```

---

## Parte C — Migrations embutidas

### Task C.1 — `embed.FS` + driver iofs
**Files:**
- Create: `laura-go/internal/migrations/embed.go`, `laura-go/internal/migrations/embed_test.go`
- Modify: `.gitignore`

**Steps:**
- [ ] 1. `ls infrastructure/migrations/` — confirmar 35 arquivos `000001_*.sql` a `000035_*.sql`.
- [ ] 2. Criar `laura-go/internal/migrations/embed.go` com `//go:embed *.sql` + função `Source()` retornando `source.Driver`. Código: plan v1 Task C.1 step 2.
- [ ] 3. Criar `embed_test.go` com `TestEmbed_HasAllMigrations` (count ≥35). Código: plan v1 Task C.1 step 3.
- [ ] 4. `cp infrastructure/migrations/*.sql laura-go/internal/migrations/` (cópia local para `go build`; em CI/Docker build faz igual via COPY).
- [ ] 5. `cd laura-go && go mod tidy` — puxa `golang-migrate/migrate/v4` + `source/iofs`.
- [ ] 6. Run test: `cd laura-go && go test ./internal/migrations/... -v`. Expected: PASS (count ≥35).
- [ ] 7. Adicionar ao `.gitignore` raiz:
  ```
  laura-go/internal/migrations/*.sql
  ```
- [ ] 8. Commit:
  ```sh
  git add laura-go/internal/migrations/{embed.go,embed_test.go} laura-go/go.{mod,sum} .gitignore
  git commit -m "feat(migrations): embed.FS para migrations SQL no binario

  //go:embed *.sql (copiado de infrastructure/migrations no build). Source()
  retorna iofs.Driver p/ golang-migrate/migrate v4. SQL files ignorados no
  git (fonte canonica continua em infrastructure/migrations/)."
  ```

### Task C.2a — Função `runMigrations()` em main.go
**Files:** Modify: `laura-go/main.go`.
**Steps:**
- [ ] 1. Adicionar imports (`errors`, `github.com/golang-migrate/migrate/v4`, `_ postgres driver`, import path real do package `migrations`).
- [ ] 2. Adicionar função `runMigrations(dbURL string) error` usando `migrate.NewWithSourceInstance("iofs", src, dbURL)` + `m.Up()` + tratar `migrate.ErrNoChange`. Código: plan v1 Task C.2 step 1.
- [ ] 3. `cd laura-go && go build ./...`. Expected: sem erros.
- [ ] 4. Sem commit (próxima subtask).

### Task C.2b — Chamada gated + env + smoke
**Files:** Modify: `laura-go/main.go`, `laura-go/.env.example`.
**Steps:**
- [ ] 1. Adicionar chamada no início de `main()` pós-env-load + pré-WA-init:
  ```go
  if os.Getenv("MIGRATE_ON_BOOT") == "true" {
      if err := runMigrations(dbURL); err != nil {
          log.Fatalf("runMigrations: %v", err)
      }
  }
  ```
- [ ] 2. Adicionar em `.env.example`:
  ```
  # MIGRATE_ON_BOOT=true roda migrate up via embed.FS no boot.
  MIGRATE_ON_BOOT=false
  ```
- [ ] 3. Smoke primeira run: criar DB `laura_migtest` limpo, rodar `cd laura-go && DISABLE_WHATSAPP=true MIGRATE_ON_BOOT=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura_migtest?sslmode=disable go run . 2>&1 | head -30`. Expected: log `migrations aplicadas: version=35 dirty=false`.
- [ ] 4. Smoke idempotência: `kill %1`; repetir step 3. Expected: log `version=35` sem aplicar nova.
- [ ] 5. Commit:
  ```sh
  git add laura-go/main.go laura-go/.env.example laura-go/go.{mod,sum}
  git commit -m "feat(migrations): runMigrations no boot via MIGRATE_ON_BOOT

  golang-migrate/migrate v4 + iofs + pg_advisory_lock. Flag opt-in.
  migrate.ErrNoChange suprimido (idempotente)."
  ```

### Task C.3 — Dockerfile distroless + `-tags timetzdata` (reconciliação vs v1)
**Files:** Modify: `laura-go/Dockerfile`.

**Decisão reconciliada:** runtime `gcr.io/distroless/static-debian12:nonroot` (não alpine). `-tags timetzdata` embute zoneinfo no binário. Healthcheck Docker removido (Fly usa `[[http_service.checks]]` via rede). `wget` não é necessário. Imagem esperada <20MB.

**Steps:**
- [ ] 1. Reescrever `laura-go/Dockerfile`:
  ```dockerfile
  # syntax=docker/dockerfile:1.7

  FROM golang:1.26-alpine AS build
  WORKDIR /src
  RUN apk add --no-cache ca-certificates git
  COPY laura-go/go.mod laura-go/go.sum ./laura-go/
  WORKDIR /src/laura-go
  RUN go mod download
  COPY laura-go ./
  COPY infrastructure/migrations ./internal/migrations
  RUN CGO_ENABLED=0 GOOS=linux go build \
          -tags "timetzdata" \
          -ldflags="-s -w" \
          -o /out/laura ./

  FROM gcr.io/distroless/static-debian12:nonroot
  ENV TZ=America/Sao_Paulo
  WORKDIR /app
  COPY --from=build /out/laura /app/laura
  USER nonroot:nonroot
  EXPOSE 8080
  ENTRYPOINT ["/app/laura"]
  ```
- [ ] 2. Ajustar build context para raiz do repo (porque `COPY infrastructure/migrations` precisa ver a pasta fora de `laura-go/`). `docker build -f laura-go/Dockerfile .` (context = `.`).
- [ ] 3. Atualizar `.github/workflows/go-ci.yml` e `deploy-api.yml` (Task L.1) para usar `-f laura-go/Dockerfile` com context raiz. Registrar como sub-fix do workflow do agente B caso ele assuma context `laura-go/`.
- [ ] 4. Build: `docker build -f laura-go/Dockerfile -t laura-go:test .` (rodado da raiz). Expected: build OK.
- [ ] 5. Tamanho: `docker images laura-go:test --format "{{.Size}}"`. Expected: <30MB (distroless).
- [ ] 6. Smoke runtime:
  ```sh
  docker run --rm -d --name laura-test -p 18080:8080 \
    -e DISABLE_WHATSAPP=true \
    -e DATABASE_URL=postgres://laura:laura@host.docker.internal:5432/laura?sslmode=disable \
    laura-go:test
  sleep 3
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/health
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/ready
  docker stop laura-test
  ```
  Expected: `/health` 200, `/ready` 200.
- [ ] 7. Commit:
  ```sh
  git add laura-go/Dockerfile
  git commit -m "build(docker): distroless runtime + timetzdata + embed migrations

  - Runtime gcr.io/distroless/static-debian12:nonroot (superficie reduzida,
    imagem <30MB).
  - Build com -tags timetzdata (America/Sao_Paulo no binario; dispensa tzdata
    do SO).
  - COPY infrastructure/migrations -> laura-go/internal/migrations antes do
    build para //go:embed.
  - Healthcheck movido para fly.toml [[http_service.checks]] (rede Fly);
    HEALTHCHECK do Dockerfile removido (desnecessario)."
  ```

---

## Parte D — fly.toml + PWA package.json

### Task D.1 — Reescrever `laura-go/fly.toml`
**Files:** Modify: `laura-go/fly.toml`.
**Steps:**
- [ ] 1. Reescrever conteúdo conforme spec v3 §4.7 (identical ao plan v1 Task D.1 step 1) — remove `[mounts]`, `memory="512mb"`, `auto_stop="suspend"`, `TZ=America/Sao_Paulo`, `MIGRATE_ON_BOOT=true`, `ENVIRONMENT=production`, `kill_signal=SIGTERM`, `kill_timeout=30`, `[[http_service.checks]]` para `/health` e `/ready`.
- [ ] 2. Validar TOML: `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"`. Expected: `toml ok`.
- [ ] 3. Se `fly` CLI instalada: `fly config validate --config laura-go/fly.toml`. Senão registrar para PR validation.
- [ ] 4. Commit:
  ```sh
  git add laura-go/fly.toml
  git commit -m "fix(fly): alinhar fly.toml com spec v3 (single-machine + /ready)

  - Remove [mounts] whatsmeow_data (whatsmeow persiste em Postgres).
  - 256mb -> 512mb (whatsmeow + cron + pgxpool margeiam 256mb).
  - auto_stop stop -> suspend.
  - TZ=America/Sao_Paulo, MIGRATE_ON_BOOT=true, ENVIRONMENT=production.
  - Healthchecks /health + /ready.
  - kill_signal=SIGTERM + kill_timeout=30 (graceful shutdown cron)."
  ```

### Task D.2 — Script `typecheck` no PWA package.json
**Files:** Modify: `laura-pwa/package.json`.
**Steps:**
- [ ] 1. Confirmar ausência: `python3 -c "import json; print('typecheck' in json.load(open('laura-pwa/package.json'))['scripts'])"`. Expected: `False`.
- [ ] 2. Adicionar em `scripts`: `"typecheck": "tsc --noEmit"`.
- [ ] 3. Validar: `cd laura-pwa && npm run typecheck`. Expected: sem erros (ou registrar erros existentes não relacionados).
- [ ] 4. Commit:
  ```sh
  git add laura-pwa/package.json
  git commit -m "chore(pwa): adicionar script typecheck (tsc --noEmit)

  Usado pelo pwa-ci.yml. Cobre GAP item 25 da spec v3 secao 15."
  ```

---

## Parte E — lefthook canônico + remoção `.githooks/`

### Task E.1 — Criar `lefthook.yml` e remover `.githooks/`
**Files:**
- Create: `lefthook.yml`
- Delete: `.githooks/pre-commit` (+ diretório `.githooks/`)
- Modify: `README.md`

**Decisão reconciliada:** lefthook canônico. `.githooks/` removido para evitar duplicação silenciosa (fonte de bug quando um contribuidor instala um e não outro).

**Steps:**
- [ ] 1. Criar `lefthook.yml` raiz com `pre-commit` (gitleaks protect + golangci-lint + eslint staged) e `pre-push` (`go test -short`). Código: plan v1 Task E.1 step 1.
- [ ] 2. `git rm -rf .githooks/`.
- [ ] 3. Patch `README.md` adicionar seção "Pre-commit hooks":
  ```md
  ## Pre-commit hooks

  Canonico: **lefthook**.

  ```sh
  brew install lefthook
  lefthook install
  ```

  Verifica gitleaks + golangci-lint + eslint em staged files.
  ```
- [ ] 4. Se `lefthook` instalado: `lefthook run pre-commit --files README.md`. Expected: steps passam. Senão registrar validação pós-instalação.
- [ ] 5. Commit:
  ```sh
  git add lefthook.yml README.md
  git rm -rf .githooks/
  git commit -m "chore(hooks): adotar lefthook canonico + remover .githooks

  - pre-commit: gitleaks protect + golangci-lint + eslint staged.
  - pre-push: go test -short.
  - .githooks removido para evitar duplicacao silenciosa (dois caminhos
    divergentes de hook). Fonte unica = lefthook.yml."
  ```

---

## Parte F — Migration 000035 dry-run + apply local

### Task F.1 — Criar scripts + dir backups
**Files:**
- Create: `scripts/dry-run-000035.sql`, `scripts/migrate.sh`, `infrastructure/backups/.gitkeep`
- Modify: `.gitignore`

**Steps:**
- [ ] 1. Criar `scripts/dry-run-000035.sql` com 8 `SELECT COUNT(*) WHERE workspace_id IS NULL` (tabelas: transactions, accounts, categories, cards, invoices, financial_goals, investments, debt_rollovers). Código: plan v1 Task F.1 step 1.
- [ ] 2. Criar `scripts/migrate.sh` wrapper CLI (`up`/`down`/`version`/`force`) + `chmod +x`. Código: plan v1 Task F.1 step 2.
- [ ] 3. Criar `infrastructure/backups/.gitkeep` vazio + patch `.gitignore`:
  ```
  infrastructure/backups/*.sql
  infrastructure/backups/*.dump
  !infrastructure/backups/.gitkeep
  ```
- [ ] 4. Commit:
  ```sh
  git add scripts/{dry-run-000035.sql,migrate.sh} infrastructure/backups/.gitkeep .gitignore
  git commit -m "feat(migrations): dry-run 000035 + wrapper migrate.sh + dir backups"
  ```

### Task F.2a — Subir Postgres dev + aplicar 001..034
**Steps:**
- [ ] 1. `docker compose -f infrastructure/docker-compose.yml up -d db`. Aguardar health: `docker compose -f infrastructure/docker-compose.yml ps`. Expected: `healthy`.
- [ ] 2. `DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable scripts/migrate.sh version`. Se `< 34`: `migrate -path infrastructure/migrations -database "$DATABASE_URL" goto 34`.
- [ ] 3. Expected: `version = 34`.
- [ ] 4. Sem commit (procedimental).

### Task F.2b — Dry-run destrutivo
**Steps:**
- [ ] 1. `psql "postgres://laura:laura@localhost:5432/laura" -f scripts/dry-run-000035.sql | tee /tmp/dry-run-000035.out`.
- [ ] 2. Inspecionar saída: **todos 0** → prosseguir para F.2c. **>0 qualquer linha** → PARAR, registrar no HANDOFF, pedir decisão ao usuário (backfill/archive/aceitar-perda).
- [ ] 3. Sem commit.

### Task F.2c — Backup pré-apply
**Steps:**
- [ ] 1. `pg_dump --format=custom "postgres://laura:laura@localhost:5432/laura" > "infrastructure/backups/pre-035-$(date +%Y%m%d-%H%M%S).dump"`.
- [ ] 2. Confirmar tamanho >0: `ls -lh infrastructure/backups/`. Expected: arquivo com bytes.
- [ ] 3. Sem commit (dumps são ignored).

### Task F.2d — Aplicar migration em transação + validar
**Steps:**
- [ ] 1. `scripts/migrate.sh up` (CLI faz bookkeeping automático em `schema_migrations`). Expected: log `1/u 000035_security_hardening ...`.
- [ ] 2. Validar constraints: `psql "postgres://laura:laura@localhost:5432/laura" -c "\d transactions" | grep workspace_id`. Expected: `workspace_id uuid NOT NULL`.
- [ ] 3. Validar version: `psql "..." -c "SELECT version FROM schema_migrations;"`. Expected: `35`.
- [ ] 4. Idempotência: `scripts/migrate.sh up`. Expected: `no change`.
- [ ] 5. Sem commit (mudança só no DB local; registrar em HANDOFF via Task G.2).

---

## Parte G — Documentação operacional (migrations + handoff + memory)

### Task G.1 — `docs/ops/migrations.md`
**Files:** Create: `docs/ops/migrations.md`.
**Steps:**
- [ ] 1. Criar conteúdo conforme plan v1 Task G.1 step 1 (dev local, prod Fly, dry-run 000035, rollback, backup manual).
- [ ] 2. Commit:
  ```sh
  git add docs/ops/migrations.md
  git commit -m "docs(ops): procedimento de migrations (dev + prod + dry-run)"
  ```

### Task G.2 — Atualizar `docs/HANDOFF.md`
**Files:** Modify: `docs/HANDOFF.md`.
**Steps:**
- [ ] 1. Ler `docs/HANDOFF.md` atual.
- [ ] 2. Inserir seção "Histórico de atualizações" no topo com entrada `2026-04-15 — Fase 10 preparada` (bullets: CI/CD, Dockerfile distroless, fly.toml single-machine, patches Go, lefthook, migration 000035 aplicada local, STANDBYs ativos). Código: plan v1 Task G.2 step 2.
- [ ] 3. Atualizar seção "Estado da produção" / "Próximos passos" para refletir próximo passo = STANDBY [GROQ-REVOKE] → Task H.1.
- [ ] 4. Commit:
  ```sh
  git add docs/HANDOFF.md
  git commit -m "docs(handoff): atualizar para estado pos-Fase 10 preparada"
  ```

### Task G.3 — Entrada memory
**Files:** Create: `~/.claude/projects/<slug-laura>/memory/phase_10_complete.md` + update MEMORY.md.
**Steps:**
- [ ] 1. `ls /Users/joaovitorzanini/.claude/projects/ | grep -i laura` — obter slug.
- [ ] 2. Criar `phase_10_complete.md` (conteúdo: plan v1 Task G.3 step 2).
- [ ] 3. Adicionar link em MEMORY.md.
- [ ] 4. Sem commit (path fora do repo).

---

## Parte H — Sanitização git history (preparar, STANDBY)

### Task H.1 — Script `sanitize-history.sh` + playbook
**Files:**
- Create: `scripts/sanitize-history.sh`
- Modify: `docs/ops/security.md`, `.gitignore`

**Steps:**
- [ ] 1. Criar `scripts/sanitize-history.sh` (backup via `git bundle` → `git filter-repo --replace-text .git-secrets-to-purge.txt --force` → validação `git log -p -Sgsk_` → instrução manual de force push). Código: plan v1 Task H.1 step 1. `chmod +x`.
- [ ] 2. Adicionar `.git-secrets-to-purge.txt` ao `.gitignore`.
- [ ] 3. Expandir `docs/ops/security.md` seção "Playbook: key vazada no histórico git" (9 passos: revoke → regen → update secrets → backup → filter → force push → validate). Código: plan v1 Task H.1 step 3.
- [ ] 4. **NÃO executar** o script. Marca `STANDBY [GROQ-REVOKE]` + `STANDBY [FORCE-PUSH]`.
- [ ] 5. Commit:
  ```sh
  git add scripts/sanitize-history.sh docs/ops/security.md .gitignore
  git commit -m "docs(security): playbook key vazada + script sanitize-history

  Preparado. NAO executado. STANDBY [GROQ-REVOKE] + [FORCE-PUSH]."
  ```

---

## Parte I — Tag + consolidação final

### Task I.1 — Verificação pré-tag + tag `phase-10-prepared`
**Steps:**
- [ ] 1. `cd laura-go && go build ./... && go test ./...`. Expected: PASS.
- [ ] 2. `cd laura-pwa && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] 3. `docker build -f laura-go/Dockerfile -t laura-go:phase10 .`. Expected: OK.
- [ ] 4. `git status --short`. Expected: working tree limpa.
- [ ] 5. `git log --oneline -30`. Expected: commits PT-BR da Fase 10.
- [ ] 6. `git tag -a phase-10-prepared -m "Fase 10 preparada -- CI/CD, Docker, Fly, patches Go. Deploy prod STANDBY."`.
- [ ] 7. **NÃO** `git push --tags` automaticamente (evita poluir remote com tag intermediária).

---

## Parte J — Runbooks operacionais (NOVO v2 — GAPs 46, 47)

### Task J.1 — `docs/ops/runbooks/rollback.md`
**Files:** Create: `docs/ops/runbooks/rollback.md`.
**Steps:**
- [ ] 1. Criar arquivo com 4 seções:
  - **API (Fly):** `fly releases list -a laura-finance-api` → `fly releases rollback <vN-1>` → validar `/health` + `/ready` 200.
  - **PWA (Vercel):** `vercel ls --scope <team>` → `vercel rollback <url-previous>` OU via dashboard "Promote previous".
  - **DB (Fly Postgres backup restore):** `fly postgres backup list -a <pg>` → escolher snapshot pré-incidente → `fly postgres backup restore <id> -a <pg>` → validar via `psql` SELECT `schema_migrations.version`.
  - **Migration 000035 específico:** restore parcial via `pg_restore --data-only --table=<t>` contra dump pré-035 em `infrastructure/backups/`. Comandos explícitos.
- [ ] 2. Cada seção com "Expected" em cada comando.
- [ ] 3. STANDBY [FLY-PG-CREATE] marca drills reais como futuros.
- [ ] 4. Commit:
  ```sh
  git add docs/ops/runbooks/rollback.md
  git commit -m "docs(ops): runbook rollback (API + PWA + DB + migration 000035)"
  ```

### Task J.2 — `docs/ops/runbooks/secrets-rotation.md`
**Files:** Create: `docs/ops/runbooks/secrets-rotation.md`.
**Steps:**
- [ ] 1. Criar arquivo com procedimento por secret:
  - **GROQ_API_KEY:** revoke console → regen → `gh secret set GROQ_API_KEY` → `fly secrets set GROQ_API_KEY=... -a laura-finance-api` → redeploy workflow trigger.
  - **SESSION_HMAC_KEY:** regen via `openssl rand -hex 32` → `fly secrets set` → deploy → invalida sessões (comunicar usuário).
  - **STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET:** dashboard Stripe → roll → atualizar Fly + GH → smoke webhook.
  - **RESEND_API_KEY:** idem Resend.
  - **DATABASE_URL:** via `fly postgres attach` com credenciais novas; requer migração de sessão WA (novo QR scan — ver `ops/deployment.md` §Whatsmeow).
  - Cadência recomendada: 90d routine + imediato em suspeita de leak.
- [ ] 2. Commit:
  ```sh
  git add docs/ops/runbooks/secrets-rotation.md
  git commit -m "docs(ops): runbook secrets-rotation (GROQ, SESSION, STRIPE, RESEND, DATABASE_URL)"
  ```

---

## Parte K — E2E expandido (NOVO v2 — GAPs 27-30)

### Task K.1 — Playwright config + globalSetup
**Files:**
- Modify: `laura-pwa/playwright.config.ts`
- Create: `laura-pwa/tests/global-setup.ts`

**Steps:**
- [ ] 1. Patch `playwright.config.ts`: `baseURL: process.env.BASE_URL || 'http://localhost:3100'`; `globalSetup: './tests/global-setup.ts'`; `use: { trace: 'on-first-retry', screenshot: 'only-on-failure' }`; timeout 30s.
- [ ] 2. Criar `tests/global-setup.ts` que: (a) aguarda API healthy (`GET /health` até 200 ou timeout 30s); (b) gera `storageState` logando user E2E via POST `/api/v1/auth/login` + salva em `tests/.auth/user.json`.
- [ ] 3. `cd laura-pwa && npx playwright test --list`. Expected: lista ≥ 1 spec existente.
- [ ] 4. Commit:
  ```sh
  git add laura-pwa/playwright.config.ts laura-pwa/tests/global-setup.ts
  git commit -m "test(e2e): playwright config baseURL + globalSetup com healthcheck API"
  ```

### Task K.2 — Fixture de auth reutilizável
**Files:** Create: `laura-pwa/tests/fixtures/auth.ts`.
**Steps:**
- [ ] 1. Criar fixture exportando `test.extend<{ authedPage: Page }>({ authedPage: async ({ browser }, use) => { const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' }); const page = await ctx.newPage(); await use(page); await ctx.close(); } })`.
- [ ] 2. Exportar também helpers `loginAs(page, email, password)` e `expectDarkMode(page)` (valida `document.documentElement.classList.contains('dark')` — UI default do projeto).
- [ ] 3. Commit:
  ```sh
  git add laura-pwa/tests/fixtures/auth.ts
  git commit -m "test(e2e): fixture auth reutilizavel (authedPage + loginAs + expectDarkMode)"
  ```

### Task K.3 — Seed E2E
**Files:** Create: `scripts/seed-e2e.sh`.
**Steps:**
- [ ] 1. Criar script que:
  - Cria user E2E (`e2e@laura.test` / senha fixa) via POST `/api/v1/auth/register` (idempotente: se já existe, skip).
  - Cria conta default + 2 categorias default.
  - Documenta no próprio arquivo que depende de API rodando em `:8080` + DB limpo com migrations aplicadas.
- [ ] 2. `chmod +x scripts/seed-e2e.sh`.
- [ ] 3. Commit:
  ```sh
  git add scripts/seed-e2e.sh
  git commit -m "test(e2e): seed script (user + conta + categorias)"
  ```

### Task K.4 — 8 specs E2E
**Files:** Create:
- `laura-pwa/tests/auth.spec.ts`
- `laura-pwa/tests/transactions.spec.ts`
- `laura-pwa/tests/cards-invoices.spec.ts`
- `laura-pwa/tests/goals.spec.ts`
- `laura-pwa/tests/investments.spec.ts`
- `laura-pwa/tests/score.spec.ts`
- `laura-pwa/tests/reports.spec.ts`
- `laura-pwa/tests/super-admin.spec.ts`

**Steps:**
- [ ] 1. Cada spec usa `data-testid` estável (ex: `data-testid="btn-login-submit"`). Onde ausente no código PWA, anotar em `NOTES.tmp.md` como follow-up leve (não bloqueante — teste pode usar role+name enquanto isso).
- [ ] 2. Cenários mínimos (1 happy path cada):
  - **auth:** register novo → login → logout.
  - **transactions:** criar transação receita + despesa → listar → deletar.
  - **cards-invoices:** criar cartão → criar despesa vinculada → ver fatura → simular "empurrar fatura" (botão `data-testid="btn-push-invoice"`).
  - **goals:** criar meta com valor-alvo + deadline → ver progresso 0%.
  - **investments:** criar investimento tipo CDB → ver na lista.
  - **score:** abrir /score → ver gauge renderizado (`data-testid="score-gauge"` presente) + valor numérico.
  - **reports:** abrir /reports → navegar pelas 9 abas → assert gráficos presentes.
  - **super-admin:** login como admin → ver lista de workspaces.
- [ ] 3. Todos os specs usam `authedPage` da fixture (exceto `auth.spec.ts` que testa fluxo de login sem auth prévio).
- [ ] 4. Rodar local: `cd laura-pwa && BASE_URL=http://localhost:3100 npx playwright test --reporter=list`. Expected: 8 passes. (Pré-req: API `:8080` + PWA `:3100` + `scripts/seed-e2e.sh` executados.)
- [ ] 5. Commit:
  ```sh
  git add laura-pwa/tests/{auth,transactions,cards-invoices,goals,investments,score,reports,super-admin}.spec.ts
  git commit -m "test(e2e): 8 specs cobrindo fluxos MVP criticos

  auth, transactions, cards-invoices, goals, investments, score, reports,
  super-admin. Usa authedPage fixture + data-testid estaveis + dark-mode
  default. Seed via scripts/seed-e2e.sh."
  ```

---

## Parte L — Workflows de deploy automático (NOVO v2 — GAPs 35, 39)

### Task L.1 — `.github/workflows/deploy-api.yml`
**Files:** Create: `.github/workflows/deploy-api.yml`.
**Steps:**
- [ ] 1. Criar workflow:
  ```yaml
  name: deploy-api
  on:
    push:
      branches: [main]
      paths:
        - 'laura-go/**'
        - 'infrastructure/migrations/**'
        - 'laura-go/fly.toml'
        - '.github/workflows/deploy-api.yml'
  jobs:
    deploy:
      runs-on: ubuntu-latest
      concurrency: deploy-api
      steps:
        - uses: actions/checkout@v4
        - uses: superfly/flyctl-actions/setup-flyctl@master
        - run: flyctl deploy --remote-only --config laura-go/fly.toml --dockerfile laura-go/Dockerfile
          env:
            FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
  ```
- [ ] 2. Validar YAML: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-api.yml')); print('ok')"`. Expected: `ok`.
- [ ] 3. STANDBY [FLY-AUTH]: workflow falha até `FLY_API_TOKEN` ser setado no GitHub Secrets. Registrar em HANDOFF.
- [ ] 4. Commit:
  ```sh
  git add .github/workflows/deploy-api.yml
  git commit -m "ci(deploy): workflow deploy-api (Fly.io)

  Gate por paths laura-go + infrastructure/migrations + fly.toml. Requer
  STANDBY [FLY-AUTH] (FLY_API_TOKEN no GH Secrets)."
  ```

### Task L.2 — `.github/workflows/deploy-pwa.yml`
**Files:** Create: `.github/workflows/deploy-pwa.yml`.
**Steps:**
- [ ] 1. Criar workflow com `amondnet/vercel-action@v25`:
  ```yaml
  name: deploy-pwa
  on:
    push:
      branches: [main]
      paths:
        - 'laura-pwa/**'
        - '.github/workflows/deploy-pwa.yml'
  jobs:
    deploy:
      runs-on: ubuntu-latest
      concurrency: deploy-pwa
      steps:
        - uses: actions/checkout@v4
        - uses: amondnet/vercel-action@v25
          with:
            vercel-token: ${{ secrets.VERCEL_TOKEN }}
            vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
            vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
            working-directory: ./laura-pwa
            vercel-args: '--prod'
  ```
- [ ] 2. Validar YAML.
- [ ] 3. STANDBY [VERCEL-AUTH]: requer `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- [ ] 4. Commit:
  ```sh
  git add .github/workflows/deploy-pwa.yml
  git commit -m "ci(deploy): workflow deploy-pwa (Vercel)

  Gate por paths laura-pwa. Requer STANDBY [VERCEL-AUTH]
  (VERCEL_TOKEN + ORG_ID + PROJECT_ID no GH Secrets)."
  ```

---

## Parte M — `.env.example` raiz consolidado (NOVO v2 — GAP 48)

### Task M.1 — `.env.example` raiz (Go + PWA)
**Files:** Create: `.env.example`.
**Steps:**
- [ ] 1. Criar `.env.example` na raiz do repo com 3 seções comentadas:
  ```
  # === Backend Go (laura-go/) ===
  DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable
  PORT=8080
  APP_ENV=development
  ENVIRONMENT=development
  TZ=America/Sao_Paulo
  MIGRATE_ON_BOOT=false
  DISABLE_WHATSAPP=false
  LOG_LEVEL=info
  SESSION_HMAC_KEY=replace-with-32-bytes-hex
  GROQ_API_KEY=
  OPENAI_API_KEY=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  RESEND_API_KEY=

  # === PWA Next.js (laura-pwa/) ===
  NEXT_PUBLIC_API_URL=http://localhost:8080
  NEXT_PUBLIC_APP_ENV=development
  # NEXTAUTH_SECRET se aplicavel
  # NEXTAUTH_URL=http://localhost:3100

  # === E2E / CI ===
  # BASE_URL usado por Playwright (default http://localhost:3100)
  # TEST_DATABASE_URL usado por testes de integracao Go
  ```
- [ ] 2. Validar que `laura-go/.env.example` continua existindo (subset Go-only, referência via comentário no topo para o `.env.example` raiz).
- [ ] 3. Commit:
  ```sh
  git add .env.example
  git commit -m "docs(env): .env.example raiz consolidado (Go + PWA + E2E)

  Cobre 100% das vars usadas. laura-go/.env.example mantido como subset
  especifico do backend."
  ```

### Task M.2 — `.dockerignore` raiz
**Files:** Create: `.dockerignore` (raiz).
**Steps:**
- [ ] 1. Confirmar ausência: `ls .dockerignore 2>&1`. Expected: `No such file`.
- [ ] 2. Criar `.dockerignore` raiz (complementa `laura-go/.dockerignore`):
  ```
  .git/
  .github/
  .githooks/
  docs/
  laura-pwa/node_modules/
  laura-pwa/.next/
  laura-pwa/out/
  laura-pwa/tests/.auth/
  infrastructure/backups/
  pgdata/
  *.md
  .env
  .env.*
  !.env.example
  *.dump
  *.bundle
  .git-secrets-to-purge.txt
  ```
  Justificativa: desde Task C.3 o build context é a raiz do repo; sem `.dockerignore` raiz, Docker copia pastas desnecessárias (PWA `node_modules`, `.next`, docs, backups) pro daemon — lento + risco de vazar `.env` local.
- [ ] 3. Commit:
  ```sh
  git add .dockerignore
  git commit -m "build(docker): .dockerignore raiz (build context = repo root)

  Complementa laura-go/.dockerignore. Evita copiar node_modules/.next/docs/
  backups/.env para Docker daemon. Obrigatorio desde C.3 (context = raiz)."
  ```

---

## Self-review — Cobertura 1:1 dos 52 itens da spec v3 §15

### A. Sanitização Git (7)
| # | Item | Task | Status |
|---|------|------|--------|
| 1 | Backup local pré-rewrite | H.1 step 1 (`git bundle`) | Coberto (preparado) |
| 2 | `.gitleaks.toml` patterns | A.3 + A.final | Coberto |
| 3 | `filter-repo --replace-text` + validação | H.1 | Coberto (preparado, STANDBY) |
| 4 | Force push coordenado | H.1 doc | STANDBY [GROQ-REVOKE/FORCE-PUSH] (legit) |
| 5 | Atualizar secrets GitHub + Fly (nova Groq) | H.1 + J.2 | STANDBY (legit) |
| 6 | `lefthook.yml` gitleaks | E.1 | Coberto |
| 7 | `.gitignore` raiz | F.1 + H.1 + C.1 | Coberto |

### B. Migrations (7)
| # | Item | Task |
|---|------|------|
| 8 | `scripts/migrate.sh` | F.1 |
| 9 | `scripts/dry-run-000035.sql` | F.1 |
| 10 | `embed.FS` com `//go:embed *.sql` | C.1 |
| 11 | Dockerfile copia migrations | C.3 |
| 12 | Patch `main.go` runMigrations | C.2a + C.2b |
| 13 | CI aplica 2× (idempotência) | A.1 (revisão do go-ci.yml agente B) |
| 14 | `rollback.md` seção 000035 | **J.1** (era GAP v1) |

### C. Patches Go (7)
| # | Item | Task |
|---|------|------|
| 15 | `client.go` Container.Upgrade | B.1 |
| 16 | `instance_manager.go` Container.Upgrade | B.1 |
| 17 | `main.go` guard DISABLE_WHATSAPP | B.2 |
| 18 | `client.go` early-return DISABLE_WHATSAPP | B.2 |
| 19 | `main.go` requestid | B.3 |
| 20 | Logger JSON condicional | B.3 |
| 21 | Handler `/ready` | B.4 |

### D. CI (5)
| # | Item | Task |
|---|------|------|
| 22 | `go-ci.yml` | A.1 + A.final |
| 23 | `pwa-ci.yml` | A.2 + A.final |
| 24 | `.golangci.yml` | A.final |
| 25 | `laura-pwa/package.json` typecheck | **D.2** (era GAP v1) |
| 26 | Validar via actionlint + PR | 0.1 step 4 |

### E. Testes E2E (4)
| # | Item | Task |
|---|------|------|
| 27 | Playwright config baseURL + globalSetup | **K.1** (era GAP v1) |
| 28 | `fixtures/auth.ts` | **K.2** (era GAP v1) |
| 29 | 8 specs | **K.4** (era GAP v1) |
| 30 | `scripts/seed-e2e.sh` | **K.3** (era GAP v1) |

### F. Containers (3)
| # | Item | Task |
|---|------|------|
| 31 | Dockerfile multi-stage timetzdata | C.3 |
| 32 | `.dockerignore` raiz | **M.2** (era GAP v1; `laura-go/.dockerignore` mantido em A.4) |
| 33 | Build <80MB, /health+/ready 200 | C.3 + I.1 |

### G. Fly (4)
| # | Item | Task |
|---|------|------|
| 34 | `fly.toml` completo | D.1 |
| 35 | `deploy-api.yml` | **L.1** (era GAP v1) |
| 36 | STANDBYs em HANDOFF | G.2 |
| 37 | `fly scale count 1` pós-deploy | D.1 (doc) + G.2 |

### H. Vercel (3)
| # | Item | Task |
|---|------|------|
| 38 | `vercel.json` headers + HSTS | A.6 + A.final |
| 39 | `deploy-pwa.yml` | **L.2** (era GAP v1) |
| 40 | STANDBYs em HANDOFF | G.2 |

### I. Postgres prod (2)
| # | Item | Task |
|---|------|------|
| 41 | Comandos Fly Postgres em `ops/deployment.md` | A.final + J.1 ref |
| 42 | Dry-run antes de MIGRATE_ON_BOOT | F.2b + G.1 (doc prod) |

### J. Documentação (6)
| # | Item | Task |
|---|------|------|
| 43 | HANDOFF atualizado | G.2 |
| 44 | `ops/security.md` | A.final + H.1 |
| 45 | `ops/deployment.md` | A.final |
| 46 | `runbooks/secrets-rotation.md` | **J.2** (era GAP v1) |
| 47 | `runbooks/rollback.md` | **J.1** (era GAP v1) |
| 48 | `.env.example` raiz | **M.1** (era GAP v1) |

### K. Tags + memory (2)
| # | Item | Task |
|---|------|------|
| 49 | Tag `phase-10-deployed` pós smoke | **Deferido** (este plan aplica `phase-10-prepared` em I.1; deployed fica para pós-STANDBY) |
| 50 | Entrada memory | G.3 |

### L. Drills (2)
| # | Item | Task |
|---|------|------|
| 51 | Drill rollback | STANDBY [FLY-PG-CREATE] — doc em J.1; exec pós-deploy |
| 52 | Drill restore Fly PG | STANDBY [FLY-PG-CREATE] — doc em J.1; exec pós-deploy |

### Contagem final
- **Total itens spec v3:** 52.
- **Cobertos 100% por tasks v2:** 47.
- **Cobertos pelo agente B + revisão em A.*:** 5 (itens 2, 22, 23, 24, 38, 44 parcial, 45).
- **Deferidos legitimamente (STANDBY externo):** 5 (itens 4, 5, 49, 51, 52).
- **GAPs remanescentes para review #2:** **0**.

### STANDBYs no plan v2
GROQ-REVOKE (H.1), FORCE-PUSH (H.1), VERCEL-AUTH (L.2 + G.2), VERCEL-ENV (G.2), FLY-AUTH (L.1 + G.2), FLY-CARD (G.2), FLY-SECRETS (G.2 + J.2), FLY-PG-CREATE (G.2 + J.1 + 51/52), STRIPE-LIVE (G.2 + J.2), RESEND-DOMAIN (G.2 + J.2), DNS (G.2), CODECOV-TOKEN (opcional), SENTRY-DSN (Fase 11).

### Contagem de tasks
- Parte 0: 1 task.
- Parte A: 7 tasks (A.1-A.6 + A.final).
- Parte B: 4 tasks (B.1-B.4, cada com TDD estrito em 6-8 sub-steps).
- Parte C: 4 tasks (C.1, C.2a, C.2b, C.3).
- Parte D: 2 tasks (D.1, D.2).
- Parte E: 1 task (E.1).
- Parte F: 5 tasks (F.1, F.2a-d).
- Parte G: 3 tasks (G.1, G.2, G.3).
- Parte H: 1 task (H.1).
- Parte I: 1 task (I.1).
- Parte J: 2 tasks (J.1, J.2).
- Parte K: 4 tasks (K.1-K.4).
- Parte L: 2 tasks (L.1, L.2).
- Parte M: 2 tasks (M.1, M.2).
- **Total: 39 tasks** (vs. 21 no v1). Granularidade ≤5 min por task (exceto K.4 — 8 specs — esperar ~30-40 min mas independente).

### Ordem de execução validada
0 → A (todas) → B.1 → B.2 → B.3 → B.4 → C.1 → C.2a → C.2b → C.3 → D.1 → D.2 → E.1 → F.1 → F.2a → F.2b → F.2c → F.2d → G.1 → G.2 → G.3 → H.1 → J.1 → J.2 → K.1 → K.2 → K.3 → K.4 → L.1 → L.2 → M.1 → M.2 → I.1.

Dependências críticas: B.4 antes de C.2b (healthcheck `/ready` usado em smoke runMigrations); C.3 depois de C.1/C.2 (Dockerfile exige embed funcionando); D.1 depois de B.4 (fly.toml referencia `/ready`); M.2 depois de C.3 (context = raiz exige `.dockerignore` raiz); I.1 último.

### Confirmação "zero placeholders"
Revisado. Nenhum "TBD" / "similar to" / "implement later". Onde conteúdo exato depende de código atual (ex: nome do `db` pool em `main.go`), task instrui `grep` prévio.

---

**Fim do Plan v2.** Pronto para review #2. GAPs remanescentes: 0. STANDBYs externos: 13 (rastreados). Próxima ação após aprovação: executar via `superpowers:subagent-driven-development`.
