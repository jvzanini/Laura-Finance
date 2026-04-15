# Fase 10 — Security closeout + infraestrutura mínima de produção (Plan v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar pendências de segurança (sanitização git, secrets) e habilitar deploy contínuo do Laura Finance (PWA→Vercel, Go→Fly.io, Postgres gerenciado), com CI/CD completo, E2E expandido e docs operacionais.

**Architecture:** PWA Next.js 16 deployado na Vercel (region gru1); backend Go 1.26.1 (Fiber v2 + Whatsmeow + cron in-process) deployado em single-machine no Fly.io region gru com volume Postgres gerenciado pelo `fly postgres`; migrations embutidas no binário Go via `embed.FS` + `golang-migrate/migrate v4` rodando na inicialização com `pg_advisory_lock`; CI via GitHub Actions (Go: lint+vet+gosec+govulncheck+test+build com Postgres service; PWA: typecheck+lint+build+playwright+vitest opcional; Security: gitleaks).

**Tech Stack:** Go 1.26.1, Fiber v2, pgx/v5, whatsmeow + sqlstore PG, robfig/cron/v3, golang-migrate/migrate v4, embed.FS; Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Playwright; Postgres 16 + pgvector; Docker (distroless static nonroot); Fly.io machines + Postgres + secrets; Vercel; GitHub Actions; gitleaks + lefthook (pre-commit).

---

## Observações globais

- **Workdir absoluto** para todos os comandos: `/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/`.
- **Commits** em PT-BR, formato conventional (`feat(...):`, `fix(...):`, `chore(...):`, `docs(...):`, `test(...):`).
- **Branch**: `main` (projeto é solo dev; spec v3 assume push direto).
- **STANDBY** items são marcados com comentário `STANDBY [ID]` e NÃO bloqueiam o plan — apenas anotam pendência externa do usuário.
- **Divergência do agente B**: o `laura-go/fly.toml` atual usa `[mounts]` whatsmeow_data + distroless + 256mb. A spec v3 (seção 4.7) especifica alpine + 512mb + SEM mount (whatsmeow persiste em Postgres). A task D1 corrige para spec.

---

## Parte 0 — Pré-condições e validações

### Task 0.1 — Garantir branch limpa e artefatos do agente B presentes

**Files:**
- Read: `.github/workflows/go-ci.yml`, `.github/workflows/pwa-ci.yml`, `.github/workflows/security.yml`, `.github/workflows/playwright.yml`, `.gitleaks.toml`, `.golangci.yml`, `.githooks/pre-commit`, `laura-go/Dockerfile`, `laura-go/fly.toml`, `laura-go/.dockerignore`, `laura-go/.env.example`, `laura-pwa/vercel.json`, `docs/ops/security.md`, `docs/ops/deployment.md`, `laura-pwa/tests/mvp-flows.spec.ts`

**Steps:**
- [ ] 1. Rodar `cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && git status --short` e confirmar que os arquivos listados aparecem como `M` ou `??` (agente B já fez as mudanças, não committadas ainda).
- [ ] 2. Rodar `python3 -c "import yaml; [yaml.safe_load(open(f'.github/workflows/{f}')) for f in ['go-ci.yml','pwa-ci.yml','security.yml','playwright.yml']]; print('yaml ok')"` — saída esperada `yaml ok`.
- [ ] 3. Rodar `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"` — saída esperada `toml ok`.
- [ ] 4. Rodar `docker build --check -f laura-go/Dockerfile laura-go/ 2>&1 | head -40 || echo "docker --check indisponível ou falhou (não-bloqueante)"`. Registrar se sintaxe Docker ok.
- [ ] 5. Rodar `which actionlint && actionlint .github/workflows/*.yml || echo "actionlint ausente — pular"`.
- [ ] 6. Rodar `which fly && fly config validate --config laura-go/fly.toml || echo "fly CLI ausente — pular, será validado no smoke pré-deploy"`.
- [ ] 7. Commit da validação apenas se algum script de checagem novo tiver sido criado — NÃO há mudanças a commitar nesta task. Apenas registrar resultados mentalmente para as próximas tasks.

---

## Parte A — Validação dos artefatos do agente B

### Task A.1 — Revisar `.github/workflows/go-ci.yml`

**Files:**
- Read: `.github/workflows/go-ci.yml`

**Steps:**
- [ ] 1. Ler o arquivo completo.
- [ ] 2. Verificar presença de jobs/steps:
  - `setup-go` com Go 1.26.
  - `go vet ./...` em `laura-go/`.
  - `golangci-lint` ação ou binário.
  - `gosec` (github.com/securego/gosec) com severity HIGH pelo menos.
  - `govulncheck` (golang.org/x/vuln/cmd/govulncheck).
  - `services: postgres` com imagem incluindo pgvector (`pgvector/pgvector:pg16` ou equivalente) + health check.
  - Step de migrations (psql aplicando arquivos em `infrastructure/migrations/*.sql` em ordem).
  - `go test -race ./...`.
  - Step de `go build`.
- [ ] 3. Se algum item ausente, anotar como gap para Task A.final (revisão consolidada).
- [ ] 4. Sem mudanças a commitar.

### Task A.2 — Revisar `.github/workflows/pwa-ci.yml` + `playwright.yml`

**Files:**
- Read: `.github/workflows/pwa-ci.yml`, `.github/workflows/playwright.yml`

**Steps:**
- [ ] 1. Confirmar `pwa-ci.yml` executa: `npm ci`, `tsc --noEmit`, `npm run lint`, `npm run build`, `vitest` (condicional à existência de `vitest.config`).
- [ ] 2. Confirmar `playwright.yml` executa: `npm ci`, `npx playwright install --with-deps`, `npx playwright test` com `working-directory: laura-pwa`.
- [ ] 3. Confirmar variável `DISABLE_WHATSAPP=true` exportada para o job E2E (necessária após Task B.2).
- [ ] 4. Anotar ausências para Task A.final.

### Task A.3 — Revisar `security.yml` + `.gitleaks.toml`

**Files:**
- Read: `.github/workflows/security.yml`, `.gitleaks.toml`

**Steps:**
- [ ] 1. Confirmar `security.yml` roda `gitleaks detect --source . --config .gitleaks.toml --no-git` ou `gitleaks detect --redact`.
- [ ] 2. Confirmar `.gitleaks.toml` tem `extend.useDefault = true` + regras/allowlist para `gsk_*`, `sk_live_*`, `re_*`, `whsec_*`.
- [ ] 3. Se regras Laura-específicas ausentes, anotar para Task A.final.

### Task A.4 — Revisar `laura-go/Dockerfile` + `.dockerignore`

**Files:**
- Read: `laura-go/Dockerfile`, `laura-go/.dockerignore`

**Steps:**
- [ ] 1. Verificar stage builder: `golang:1.26-alpine`, `CGO_ENABLED=0`, `go build -o /out/laura ./`.
- [ ] 2. Verificar se flag `-tags timetzdata` está presente — **ausente no Dockerfile atual** (confirmado em pré-leitura). Será corrigida em Task C.3.
- [ ] 3. Verificar runtime stage: `distroless/static-debian12:nonroot`, `EXPOSE 8080`, `USER nonroot:nonroot`.
- [ ] 4. Confirmar `.dockerignore` exclui `*.md`, `.git/`, `tests/`, `bin/`, `.env*` — leitura.
- [ ] 5. Anotar gaps para Task C.3.

### Task A.5 — Revisar `laura-go/fly.toml`

**Files:**
- Read: `laura-go/fly.toml`

**Steps:**
- [ ] 1. Ler arquivo.
- [ ] 2. Comparar com spec 4.7:
  - **Divergências confirmadas na pré-leitura:**
    - `[mounts]` whatsmeow_data presente — spec não pede (whatsmeow via Postgres).
    - `memory_mb = 256` — spec pede `memory = "512mb"` em bloco `[[vm]]`.
    - `auto_stop_machines = "stop"` — spec pede `"suspend"`.
    - Falta `max_machines_count`/enforcement explícito.
    - Falta `[[http_service.checks]]` para `/ready`.
    - Falta `TZ = "America/Sao_Paulo"` no `[env]`.
    - Falta `MIGRATE_ON_BOOT = "true"` no `[env]`.
    - Falta `kill_signal = "SIGTERM"` + `kill_timeout = 30`.
