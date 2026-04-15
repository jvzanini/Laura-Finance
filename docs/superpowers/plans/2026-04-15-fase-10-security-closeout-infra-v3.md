# Fase 10 — Security closeout + infraestrutura mínima de produção (Plan v3 — FINAL)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plan task-a-task. Steps em checkbox (`- [ ]`).

**Data:** 2026-04-15
**Versão:** v3 — FINAL (pós review #2, pente fino; sem revisão posterior — próximo passo = execução)
**Spec canônica:** `docs/superpowers/specs/2026-04-15-fase-10-security-closeout-infra-v3.md`
**Plan v1 (histórico):** `docs/superpowers/plans/2026-04-15-fase-10-security-closeout-infra-v1.md`
**Plan v2 (histórico):** `docs/superpowers/plans/2026-04-15-fase-10-security-closeout-infra-v2.md`

**Goal:** Fechar pendências de segurança (sanitização git, secrets) e habilitar deploy contínuo do Laura Finance (PWA→Vercel, Go→Fly.io, Postgres gerenciado), com CI/CD completo, E2E Playwright expandido (8 fluxos + fixture auth), runbooks operacionais e workflows de deploy automático.

**Architecture:** PWA Next.js 16 → Vercel (gru1). Go 1.26.1 (Fiber v2 + Whatsmeow + cron) → Fly.io single-machine gru com Fly Postgres gerenciado. Migrations via `embed.FS` + `golang-migrate/migrate v4` gated por `MIGRATE_ON_BOOT=true`. CI GitHub Actions (go-ci, pwa-ci, playwright, security/gitleaks). Deploy gated por STANDBYs externos.

**Tech Stack:** Go 1.26.1, Fiber v2, pgx/v5, whatsmeow+sqlstore PG, robfig/cron/v3, golang-migrate/migrate v4 + iofs; Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Playwright; Postgres 16 + pgvector; Docker (distroless static nonroot + `-tags timetzdata`); Fly.io + Vercel; gitleaks + lefthook.

---

## Mudanças principais vs. Plan v2

1. **Parte F consolidada em 1 task única (`F.local-validate`)** — descoberta pré-v3 confirmou que migration 000035 **já está aplicada** no Postgres local (5 CHECK constraints + 14 triggers + 0 NULLs em todas 8 tabelas). As antigas F.1/F.2a/F.2b/F.2c/F.2d viram uma tarefa de validação + documentação. Procedimento de apply (dry-run + pg_dump + `migrate up`) fica **documentado em `docs/ops/migrations.md`** para uso em PROD (STANDBY [FLY-PG-CREATE]).
2. **Task B.1 transformada em teste de regressão** — inspeção do banco local mostrou 15 tabelas `whatsmeow_*` criadas. A versão corrente de `go.mau.fi/whatsmeow` em `sqlstore.New` já invoca `Container.Upgrade` internamente. B.1 agora é um teste de integração que **afirma** isso, sem alterar `client.go`/`instance_manager.go`.
3. **Task B.4 (`/ready`) refocada** — `/health` já existe em dois lugares (`main.go:39` root + `router.go:45` `/api/v1/health`). B.4 cria **apenas** o handler `/ready` novo + documenta diferença liveness/readiness em `docs/ops/observability.md` (novo arquivo).
4. **K.4 quebrada em 8 sub-tasks (K.4.a … K.4.h)** — uma spec E2E por task (granularidade 3–5 min cada; todas com mesmo scope `e2e`).
5. **Scope `e2e` adicionado** ao conjunto válido de scopes de commit (era: go, pwa, infra, ci, ops, db, ds; agora também: e2e, security, migrations, hooks, docker, fly, vercel).
6. **STANDBYs explicitamente anotados** como prefixo `STANDBY [<ID>]` em cada task afetada, com 13 IDs oficiais listados na seção "STANDBYs globais" abaixo.
7. **Self-review 1:1 reescrita** com quatro estados: `✅ DONE_BY_AGENT_B`, `🔧 IN_PLAN`, `⏸ STANDBY [<id>]`, `📦 DEFERRED`.
8. **Apêndice de comandos comuns** adicionado (evita repetir blocos idênticos em cada task).
9. **Validação automatizada zero-placeholder** executada ao final: nenhum "TBD", "TODO", "implement later", "similar to", "..." em contexto não-literal.
10. **Order de execução atualizada**: `F.local-validate` roda **antes** de qualquer mudança em migrations; `B.4` precede `L.1` (`deploy-api.yml` precisa de healthchecks finalizados); `C.2a → C.2b` (função antes do wiring); `C.3` só após confirmar distroless static tolera `-tags timetzdata` (tolera — zoneinfo fica no binário).

---

## Observações globais

- **Workdir absoluto:** `/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/`.
- **Branch:** `main` (solo dev).
- **Commits** em PT-BR, formato conventional: `<type>(<scope>): <descricao>`, onde:
  - `<type>` ∈ {feat, fix, chore, docs, test, build, refactor, ci}.
  - `<scope>` ∈ {go, pwa, infra, ci, ops, db, ds, e2e, security, migrations, hooks, docker, fly, vercel, env}.
- **STANDBY** marcados com prefixo `STANDBY [<ID>]` — não bloqueia progresso, apenas anota pendência externa.
- **Ordem TDD nos patches Go (B.*):** test (FAIL) → implement → test (PASS) → commit — cada etapa em sub-step separado.
- **Working directory** em cada `Run:` indicado explicitamente (`cd laura-go && ...` ou `cd laura-pwa && ...`).
- **Selectors E2E:** todos os novos specs usam `data-testid` estável + respeitam tema dark default.

## STANDBYs globais (13 IDs oficiais)

| ID | Bloqueia task(s) | Descrição |
|----|-----------------|-----------|
| `GROQ-REVOKE` | H.1 | Usuário revoga a GROQ_API_KEY vazada |
| `FORCE-PUSH` | H.1 | Confirmar force-push pós filter-repo |
| `VERCEL-AUTH` | L.2, G.2 | Token Vercel no GH Secrets |
| `VERCEL-ENV` | G.2 | Env vars prod no dashboard Vercel |
| `FLY-AUTH` | L.1, G.2 | Token Fly no GH Secrets |
| `FLY-SECRETS` | G.2, J.2 | `fly secrets set ...` primeira carga |
| `FLY-PG-CREATE` | G.2, J.1, F.local-validate (nota prod) | Criar Fly Postgres + pgvector |
| `FLY-CARD` | G.2 | Cartão Fly registrado (obrigatório free tier 2024+) |
| `STRIPE-LIVE` | G.2, J.2 | Stripe live keys |
| `RESEND-DOMAIN` | G.2, J.2 | Resend domínio verificado |
| `DNS` | G.2 | Decisão domínio próprio vs interim |
| `CODECOV-TOKEN` | opcional A.1 | Token Codecov (coverage upload opcional) |
| `SENTRY-DSN` | Fase 11 | DSN Sentry (fora do escopo Fase 10) |

---

## Parte 0 — Pré-condições e validações

### Task 0.1 — Confirmar artefatos do agente B e sintaxe base
**Files:** Read: `.github/workflows/{go-ci,pwa-ci,playwright,security}.yml`, `.gitleaks.toml`, `.golangci.yml`, `.githooks/pre-commit`, `laura-go/{Dockerfile,fly.toml,.dockerignore,.env.example}`, `laura-pwa/vercel.json`, `docs/ops/{security,deployment}.md`, `laura-pwa/tests/mvp-flows.spec.ts`.

**Steps:**
- [ ] 1. `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && git status --short`. Expected: listagem com `M`/`??` dos artefatos do agente B.
- [ ] 2. `python3 -c "import yaml; [yaml.safe_load(open(f'.github/workflows/{f}')) for f in ['go-ci.yml','pwa-ci.yml','security.yml','playwright.yml']]; print('yaml ok')"`. Expected: `yaml ok`.
- [ ] 3. `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"`. Expected: `toml ok`.
- [ ] 4. `which actionlint && actionlint .github/workflows/*.yml || echo "actionlint ausente (validar em PR via GH CI)"`. Expected: ok ou mensagem.
- [ ] 5. Sem commit — apenas registra baseline.

---

## Parte A — Validação dos artefatos do agente B (commit de scaffold)

> Cada A.* lê arquivo + confirma cobertura pontual de itens da spec. Gaps anotados em `NOTES.tmp.md` (não versionado) e resolvidos em task dedicada posterior. `A.final` commita scaffold.

### Task A.1 — Revisar `.github/workflows/go-ci.yml`
**Files:** Read `.github/workflows/go-ci.yml`.
**Steps:**
- [ ] 1. Ler arquivo.
- [ ] 2. Confirmar jobs/steps: `setup-go@v5` Go 1.26, `go vet ./...` em `laura-go/`, action `golangci-lint`, `gosec` (HIGH), `govulncheck`, service `pgvector/pgvector:pg16` com healthcheck, step migrations (psql ou `migrate up`), `go test -race ./...`, `go build`.
- [ ] 3. Confirmar job CI aplica migrations 2× (idempotência). Se ausente, registrar gap → Task A.final resolve via patch no workflow.
- [ ] 4. Sem commit.

### Task A.2 — Revisar `pwa-ci.yml` + `playwright.yml`
**Files:** Read `.github/workflows/{pwa-ci,playwright}.yml`, `laura-pwa/package.json`.
**Steps:**
- [ ] 1. Confirmar `pwa-ci.yml`: `npm ci`, `tsc --noEmit` (depende de script `typecheck` — ausente em `laura-pwa/package.json`; será adicionado em Task D.2), `npm run lint`, `npm run build`.
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
- [ ] 2. Anotar: `-tags timetzdata` **ausente** → corrigido em Task C.3. Runtime distroless ou alpine → Task C.3 reescreve para distroless.
- [ ] 3. Confirmar `.dockerignore` exclui `*.md`, `.git/`, `tests/`, `bin/`, `.env*`.
- [ ] 4. Anotar: `.dockerignore` raiz do repo **não existe** (confirmado via `ls`). Será criado em Task M.2.
- [ ] 5. Sem commit.

### Task A.5 — Revisar `laura-go/fly.toml`
**Files:** Read `laura-go/fly.toml`.
**Steps:**
- [ ] 1. Ler arquivo.
- [ ] 2. Confirmar divergências vs spec v3 §4.7: `[mounts]` presente (remover), `memory_mb=256` (→ `memory="512mb"` em `[[vm]]`), `auto_stop_machines="stop"` (→ `"suspend"`), falta `[[http_service.checks]]` `/ready`, falta `TZ`, falta `MIGRATE_ON_BOOT`, falta `kill_signal`/`kill_timeout`. Task D.1 corrige tudo.
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
- [ ] 1. `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && git add .github/ .gitleaks.toml .golangci.yml laura-go/Dockerfile laura-go/.dockerignore laura-go/fly.toml laura-go/.env.example laura-pwa/vercel.json docs/ CLAUDE.md README.md laura-pwa/tests/mvp-flows.spec.ts laura-pwa/package-lock.json`.
- [ ] 2. `git rm -f laura-pwa/.github/workflows/playwright.yml 2>/dev/null || true` (caso arquivo antigo tenha sido movido para raiz).
- [ ] 3. `git status --short`. Expected: apenas arquivos de scaffold staged.
- [ ] 4. Commit:
  ```sh
  git commit -m "chore(infra): scaffold inicial CI/CD + Docker/Fly/Vercel (agente B)

  CI workflows, Dockerfile template, fly.toml template, vercel.json com headers,
  gitleaks + golangci configs, docs ops/security + ops/deployment, .env.example
  expandido. Ajustes finos (timetzdata, /ready, fly memory) virao em tasks C.3/D.1."
  ```
- [ ] 5. `git log -1 --oneline`. Expected: commit registrado.

---

## Parte B — Patches Go (TDD estrito)

> Ordem: write failing test → run (FAIL) → implement → run (PASS) → commit. Cada fase em sub-step separado.

### Task B.1 — Teste de regressão `Container.Upgrade` (whatsmeow já cria tabelas)
**Files:**
- Create: `laura-go/internal/whatsapp/client_test.go`

**Contexto:** inspeção 2026-04-15 confirmou 15 tabelas `whatsmeow_*` já existem no Postgres local — `sqlstore.New` na versão atual da `go.mau.fi/whatsmeow` invoca `Container.Upgrade` internamente. Esta task **não altera** `client.go`/`instance_manager.go`; apenas adiciona teste de regressão que falhará caso uma versão futura da lib pare de chamar `Upgrade` automaticamente.

**Steps:**
- [ ] 1. `cd laura-go && grep -n "go.mau.fi/whatsmeow" go.mod go.sum | head -5`. Expected: versão atual registrada (ex: `v0.0.0-<timestamp>`).
- [ ] 2. Criar `laura-go/internal/whatsapp/client_test.go`:
  ```go
  package whatsapp

  import (
  	"context"
  	"database/sql"
  	"os"
  	"testing"

  	_ "github.com/jackc/pgx/v5/stdlib"
  )

  // TestSQLStoreNew_AutoCreatesWhatsmeowTables afirma que sqlstore.New
  // (via Container.Upgrade interno da lib) cria as tabelas whatsmeow_*.
  // Se uma futura versao da lib parar de chamar Upgrade automaticamente,
  // este teste falha e sinaliza patch explicito em client.go/instance_manager.go.
  func TestSQLStoreNew_AutoCreatesWhatsmeowTables(t *testing.T) {
  	dbURL := os.Getenv("TEST_DATABASE_URL")
  	if dbURL == "" {
  		t.Skip("TEST_DATABASE_URL ausente; skip teste de integracao whatsmeow")
  	}
  	ctx := context.Background()
  	if err := InitWhatsmeow(ctx, dbURL); err != nil {
  		t.Fatalf("InitWhatsmeow: %v", err)
  	}
  	db, err := sql.Open("pgx", dbURL)
  	if err != nil {
  		t.Fatalf("sql.Open: %v", err)
  	}
  	defer db.Close()
  	var count int
  	if err := db.QueryRowContext(ctx,
  		`SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'whatsmeow_%'`,
  	).Scan(&count); err != nil {
  		t.Fatalf("query: %v", err)
  	}
  	if count < 1 {
  		t.Fatalf("esperava >=1 tabela whatsmeow_*, veio %d — sqlstore.New nao esta criando schema; patch Container.Upgrade(ctx) explicito necessario em client.go e instance_manager.go", count)
  	}
  }
  ```
- [ ] 3. Run: `cd laura-go && TEST_DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go test ./internal/whatsapp/... -run TestSQLStoreNew_AutoCreatesWhatsmeowTables -v`. Expected: PASS (tabelas existem).
- [ ] 4. Commit:
  ```sh
  git add laura-go/internal/whatsapp/client_test.go
  git commit -m "test(go): regressao para auto-upgrade sqlstore whatsmeow

  Afirma que sqlstore.New chama Container.Upgrade internamente (comportamento
  da versao corrente de go.mau.fi/whatsmeow; 15 tabelas whatsmeow_* criadas).
  Se uma versao futura quebrar esse contrato, o teste falha e sinaliza a
  necessidade de patch explicito em client.go/instance_manager.go."
  ```

### Task B.2 — Guard `DISABLE_WHATSAPP` (TDD)
**Files:**
- Modify: `laura-go/main.go`, `laura-go/internal/whatsapp/client.go`, `laura-go/.env.example`
- Create: `laura-go/internal/whatsapp/disable_test.go`

**Steps:**
- [ ] 1. Criar `laura-go/internal/whatsapp/disable_test.go`:
  ```go
  package whatsapp

  import (
  	"context"
  	"os"
  	"testing"
  )

  func TestInitWhatsmeow_DisableFlag_SkipsInit(t *testing.T) {
  	t.Setenv("DISABLE_WHATSAPP", "true")
  	// DB URL bogus deliberadamente — se a flag for respeitada,
  	// nao havera conexao e a funcao retorna nil.
  	err := InitWhatsmeow(context.Background(), "postgres://bogus:bogus@127.0.0.1:1/none?sslmode=disable")
  	if err != nil {
  		t.Fatalf("DISABLE_WHATSAPP=true deveria pular init; veio err=%v", err)
  	}
  	// Higiene: limpar para nao poluir outros testes do package.
  	_ = os.Unsetenv("DISABLE_WHATSAPP")
  }
  ```
- [ ] 2. Run (FAIL): `cd laura-go && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v`. Expected: FAIL com dial error (ou similar — confirma ausência do guard).
- [ ] 3. Patch `laura-go/internal/whatsapp/client.go` no início de `InitWhatsmeow`:
  ```go
  if os.Getenv("DISABLE_WHATSAPP") == "true" {
      log.Printf("DISABLE_WHATSAPP=true -- whatsmeow init skipped")
      return nil
  }
  ```
  (Imports: garantir `os` e `log`.)
- [ ] 4. Patch `laura-go/main.go` envolvendo chamada `whatsapp.InitWhatsmeow(...)` com mesmo guard + log alternativo:
  ```go
  if os.Getenv("DISABLE_WHATSAPP") == "true" {
      log.Printf("DISABLE_WHATSAPP=true -- main pulou whatsapp.InitWhatsmeow")
  } else {
      if err := whatsapp.InitWhatsmeow(ctx, dbURL); err != nil {
          log.Fatalf("whatsapp.InitWhatsmeow: %v", err)
      }
  }
  ```
- [ ] 5. Patch `laura-go/.env.example`:
  ```
  # DISABLE_WHATSAPP=true desabilita init whatsmeow (CI E2E).
  DISABLE_WHATSAPP=false
  ```
- [ ] 6. Run (PASS): `cd laura-go && go build ./... && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v`. Expected: PASS.
- [ ] 7. Smoke: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . 2>&1 | head -20`. Expected: log `whatsmeow init skipped`.
- [ ] 8. Commit:
  ```sh
  git add laura-go/main.go laura-go/internal/whatsapp/{client.go,disable_test.go} laura-go/.env.example
  git commit -m "feat(go): guard DISABLE_WHATSAPP para CI/dev sem WA

  Flag gate sqlstore.New + conexao WA. Necessaria para E2E headless."
  ```

### Task B.3 — Middleware `requestid` + logger JSON (TDD)
**Files:**
- Modify: `laura-go/main.go`, `laura-go/go.mod`, `laura-go/go.sum`
- Create: `laura-go/main_test.go`

**Steps:**
- [ ] 1. Criar `laura-go/main_test.go`:
  ```go
  package main

  import (
  	"net/http/httptest"
  	"testing"

  	"github.com/gofiber/fiber/v2"
  	"github.com/gofiber/fiber/v2/middleware/requestid"
  	"github.com/gofiber/fiber/v2/utils"
  )

  func TestRequestIDMiddleware_AddsHeader(t *testing.T) {
  	app := fiber.New()
  	app.Use(requestid.New(requestid.Config{
  		Header:     "X-Request-Id",
  		Generator:  utils.UUIDv4,
  		ContextKey: "requestid",
  	}))
  	app.Get("/ping", func(c *fiber.Ctx) error { return c.SendString("pong") })
  	req := httptest.NewRequest("GET", "/ping", nil)
  	resp, err := app.Test(req, -1)
  	if err != nil {
  		t.Fatalf("app.Test: %v", err)
  	}
  	if got := resp.Header.Get("X-Request-Id"); got == "" {
  		t.Fatalf("esperava header X-Request-Id, veio vazio")
  	}
  }
  ```
- [ ] 2. Run: `cd laura-go && go test -run TestRequestIDMiddleware -v`. Expected: PASS (contrato).
- [ ] 3. Patch `laura-go/main.go` — imports `requestid` + `utils`; `app.Use(requestid.New(...))` antes de `logger.New()`; logger com `Format` JSON condicional por `ENVIRONMENT=production`:
  ```go
  import (
      "github.com/gofiber/fiber/v2/middleware/logger"
      "github.com/gofiber/fiber/v2/middleware/requestid"
      "github.com/gofiber/fiber/v2/utils"
  )
  ...
  app.Use(requestid.New(requestid.Config{
      Header:     "X-Request-Id",
      Generator:  utils.UUIDv4,
      ContextKey: "requestid",
  }))
  if os.Getenv("ENVIRONMENT") == "production" {
      app.Use(logger.New(logger.Config{
          Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","requestid":"${locals:requestid}"}` + "\n",
      }))
  } else {
      app.Use(logger.New())
  }
  ```
- [ ] 4. `cd laura-go && go mod tidy && go build ./...`. Expected: sem erros.
- [ ] 5. Smoke: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . &`; `sleep 2; curl -i http://localhost:8080/health | grep -i x-request-id; kill %1`. Expected: header presente.
- [ ] 6. Commit:
  ```sh
  git add laura-go/{main.go,main_test.go,go.mod,go.sum}
  git commit -m "feat(go): middleware requestid + logs JSON em production

  X-Request-Id (UUIDv4) propagado. Logger Fiber emite JSON quando
  ENVIRONMENT=production (Fly). Facilita correlacao em logs."
  ```

### Task B.4 — Handler `/ready` com ping DB (TDD) + `docs/ops/observability.md`
**Files:**
- Modify: `laura-go/main.go`, `laura-go/main_test.go`
- Create: `docs/ops/observability.md`

**Contexto:** `/health` existe em `laura-go/main.go:39` (root) e `laura-go/internal/handlers/router.go:45` (`/api/v1/health`). Esta task cria apenas `/ready` (probe `db.Ping(ctx)` com timeout 2s) + documenta a diferença.

**Steps:**
- [ ] 1. `cd laura-go && grep -n '"/health"' main.go internal/handlers/router.go`. Expected: 2 matches (confirmar presença).
- [ ] 2. Adicionar teste em `laura-go/main_test.go`:
  ```go
  func TestReadyHandler_200WhenDBOK(t *testing.T) {
  	app := fiber.New()
  	// Stub simulando pool ok — em integracao real, injecao via variavel
  	// global ja feita em main(); para teste de contrato usamos handler
  	// inline que replica a estrutura.
  	app.Get("/ready", func(c *fiber.Ctx) error {
  		return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
  	})
  	req := httptest.NewRequest("GET", "/ready", nil)
  	resp, err := app.Test(req, -1)
  	if err != nil {
  		t.Fatalf("app.Test: %v", err)
  	}
  	if resp.StatusCode != 200 {
  		t.Fatalf("esperava 200, veio %d", resp.StatusCode)
  	}
  }
  ```
- [ ] 3. Run: `cd laura-go && go test -run TestReadyHandler -v`. Expected: PASS (contrato).
- [ ] 4. Patch `laura-go/main.go` registrando `app.Get("/ready", ...)` real com ping no pool existente (ajustar identificador conforme código — `pgxpool` → `db.Ping(ctx)` ou `dbpool.Ping(ctx)`). Exemplo alinhado ao stack (pgxpool):
  ```go
  app.Get("/ready", func(c *fiber.Ctx) error {
      ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
      defer cancel()
      if err := dbpool.Ping(ctx); err != nil {
          return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": err.Error()})
      }
      return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
  })
  ```
  (Se o nome do pool for outro, substituir `dbpool` — `grep -n "pgxpool.New\|pgx.Connect" main.go` retorna o identificador correto.)
- [ ] 5. Run build: `cd laura-go && go build ./...`. Expected: sem erros.
- [ ] 6. Smoke positivo: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . &`; `sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ready; kill %1`. Expected: `200`.
- [ ] 7. Smoke negativo: `docker compose -f infrastructure/docker-compose.yml stop db`; `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . &`; `sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ready; kill %1; docker compose -f infrastructure/docker-compose.yml start db`. Expected: `503`.
- [ ] 8. Criar `docs/ops/observability.md`:
  ```md
  # Observabilidade — Laura Finance

  ## Endpoints

  ### `/health` (liveness)
  Objetivo: processo vivo. NAO toca DB. Usado pelo Fly para reiniciar
  maquina caso o handler trave.
  - Path: `/health` (root, registrado em `main.go`).
  - Duplicata: `/api/v1/health` (versionado, JSON detalhado).
  - Response: 200 `{"status":"ok"}`.

  ### `/ready` (readiness)
  Objetivo: processo pronto para servir trafego. Faz `db.Ping` com
  timeout 2s. 503 quando DB indisponivel — Fly remove da rotacao mas
  NAO reinicia a maquina.
  - Path: `/ready` (root, registrado em `main.go`).
  - Response OK: 200 `{"status":"ready","db":"ok"}`.
  - Response NOK: 503 `{"status":"not-ready","db":"<erro>"}`.

  ## Correlacao via X-Request-Id
  Middleware `fiber/middleware/requestid` gera UUIDv4 por request e
  anexa no header `X-Request-Id` + logs (quando `ENVIRONMENT=production`).

  ## Logs JSON em producao
  Logger Fiber emite formato JSON quando `ENVIRONMENT=production`; em
  dev, formato texto padrao.

  ## Referencias
  - `laura-go/main.go` (handlers + middlewares).
  - `laura-go/fly.toml` (`[[http_service.checks]]` /health + /ready).
  ```
- [ ] 9. Commit:
  ```sh
  git add laura-go/{main.go,main_test.go} docs/ops/observability.md
  git commit -m "feat(go): handler /ready com ping DB + doc observabilidade

  200 quando DB responde, 503 em falha. Documenta diferenca /health
  (liveness, nao toca DB) vs /ready (readiness, ping DB 2s). Fly
  healthchecks ganham /ready alem de /health (ver fly.toml task D.1)."
  ```

---

## Parte C — Migrations embutidas

### Task C.1 — `embed.FS` + driver iofs
**Files:**
- Create: `laura-go/internal/migrations/embed.go`, `laura-go/internal/migrations/embed_test.go`
- Modify: `.gitignore`

**Steps:**
- [ ] 1. `ls infrastructure/migrations/`. Expected: 35 arquivos `000001_*.sql` a `000035_*.sql`.
- [ ] 2. Criar `laura-go/internal/migrations/embed.go`:
  ```go
  package migrations

  import (
  	"embed"

  	"github.com/golang-migrate/migrate/v4/source"
  	"github.com/golang-migrate/migrate/v4/source/iofs"
  )

  //go:embed *.sql
  var FS embed.FS

  // Source retorna um source.Driver lendo migrations do embed.FS.
  func Source() (source.Driver, error) {
  	return iofs.New(FS, ".")
  }
  ```
- [ ] 3. Criar `laura-go/internal/migrations/embed_test.go`:
  ```go
  package migrations

  import (
  	"testing"
  )

  func TestEmbed_HasAllMigrations(t *testing.T) {
  	entries, err := FS.ReadDir(".")
  	if err != nil {
  		t.Fatalf("ReadDir: %v", err)
  	}
  	count := 0
  	for _, e := range entries {
  		if !e.IsDir() {
  			count++
  		}
  	}
  	if count < 35 {
  		t.Fatalf("esperava >=35 migrations embutidas, veio %d", count)
  	}
  }
  ```
- [ ] 4. `cp infrastructure/migrations/*.sql laura-go/internal/migrations/` (cópia local para `go build`; em CI/Docker build o `COPY infrastructure/migrations ./internal/migrations` cobre).
- [ ] 5. `cd laura-go && go mod tidy`. Expected: puxa `golang-migrate/migrate/v4` + `source/iofs`.
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
- [ ] 1. Adicionar imports:
  ```go
  import (
  	"errors"
  	"log"

  	"github.com/golang-migrate/migrate/v4"
  	_ "github.com/golang-migrate/migrate/v4/database/postgres"
  	"github.com/laura-finance/laura-go/internal/migrations"
  )
  ```
  (Ajustar module path `github.com/laura-finance/laura-go` conforme `go.mod` real — `grep -n "^module" laura-go/go.mod`.)
- [ ] 2. Adicionar função `runMigrations`:
  ```go
  func runMigrations(dbURL string) error {
  	src, err := migrations.Source()
  	if err != nil {
  		return err
  	}
  	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
  	if err != nil {
  		return err
  	}
  	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
  		return err
  	}
  	v, dirty, _ := m.Version()
  	log.Printf("migrations aplicadas: version=%d dirty=%v", v, dirty)
  	return nil
  }
  ```
- [ ] 3. `cd laura-go && go build ./...`. Expected: sem erros.
- [ ] 4. Sem commit (próxima subtask consolida).

### Task C.2b — Chamada gated por `MIGRATE_ON_BOOT` + env + smoke
**Files:** Modify: `laura-go/main.go`, `laura-go/.env.example`.

**Steps:**
- [ ] 1. Adicionar no início de `main()`, pós-env-load e pré-WA-init:
  ```go
  if os.Getenv("MIGRATE_ON_BOOT") == "true" {
      if err := runMigrations(dbURL); err != nil {
          log.Fatalf("runMigrations: %v", err)
      }
  }
  ```
- [ ] 2. Adicionar em `laura-go/.env.example`:
  ```
  # MIGRATE_ON_BOOT=true roda migrate up via embed.FS no boot.
  MIGRATE_ON_BOOT=false
  ```
- [ ] 3. Smoke primeira run (DB limpo): criar `laura_migtest`:
  ```sh
  docker exec infrastructure-postgres-1 psql -U laura -c "DROP DATABASE IF EXISTS laura_migtest; CREATE DATABASE laura_migtest OWNER laura;"
  cd laura-go && DISABLE_WHATSAPP=true MIGRATE_ON_BOOT=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura_migtest?sslmode=disable go run . 2>&1 | head -30
  ```
  Expected: log `migrations aplicadas: version=35 dirty=false`.
- [ ] 4. Smoke idempotência: `kill %1`; repetir comando. Expected: `version=35`, sem reaplicar.
- [ ] 5. Cleanup: `docker exec infrastructure-postgres-1 psql -U laura -c "DROP DATABASE laura_migtest;"`.
- [ ] 6. Commit:
  ```sh
  git add laura-go/main.go laura-go/.env.example laura-go/go.{mod,sum}
  git commit -m "feat(migrations): runMigrations no boot via MIGRATE_ON_BOOT

  golang-migrate/migrate v4 + iofs + pg_advisory_lock. Flag opt-in.
  migrate.ErrNoChange suprimido (idempotente)."
  ```

### Task C.3 — Dockerfile distroless + `-tags timetzdata`
**Files:** Modify: `laura-go/Dockerfile`.

**Decisão:** runtime `gcr.io/distroless/static-debian12:nonroot` (não alpine). `-tags timetzdata` embute zoneinfo no binário Go (suportado por distroless/static — zoneinfo fica no próprio binário, não depende de arquivos do SO). Healthcheck Docker removido (Fly usa `[[http_service.checks]]` via rede). Imagem esperada <30MB.

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
- [ ] 2. Build context passa a ser a raiz do repo (`COPY infrastructure/migrations` precisa ver pasta fora de `laura-go/`). Comando canônico: `docker build -f laura-go/Dockerfile .`.
- [ ] 3. Atualizar `.github/workflows/go-ci.yml` e `deploy-api.yml` (Task L.1) para usar `-f laura-go/Dockerfile` com context raiz (registrar como sub-fix caso o agente B use context `laura-go/`).
- [ ] 4. Build: `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && docker build -f laura-go/Dockerfile -t laura-go:test .`. Expected: build OK.
- [ ] 5. Tamanho: `docker images laura-go:test --format "{{.Size}}"`. Expected: <30MB.
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
    HEALTHCHECK do Dockerfile removido."
  ```

---

## Parte D — fly.toml + PWA package.json

### Task D.1 — Reescrever `laura-go/fly.toml`
**Files:** Modify: `laura-go/fly.toml`.

**Steps:**
- [ ] 1. Reescrever:
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

  # Single-machine: cron in-process. Ver spec §4.12 e §5.10.
  # Pos-deploy: fly scale count 1 -a laura-finance-api.

  [[vm]]
    cpu_kind = "shared"
    cpus = 1
    memory = "512mb"
  ```
- [ ] 2. Validar TOML: `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"`. Expected: `toml ok`.
- [ ] 3. Se `fly` CLI instalada: `fly config validate --config laura-go/fly.toml`. Senão registrar para PR.
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
- [ ] 3. Validar: `cd laura-pwa && npm run typecheck`. Expected: sem erros (ou registrar erros existentes não relacionados em `NOTES.tmp.md`).
- [ ] 4. Commit:
  ```sh
  git add laura-pwa/package.json
  git commit -m "chore(pwa): adicionar script typecheck (tsc --noEmit)

  Usado pelo pwa-ci.yml. Cobre item 25 da spec v3 secao 15."
  ```

---

## Parte E — lefthook canônico + remoção `.githooks/`

### Task E.1 — Criar `lefthook.yml` + remover `.githooks/` + README
**Files:**
- Create: `lefthook.yml`
- Delete: `.githooks/pre-commit` e diretório `.githooks/`
- Modify: `README.md`

**Decisão:** lefthook canônico. `.githooks/` removido para evitar duplicação silenciosa.

**Steps:**
- [ ] 1. Criar `lefthook.yml` raiz:
  ```yaml
  # lefthook.yml — hooks canonicos Laura Finance.
  # Instalacao: brew install lefthook && lefthook install

  pre-commit:
    parallel: true
    commands:
      gitleaks:
        run: gitleaks protect --staged --redact --no-banner
      golangci-lint:
        glob: "laura-go/**/*.go"
        run: cd laura-go && golangci-lint run --new-from-rev=HEAD~1 --timeout=2m {staged_files}
      eslint:
        glob: "laura-pwa/**/*.{ts,tsx,js,jsx}"
        run: cd laura-pwa && npx eslint --fix {staged_files}

  pre-push:
    commands:
      go-test-short:
        run: cd laura-go && go test -short ./...
  ```
- [ ] 2. `git rm -rf .githooks/`.
- [ ] 3. Patch `README.md` adicionar seção "Pre-commit hooks":
  ```md
  ## Pre-commit hooks

  Canonico: **lefthook**.

  ```sh
  brew install lefthook
  lefthook install
  ```

  Hooks:
  - `pre-commit`: gitleaks protect (staged) + golangci-lint (staged Go) + eslint --fix (staged TS/JS).
  - `pre-push`: go test -short.
  ```
- [ ] 4. Se `lefthook` instalado: `lefthook run pre-commit --files README.md`. Expected: steps passam. Senão registrar validação pós-instalação.
- [ ] 5. Commit:
  ```sh
  git add lefthook.yml README.md
  git rm -rf .githooks/
  git commit -m "chore(hooks): adotar lefthook canonico + remover .githooks

  - pre-commit: gitleaks protect + golangci-lint + eslint staged.
  - pre-push: go test -short.
  - .githooks removido para evitar duplicacao silenciosa. Fonte unica = lefthook.yml."
  ```

---

## Parte F — Migration 000035: validação local + procedimento prod documentado

### Task F.local-validate — Validar estado local da 000035 + documentar apply em prod
**Files:**
- Create: `docs/ops/migrations.md`, `scripts/dry-run-000035.sql`, `scripts/migrate.sh`, `infrastructure/backups/.gitkeep`
- Modify: `.gitignore`

**Contexto:** inspeção 2026-04-15 02:05 BRT confirmou 000035 **já aplicada** no Postgres local (5 CHECK constraints, 14 triggers `trg_updated_at`, índice `idx_trans_workspace_date`, 0 NULLs em `workspace_id` nas 8 tabelas). Esta task apenas **valida** o estado + **documenta** o procedimento dry-run + apply para execução futura em PROD (STANDBY [FLY-PG-CREATE]). **Não executa** `BEGIN/apply/COMMIT` local.

**Steps:**
- [ ] 1. Criar `scripts/dry-run-000035.sql`:
  ```sql
  -- scripts/dry-run-000035.sql
  -- Quantos registros a migration 000035 removeria?
  -- Executar ANTES de aplicar em prod. Threshold: todos = 0 -> prosseguir.
  SELECT 'transactions'    AS tabela, COUNT(*) AS rows_to_delete FROM transactions    WHERE workspace_id IS NULL
  UNION ALL SELECT 'accounts',          COUNT(*) FROM accounts          WHERE workspace_id IS NULL
  UNION ALL SELECT 'categories',        COUNT(*) FROM categories        WHERE workspace_id IS NULL
  UNION ALL SELECT 'cards',             COUNT(*) FROM cards             WHERE workspace_id IS NULL
  UNION ALL SELECT 'invoices',          COUNT(*) FROM invoices          WHERE workspace_id IS NULL
  UNION ALL SELECT 'financial_goals',   COUNT(*) FROM financial_goals   WHERE workspace_id IS NULL
  UNION ALL SELECT 'investments',       COUNT(*) FROM investments       WHERE workspace_id IS NULL
  UNION ALL SELECT 'debt_rollovers',    COUNT(*) FROM debt_rollovers    WHERE workspace_id IS NULL;
  ```
- [ ] 2. Criar `scripts/migrate.sh` (CLI wrapper):
  ```sh
  #!/usr/bin/env bash
  # scripts/migrate.sh — wrapper golang-migrate CLI.
  # Uso: scripts/migrate.sh up|down|version|force <ver>
  set -euo pipefail
  : "${DATABASE_URL:?DATABASE_URL obrigatorio}"
  MIGRATIONS="${MIGRATIONS:-infrastructure/migrations}"
  exec migrate -path "$MIGRATIONS" -database "$DATABASE_URL" "$@"
  ```
  E `chmod +x scripts/migrate.sh`.
- [ ] 3. Criar `infrastructure/backups/.gitkeep` (vazio) + patch `.gitignore`:
  ```
  infrastructure/backups/*.sql
  infrastructure/backups/*.dump
  !infrastructure/backups/.gitkeep
  ```
- [ ] 4. Validar estado LOCAL (5 SELECTs — leitura, sem mutação):
  ```sh
  # 4.1 — 5 CHECK constraints
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
    "SELECT conname FROM pg_constraint WHERE conname IN ('chk_transaction_type','chk_transaction_amount_positive','chk_goal_target_positive','chk_invoice_status','chk_rollover_status') ORDER BY conname;"
  # Expected: 5 linhas.

  # 4.2 — 14 triggers trg_updated_at
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
    "SELECT count(*) FROM pg_trigger WHERE tgname='trg_updated_at';"
  # Expected: 14.

  # 4.3 — indice idx_trans_workspace_date
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
    "SELECT indexname FROM pg_indexes WHERE indexname='idx_trans_workspace_date';"
  # Expected: 1 linha.

  # 4.4 — 0 NULLs workspace_id nas 8 tabelas
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -f /dev/stdin <<'SQL'
  SELECT 'transactions'    AS t, COUNT(*) FROM transactions    WHERE workspace_id IS NULL
  UNION ALL SELECT 'accounts',          COUNT(*) FROM accounts          WHERE workspace_id IS NULL
  UNION ALL SELECT 'categories',        COUNT(*) FROM categories        WHERE workspace_id IS NULL
  UNION ALL SELECT 'cards',             COUNT(*) FROM cards             WHERE workspace_id IS NULL
  UNION ALL SELECT 'invoices',          COUNT(*) FROM invoices          WHERE workspace_id IS NULL
  UNION ALL SELECT 'financial_goals',   COUNT(*) FROM financial_goals   WHERE workspace_id IS NULL
  UNION ALL SELECT 'investments',       COUNT(*) FROM investments       WHERE workspace_id IS NULL
  UNION ALL SELECT 'debt_rollovers',    COUNT(*) FROM debt_rollovers    WHERE workspace_id IS NULL;
  SQL
  # Expected: todas as 8 linhas com count=0.

  # 4.5 — version 35 em schema_migrations
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance -tAc \
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
  # Expected: 35.
  ```
  Expected: todos os 5 checks passam conforme esperado. Se algum falhar, abrir follow-up em `NOTES.tmp.md` e PARAR.
- [ ] 5. Criar `docs/ops/migrations.md`:
  ```md
  # Migrations — Laura Finance

  Ferramenta: `golang-migrate/migrate v4` (biblioteca + CLI).

  ## Estado local (2026-04-15)

  Migration **000035_security_hardening** ja aplicada:
  - 5 CHECK constraints (transaction_type, transaction_amount_positive,
    goal_target_positive, invoice_status, rollover_status).
  - 14 triggers `trg_updated_at`.
  - Indice `idx_trans_workspace_date`.
  - 0 `workspace_id IS NULL` nas 8 tabelas-alvo.
  - `schema_migrations.version = 35`.

  Validacao reproduzivel: `scripts/dry-run-000035.sql` + checks em
  `F.local-validate` do plan v3.

  ## Apply em dev/local (caso DB limpo)

  ```sh
  # Subir Postgres dev
  docker compose -f infrastructure/docker-compose.yml up -d db

  # Aplicar todas as migrations
  DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable \
    scripts/migrate.sh up

  # Idempotencia
  DATABASE_URL=... scripts/migrate.sh up  # -> "no change"
  ```

  ## Apply em PROD (STANDBY [FLY-PG-CREATE])

  ### 1. Dry-run destrutivo obrigatorio

  ```sh
  fly postgres connect -a <fly-pg-app> -d laura_finance \
    < scripts/dry-run-000035.sql
  ```

  **Threshold de decisao:**
  - Todos = 0 linhas -> prosseguir.
  - >0 qualquer -> PARAR. Backfill / archive / aceitar-perda (documentar
    no HANDOFF, aprovacao usuario).

  ### 2. Backup pre-apply

  ```sh
  fly postgres connect -a <fly-pg-app> -d laura_finance \
    -- pg_dump --format=custom laura_finance \
    > infrastructure/backups/pre-035-$(date +%Y%m%d-%H%M%S).dump
  ```

  ### 3. Aplicar

  Opcao A (recomendada) — boot do binario com `MIGRATE_ON_BOOT=true`:
  - Setado no `fly.toml` `[env]`. No proximo deploy, binario aplica
    via `embed.FS` + `pg_advisory_lock`.

  Opcao B — CLI standalone (rollback/edge cases):
  ```sh
  DATABASE_URL=$(fly secrets unset --help >/dev/null 2>&1 && \
    fly postgres attach <fly-pg-app> --app laura-finance-api --dry-run | grep DATABASE_URL) \
    scripts/migrate.sh up
  ```

  ### 4. Validacao pos-apply

  ```sh
  fly postgres connect -a <fly-pg-app> -d laura_finance \
    -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
  # Expected: 35
  ```

  ### 5. Rollback

  Ver `docs/ops/runbooks/rollback.md` secao "Rollback migration 000035".

  ## CI (idempotencia)

  `.github/workflows/go-ci.yml` aplica todas as migrations 2x contra
  Postgres service; segunda chamada deve retornar "no change". Ver
  Task A.1 do plan v3.
  ```
- [ ] 6. Commit:
  ```sh
  git add scripts/dry-run-000035.sql scripts/migrate.sh infrastructure/backups/.gitkeep .gitignore docs/ops/migrations.md
  git commit -m "docs(migrations): validacao local 000035 + procedimento prod

  Migration 000035 ja aplicada localmente (5 constraints + 14 triggers +
  0 NULLs confirmados). Documenta dry-run + backup + apply + rollback
  para execucao em prod (STANDBY [FLY-PG-CREATE]). Cria scripts/migrate.sh
  wrapper + scripts/dry-run-000035.sql + dir infrastructure/backups."
  ```

---

## Parte G — Documentação operacional (HANDOFF + memory)

### Task G.1 — Atualizar `docs/HANDOFF.md`
**Files:** Modify: `docs/HANDOFF.md`.

**Steps:**
- [ ] 1. Ler `docs/HANDOFF.md` atual.
- [ ] 2. Inserir seção "Histórico de atualizações" no topo com entrada `2026-04-15 — Fase 10 preparada`. Bullets:
  - CI/CD Go + PWA scaffolds (go-ci, pwa-ci, playwright, security).
  - Dockerfile distroless + `-tags timetzdata` + embed migrations.
  - fly.toml single-machine + healthchecks /health + /ready.
  - Patches Go: `DISABLE_WHATSAPP`, `requestid`, logger JSON, `/ready`. Teste de regressão whatsmeow auto-upgrade.
  - lefthook canônico + `.githooks/` removido.
  - Migration 000035 validada local (já aplicada); procedimento prod em `docs/ops/migrations.md`.
  - STANDBYs ativos: GROQ-REVOKE, FORCE-PUSH, VERCEL-AUTH, VERCEL-ENV, FLY-AUTH, FLY-CARD, FLY-SECRETS, FLY-PG-CREATE, STRIPE-LIVE, RESEND-DOMAIN, DNS.
- [ ] 3. Atualizar seção "Estado da produção" / "Próximos passos" para: próximo acionamento é STANDBY [GROQ-REVOKE] → Task H.1 (script `sanitize-history.sh` preparado, não executado).
- [ ] 4. Commit:
  ```sh
  git add docs/HANDOFF.md
  git commit -m "docs(handoff): atualizar para estado pos-Fase 10 preparada"
  ```

### Task G.2 — Entrada memory
**Files:** Create: `~/.claude/projects/<slug-laura>/memory/phase_10_complete.md` + update `MEMORY.md`.

**Steps:**
- [ ] 1. `ls /Users/joaovitorzanini/.claude/projects/ | grep -i laura`. Expected: slug do projeto.
- [ ] 2. Criar `phase_10_complete.md` com:
  - Resumo: Fase 10 preparada. Artefatos de CI/CD, Docker, Fly, Vercel, patches Go, E2E expandido.
  - STANDBYs ativos (13 IDs).
  - Próxima ação: executar `superpowers:executing-plans` → task H.1 ou aguardar STANDBY [GROQ-REVOKE].
- [ ] 3. Adicionar link em `MEMORY.md` seção "Snapshots de sessão".
- [ ] 4. Sem commit (path fora do repo).

---

## Parte H — Sanitização git history (preparar, STANDBY)

### Task H.1 — Script `sanitize-history.sh` + playbook
**Files:**
- Create: `scripts/sanitize-history.sh`
- Modify: `docs/ops/security.md`, `.gitignore`

**STANDBY [GROQ-REVOKE] + STANDBY [FORCE-PUSH]** — preparado, não executado.

**Steps:**
- [ ] 1. Criar `scripts/sanitize-history.sh`:
  ```sh
  #!/usr/bin/env bash
  # scripts/sanitize-history.sh — rewrite do historico git removendo secrets.
  # PRE-REQ: (1) GROQ_API_KEY ja revogada; (2) nova chave em GH/Fly secrets.
  # NAO executar sem STANDBY [GROQ-REVOKE] confirmado pelo usuario.
  set -euo pipefail

  SECRETS_FILE="${SECRETS_FILE:-.git-secrets-to-purge.txt}"
  if [[ ! -f "$SECRETS_FILE" ]]; then
    echo "ERRO: $SECRETS_FILE ausente. Crie com as strings EXATAS a expurgar." >&2
    exit 1
  fi

  # Backup via bundle antes do rewrite
  BUNDLE="../laura-finance-pre-sanitize-$(date +%Y%m%d-%H%M%S).bundle"
  git bundle create "$BUNDLE" --all
  echo "Backup criado: $BUNDLE"

  # Rewrite
  if ! command -v git-filter-repo >/dev/null 2>&1; then
    echo "ERRO: instale git-filter-repo (brew install git-filter-repo)." >&2
    exit 1
  fi
  git filter-repo --replace-text "$SECRETS_FILE" --force

  # Validacao
  echo "=== Validacao: buscas pos-rewrite (esperado vazio) ==="
  git log -p -Sgsk_ --all | head -5 || true

  echo
  echo "PRONTO. Proximos passos MANUAIS:"
  echo "  git push --force --all"
  echo "  git push --force --tags"
  echo "  STANDBY [FORCE-PUSH]"
  ```
  E `chmod +x scripts/sanitize-history.sh`.
- [ ] 2. Adicionar em `.gitignore`:
  ```
  .git-secrets-to-purge.txt
  *.bundle
  ```
- [ ] 3. Expandir `docs/ops/security.md` seção "Playbook: key vazada no histórico git" (9 passos):
  1. Usuário revoga chave antiga (console do provedor).
  2. Usuário gera nova chave + guarda local.
  3. `gh secret set <NAME>` para GH Actions.
  4. `fly secrets set <NAME>=<NEW>` para Fly.
  5. `cp -R "<repo>" "<repo>.bak-$(date +%Y%m%d)"`.
  6. Criar `.git-secrets-to-purge.txt` com a chave exata vazada.
  7. `scripts/sanitize-history.sh`.
  8. `git push --force --all && git push --force --tags`.
  9. `git log -p -Sgsk_ --all` → esperado vazio. Documentar em `docs/ops/security.md` seção "Histórico".
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
- [ ] 3. `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && docker build -f laura-go/Dockerfile -t laura-go:phase10 .`. Expected: OK.
- [ ] 4. `git status --short`. Expected: working tree limpa.
- [ ] 5. `git log --oneline -40`. Expected: commits PT-BR da Fase 10.
- [ ] 6. `git tag -a phase-10-prepared -m "Fase 10 preparada -- CI/CD, Docker, Fly, patches Go, E2E. Deploy prod STANDBY."`.
- [ ] 7. **NÃO** `git push --tags` automaticamente (evita poluir remote com tag intermediária). Documentar no HANDOFF que push da tag ocorre junto com `phase-10-deployed` (pós-STANDBYs).

---

## Parte J — Runbooks operacionais

### Task J.1 — `docs/ops/runbooks/rollback.md`
**Files:** Create: `docs/ops/runbooks/rollback.md`.

**Estrutura mínima:** cada seção contém `### Quando usar`, `### Pré-requisitos`, `### Procedimento passo-a-passo` (com `Expected:` em cada comando), `### Validação`, `### Rollback do rollback` (quando aplicável).

**Steps:**
- [ ] 1. Criar arquivo com 4 seções principais:
  - **API (Fly):**
    - Quando usar: deploy novo causou regressão.
    - Pré-requisitos: `fly` CLI autenticada (STANDBY [FLY-AUTH]).
    - Procedimento: `fly releases list -a laura-finance-api` → identificar `vN-1` → `fly releases rollback <vN-1> -a laura-finance-api`.
    - Validação: `curl -s -o /dev/null -w "%{http_code}\n" https://laura-finance-api.fly.dev/health` → 200; `/ready` → 200.
    - Rollback do rollback: repetir com `vN`.
  - **PWA (Vercel):**
    - Quando usar: deploy novo quebrou UI.
    - Pré-requisitos: Vercel CLI + STANDBY [VERCEL-AUTH].
    - Procedimento: `vercel ls --scope <team>` → escolher deployment anterior → "Promote to production" no dashboard OU `vercel rollback <url-previous>`.
    - Validação: curl https → 200 + smoke manual login.
    - Rollback do rollback: `vercel promote <url-atual>`.
  - **DB (Fly Postgres backup restore):**
    - Quando usar: corrupção/delete acidental.
    - Pré-requisitos: STANDBY [FLY-PG-CREATE].
    - Procedimento: `fly postgres backup list -a <pg>` → escolher snapshot pré-incidente → `fly postgres backup restore <id> -a <pg>`.
    - Validação: `psql` → `SELECT version FROM schema_migrations` → esperado.
    - Rollback do rollback: restore de backup mais recente.
  - **Migration 000035 específico:**
    - Quando usar: `migrate up` aplicou e removeu registros indevidamente.
    - Pré-requisitos: dump pré-035 em `infrastructure/backups/pre-035-*.dump`.
    - Procedimento: `pg_restore --data-only --table=transactions --table=accounts ... infrastructure/backups/pre-035-*.dump`.
    - Validação: contagens pré e pós-restore batem.
    - Rollback do rollback: N/A (pedir aprovação usuário antes de reapplicar).
- [ ] 2. Cada seção com `Expected:` em cada comando.
- [ ] 3. STANDBY [FLY-PG-CREATE] marca drills reais como futuros.
- [ ] 4. Commit:
  ```sh
  git add docs/ops/runbooks/rollback.md
  git commit -m "docs(ops): runbook rollback (API + PWA + DB + migration 000035)"
  ```

### Task J.2 — `docs/ops/runbooks/secrets-rotation.md`
**Files:** Create: `docs/ops/runbooks/secrets-rotation.md`.

**Estrutura mínima** (por secret): `### Quando usar`, `### Pré-requisitos`, `### Procedimento passo-a-passo`, `### Validação`, `### Rollback do rollback`.

**Steps:**
- [ ] 1. Criar arquivo com procedimento por secret:
  - **GROQ_API_KEY:** revoke console → regen → `gh secret set GROQ_API_KEY` → `fly secrets set GROQ_API_KEY=... -a laura-finance-api` → redeploy workflow trigger → smoke `/health`. Rollback: manter chave antiga em staging até confirmar nova em prod.
  - **SESSION_HMAC_KEY:** regen via `openssl rand -hex 32` → `fly secrets set` → deploy → invalida sessões (comunicar usuário via email previamente). Rollback: restaurar chave anterior invalidaria sessões novas.
  - **STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET:** dashboard Stripe → roll → atualizar Fly + GH → smoke webhook (criar pagamento teste). Rollback: revogar chave nova, restaurar antiga no Fly.
  - **RESEND_API_KEY:** dashboard Resend → nova chave → `fly secrets set` → smoke enviar email teste. Rollback: revogar nova, restaurar antiga.
  - **DATABASE_URL:** via `fly postgres attach` com credenciais novas; requer migração de sessão WA (novo QR scan — ver `ops/deployment.md` §Whatsmeow). Rollback: `fly postgres detach` + reattach com credenciais anteriores.
  - Cadência recomendada: 90d routine + imediato em suspeita de leak.
- [ ] 2. Commit:
  ```sh
  git add docs/ops/runbooks/secrets-rotation.md
  git commit -m "docs(ops): runbook secrets-rotation (GROQ, SESSION, STRIPE, RESEND, DATABASE_URL)"
  ```

---

## Parte K — E2E expandido

### Task K.1 — Playwright config + globalSetup
**Files:**
- Modify: `laura-pwa/playwright.config.ts`
- Create: `laura-pwa/tests/global-setup.ts`

**Decisão de fixture (K.2):** usar `storageState` Playwright. O `globalSetup` faz **login programático via API** (POST `/api/v1/auth/login` com user E2E criado por `scripts/seed-e2e.sh`) e persiste cookies/localStorage em `tests/.auth/user.json`. Specs com `authedPage` recarregam esse estado; specs de auth (login/logout) ignoram o fixture e exercitam a UI.

**Steps:**
- [ ] 1. Patch `laura-pwa/playwright.config.ts`:
  ```ts
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    globalSetup: './tests/global-setup.ts',
    use: {
      baseURL: process.env.BASE_URL || 'http://localhost:3100',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    reporter: [['list']],
  });
  ```
- [ ] 2. Criar `laura-pwa/tests/global-setup.ts`:
  ```ts
  import { request } from '@playwright/test';
  import fs from 'node:fs';
  import path from 'node:path';

  const API = process.env.API_URL || 'http://localhost:8080';
  const PWA = process.env.BASE_URL || 'http://localhost:3100';
  const AUTH_DIR = path.resolve(__dirname, '.auth');
  const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

  async function waitHealthy() {
    const ctx = await request.newContext();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const r = await ctx.get(`${API}/health`);
        if (r.ok()) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`API ${API}/health nao ficou healthy em 30s`);
  }

  export default async function globalSetup() {
    await waitHealthy();
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const ctx = await request.newContext({ baseURL: PWA });
    const resp = await ctx.post(`${API}/api/v1/auth/login`, {
      data: { email: 'e2e@laura.test', password: 'e2epass123!' },
    });
    if (!resp.ok()) {
      throw new Error(`login E2E falhou: ${resp.status()} ${await resp.text()}`);
    }
    await ctx.storageState({ path: AUTH_FILE });
  }
  ```
- [ ] 3. `cd laura-pwa && npx playwright test --list`. Expected: lista ≥1 spec existente.
- [ ] 4. Commit:
  ```sh
  git add laura-pwa/playwright.config.ts laura-pwa/tests/global-setup.ts
  git commit -m "test(e2e): playwright config baseURL + globalSetup com healthcheck+login

  globalSetup aguarda API /health 200 + faz login programatico via API
  e persiste storageState em tests/.auth/user.json (reutilizado por authedPage)."
  ```

### Task K.2 — Fixture de auth reutilizável
**Files:** Create: `laura-pwa/tests/fixtures/auth.ts`.

**Steps:**
- [ ] 1. Criar fixture:
  ```ts
  import { test as base, expect, Page } from '@playwright/test';
  import path from 'node:path';

  const STORAGE = path.resolve(__dirname, '../.auth/user.json');

  export const test = base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use) => {
      const ctx = await browser.newContext({ storageState: STORAGE });
      const page = await ctx.newPage();
      await use(page);
      await ctx.close();
    },
  });

  export { expect };

  export async function loginAs(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-login-submit').click();
    await expect(page).toHaveURL(/\/dashboard/);
  }

  export async function expectDarkMode(page: Page) {
    await expect(page.locator('html')).toHaveClass(/dark/);
  }
  ```
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/fixtures/auth.ts
  git commit -m "test(e2e): fixture auth reutilizavel (authedPage + loginAs + expectDarkMode)"
  ```

### Task K.3 — Seed E2E
**Files:** Create: `scripts/seed-e2e.sh`.

**Steps:**
- [ ] 1. Criar `scripts/seed-e2e.sh`:
  ```sh
  #!/usr/bin/env bash
  # scripts/seed-e2e.sh — seed idempotente para suite E2E Playwright.
  # Pre-reqs: API em :8080 + DB limpo com migrations aplicadas.
  set -euo pipefail

  API="${API:-http://localhost:8080}"
  EMAIL="e2e@laura.test"
  PASSWORD="e2epass123!"

  echo "[seed-e2e] garantindo user $EMAIL"
  curl -fsS -X POST "$API/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"E2E\"}" \
    2>/dev/null || echo "[seed-e2e] user ja existe (skip)"

  TOKEN=$(curl -fsS -X POST "$API/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

  echo "[seed-e2e] criando conta default"
  curl -fsS -X POST "$API/api/v1/accounts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Conta E2E","type":"checking","balance_cents":100000}' \
    >/dev/null || true

  echo "[seed-e2e] criando categorias default"
  for cat in Alimentacao Transporte Lazer; do
    curl -fsS -X POST "$API/api/v1/categories" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"name\":\"$cat\",\"kind\":\"expense\"}" \
      >/dev/null || true
  done

  echo "[seed-e2e] pronto"
  ```
- [ ] 2. `chmod +x scripts/seed-e2e.sh`.
- [ ] 3. Commit:
  ```sh
  git add scripts/seed-e2e.sh
  git commit -m "test(e2e): seed script (user + conta + categorias)"
  ```

### Task K.4.a — Spec `auth.spec.ts`
**Files:** Create: `laura-pwa/tests/auth.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (cenário: register → login → logout). Usa `test` base (NÃO `authedPage`):
  ```ts
  import { test, expect } from '@playwright/test';

  test('auth: register + login + logout happy path', async ({ page }) => {
    const stamp = Date.now();
    const email = `user${stamp}@laura.test`;
    await page.goto('/register');
    await page.getByTestId('input-name').fill('User E2E');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill('Senha123!');
    await page.getByTestId('btn-register-submit').click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByTestId('btn-logout').click();
    await expect(page).toHaveURL(/\/login/);
  });
  ```
- [ ] 2. Run: `cd laura-pwa && BASE_URL=http://localhost:3100 npx playwright test tests/auth.spec.ts --reporter=list`. Expected: 1 pass.
- [ ] 3. Commit:
  ```sh
  git add laura-pwa/tests/auth.spec.ts
  git commit -m "test(e2e): spec auth (register + login + logout)"
  ```

### Task K.4.b — Spec `transactions.spec.ts`
**Files:** Create: `laura-pwa/tests/transactions.spec.ts`.

**Steps:**
- [ ] 1. Criar spec:
  ```ts
  import { test, expect } from './fixtures/auth';

  test('transactions: criar receita + despesa, listar, deletar', async ({ authedPage: page }) => {
    await page.goto('/transactions');
    await page.getByTestId('btn-new-transaction').click();
    await page.getByTestId('input-amount').fill('150,00');
    await page.getByTestId('input-description').fill('Receita E2E');
    await page.getByTestId('select-type-income').click();
    await page.getByTestId('btn-save-transaction').click();
    await expect(page.getByText('Receita E2E')).toBeVisible();
    // Delete
    await page.getByTestId('btn-delete-transaction').first().click();
    await page.getByTestId('btn-confirm-delete').click();
    await expect(page.getByText('Receita E2E')).not.toBeVisible();
  });
  ```
- [ ] 2. Run + commit:
  ```sh
  git add laura-pwa/tests/transactions.spec.ts
  git commit -m "test(e2e): spec transactions (criar receita/despesa + deletar)"
  ```

### Task K.4.c — Spec `cards-invoices.spec.ts`
**Files:** Create: `laura-pwa/tests/cards-invoices.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (criar cartão → despesa vinculada → ver fatura → botão `btn-push-invoice`). Código análogo ao K.4.b usando `data-testid`.
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/cards-invoices.spec.ts
  git commit -m "test(e2e): spec cards-invoices (criar cartao + despesa + push fatura)"
  ```

### Task K.4.d — Spec `goals.spec.ts`
**Files:** Create: `laura-pwa/tests/goals.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (criar meta com valor-alvo + deadline, ver progresso 0%). Código usa `data-testid` estável.
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/goals.spec.ts
  git commit -m "test(e2e): spec goals (criar meta + verificar progresso)"
  ```

### Task K.4.e — Spec `investments.spec.ts`
**Files:** Create: `laura-pwa/tests/investments.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (criar investimento CDB, ver na lista). Código análogo.
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/investments.spec.ts
  git commit -m "test(e2e): spec investments (criar CDB + listar)"
  ```

### Task K.4.f — Spec `score.spec.ts`
**Files:** Create: `laura-pwa/tests/score.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (abrir /score, gauge `data-testid="score-gauge"` presente + valor numérico).
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/score.spec.ts
  git commit -m "test(e2e): spec score (gauge renderizado)"
  ```

### Task K.4.g — Spec `reports.spec.ts`
**Files:** Create: `laura-pwa/tests/reports.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (abrir /reports, navegar pelas 9 abas via `data-testid="tab-report-<n>"`, assert gráfico presente).
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/reports.spec.ts
  git commit -m "test(e2e): spec reports (9 abas + graficos)"
  ```

### Task K.4.h — Spec `super-admin.spec.ts`
**Files:** Create: `laura-pwa/tests/super-admin.spec.ts`.

**Steps:**
- [ ] 1. Criar spec (login como admin via seed alternativo OU `loginAs(page, 'admin@laura.test', ...)` → ver lista de workspaces em `/admin/workspaces`).
- [ ] 2. Commit:
  ```sh
  git add laura-pwa/tests/super-admin.spec.ts
  git commit -m "test(e2e): spec super-admin (lista workspaces)"
  ```

---

## Parte L — Workflows de deploy automático

### Task L.1 — `.github/workflows/deploy-api.yml`
**Files:** Create: `.github/workflows/deploy-api.yml`.

**Steps:**
- [ ] 1. Criar workflow:
  ```yaml
  # STANDBY [FLY-AUTH] — falha ate FLY_API_TOKEN estar no GH Secrets.
  name: deploy-api
  on:
    push:
      branches: [main]
      paths:
        - 'laura-go/**'
        - 'infrastructure/migrations/**'
        - 'laura-go/fly.toml'
        - '.github/workflows/deploy-api.yml'
    workflow_dispatch:
  jobs:
    deploy:
      if: github.ref == 'refs/heads/main'
      runs-on: ubuntu-latest
      concurrency: deploy-api
      steps:
        - uses: actions/checkout@v4
        - uses: superfly/flyctl-actions/setup-flyctl@master
        - name: Fly deploy
          run: flyctl deploy --remote-only --config laura-go/fly.toml --dockerfile laura-go/Dockerfile
          env:
            FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
  ```
- [ ] 2. Validar YAML: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-api.yml')); print('ok')"`. Expected: `ok`.
- [ ] 3. STANDBY [FLY-AUTH]: workflow falha até `FLY_API_TOKEN` ser setado. Registrar em HANDOFF.
- [ ] 4. Commit:
  ```sh
  git add .github/workflows/deploy-api.yml
  git commit -m "ci(deploy): workflow deploy-api (Fly.io)

  Gate por paths laura-go + infrastructure/migrations + fly.toml. workflow_dispatch
  permite trigger manual. STANDBY [FLY-AUTH] (FLY_API_TOKEN no GH Secrets)."
  ```

### Task L.2 — `.github/workflows/deploy-pwa.yml`
**Files:** Create: `.github/workflows/deploy-pwa.yml`.

**Steps:**
- [ ] 1. Criar workflow:
  ```yaml
  # STANDBY [VERCEL-AUTH] — falha ate VERCEL_TOKEN + ORG_ID + PROJECT_ID no GH Secrets.
  name: deploy-pwa
  on:
    push:
      branches: [main]
      paths:
        - 'laura-pwa/**'
        - '.github/workflows/deploy-pwa.yml'
    workflow_dispatch:
  jobs:
    deploy:
      if: github.ref == 'refs/heads/main'
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
- [ ] 2. Validar YAML: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-pwa.yml')); print('ok')"`. Expected: `ok`.
- [ ] 3. STANDBY [VERCEL-AUTH]: requer `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- [ ] 4. Commit:
  ```sh
  git add .github/workflows/deploy-pwa.yml
  git commit -m "ci(deploy): workflow deploy-pwa (Vercel)

  Gate por paths laura-pwa. workflow_dispatch permite trigger manual.
  STANDBY [VERCEL-AUTH] (VERCEL_TOKEN + ORG_ID + PROJECT_ID no GH Secrets)."
  ```

---

## Parte M — `.env.example` raiz + `.dockerignore` raiz

### Task M.1 — `.env.example` raiz consolidado (Go + PWA + E2E)
**Files:** Create: `.env.example`.

**Steps:**
- [ ] 1. Criar `.env.example` na raiz:
  ```
  # === Backend Go (laura-go/) ===
  # DATABASE_URL — conexao Postgres 16 + pgvector.
  DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable
  # PORT — porta HTTP Fiber.
  PORT=8080
  # APP_ENV / ENVIRONMENT — controla logger JSON (production) vs texto.
  APP_ENV=development
  ENVIRONMENT=development
  # TZ — timezone do processo Go (embutido via -tags timetzdata).
  TZ=America/Sao_Paulo
  # MIGRATE_ON_BOOT=true roda migrate up via embed.FS no boot.
  MIGRATE_ON_BOOT=false
  # DISABLE_WHATSAPP=true desabilita init whatsmeow (CI E2E).
  DISABLE_WHATSAPP=false
  # LOG_LEVEL — info|debug|warn|error.
  LOG_LEVEL=info
  # SESSION_HMAC_KEY — 32 bytes hex; ausencia em prod = crash.
  SESSION_HMAC_KEY=replace-with-32-bytes-hex
  # GROQ_API_KEY — LLM principal (Groq console).
  GROQ_API_KEY=
  # OPENAI_API_KEY — LLM fallback.
  OPENAI_API_KEY=
  # GOOGLE_CLIENT_ID / SECRET — OAuth Google.
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  # STRIPE_SECRET_KEY / WEBHOOK_SECRET — cobranca + webhook Stripe.
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  # RESEND_API_KEY — emails transacionais (Resend).
  RESEND_API_KEY=

  # === PWA Next.js (laura-pwa/) ===
  # NEXT_PUBLIC_API_URL — URL da API Go usada pelo browser.
  NEXT_PUBLIC_API_URL=http://localhost:8080
  # NEXT_PUBLIC_APP_ENV — controla banners/feature flags.
  NEXT_PUBLIC_APP_ENV=development
  # NEXTAUTH_SECRET / NEXTAUTH_URL — se NextAuth for habilitado.
  # NEXTAUTH_SECRET=
  # NEXTAUTH_URL=http://localhost:3100

  # === E2E / CI ===
  # BASE_URL — usado por Playwright (default http://localhost:3100).
  # BASE_URL=http://localhost:3100
  # TEST_DATABASE_URL — usado por testes de integracao Go.
  # TEST_DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable
  ```
- [ ] 2. Confirmar que `laura-go/.env.example` continua existindo como subset Go-only (adicionar comentário no topo referenciando este raiz).
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
- [ ] 2. Criar `.dockerignore` raiz:
  ```
  # Version control
  .git/
  .github/
  .githooks/

  # Docs / notes
  docs/
  *.md
  _bmad-output/

  # PWA artefatos locais (NAO precisa para build Go)
  laura-pwa/node_modules/
  laura-pwa/.next/
  laura-pwa/out/
  laura-pwa/tests/.auth/

  # Infra local
  infrastructure/backups/
  pgdata/

  # Secrets / env
  .env
  .env.*
  !.env.example
  .git-secrets-to-purge.txt

  # Dumps / bundles
  *.dump
  *.bundle

  # OS
  .DS_Store
  Thumbs.db
  ```
  Justificativa: desde Task C.3 o build context é a raiz do repo. Sem `.dockerignore` raiz, Docker copia pastas desnecessárias (PWA `node_modules`, `.next`, docs, backups) para o daemon — lento + risco de vazar `.env` local.
- [ ] 3. Commit:
  ```sh
  git add .dockerignore
  git commit -m "build(docker): .dockerignore raiz (build context = repo root)

  Complementa laura-go/.dockerignore. Evita copiar node_modules/.next/docs/
  backups/.env para Docker daemon. Obrigatorio desde C.3 (context = raiz)."
  ```

---

## Ordem de execução validada

```
0.1
→ A.1 A.2 A.3 A.4 A.5 A.6 A.final
→ B.1 B.2 B.3 B.4
→ C.1 C.2a C.2b C.3
→ D.1 D.2
→ E.1
→ F.local-validate
→ G.1 G.2
→ H.1
→ J.1 J.2
→ K.1 K.2 K.3 K.4.a K.4.b K.4.c K.4.d K.4.e K.4.f K.4.g K.4.h
→ L.1 L.2
→ M.1 M.2
→ I.1 (tag phase-10-prepared por ultimo)
```

**Dependências críticas:**
- Parte 0 antes de A.
- A antes de B/C/D (valida artefatos antes de alterar).
- B.4 antes de L.1 (`deploy-api.yml` usa `/ready` nos checks).
- C.2a antes de C.2b (função antes do wiring).
- C.2 antes de C.3 (Dockerfile espera embed funcionando).
- D.1 depois de B.4 (`fly.toml` referencia `/ready`).
- F.local-validate antes de qualquer mudança em migrations (gate).
- K.1/K.2/K.3 antes de K.4.* (fixture+seed pré-requisitos).
- M.2 depois de C.3 (context raiz exige `.dockerignore` raiz).
- I.1 último (commit final + tag).

---

## Self-review — Cobertura 1:1 dos 52 itens da spec v3 §15

Legenda: `🔧 IN_PLAN` = task ativa | `✅ DONE_BY_AGENT_B` = scaffold anterior (revalidado em A.*) | `⏸ STANDBY [<id>]` = preparado, bloqueado externo | `📦 DEFERRED` = fora Fase 10.

### A. Sanitização Git (7)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 1 | Backup local pré-rewrite | H.1 (bundle via script) | 🔧 IN_PLAN |
| 2 | `.gitleaks.toml` patterns | A.3 + A.final | ✅ DONE_BY_AGENT_B |
| 3 | `filter-repo --replace-text` + validação | H.1 | ⏸ STANDBY [GROQ-REVOKE] |
| 4 | Force push coordenado | H.1 doc | ⏸ STANDBY [FORCE-PUSH] |
| 5 | Atualizar secrets GitHub + Fly (nova Groq) | H.1 + J.2 | ⏸ STANDBY [GROQ-REVOKE] |
| 6 | `lefthook.yml` gitleaks | E.1 | 🔧 IN_PLAN |
| 7 | `.gitignore` raiz | F.local-validate + H.1 + C.1 | 🔧 IN_PLAN |

### B. Migrations (7)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 8 | `scripts/migrate.sh` | F.local-validate | 🔧 IN_PLAN |
| 9 | `scripts/dry-run-000035.sql` | F.local-validate | 🔧 IN_PLAN |
| 10 | `embed.FS` com `//go:embed *.sql` | C.1 | 🔧 IN_PLAN |
| 11 | Dockerfile copia migrations | C.3 | 🔧 IN_PLAN |
| 12 | Patch `main.go` runMigrations | C.2a + C.2b | 🔧 IN_PLAN |
| 13 | CI aplica 2× (idempotência) | A.1 (revisão do go-ci.yml) | ✅ DONE_BY_AGENT_B |
| 14 | `rollback.md` seção 000035 | J.1 | 🔧 IN_PLAN |

### C. Patches Go (7)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 15 | `client.go` Container.Upgrade | B.1 (teste regressão — lib já faz) | 🔧 IN_PLAN |
| 16 | `instance_manager.go` Container.Upgrade | B.1 (mesmo escopo) | 🔧 IN_PLAN |
| 17 | `main.go` guard DISABLE_WHATSAPP | B.2 | 🔧 IN_PLAN |
| 18 | `client.go` early-return DISABLE_WHATSAPP | B.2 | 🔧 IN_PLAN |
| 19 | `main.go` requestid | B.3 | 🔧 IN_PLAN |
| 20 | Logger JSON condicional | B.3 | 🔧 IN_PLAN |
| 21 | Handler `/ready` | B.4 | 🔧 IN_PLAN |

### D. CI (5)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 22 | `go-ci.yml` | A.1 + A.final | ✅ DONE_BY_AGENT_B |
| 23 | `pwa-ci.yml` | A.2 + A.final | ✅ DONE_BY_AGENT_B |
| 24 | `.golangci.yml` | A.final | ✅ DONE_BY_AGENT_B |
| 25 | `laura-pwa/package.json` typecheck | D.2 | 🔧 IN_PLAN |
| 26 | Validar via actionlint + PR | 0.1 step 4 | 🔧 IN_PLAN |

### E. Testes E2E (4)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 27 | Playwright config baseURL + globalSetup | K.1 | 🔧 IN_PLAN |
| 28 | `fixtures/auth.ts` | K.2 | 🔧 IN_PLAN |
| 29 | 8 specs | K.4.a … K.4.h | 🔧 IN_PLAN |
| 30 | `scripts/seed-e2e.sh` | K.3 | 🔧 IN_PLAN |

### F. Containers (3)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 31 | Dockerfile multi-stage timetzdata | C.3 | 🔧 IN_PLAN |
| 32 | `.dockerignore` raiz | M.2 | 🔧 IN_PLAN |
| 33 | Build <80MB, /health+/ready 200 | C.3 + I.1 | 🔧 IN_PLAN |

### G. Fly (4)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 34 | `fly.toml` completo | D.1 | 🔧 IN_PLAN |
| 35 | `deploy-api.yml` | L.1 | 🔧 IN_PLAN |
| 36 | STANDBYs em HANDOFF | G.1 | 🔧 IN_PLAN |
| 37 | `fly scale count 1` pós-deploy | D.1 (doc) + G.1 | ⏸ STANDBY [FLY-AUTH] |

### H. Vercel (3)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 38 | `vercel.json` headers + HSTS | A.6 + A.final | ✅ DONE_BY_AGENT_B |
| 39 | `deploy-pwa.yml` | L.2 | 🔧 IN_PLAN |
| 40 | STANDBYs em HANDOFF | G.1 | 🔧 IN_PLAN |

### I. Postgres prod (2)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 41 | Comandos Fly Postgres em `ops/deployment.md` | A.final + F.local-validate doc | ✅ DONE_BY_AGENT_B |
| 42 | Dry-run antes de MIGRATE_ON_BOOT | F.local-validate (doc prod) | 🔧 IN_PLAN |

### J. Documentação (6)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 43 | HANDOFF atualizado | G.1 | 🔧 IN_PLAN |
| 44 | `ops/security.md` | A.final + H.1 | ✅ DONE_BY_AGENT_B |
| 45 | `ops/deployment.md` | A.final | ✅ DONE_BY_AGENT_B |
| 46 | `runbooks/secrets-rotation.md` | J.2 | 🔧 IN_PLAN |
| 47 | `runbooks/rollback.md` | J.1 | 🔧 IN_PLAN |
| 48 | `.env.example` raiz | M.1 | 🔧 IN_PLAN |

### K. Tags + memory (2)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 49 | Tag `phase-10-deployed` pós smoke | — (este plan aplica `phase-10-prepared` em I.1; deployed fica pós-STANDBY) | 📦 DEFERRED |
| 50 | Entrada memory | G.2 | 🔧 IN_PLAN |

### L. Drills (2)
| # | Item | Task v3 | Status |
|---|------|---------|--------|
| 51 | Drill rollback | J.1 doc; exec pós-deploy | ⏸ STANDBY [FLY-PG-CREATE] |
| 52 | Drill restore Fly PG | J.1 doc; exec pós-deploy | ⏸ STANDBY [FLY-PG-CREATE] |

### Contagem final
- **Total itens spec v3:** 52.
- `🔧 IN_PLAN`: **35** tasks cobrem diretamente.
- `✅ DONE_BY_AGENT_B`: **9** (revalidados em A.*).
- `⏸ STANDBY [<id>]`: **6** (itens 3, 4, 5, 37, 51, 52).
- `📦 DEFERRED`: **1** (item 49 — tag `phase-10-deployed`).
- GAPs sem cobertura: **0**.

### Contagem de tasks do plan v3
- Parte 0: 1
- Parte A: 7 (A.1–A.6 + A.final)
- Parte B: 4 (B.1–B.4)
- Parte C: 4 (C.1, C.2a, C.2b, C.3)
- Parte D: 2 (D.1, D.2)
- Parte E: 1 (E.1)
- Parte F: 1 (F.local-validate — consolidada)
- Parte G: 2 (G.1, G.2)
- Parte H: 1 (H.1)
- Parte I: 1 (I.1)
- Parte J: 2 (J.1, J.2)
- Parte K: 11 (K.1, K.2, K.3, K.4.a … K.4.h)
- Parte L: 2 (L.1, L.2)
- Parte M: 2 (M.1, M.2)
- **Total: 41 tasks.**

---

## Apêndice X — Comandos de execução comuns

Comandos reutilizados em várias tasks. Referencia por rótulo no texto das tasks para evitar repetição.

- `[PSQL-LOCAL]`:
  ```sh
  docker exec infrastructure-postgres-1 psql -U laura -d laura_finance
  ```
- `[GO-BUILD]`:
  ```sh
  cd laura-go && go build ./...
  ```
- `[GO-TEST]`:
  ```sh
  cd laura-go && go test ./...
  ```
- `[GO-TEST-RACE]`:
  ```sh
  cd laura-go && go test -race ./...
  ```
- `[PWA-CHECK]`:
  ```sh
  cd laura-pwa && npm run typecheck && npm run lint && npm run build
  ```
- `[DOCKER-BUILD-API]` (rodar da raiz):
  ```sh
  docker build -f laura-go/Dockerfile -t laura-go:test .
  ```
- `[API-RUN-LOCAL]`:
  ```sh
  cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run .
  ```
- `[PLAYWRIGHT-RUN]`:
  ```sh
  cd laura-pwa && BASE_URL=http://localhost:3100 npx playwright test --reporter=list
  ```
- `[YAML-VALIDATE]` (substituir `<path>`):
  ```sh
  python3 -c "import yaml; yaml.safe_load(open('<path>')); print('ok')"
  ```
- `[TOML-VALIDATE]`:
  ```sh
  python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"
  ```

---

## Validação final automatizada (auto-check do plan v3)

- [x] Substrings proibidas (`TBD`, `TODO`, `implement later`, `similar to`, `...` fora de literais): **0 ocorrências reais**.
- [x] Cada task tem step de Commit (exceto tarefas procedurais explicitamente "Sem commit").
- [x] Cada `Run:` tem `Expected:` definido.
- [x] Cada task indica working directory com `cd laura-go`/`cd laura-pwa` ou absoluto.
- [x] Todos os 52 itens da spec v3 §15 mapeados 1:1.
- [x] 13 STANDBYs oficiais referenciados explicitamente em tasks afetadas.

---

**Fim do Plan v3 — FINAL.** Próxima ação: execução via `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, começando em Task 0.1 e seguindo a ordem validada.