- [ ] 3. Task D.1 fará a correção completa.

### Task A.6 — Revisar `laura-pwa/vercel.json` + `laura-go/.env.example`

**Files:**
- Read: `laura-pwa/vercel.json`, `laura-go/.env.example`

**Steps:**
- [ ] 1. `vercel.json`: confirmar `regions: ["gru1"]` + headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS preload).
- [ ] 2. `.env.example`: confirmar cobertura de `DATABASE_URL`, `SESSION_HMAC_KEY` (ou `SESSION_SECRET`), `GROQ_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_ENV`, `PORT`, `MIGRATE_ON_BOOT`, `DISABLE_WHATSAPP`, `ENVIRONMENT`.
- [ ] 3. Se `MIGRATE_ON_BOOT` ou `DISABLE_WHATSAPP` ausente, anotar para patch na Task C.2 (quando criarmos o runMigrations) / Task B.2.

### Task A.final — Consolidar sanity-check e commitar artefatos do agente B

**Files:**
- Modify: mensagem de commit apenas (arquivos já foram criados pelo agente B).

**Steps:**
- [ ] 1. Rodar `git add .github/ .gitleaks.toml .golangci.yml .githooks/ laura-go/Dockerfile laura-go/.dockerignore laura-go/fly.toml laura-go/.env.example laura-pwa/vercel.json docs/ CLAUDE.md README.md laura-pwa/tests/mvp-flows.spec.ts laura-pwa/package-lock.json`.
- [ ] 2. Rodar `git rm laura-pwa/.github/workflows/playwright.yml` (arquivo foi movido para raiz).
- [ ] 3. Rodar `git status --short` e confirmar que só os arquivos esperados estão staged.
- [ ] 4. Commit:
  ```sh
  git commit -m "chore(infra): scaffold inicial CI/CD + Docker/Fly/Vercel (agente B)

  - CI workflows: go-ci, pwa-ci, playwright, security (gitleaks)
  - Dockerfile distroless + .dockerignore
  - fly.toml template (será ajustado na task D1)
  - vercel.json com headers de segurança + region gru1
  - .golangci.yml, .gitleaks.toml, .githooks/pre-commit
  - docs/ops/security.md + docs/ops/deployment.md
  - laura-go/.env.example expandido
  - smoke E2E PWA expandido"
  ```
- [ ] 5. Rodar `git log -1 --oneline` e confirmar commit criado.

---

## Parte B — Patches Go (TDD)

### Task B.1 — Adicionar `Container.Upgrade(ctx)` nos 2 lugares de Whatsmeow

**Files:**
- Modify: `laura-go/internal/whatsapp/client.go`, `laura-go/internal/whatsapp/instance_manager.go`
- Test: `laura-go/internal/whatsapp/client_test.go` (novo)

**Steps:**
- [ ] 1. Rodar `grep -n "sqlstore.New" laura-go/internal/whatsapp/client.go laura-go/internal/whatsapp/instance_manager.go` para localizar linhas exatas.
- [ ] 2. Escrever teste que falha — `laura-go/internal/whatsapp/client_test.go` (novo):
  ```go
  package whatsapp

  import (
      "context"
      "database/sql"
      "os"
      "testing"

      _ "github.com/jackc/pgx/v5/stdlib"
  )

  // TestContainerUpgrade_CreatesWhatsmeowTables valida que após InitWhatsmeow
  // as tabelas whatsmeow_* existem no DB.
  func TestContainerUpgrade_CreatesWhatsmeowTables(t *testing.T) {
      dbURL := os.Getenv("TEST_DATABASE_URL")
      if dbURL == "" {
          t.Skip("TEST_DATABASE_URL não definido; skip")
      }
      db, err := sql.Open("pgx", dbURL)
      if err != nil { t.Fatal(err) }
      defer db.Close()

      // Drop pre-existente (estado fresco)
      _, _ = db.ExecContext(context.Background(), `DROP TABLE IF EXISTS whatsmeow_device CASCADE`)

      if err := InitWhatsmeow(context.Background(), dbURL); err != nil {
          t.Fatalf("InitWhatsmeow falhou: %v", err)
      }

      var exists bool
      err = db.QueryRowContext(context.Background(),
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsmeow_device')`,
      ).Scan(&exists)
      if err != nil { t.Fatal(err) }
      if !exists {
          t.Fatal("tabela whatsmeow_device não foi criada — Container.Upgrade() não chamado")
      }
  }
  ```
- [ ] 3. Rodar `cd laura-go && go test ./internal/whatsapp/... -run TestContainerUpgrade -v` — saída esperada: `FAIL` (relação whatsmeow_device não existe ou skip; se skip, setar `TEST_DATABASE_URL` para compose dev).
- [ ] 4. Aplicar patch em `laura-go/internal/whatsapp/client.go` — adicionar após a linha `sqlstore.New(...)`:
  ```go
  if err := container.Upgrade(ctx); err != nil {
      return nil, fmt.Errorf("whatsmeow upgrade: %w", err)
  }
  ```
  (Preservar assinatura existente de `container`. Se o retorno de `sqlstore.New` usa nome diferente, ajustar.)
- [ ] 5. Aplicar patch idêntico em `laura-go/internal/whatsapp/instance_manager.go` após `sqlstore.New`.
- [ ] 6. Rodar `cd laura-go && go build ./...` — saída esperada: sem erros.
- [ ] 7. Rodar `cd laura-go && TEST_DATABASE_URL=postgres://laura:laura@localhost:5432/laura_test?sslmode=disable go test ./internal/whatsapp/... -run TestContainerUpgrade -v` — saída esperada: `PASS`.
- [ ] 8. Commit:
  ```sh
  git add laura-go/internal/whatsapp/client.go laura-go/internal/whatsapp/instance_manager.go laura-go/internal/whatsapp/client_test.go
  git commit -m "fix(whatsapp): chamar Container.Upgrade(ctx) após sqlstore.New

  Sem Upgrade, primeiro boot em prod falha ao ler tabelas whatsmeow_*.
  Patch aplicado nos 2 lugares que chamam sqlstore.New (client.go,
  instance_manager.go). Teste valida criação de whatsmeow_device."
  ```

### Task B.2 — Implementar guard `DISABLE_WHATSAPP`

**Files:**
- Modify: `laura-go/main.go`, `laura-go/internal/whatsapp/client.go`, `laura-go/.env.example`
- Test: `laura-go/internal/whatsapp/disable_test.go` (novo)

**Steps:**
- [ ] 1. Escrever teste — `laura-go/internal/whatsapp/disable_test.go` (novo):
  ```go
  package whatsapp

  import (
      "context"
      "os"
      "testing"
  )

  func TestInitWhatsmeow_DisableFlag_SkipsInit(t *testing.T) {
      t.Setenv("DISABLE_WHATSAPP", "true")
      // DB URL inválida de propósito: se InitWhatsmeow for chamado, vai falhar.
      err := InitWhatsmeow(context.Background(), "postgres://bogus:bogus@127.0.0.1:1/bogus?sslmode=disable")
      if err != nil {
          t.Fatalf("DISABLE_WHATSAPP=true deveria fazer early-return sem erro, veio: %v", err)
      }
      _ = os.Unsetenv("DISABLE_WHATSAPP")
  }
  ```
- [ ] 2. Rodar `cd laura-go && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v` — saída esperada: `FAIL` (função tenta conectar).
- [ ] 3. Patch em `laura-go/internal/whatsapp/client.go` no início de `InitWhatsmeow` (e `NewClient` se aplicável):
  ```go
  if os.Getenv("DISABLE_WHATSAPP") == "true" {
      log.Printf("DISABLE_WHATSAPP=true — whatsmeow init skipped")
      return nil
  }
  ```
  Adicionar `import "os"` + `"log"` se ausentes.
- [ ] 4. Patch em `laura-go/main.go` — envolver chamada `whatsapp.InitWhatsmeow(...)` com:
  ```go
  if os.Getenv("DISABLE_WHATSAPP") != "true" {
      if err := whatsapp.InitWhatsmeow(ctx, dbURL); err != nil {
          log.Fatalf("whatsapp init: %v", err)
      }
  } else {
      log.Println("DISABLE_WHATSAPP=true — pulando inicialização do whatsmeow")
  }
  ```
- [ ] 5. Patch em `laura-go/.env.example` — adicionar se ausente:
  ```
  # DISABLE_WHATSAPP=true desabilita init do whatsmeow (usado em CI E2E).
  DISABLE_WHATSAPP=false
  ```
- [ ] 6. Rodar `cd laura-go && go build ./...` — saída esperada: sem erros.
- [ ] 7. Rodar `cd laura-go && go test ./internal/whatsapp/... -run TestInitWhatsmeow_DisableFlag -v` — saída esperada: `PASS`.
- [ ] 8. Sanity-check manual: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . 2>&1 | head -20` — deve logar "pulando inicialização do whatsmeow" e subir Fiber normalmente. `Ctrl+C` para parar.
- [ ] 9. Commit:
  ```sh
  git add laura-go/main.go laura-go/internal/whatsapp/client.go laura-go/internal/whatsapp/disable_test.go laura-go/.env.example
  git commit -m "feat(whatsapp): guard DISABLE_WHATSAPP para CI/dev sem WA

  Flag desabilita sqlstore.New + Container.Upgrade + conexão WA.
  Necessária para E2E headless no CI (sem QR scan)."
  ```

### Task B.3 — Middleware `requestid` + logger JSON condicional

**Files:**
- Modify: `laura-go/main.go`
- Test: `laura-go/main_test.go` (novo, se não existir)

**Steps:**
- [ ] 1. Escrever teste — `laura-go/main_test.go`:
  ```go
  package main

  import (
      "net/http/httptest"
      "testing"

      "github.com/gofiber/fiber/v2"
      "github.com/gofiber/fiber/v2/middleware/requestid"
  )

  func TestRequestIDMiddleware_AddsHeader(t *testing.T) {
      app := fiber.New()
      app.Use(requestid.New())
      app.Get("/ping", func(c *fiber.Ctx) error { return c.SendString("ok") })

      req := httptest.NewRequest("GET", "/ping", nil)
      resp, err := app.Test(req, -1)
      if err != nil { t.Fatal(err) }
      if resp.Header.Get("X-Request-Id") == "" {
          t.Fatalf("header X-Request-Id ausente")
      }
  }
  ```
- [ ] 2. Rodar `cd laura-go && go test -run TestRequestIDMiddleware -v` — esperado: se pacote `requestid` não importado em `main.go`, teste pode passar isolado mas indica integração pendente. Documentar como teste "contrato do middleware" isolado e prosseguir com o patch em main.
- [ ] 3. Patch em `laura-go/main.go`:
  - Import:
    ```go
    import "github.com/gofiber/fiber/v2/middleware/requestid"
    import "github.com/gofiber/fiber/v2/utils"
    ```
  - Antes de `app.Use(logger.New())` adicionar:
    ```go
    app.Use(requestid.New(requestid.Config{
        Header:     "X-Request-Id",
        Generator:  utils.UUIDv4,
        ContextKey: "requestid",
    }))
    ```
  - Substituir `app.Use(logger.New())` por:
    ```go
    if os.Getenv("ENVIRONMENT") == "production" {
        app.Use(logger.New(logger.Config{
            Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","requestid":"${locals:requestid}"}` + "\n",
        }))
    } else {
        app.Use(logger.New())
    }
    ```
- [ ] 4. Rodar `cd laura-go && go mod tidy && go build ./...` — saída esperada: sem erros.
- [ ] 5. Sanity-check: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=... go run . &`; `sleep 2; curl -i http://localhost:8080/health | grep -i x-request-id`; `kill %1`. Esperar header presente.
- [ ] 6. Commit:
  ```sh
  git add laura-go/main.go laura-go/main_test.go laura-go/go.mod laura-go/go.sum
  git commit -m "feat(obs): middleware requestid + logs JSON em production

  - X-Request-Id gerado (UUIDv4) e propagado no header.
  - Logger Fiber emite JSON quando ENVIRONMENT=production, texto em dev.
  - Facilita correlação em Fly/Vercel logs."
  ```

### Task B.4 — Handler `/ready` com ping DB (criar `/health` se ausente)

**Files:**
- Modify: `laura-go/main.go`
- Test: `laura-go/main_test.go` (patch)

**Steps:**
- [ ] 1. Rodar `grep -n "\"/health\"" laura-go/main.go laura-go/internal/handlers/router.go` para confirmar `/health` já existe (spec indica main.go:39 + router.go:45).
- [ ] 2. Escrever teste em `laura-go/main_test.go`:
  ```go
  func TestReadyHandler_ReturnsReadyWhenDBOK(t *testing.T) {
      app := fiber.New()
      // Stub: usamos função que sempre retorna nil (ping ok).
      app.Get("/ready", func(c *fiber.Ctx) error {
          return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
      })
      req := httptest.NewRequest("GET", "/ready", nil)
      resp, err := app.Test(req, -1)
      if err != nil { t.Fatal(err) }
      if resp.StatusCode != 200 {
          t.Fatalf("esperado 200, veio %d", resp.StatusCode)
      }
  }
  ```
- [ ] 3. Rodar `cd laura-go && go test -run TestReadyHandler -v` — esperado `PASS` (contrato local). O teste integra ping real via smoke manual.
- [ ] 4. Patch em `laura-go/main.go` — registrar handler real antes do `app.Listen`:
  ```go
  app.Get("/ready", func(c *fiber.Ctx) error {
      if db == nil {
          return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": "nil"})
      }
      if err := db.PingContext(c.Context()); err != nil {
          return c.Status(503).JSON(fiber.Map{"status": "not-ready", "db": err.Error()})
      }
      return c.JSON(fiber.Map{"status": "ready", "db": "ok"})
  })
  ```
  (Ajustar `db` para o identificador real do pool pgx/sql em main.go. Se usa `pgxpool.Pool`, trocar `PingContext` por `Ping(ctx)`.)
- [ ] 5. Confirmar `/health` existe — se `grep` do step 1 não achou em main.go, adicionar:
  ```go
  app.Get("/health", func(c *fiber.Ctx) error {
      return c.SendString("ok")
  })
  ```
- [ ] 6. Rodar `cd laura-go && go build ./...` — saída esperada: sem erros.
- [ ] 7. Smoke: `cd laura-go && DISABLE_WHATSAPP=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable go run . &`; `sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ready`; `kill %1`. Esperado: `200`. Depois parar docker-compose do db e repetir: esperado `503`.
- [ ] 8. Commit:
  ```sh
  git add laura-go/main.go laura-go/main_test.go
  git commit -m "feat(obs): handler /ready com ping DB

  - Retorna 200 {status:ready,db:ok} quando DB responde.
  - 503 {status:not-ready,db:<err>} em falha.
  - Fly health checks usarão /ready além de /health."
  ```

---

## Parte C — Migrations embutidas

### Task C.1 — Criar `embed.FS` com todas as migrations SQL

**Files:**
- Create: `laura-go/internal/migrations/embed.go`
- Create: `laura-go/internal/migrations/embed_test.go`
- Modify: `laura-go/.dockerignore` (se necessário para não excluir a cópia de migrations)

**Steps:**
- [ ] 1. Ler `ls infrastructure/migrations/` para confirmar existem `000001_*.sql` a `000035_*.sql`.
- [ ] 2. Criar `laura-go/internal/migrations/embed.go`:
  ```go
  // Package migrations expõe as migrations SQL embutidas no binário Go.
  //
  // Os arquivos *.sql são copiados de infrastructure/migrations/ para este
  // diretório durante o build (Dockerfile ou script local) e empacotados
  // via //go:embed. Em runtime, o pacote fornece um iofs.Driver compatível
  // com github.com/golang-migrate/migrate/v4.
  package migrations

  import (
      "embed"
      "fmt"
      "io/fs"

      "github.com/golang-migrate/migrate/v4/source"
      "github.com/golang-migrate/migrate/v4/source/iofs"
  )

  //go:embed *.sql
  var FS embed.FS

  // Source retorna um source.Driver baseado em embed.FS.
  // Uso: migrate.NewWithSourceInstance("iofs", src, dbURL).
  func Source() (source.Driver, error) {
      sub, err := fs.Sub(FS, ".")
      if err != nil {
          return nil, fmt.Errorf("migrations sub fs: %w", err)
      }
      return iofs.New(sub, ".")
  }
  ```
- [ ] 3. Criar `laura-go/internal/migrations/embed_test.go`:
  ```go
  package migrations

  import (
      "io/fs"
      "strings"
      "testing"
  )

  func TestEmbed_HasAllMigrations(t *testing.T) {
      entries, err := fs.ReadDir(FS, ".")
      if err != nil { t.Fatal(err) }
      var count int
      for _, e := range entries {
          if strings.HasSuffix(e.Name(), ".sql") { count++ }
      }
      if count < 35 {
          t.Fatalf("esperado pelo menos 35 arquivos .sql embutidos, veio %d", count)
      }
  }
  ```
- [ ] 4. Copiar migrations uma vez para permitir `go build` local:
  ```sh
  cp infrastructure/migrations/*.sql laura-go/internal/migrations/
  ```
- [ ] 5. Rodar `cd laura-go && go mod tidy` (puxa `golang-migrate/migrate/v4` + `source/iofs`).
- [ ] 6. Rodar `cd laura-go && go test ./internal/migrations/... -v` — saída esperada: `PASS` com count ≥35.
- [ ] 7. Adicionar `laura-go/internal/migrations/*.sql` ao `.gitignore` (arquivos são cópia; fonte canônica em `infrastructure/migrations/`):
  ```
  laura-go/internal/migrations/*.sql
  ```
  (Adicionar em `.gitignore` raiz se não existir.)
- [ ] 8. Commit:
  ```sh
  git add laura-go/internal/migrations/embed.go laura-go/internal/migrations/embed_test.go laura-go/go.mod laura-go/go.sum .gitignore
  git commit -m "feat(migrations): embed.FS para migrations SQL no binário

  - //go:embed *.sql empacota infrastructure/migrations/*.sql dentro
    do binário via cópia no build.
  - Source() retorna iofs.Driver para golang-migrate/migrate v4.
  - .sql copiados ignorados pelo git (fonte canônica continua em
    infrastructure/migrations/)."
  ```

### Task C.2 — Integrar `runMigrations()` no boot + flag `MIGRATE_ON_BOOT`

**Files:**
- Modify: `laura-go/main.go`
- Modify: `laura-go/.env.example`

**Steps:**
- [ ] 1. Patch `laura-go/main.go` — adicionar função:
  ```go
  func runMigrations(dbURL string) error {
      src, err := migrations.Source()
      if err != nil {
          return fmt.Errorf("migrations source: %w", err)
      }
      m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
      if err != nil {
          return fmt.Errorf("migrate new: %w", err)
      }
      defer m.Close()
      if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
          return fmt.Errorf("migrate up: %w", err)
      }
      v, dirty, _ := m.Version()
      log.Printf("migrations aplicadas: version=%d dirty=%v", v, dirty)
      return nil
  }
  ```
  Imports:
  ```go
  "errors"
  "github.com/golang-migrate/migrate/v4"
  _ "github.com/golang-migrate/migrate/v4/database/postgres"
  "laura-finance/laura-go/internal/migrations"
  ```
  (Ajustar import path conforme `go.mod` `module` atual.)
- [ ] 2. Chamar no início do `main()` após carregar env e antes de init WA:
  ```go
  if os.Getenv("MIGRATE_ON_BOOT") == "true" {
      if err := runMigrations(dbURL); err != nil {
          log.Fatalf("runMigrations: %v", err)
      }
  }
  ```
- [ ] 3. Patch `laura-go/.env.example` — adicionar se ausente:
  ```
  # MIGRATE_ON_BOOT=true roda golang-migrate up via embed.FS no start do binário.
  # pg_advisory_lock garante segurança em restart concorrente.
  MIGRATE_ON_BOOT=false
  ```
- [ ] 4. Rodar `cd laura-go && go mod tidy && go build ./...` — saída esperada: sem erros.
- [ ] 5. Smoke: `cd laura-go && DISABLE_WHATSAPP=true MIGRATE_ON_BOOT=true DATABASE_URL=postgres://laura:laura@localhost:5432/laura_migtest?sslmode=disable go run . 2>&1 | head -30`. Esperar log "migrations aplicadas: version=35 dirty=false". `Ctrl+C`.
- [ ] 6. Rodar 2× (idempotência): repetir step 5 — segunda rodada deve logar version=35 sem aplicar novas (ErrNoChange silenciado).
- [ ] 7. Commit:
  ```sh
  git add laura-go/main.go laura-go/.env.example laura-go/go.mod laura-go/go.sum
  git commit -m "feat(migrations): runMigrations no boot via MIGRATE_ON_BOOT

  - Integração golang-migrate/migrate v4 + iofs + pg_advisory_lock.
  - Flag opt-in MIGRATE_ON_BOOT=true (prod Fly); dev continua via CLI.
  - Idempotente: migrate.ErrNoChange suprimido."
  ```

### Task C.3 — Ajustar Dockerfile (`-tags timetzdata` + cópia migrations)

**Files:**
- Modify: `laura-go/Dockerfile`

**Steps:**
- [ ] 1. Reescrever `laura-go/Dockerfile`:
  ```dockerfile
  # syntax=docker/dockerfile:1.7

  # ---------- Stage 1: build ----------
  FROM golang:1.26-alpine AS build

  WORKDIR /src
  RUN apk add --no-cache ca-certificates git

  # Dependências primeiro para maximizar cache.
  COPY laura-go/go.mod laura-go/go.sum ./laura-go/
  WORKDIR /src/laura-go
  RUN go mod download

  # Copia código Go e migrations (fonte em infrastructure/migrations/).
  COPY laura-go ./
  COPY infrastructure/migrations ./internal/migrations

  # Build estático com timetzdata embutido (America/Sao_Paulo disponível
  # mesmo sem tzdata no runtime).
  RUN CGO_ENABLED=0 GOOS=linux go build \
          -tags "timetzdata" \
          -ldflags="-s -w" \
          -o /out/laura ./

  # ---------- Stage 2: runtime ----------
  FROM alpine:3.19

  RUN apk add --no-cache ca-certificates tzdata wget \
      && addgroup -S app && adduser -S app -G app
  ENV TZ=America/Sao_Paulo

  WORKDIR /app
  COPY --from=build /out/laura /app/laura
  USER app

  EXPOSE 8080
  HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
      CMD wget -qO- http://localhost:8080/health || exit 1

  ENTRYPOINT ["/app/laura"]
  ```
  **Nota de divergência:** spec v3 recomenda alpine+tzdata (não distroless) para permitir `wget` no healthcheck + `tzdata` de runtime. O Dockerfile do agente B usa distroless — esta task troca para alinhar com spec.
- [ ] 2. O `build context` agora é a raiz do repo (não `laura-go/`). Atualizar `.github/workflows/go-ci.yml` e eventual `deploy-api.yml` para `docker build -f laura-go/Dockerfile .` (context = `.`). Se `go-ci.yml` já usa `docker build`, ajustar. Caso contrário, registrar para Task G.2 quando formos documentar deploy.
- [ ] 3. Rodar `docker build -f laura-go/Dockerfile -t laura-go:test .` a partir da raiz — saída esperada: build completo sem erros, tamanho da imagem <80MB (`docker images laura-go:test --format "{{.Size}}"`).
- [ ] 4. Smoke runtime:
  ```sh
  docker run --rm -d --name laura-test -p 18080:8080 \
      -e DISABLE_WHATSAPP=true \
      -e DATABASE_URL=postgres://laura:laura@host.docker.internal:5432/laura?sslmode=disable \
      laura-go:test
  sleep 3
  curl -s http://localhost:18080/health
  curl -s -w "\n%{http_code}\n" http://localhost:18080/ready
  docker logs laura-test | tail -10
  docker stop laura-test
  ```
  Esperado: `/health` 200, `/ready` 200, logs incluem "pulando inicialização do whatsmeow".
- [ ] 5. Commit:
  ```sh
  git add laura-go/Dockerfile
  git commit -m "build(docker): alpine runtime + timetzdata + migrations embutidas

  - Troca distroless por alpine:3.19 (wget healthcheck + tzdata nativo).
  - Build com -tags timetzdata (America/Sao_Paulo no binário).
  - COPY infrastructure/migrations → laura-go/internal/migrations antes
    do go build para //go:embed funcionar.
  - Context do docker build passa a ser a raiz do repo."
  ```

---

## Parte D — fly.toml hardening

### Task D.1 — Reescrever `laura-go/fly.toml` para atingir spec 4.7/4.12

**Files:**
- Modify: `laura-go/fly.toml`

**Steps:**
- [ ] 1. Reescrever `laura-go/fly.toml`:
  ```toml
  app = "laura-finance-api"
  primary_region = "gru"
  kill_signal = "SIGTERM"
  kill_timeout = 30

  [build]
    dockerfile = "laura-go/Dockerfile"

  [env]
    PORT = "8080"
    APP_ENV = "production"
    ENVIRONMENT = "production"
    MIGRATE_ON_BOOT = "true"
    LOG_LEVEL = "info"
    TZ = "America/Sao_Paulo"

  [http_service]
    internal_port = 8080
    force_https = true
    auto_stop_machines = "suspend"
    auto_start_machines = true
    min_machines_running = 1
    processes = ["app"]

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

  # Single-machine enforce: pós-deploy rodar `fly scale count 1 --max-per-region 1`.
  # Cron in-process (robfig/cron/v3) duplica score_snapshots com 2+ máquinas.
  # Ver docs/ops/deployment.md seção "Escala" e Fase 17 no backlog.

  [[vm]]
    cpu_kind = "shared"
    cpus = 1
    memory = "512mb"
  ```
  **Remoções vs. versão do agente B:** `[mounts]` whatsmeow_data (whatsmeow persiste em Postgres via sqlstore).
- [ ] 2. Rodar `python3 -c "import tomllib; tomllib.load(open('laura-go/fly.toml','rb')); print('toml ok')"` — esperado `toml ok`.
- [ ] 3. Se `fly` CLI disponível: `fly config validate --config laura-go/fly.toml`. Senão anotar como validação pendente.
- [ ] 4. Commit:
  ```sh
  git add laura-go/fly.toml
  git commit -m "fix(fly): alinhar fly.toml com spec v3 (single-machine + /ready)

  - Remove [mounts] whatsmeow_data (whatsmeow persiste em Postgres).
  - memory: 256mb → 512mb, auto_stop: stop → suspend.
  - Adiciona TZ=America/Sao_Paulo, MIGRATE_ON_BOOT=true, ENVIRONMENT=production.
  - Adiciona healthcheck /ready além de /health.
  - Documenta enforce de 1 máquina (cron in-process)."
  ```

---

## Parte E — lefthook substituindo `.githooks/`

### Task E.1 — Criar `lefthook.yml` na raiz

**Files:**
- Create: `lefthook.yml`

**Steps:**
- [ ] 1. Criar `lefthook.yml` na raiz:
  ```yaml
  # lefthook.yml — pre-commit hooks para Laura Finance.
  # Instalar uma vez: `lefthook install` (após `brew install lefthook`).
  # Docs: https://github.com/evilmartians/lefthook

  pre-commit:
    parallel: true
    commands:
      gitleaks:
        run: gitleaks protect --staged --no-banner --redact --config=.gitleaks.toml
        fail_text: "Segredo detectado — abortando commit."

      golangci-lint:
        glob: "laura-go/**/*.go"
        run: cd laura-go && golangci-lint run --fix {staged_files}
        stage_fixed: true

      eslint-pwa:
        glob: "laura-pwa/**/*.{ts,tsx,js,jsx}"
        run: cd laura-pwa && npx eslint --fix {staged_files}
        stage_fixed: true

  pre-push:
    commands:
      go-test-fast:
        glob: "laura-go/**/*.go"
        run: cd laura-go && go test -short ./...
  ```
- [ ] 2. Testar com `lefthook run pre-commit --files README.md` se `lefthook` instalado. Senão registrar como validação pós-instalação.
- [ ] 3. Commit:
  ```sh
  git add lefthook.yml
  git commit -m "chore(hooks): adotar lefthook (gitleaks + lint staged)

  - pre-commit: gitleaks protect + golangci-lint + eslint (staged only).
  - pre-push: go test -short.
  - Substitui .githooks/pre-commit (mantido como fallback manual)."
  ```

### Task E.2 — Atualizar README + decisão sobre `.githooks/`

**Files:**
- Modify: `README.md`

**Steps:**
- [ ] 1. Adicionar seção em README.md (se ausente):
  ```md
  ## Pre-commit hooks

  Canônico: **lefthook**.

  ```sh
  brew install lefthook
  lefthook install
  ```

  O diretório `.githooks/` é mantido como fallback manual (sem dependência
  Node/Go). Para usar: `git config core.hooksPath .githooks`.
  ```
- [ ] 2. Manter `.githooks/pre-commit` no repo — NÃO remover (é fallback útil para envs sem lefthook).
- [ ] 3. Commit:
  ```sh
  git add README.md
  git commit -m "docs(hooks): documentar lefthook (canônico) + .githooks fallback"
  ```

---

## Parte F — Migration 000035 dry-run + apply local

### Task F.1 — Script dry-run + backup pré-apply

**Files:**
- Create: `scripts/dry-run-000035.sql`
- Create: `scripts/migrate.sh`
- Create: `infrastructure/backups/.gitkeep`
- Modify: `.gitignore` (ignorar backups `.sql`)

**Steps:**
- [ ] 1. Criar `scripts/dry-run-000035.sql`:
  ```sql
  -- scripts/dry-run-000035.sql
  -- Executar ANTES de aplicar infrastructure/migrations/000035_security_hardening.sql.
  -- Retorna quantas linhas serão DELETADAS pela migration (por tabela).
  -- Threshold: todos 0 => prosseguir. >0 em qualquer linha => PARAR.
  SELECT 'transactions'     AS tabela, COUNT(*) AS rows_to_delete FROM transactions     WHERE workspace_id IS NULL
  UNION ALL SELECT 'accounts',          COUNT(*) FROM accounts          WHERE workspace_id IS NULL
  UNION ALL SELECT 'categories',        COUNT(*) FROM categories        WHERE workspace_id IS NULL
  UNION ALL SELECT 'cards',             COUNT(*) FROM cards             WHERE workspace_id IS NULL
  UNION ALL SELECT 'invoices',          COUNT(*) FROM invoices          WHERE workspace_id IS NULL
  UNION ALL SELECT 'financial_goals',   COUNT(*) FROM financial_goals   WHERE workspace_id IS NULL
  UNION ALL SELECT 'investments',       COUNT(*) FROM investments       WHERE workspace_id IS NULL
  UNION ALL SELECT 'debt_rollovers',    COUNT(*) FROM debt_rollovers    WHERE workspace_id IS NULL;
  ```
- [ ] 2. Criar `scripts/migrate.sh`:
  ```bash
  #!/usr/bin/env bash
  # scripts/migrate.sh — wrapper para golang-migrate CLI em dev.
  set -euo pipefail

  DB_URL="${DATABASE_URL:-postgres://laura:laura@localhost:5432/laura?sslmode=disable}"
  MIG_DIR="$(cd "$(dirname "$0")/.." && pwd)/infrastructure/migrations"

  case "${1:-up}" in
    up)      migrate -path "$MIG_DIR" -database "$DB_URL" up ;;
    down)    migrate -path "$MIG_DIR" -database "$DB_URL" down 1 ;;
    version) migrate -path "$MIG_DIR" -database "$DB_URL" version ;;
    force)   migrate -path "$MIG_DIR" -database "$DB_URL" force "$2" ;;
    *) echo "uso: $0 {up|down|version|force <v>}" >&2; exit 1 ;;
  esac
  ```
  + `chmod +x scripts/migrate.sh`.
- [ ] 3. Criar `infrastructure/backups/.gitkeep` (vazio) + patch `.gitignore` raiz:
  ```
  infrastructure/backups/*.sql
  infrastructure/backups/*.dump
  !infrastructure/backups/.gitkeep
  ```
- [ ] 4. Subir Postgres dev: `docker compose -f infrastructure/docker-compose.yml up -d db`. Esperar health.
- [ ] 5. Aplicar migrations 001..034: `DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable scripts/migrate.sh version`. Se `< 34`, rodar `migrate -path infrastructure/migrations -database "$DB_URL" goto 34`.
- [ ] 6. Rodar dry-run: `psql "postgres://laura:laura@localhost:5432/laura" -f scripts/dry-run-000035.sql | tee /tmp/dry-run-000035.out`. Registrar resultado. Se todos 0: prosseguir. Se >0 em qualquer: ABORTAR task F.2 e registrar no HANDOFF.
- [ ] 7. Backup: `pg_dump --format=custom "postgres://laura:laura@localhost:5432/laura" > "infrastructure/backups/pre-035-$(date +%Y%m%d-%H%M%S).dump"`. Confirmar arquivo >0 bytes.
- [ ] 8. Commit:
  ```sh
  git add scripts/dry-run-000035.sql scripts/migrate.sh infrastructure/backups/.gitkeep .gitignore
  chmod +x scripts/migrate.sh
  git commit -m "feat(migrations): dry-run 000035 + wrapper migrate.sh + dir backups

  - dry-run-000035.sql: 8 SELECT COUNT(*) WHERE workspace_id IS NULL.
  - migrate.sh: wrapper golang-migrate CLI para dev.
  - infrastructure/backups/ versionado (gitkeep), dumps ignorados."
  ```

### Task F.2 — Aplicar migration 000035 local em transação

**Files:** apenas DB local (nenhum arquivo novo; Steps são procedimentais).

**Steps:**
- [ ] 1. Confirmar que F.1 step 6 retornou todos 0. Se não, parar e registrar no HANDOFF.
- [ ] 2. Aplicar em transação:
  ```sh
  psql "postgres://laura:laura@localhost:5432/laura" <<'EOF'
  BEGIN;
  \i infrastructure/migrations/000035_security_hardening.sql
  -- validação: listar constraints adicionadas
  SELECT table_name, constraint_name, constraint_type
  FROM information_schema.table_constraints
  WHERE constraint_name LIKE '%workspace%' OR constraint_name LIKE '%_not_null'
  ORDER BY table_name;
  COMMIT;
  EOF
  ```
- [ ] 3. Atualizar `schema_migrations` se aplicação foi manual (bypassou CLI):
  ```sh
  psql "postgres://laura:laura@localhost:5432/laura" -c "UPDATE schema_migrations SET version=35, dirty=false;"
  ```
  Alternativa preferível: aplicar via `scripts/migrate.sh up` direto (faz bookkeeping). Se optar por isso, pular o psql manual acima.
- [ ] 4. Validação:
  ```sh
  psql "..." -c "\d transactions" | grep workspace_id
  psql "..." -c "SELECT version FROM schema_migrations;"
  ```
  Esperado: `workspace_id uuid NOT NULL` + version 35.
- [ ] 5. Idempotência: `scripts/migrate.sh up` — esperado `no change`.
- [ ] 6. Sem commit (mudança é apenas no DB local). Registrar saída em nota para HANDOFF update.

---

## Parte G — Documentação operacional final

### Task G.1 — `docs/ops/migrations.md`

**Files:**
- Create: `docs/ops/migrations.md`

**Steps:**
- [ ] 1. Criar `docs/ops/migrations.md`:
  ```md
  # Migrations — procedimento operacional

  > Ferramenta: `github.com/golang-migrate/migrate/v4`.
  > Source canônico: `infrastructure/migrations/*.sql`.
  > Em runtime prod: embutidas via `//go:embed` (ver `laura-go/internal/migrations/embed.go`).

  ## Dev local

  ```sh
  docker compose -f infrastructure/docker-compose.yml up -d db
  DATABASE_URL=postgres://laura:laura@localhost:5432/laura?sslmode=disable \
      scripts/migrate.sh up
  ```

  Idempotência: `scripts/migrate.sh up` duas vezes → segunda = `no change`.

  ## Produção (Fly.io)

  Padrão: `MIGRATE_ON_BOOT=true` no `fly.toml`. O binário aplica migrations
  no início via embed.FS + pg_advisory_lock. Single-machine (ver `fly.toml`).

  Pré-requisito do PRIMEIRO deploy: rodar dry-run 000035 (seção abaixo).

  ## Dry-run 000035 (obrigatório pré-prod)

  ```sh
  fly postgres connect -a <pg-app> < scripts/dry-run-000035.sql
  ```

  Threshold: todos 0 → prosseguir. >0 → parar e ver runbook.

  ## Rollback

  Ver `docs/ops/runbooks/rollback.md` seção "Rollback migration 000035".

  ## Backup manual pré-risco

  ```sh
  pg_dump --format=custom "$DATABASE_URL" \
      > infrastructure/backups/pre-<nome>-$(date +%Y%m%d-%H%M%S).dump
  ```
  ```
- [ ] 2. Commit:
  ```sh
  git add docs/ops/migrations.md
  git commit -m "docs(ops): procedimento de migrations (dev + prod + dry-run)"
  ```

### Task G.2 — Atualizar `docs/HANDOFF.md`

**Files:**
- Modify: `docs/HANDOFF.md`

**Steps:**
- [ ] 1. Ler `docs/HANDOFF.md` atual.
- [ ] 2. Inserir no topo seção "Histórico de atualizações" (se ausente) e entrada de hoje:
  ```md
  ## Histórico de atualizações

  ### 2026-04-15 — Fase 10 preparada
  - CI/CD scaffolded (go-ci, pwa-ci, playwright, security).
  - Dockerfile alpine + timetzdata + migrations embutidas.
  - fly.toml single-machine (gru, 512mb, /health + /ready).
  - Patches Go: Container.Upgrade, DISABLE_WHATSAPP, requestid, /ready.
  - lefthook canônico (gitleaks + lint staged).
  - Migration 000035 aplicada LOCAL (dry-run = 0 órfãos).
  - STANDBY ativos: GROQ-REVOKE, FORCE-PUSH, VERCEL-AUTH, VERCEL-ENV,
    FLY-AUTH, FLY-CARD, FLY-SECRETS, FLY-PG-CREATE, STRIPE-LIVE,
    RESEND-DOMAIN, DNS.
  ```
- [ ] 3. Atualizar seção "Estado da produção" / "Próximos passos" para refletir:
  - Próximo passo = usuário executar STANDBY [GROQ-REVOKE] → agente executa Task H.1 (sanitize-history).
  - Migration 000035 já aplicada local.
  - Deploy prod bloqueado por STANDBY [FLY-AUTH/FLY-CARD/FLY-PG-CREATE].
- [ ] 4. Mover STANDBYs resolvidos (se houver — nesta fase provavelmente nenhum ainda) para "Histórico".
- [ ] 5. Commit:
  ```sh
  git add docs/HANDOFF.md
  git commit -m "docs(handoff): atualizar para estado pós-Fase 10 preparada"
  ```

### Task G.3 — Criar memória `phase_10_complete.md`

**Files:**
- Create: `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/phase_10_complete.md` (ajustar slug real do projeto via `ls ~/.claude/projects/ | grep -i laura`).

**Steps:**
- [ ] 1. Identificar diretório real: `ls /Users/joaovitorzanini/.claude/projects/ | grep -i laura`. Anotar slug.
- [ ] 2. Criar arquivo memory (conteúdo):
  ```md
  # Phase 10 complete — security closeout + infra prep

  **Data:** 2026-04-15
  **Tag:** phase-10-prepared (não phase-10-deployed — smoke prod pendente)

  ## Snapshot

  - CI/CD: go-ci, pwa-ci, playwright, security (gitleaks) — todos verdes.
  - Dockerfile: alpine:3.19 runtime + -tags timetzdata + migrations embed.FS.
  - fly.toml: single-machine gru 512mb, /health + /ready, TZ SP, MIGRATE_ON_BOOT=true.
  - Patches Go: Container.Upgrade (2x), DISABLE_WHATSAPP guard, requestid mw, /ready handler, logs JSON em prod.
  - Migration 000035 aplicada LOCAL (dry-run=0).
  - lefthook canônico.
  - Docs: HANDOFF, ops/security, ops/deployment, ops/migrations.

  ## STANDBY ativos

  GROQ-REVOKE, FORCE-PUSH, VERCEL-AUTH, VERCEL-ENV, FLY-AUTH, FLY-CARD,
  FLY-SECRETS, FLY-PG-CREATE, STRIPE-LIVE, RESEND-DOMAIN, DNS.

  ## Referências

  - Spec: docs/superpowers/specs/2026-04-15-fase-10-security-closeout-infra-v3.md
  - Plan: docs/superpowers/plans/2026-04-15-fase-10-security-closeout-infra-v1.md

  ## Decisões

  - golang-migrate/migrate v4 (não goose).
  - lefthook (não husky/pre-commit).
  - alpine runtime (não distroless) — wget healthcheck + tzdata.
  - Whatsmeow em Postgres (sem Fly volume).
  - Single-machine enforce (cron in-process; multi-réplica = Fase 17).
  ```
- [ ] 3. Atualizar `MEMORY.md` do projeto adicionando link à nova entrada.
- [ ] 4. Commit (se memory dir é versionado via symlink — normalmente NÃO é versionado no repo do projeto, então só criar arquivo e pular commit):
  - Se caminho estiver fora do repo (é o caso), nenhum git add necessário.
  - Se estiver dentro: `git add <path>` + commit PT-BR.

---

## Parte H — Sanitização git history (STANDBY, preparar)

### Task H.1 — Preparar `scripts/sanitize-history.sh` + documentação operacional

**Files:**
- Create: `scripts/sanitize-history.sh`
- Modify: `docs/ops/security.md` (seção "Key leak playbook")

**Steps:**
- [ ] 1. Criar `scripts/sanitize-history.sh`:
  ```bash
  #!/usr/bin/env bash
  # scripts/sanitize-history.sh — reescreve histórico git para remover segredo.
  # PRÉ-REQUISITOS:
  #   1. Key antiga REVOGADA (GROQ console).  [STANDBY GROQ-REVOKE]
  #   2. Nova key gerada e armazenada.
  #   3. Secrets atualizados: GitHub Actions + Fly.
  #   4. Backup do repo local feito.
  #   5. Usuário autorizou force push.         [STANDBY FORCE-PUSH]
  #
  # Este script NÃO roda force push automaticamente — a etapa final é manual.
  set -euo pipefail

  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$REPO_ROOT"

  if [[ ! -f .git-secrets-to-purge.txt ]]; then
      cat <<'EOF' >&2
  Arquivo .git-secrets-to-purge.txt ausente.
  Criar com formato: uma linha por segredo exato a remover. Ex:
    gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  Este arquivo é EFÊMERO — não commitar.
  EOF
      exit 1
  fi

  command -v git-filter-repo >/dev/null || { echo "instale git-filter-repo (brew install git-filter-repo)" >&2; exit 1; }

  echo "==> Backup em /tmp/laura-finance-pre-sanitize-$(date +%s).bundle"
  git bundle create "/tmp/laura-finance-pre-sanitize-$(date +%s).bundle" --all

  echo "==> Rodando filter-repo (reescreve histórico)"
  git filter-repo --replace-text .git-secrets-to-purge.txt --force

  echo "==> Validação — busca por 'gsk_' deve retornar vazio:"
  git log -p -Sgsk_ --all | head -5 || true

  echo ""
  echo "=== Sanitização concluída LOCAL. Próximo passo MANUAL:"
  echo "  git push --force --all"
  echo "  git push --force --tags"
  echo ""
  echo "STANDBY [FORCE-PUSH] — aguardar confirmação do usuário antes de rodar."
  ```
  + `chmod +x scripts/sanitize-history.sh`.
- [ ] 2. Adicionar `.git-secrets-to-purge.txt` ao `.gitignore`:
  ```
  .git-secrets-to-purge.txt
  ```
- [ ] 3. Expandir seção "Key leak playbook" em `docs/ops/security.md` (adicionar se ausente):
  ```md
  ## Playbook: key vazada no histórico git

  Ordem canônica (STANDBY [GROQ-REVOKE] + [FORCE-PUSH]):

  1. Usuário: revogar key antiga no provider.
  2. Usuário: gerar nova key.
  3. Agente: atualizar GitHub secret + Fly secret.
  4. Agente: backup do repo local (cp -R).
  5. Agente: criar `.git-secrets-to-purge.txt` com o segredo EXATO.
  6. Agente: rodar `scripts/sanitize-history.sh`.
  7. Agente → usuário: confirmar force push.
  8. Agente: `git push --force --all && git push --force --tags`.
  9. Agente: validar `git log -p -Sgsk_ --all | head` = vazio.

  **Fly/Vercel não quebram com force push** — deploys puxam HEAD no momento
  do workflow trigger.
  ```
- [ ] 4. **NÃO executar** `sanitize-history.sh` — marca STANDBY [GROQ-REVOKE] + [FORCE-PUSH].
- [ ] 5. Commit:
  ```sh
  git add scripts/sanitize-history.sh docs/ops/security.md .gitignore
  git commit -m "docs(security): playbook key vazada + script sanitize-history

  Script preparado mas NÃO executado. Depende de:
    STANDBY [GROQ-REVOKE] — usuário revoga+gera nova key.
    STANDBY [FORCE-PUSH]  — usuário autoriza force push main."
  ```

---

## Parte I — Tag + consolidação final

### Task I.1 — Verificação pré-tag + tag `phase-10-prepared`

**Files:** nenhum novo; apenas validação + tag.

**Steps:**
- [ ] 1. Rodar `cd laura-go && go build ./... && go test ./...` — saída esperada: todos PASS.
- [ ] 2. Rodar `cd laura-pwa && npm run typecheck && npm run lint && npm run build` — saída esperada: todos PASS.
- [ ] 3. Rodar `docker build -f laura-go/Dockerfile -t laura-go:phase10 .` — saída esperada: build OK.
- [ ] 4. Rodar `git status --short` — saída esperada: working tree limpa (ou apenas arquivos volumosos ignorados).
- [ ] 5. Rodar `git log --oneline -20` — confirmar commits PT-BR da fase 10 presentes.
- [ ] 6. Aplicar tag:
  ```sh
  git tag -a phase-10-prepared -m "Fase 10 preparada — CI/CD, Docker, Fly, patches Go.

  Produção ainda NÃO deployada (STANDBY [GROQ-REVOKE, FLY-AUTH, FLY-CARD,
  FLY-PG-CREATE, VERCEL-AUTH]). Tag phase-10-deployed só após smoke prod
  com /health e /ready 200 OK."
  ```
- [ ] 7. **NÃO fazer push da tag automaticamente** — `git push --tags` fica para quando STANDBYs externos resolverem (evita poluir remote com tag de estado intermediário). Anotar em HANDOFF.
- [ ] 8. Sem commit final (tag já é o commit mark).

---

## Self-review

Mapeamento 1:1 dos 52 itens do checklist da spec v3 seção 15 → task deste plan.

### A. Sanitização Git

| # | Item | Task | Status |
|---|------|------|--------|
| 1 | Backup local pré-rewrite | H.1 step 1 (via `git bundle`) | Coberto (preparado) |
| 2 | `.gitleaks.toml` patterns | A.3 + agente B | Coberto (agente B + review) |
| 3 | `git filter-repo --replace-text` + validação | H.1 step 1 | Coberto (preparado, STANDBY) |
| 4 | Force push coordenado | H.1 step 3-4 (doc) | STANDBY [GROQ-REVOKE/FORCE-PUSH] |
| 5 | Atualizar secrets GitHub + Fly | H.1 doc + G.2 HANDOFF | STANDBY (manual) |
| 6 | `lefthook.yml` com gitleaks | E.1 | Coberto |
| 7 | `.gitignore` raiz (`.env`, etc.) | F.1 step 3 + H.1 step 2 | Coberto |

### B. Migrations

| # | Item | Task |
|---|------|------|
| 8 | `scripts/migrate.sh` | F.1 |
| 9 | `scripts/dry-run-000035.sql` | F.1 |
| 10 | `embed.go` com `//go:embed *.sql` | C.1 |
| 11 | Dockerfile copia migrations | C.3 |
| 12 | Patch `main.go` runMigrations | C.2 |
| 13 | Job CI aplica 2× (idempotência) | A.1 (revisão) — go-ci.yml do agente B já cobre (confirmar em A.1) |
| 14 | `rollback.md` seção "Rollback 000035" | G.1 (`migrations.md` referencia) + gap: criar `rollback.md` dedicado (ver lacuna abaixo) |

### C. Patches Go

| # | Item | Task |
|---|------|------|
| 15 | `client.go` Container.Upgrade | B.1 |
| 16 | `instance_manager.go` Container.Upgrade | B.1 |
| 17 | `main.go` guard DISABLE_WHATSAPP | B.2 |
| 18 | `client.go` early-return DISABLE_WHATSAPP | B.2 |
| 19 | `main.go` requestid.New | B.3 |
| 20 | Logger JSON condicional | B.3 |
| 21 | Handler `/ready` | B.4 |

### D. CI

| # | Item | Task |
|---|------|------|
| 22 | `.github/workflows/go.yml` (ou `go-ci.yml`) | A.1 (agente B) |
| 23 | `.github/workflows/pwa.yml` (ou `pwa-ci.yml`) | A.2 (agente B) |
| 24 | `.golangci.yml` | A.final (agente B) |
| 25 | `laura-pwa/package.json` typecheck | A.2 — verificar presença (GAP se ausente) |
| 26 | Validar via actionlint + PR teste | 0.1 step 5 |

### E. Testes E2E

| # | Item | Task |
|---|------|------|
| 27 | `playwright.config.ts` baseURL + globalSetup | **GAP — não coberto por este plan** |
| 28 | `fixtures/auth.ts` | **GAP** |
| 29 | 8 specs novos | **GAP — explicitamente deferido para v2 deste plan** |
| 30 | `scripts/seed-e2e.sh` | **GAP** |

### F. Containers

| # | Item | Task |
|---|------|------|
| 31 | Dockerfile multi-stage timetzdata | C.3 |
| 32 | `.dockerignore` raiz | A.4 (agente B + review); **GAP**: `.dockerignore` atual está em `laura-go/`, não na raiz. Revisar em A.4. |
| 33 | Build local <80MB, /health+/ready 200 | C.3 step 3-4, I.1 step 3 |

### G. Fly

| # | Item | Task |
|---|------|------|
| 34 | `fly.toml` completo | D.1 |
| 35 | `.github/workflows/deploy-api.yml` | **GAP — não criado neste plan** (depende STANDBY [FLY-AUTH]) |
| 36 | STANDBYs em HANDOFF | G.2 |
| 37 | Pós-deploy `fly scale count 1` | Documentado em D.1 + G.2 (exec pós-STANDBY) |

### H. Vercel

| # | Item | Task |
|---|------|------|
| 38 | `vercel.json` headers + HSTS | A.6 (agente B + review) |
| 39 | `deploy-pwa.yml` | **GAP — não criado neste plan** (depende STANDBY [VERCEL-AUTH]) |
| 40 | STANDBYs em HANDOFF | G.2 |

### I. Postgres prod

| # | Item | Task |
|---|------|------|
| 41 | Comandos Fly Postgres em `ops/deployment.md` | A.final (agente B já criou deployment.md); revisar em A.final |
| 42 | Dry-run antes de MIGRATE_ON_BOOT | F.1/F.2 (local) + G.1 (doc prod) |

### J. Documentação

| # | Item | Task |
|---|------|------|
| 43 | HANDOFF atualizado | G.2 |
| 44 | `ops/security.md` | A.final (agente B) + H.1 (playbook leak) |
| 45 | `ops/deployment.md` | A.final (agente B) |
| 46 | `runbooks/secrets-rotation.md` | **GAP — não criado** |
| 47 | `runbooks/rollback.md` | **GAP — não criado** |
| 48 | `.env.example` raiz | **GAP** (existe `laura-go/.env.example`; falta raiz consolidado PWA+Go) |

### K. Tags + memory

| # | Item | Task |
|---|------|------|
| 49 | Tag `phase-10-deployed` após smoke | **Deferido** — tag deste plan = `phase-10-prepared` (I.1) |
| 50 | Entrada em memory index | G.3 |

### L. Drills

| # | Item | Task |
|---|------|------|
| 51 | Drill rollback fake | **GAP — deferido** (depende de Fly Postgres existir) |
| 52 | Drill restore Fly Postgres | **GAP — deferido** (STANDBY [FLY-PG-CREATE]) |

### Contagem final

- **Total de itens:** 52.
- **Cobertos por tasks deste plan:** 37.
- **Cobertos pelo agente B (confirmados via tasks A.*):** 10 (itens 2, 7 parcial, 22, 23, 24, 32 parcial, 38, 41, 44, 45).
- **GAPs identificados (a resolver no plan review #1):** 13 — itens 14, 25, 27-30, 32 (raiz), 35, 39, 46-48, 51-52.
- **Deferidos legitimamente (STANDBY externo ou fora do escopo plan v1):** 4, 5, 49.

### Itens STANDBY explícitos no plan

- STANDBY [GROQ-REVOKE] — H.1
- STANDBY [FORCE-PUSH] — H.1
- STANDBY [VERCEL-AUTH] — G.2 (doc) + GAP item 39
- STANDBY [VERCEL-ENV] — G.2
- STANDBY [FLY-AUTH] — G.2 + GAP item 35
- STANDBY [FLY-CARD] — G.2
- STANDBY [FLY-SECRETS] — G.2
- STANDBY [FLY-PG-CREATE] — G.2 + GAPs 51-52
- STANDBY [STRIPE-LIVE] — G.2
- STANDBY [RESEND-DOMAIN] — G.2
- STANDBY [DNS] — G.2
- STANDBY [CODECOV-TOKEN] — opcional, não tocado
- STANDBY [SENTRY-DSN] — Fase 11

### Confirmação "zero placeholders"

Revisado: nenhuma task contém "TBD", "implement later", "similar to task N". Todos os blocos de código são literais completos. Onde o conteúdo exato depende do código atual (e.g., nome do `db` pool em main.go), a task instrui explicitamente o agente a ajustar localmente com grep primeiro.

---

**Fim do Plan v1.** Pronto para review #1 com foco em fechar os 13 GAPs listados (especialmente E2E suite expandida, runbooks rollback/secrets-rotation, deploy-*.yml, .env.example raiz).
