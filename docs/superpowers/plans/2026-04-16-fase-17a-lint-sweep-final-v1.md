# Fase 17A — Lint Sweep Final (plan v1)

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps com `- [ ]`.

**Goal:** Zerar todos os warnings de lint no `laura-go/` (`errcheck` 38, `staticcheck` 16, `revive` 145) e destravar o `.golangci.yml` para rodar com perfil amplo e CI verde.

**Architecture:** 6 sprints sequenciais por risco crescente. Sprint A (staticcheck 1-liners) → B (errcheck) → C (SA1019 whatsmeow migration) → D (revive enable) → E (destravar config) → F (docs + tag).

**Tech Stack:** Go 1.26, `golangci-lint v2.11.4`, `errcheck@latest`, `revive@latest`, `whatsmeow v0.0.0-20260305215846` (pacote novo `proto/waE2E`).

---

## File Structure

**Arquivos que serão modificados:**

| Arquivo | Motivo |
|---|---|
| `laura-go/.golangci.yml` | Habilitar errcheck + revive; remover 8 supressões staticcheck |
| `laura-go/internal/services/llm.go` | ST1005 ×1 + S1025 ×1 |
| `laura-go/internal/services/llm_helpers.go` | ST1005 ×2 + errcheck ×2 |
| `laura-go/internal/services/rollover.go` | errcheck ×1 |
| `laura-go/internal/services/score_test.go` | SA1012 ×1 |
| `laura-go/internal/services/rollover_e2e_test.go` | S1039 ×1 |
| `laura-go/internal/services/llm_extra_test.go` | errcheck ×8 |
| `laura-go/internal/handlers/reports.go` | QF1007 ×1 |
| `laura-go/internal/handlers/ops_backup.go` | SA9003 ×1 |
| `laura-go/internal/handlers/categories.go` | errcheck ×1 |
| `laura-go/internal/whatsapp/client.go` | SA1019 ×3 (migração waE2E) |
| `laura-go/internal/whatsapp/instance_manager.go` | SA1019 ×2 + SA9003 ×1 + QF1003 ×2 |
| `laura-go/internal/whatsapp/client_test.go` | errcheck ×1 |
| `laura-go/internal/pluggy/client.go` | errcheck ×3 |
| `laura-go/internal/bootstrap/db_test.go` | errcheck ×3 |
| `laura-go/internal/cache/memory_test.go` | errcheck ×8 |
| `laura-go/internal/cache/invalidate_test.go` | errcheck ×6 |
| `laura-go/internal/cache/cache_test.go` | errcheck ×1 |
| `laura-go/internal/cache/cache_bench_test.go` | errcheck ×2 |
| `laura-go/internal/obs/metrics_integration_test.go` | errcheck ×2 |
| `docs/architecture/adr/001-golangci-lint-aguarda-v2.md` | Encerramento |
| `docs/architecture/adr/004-whatsmeow-proto-migration.md` | Novo |
| `docs/architecture/adr/005-revive-profile.md` | Novo |
| `docs/HANDOFF.md` | Seção Fase 17A |
| `_bmad-output/project-context.md` | Snapshot |

**Memory novo:**
- `.claude/.../memory/phase_17a_complete.md`

---

## Sprint A — Staticcheck 1-liners

### Task A.0: Instalar/validar ferramentas

**Files:** (ambiente)

- [ ] **Step 1: Verificar golangci-lint v2.11.4**

```bash
export PATH="$HOME/go/bin:$PATH"
golangci-lint version 2>&1 | head -1
```

Esperado: `golangci-lint has version 2.11.4`. Se ausente: `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.4`.

- [ ] **Step 2: Verificar errcheck**

```bash
which errcheck || go install github.com/kisielk/errcheck@latest
```

- [ ] **Step 3: Verificar revive**

```bash
which revive || go install github.com/mgechev/revive@latest
```

- [ ] **Step 4: Baseline staticcheck full**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | tee /tmp/sc-before.out | tail -5
```

Esperado: `16 issues` (SA1019 ×5, ST1005 ×3, SA9003 ×2, QF1003 ×2, SA1012 ×1, S1039 ×1, S1025 ×1, QF1007 ×1).

### Task A.1: Fix ST1005 ×3

**Files:**
- Modify: `laura-go/internal/services/llm.go:223`
- Modify: `laura-go/internal/services/llm_helpers.go:174,180`

- [ ] **Step 1: Ler contexto de cada ocorrência**

```bash
cd laura-go && sed -n '220,226p' internal/services/llm.go
sed -n '170,185p' internal/services/llm_helpers.go
```

- [ ] **Step 2: Aplicar fix em `internal/services/llm.go:223`**

```go
// antes
return "", fmt.Errorf("Google AI API key não configurada")
// depois
return "", fmt.Errorf("google AI API key não configurada")
```

- [ ] **Step 3: Aplicar fix em `internal/services/llm_helpers.go:174`**

```go
// antes
return "", fmt.Errorf("Whisper API unreachable: %v", err)
// depois
return "", fmt.Errorf("whisper API unreachable: %v", err)
```

- [ ] **Step 4: Aplicar fix em `internal/services/llm_helpers.go:180`**

```go
// antes
return "", fmt.Errorf("Whisper API error (status %d): %s", resp.StatusCode, respBody)
// depois
return "", fmt.Errorf("whisper API error (status %d): %s", resp.StatusCode, respBody)
```

- [ ] **Step 5: Validar**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep ST1005 | wc -l
```

Esperado: `0`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/services/llm.go laura-go/internal/services/llm_helpers.go
git commit -m "lint(services): ST1005 error strings minúsculas"
```

### Task A.2: Fix SA9003 ×2

**Files:**
- Modify: `laura-go/internal/handlers/ops_backup.go:42`
- Modify: `laura-go/internal/whatsapp/instance_manager.go:235`

- [ ] **Step 1: Ler contexto**

```bash
cd laura-go && sed -n '38,50p' internal/handlers/ops_backup.go
sed -n '230,245p' internal/whatsapp/instance_manager.go
```

- [ ] **Step 2: Decisão caso-a-caso**

Se branch vazio é placeholder: remover. Se é intencional (futuro log/métrica): substituir por comentário explícito:
```go
// TODO(ops): considerar métrica de backup failure em Fase 18
_ = nil
```

- [ ] **Step 3: Aplicar fix**

Padrão default: remover branch vazio (else sem código).

- [ ] **Step 4: Validar**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep SA9003 | wc -l
```

Esperado: `0`.

- [ ] **Step 5: Commit**

```bash
git add laura-go/internal/handlers/ops_backup.go laura-go/internal/whatsapp/instance_manager.go
git commit -m "lint(handlers+whatsapp): SA9003 remover branch vazio"
```

### Task A.3: Fix QF1003 ×2

**Files:**
- Modify: `laura-go/internal/whatsapp/instance_manager.go:169,326`

- [ ] **Step 1: Ler contexto linha 169**

```bash
cd laura-go && sed -n '165,185p' internal/whatsapp/instance_manager.go
```

- [ ] **Step 2: Converter if/else para switch**

```go
// antes
if evt.Event == "code" {
    // ...
} else if evt.Event == "timeout" {
    // ...
}
// depois
switch evt.Event {
case "code":
    // ...
case "timeout":
    // ...
}
```

- [ ] **Step 3: Ler contexto linha 326**

```bash
sed -n '320,335p' internal/whatsapp/instance_manager.go
```

- [ ] **Step 4: Converter**

```go
// antes
if status == "connected" {
    // ...
} else if status == "disconnected" {
    // ...
}
// depois
switch status {
case "connected":
    // ...
case "disconnected":
    // ...
}
```

- [ ] **Step 5: Validar build + lint**

```bash
cd laura-go && go build ./... && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep QF1003 | wc -l
```

Esperado: `0`.

- [ ] **Step 6: Commit**

```bash
git add laura-go/internal/whatsapp/instance_manager.go
git commit -m "lint(whatsapp): QF1003 usar tagged switch"
```

### Task A.4: Fix SA1012

**Files:**
- Modify: `laura-go/internal/services/score_test.go:156`

- [ ] **Step 1: Ler contexto**

```bash
cd laura-go && sed -n '150,160p' internal/services/score_test.go
```

- [ ] **Step 2: Substituir nil por context.TODO()**

```go
// antes
f := ComputeScoreFactors(nil, "any-ws")
// depois
f := ComputeScoreFactors(context.TODO(), "any-ws")
```

- [ ] **Step 3: Verificar import de context**

```bash
grep -n '^import\|"context"' internal/services/score_test.go | head -5
```

Se ausente: adicionar `"context"` ao import block.

- [ ] **Step 4: Validar build + lint**

```bash
cd laura-go && go test -short ./internal/services/ -run TestComputeScoreFactors -v
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep SA1012 | wc -l
```

Esperado test PASS; lint `0`.

- [ ] **Step 5: Commit**

```bash
git add laura-go/internal/services/score_test.go
git commit -m "lint(services): SA1012 context.TODO em vez de nil"
```

### Task A.5: Fix S1039

**Files:**
- Modify: `laura-go/internal/services/rollover_e2e_test.go:347`

- [ ] **Step 1: Ler contexto**

```bash
cd laura-go && sed -n '345,350p' internal/services/rollover_e2e_test.go
```

- [ ] **Step 2: Remover Sprintf redundante**

```go
// antes
_ = fmt.Sprintf("E2E smoke ok")
// depois
_ = "E2E smoke ok"
```

Ou remover a linha se for dead code.

- [ ] **Step 3: Validar**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep S1039 | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/services/rollover_e2e_test.go
git commit -m "lint(services): S1039 remover fmt.Sprintf redundante"
```

### Task A.6: Fix S1025

**Files:**
- Modify: `laura-go/internal/services/llm.go:275`

- [ ] **Step 1: Ler contexto**

```bash
cd laura-go && sed -n '270,280p' internal/services/llm.go
```

- [ ] **Step 2: Remover Sprintf redundante**

```go
// antes
return fmt.Sprintf("%s", mustGetenv(key))
// depois
return mustGetenv(key)
```

- [ ] **Step 3: Validar**

```bash
cd laura-go && go build ./... && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep S1025 | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/services/llm.go
git commit -m "lint(services): S1025 remover fmt.Sprintf(%s) redundante"
```

### Task A.7: Fix QF1007

**Files:**
- Modify: `laura-go/internal/handlers/reports.go:41`

- [ ] **Step 1: Ler contexto**

```bash
cd laura-go && sed -n '38,50p' internal/handlers/reports.go
```

- [ ] **Step 2: Merge assignment**

```go
// antes (provável padrão)
var useExplicit bool
useExplicit = false
// depois
useExplicit := false
```

Ou, se o literal já é `useExplicit := false` seguido de reatribuição, merge conforme mensagem golangci.

- [ ] **Step 3: Validar**

```bash
cd laura-go && go build ./... && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep QF1007 | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/handlers/reports.go
git commit -m "lint(handlers): QF1007 merge declaration+assignment"
```

### Task A.8: Validação Sprint A

- [ ] **Step 1: Run staticcheck full, deve ter apenas SA1019 ×5**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | tee /tmp/sc-after-sprintA.out
grep -oE "(SA[0-9]+|ST[0-9]+|QF[0-9]+|S[0-9]+)" /tmp/sc-after-sprintA.out | sort | uniq -c
```

Esperado: apenas `SA1019 ×5`. Total: `5 issues`.

- [ ] **Step 2: go test -short**

```bash
cd laura-go && go test -short ./... 2>&1 | tail -10
```

Esperado: todos os pacotes PASS (ou com mesmo estado baseline de pré-Sprint A).

---

## Sprint B — errcheck

### Task B.0: Baseline errcheck

- [ ] **Step 1: Snapshot**

```bash
export PATH="$HOME/go/bin:$PATH"
cd laura-go && errcheck ./... 2>&1 | tee /tmp/errcheck-before.out | wc -l
```

Esperado: `38`.

### Task B.1: Fix errcheck `pluggy/client.go` ×3

**Files:**
- Modify: `laura-go/internal/pluggy/client.go`

- [ ] **Step 1: Identificar linhas exatas**

```bash
grep -n ":" /tmp/errcheck-before.out | grep pluggy/client.go
```

- [ ] **Step 2: Para cada linha, wrappear em defer seguro**

Padrão típico:
```go
// antes
resp.Body.Close()
// depois
defer func() { _ = resp.Body.Close() }()
```

Ou se o call já está em defer:
```go
// antes
defer resp.Body.Close()
// depois
defer func() { _ = resp.Body.Close() }()
```

- [ ] **Step 3: Validar**

```bash
cd laura-go && errcheck ./internal/pluggy/... 2>&1 | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/pluggy/client.go
git commit -m "lint(pluggy): errcheck close Body em defer seguro"
```

### Task B.2: Fix errcheck `services/llm_helpers.go` ×2

**Files:**
- Modify: `laura-go/internal/services/llm_helpers.go`

- [ ] **Step 1: Identificar linhas**

```bash
grep "services/llm_helpers.go" /tmp/errcheck-before.out
```

- [ ] **Step 2: Aplicar padrão defer seguro (mesmo de B.1)**

- [ ] **Step 3: Validar**

```bash
cd laura-go && errcheck ./internal/services/... 2>&1 | grep llm_helpers.go | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/services/llm_helpers.go
git commit -m "lint(services): errcheck llm_helpers close Body seguro"
```

### Task B.3: Fix errcheck `services/rollover.go` ×1

**Files:**
- Modify: `laura-go/internal/services/rollover.go`

- [ ] **Step 1: Identificar linha**

```bash
grep "services/rollover.go" /tmp/errcheck-before.out
```

- [ ] **Step 2: Analisar caso**

Ler ±5 linhas de contexto. Decidir:
- Se erro de log/metric → `_ = call()` + comentário 1-liner explicando.
- Se erro de query/persistência → **propagar** (mudar assinatura se necessário).

- [ ] **Step 3: Aplicar fix conforme análise**

- [ ] **Step 4: Validar build + test**

```bash
cd laura-go && go build ./... && go test -short ./internal/services/ -run TestRollover -v | tail -5
```

Esperado: build OK, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add laura-go/internal/services/rollover.go
git commit -m "lint(services): errcheck rollover tratar retorno"
```

### Task B.4: Fix errcheck `handlers/categories.go` ×1

**Files:**
- Modify: `laura-go/internal/handlers/categories.go`

- [ ] **Step 1: Identificar + analisar**

Mesmo processo de B.3.

- [ ] **Step 2: Aplicar fix**

- [ ] **Step 3: Validar**

```bash
cd laura-go && go build ./... && errcheck ./internal/handlers/... 2>&1 | grep categories.go | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/handlers/categories.go
git commit -m "lint(handlers): errcheck categories tratar retorno"
```

### Task B.5: Fix errcheck cache tests (17 warnings)

**Files:**
- Modify: `laura-go/internal/cache/memory_test.go` (8)
- Modify: `laura-go/internal/cache/invalidate_test.go` (6)
- Modify: `laura-go/internal/cache/cache_test.go` (1)
- Modify: `laura-go/internal/cache/cache_bench_test.go` (2)

- [ ] **Step 1: Sample das linhas**

```bash
grep "internal/cache" /tmp/errcheck-before.out
```

Padrão típico esperado: `c.Set(ctx, "k", []byte("v"), time.Minute)` retornando error ignorado.

- [ ] **Step 2: Aplicar fix — `require.NoError` se testify já no arquivo**

Para cada chamada:
```go
// antes
c.Set(ctx, "k", []byte("v"), time.Minute)
// depois (com testify)
require.NoError(t, c.Set(ctx, "k", []byte("v"), time.Minute))
```

- [ ] **Step 3: Se testify não importa, usar `_ =`**

```go
_ = c.Set(ctx, "k", []byte("v"), time.Minute)
```

- [ ] **Step 4: Validar**

```bash
cd laura-go && go test -short ./internal/cache/... -count=1 2>&1 | tail -5
errcheck ./internal/cache/... 2>&1 | wc -l
```

Esperado: tests PASS, errcheck `0`.

- [ ] **Step 5: Commit**

```bash
git add laura-go/internal/cache/
git commit -m "lint(cache): errcheck tests require.NoError em Set/GetOrCompute"
```

### Task B.6: Fix errcheck `services/llm_extra_test.go` (8)

**Files:**
- Modify: `laura-go/internal/services/llm_extra_test.go`

- [ ] **Step 1: Identificar padrão**

```bash
grep "llm_extra_test.go" /tmp/errcheck-before.out
```

- [ ] **Step 2: Aplicar padrão testify/`_ =`** (mesmo de B.5)

- [ ] **Step 3: Validar**

```bash
cd laura-go && go test -short ./internal/services/ -run TestLLM -v | tail -5
errcheck ./internal/services/... 2>&1 | grep llm_extra_test.go | wc -l
```

Esperado: PASS + `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/services/llm_extra_test.go
git commit -m "lint(services): errcheck llm_extra_test"
```

### Task B.7: Fix errcheck restantes (bootstrap + obs + whatsapp tests)

**Files:**
- Modify: `laura-go/internal/bootstrap/db_test.go` (3)
- Modify: `laura-go/internal/obs/metrics_integration_test.go` (2)
- Modify: `laura-go/internal/whatsapp/client_test.go` (1)

- [ ] **Step 1: Identificar padrões**

```bash
grep -E "bootstrap|metrics_integration|whatsapp/client_test" /tmp/errcheck-before.out
```

- [ ] **Step 2: Aplicar fixes caso-a-caso**

Padrão `os.Setenv/Unsetenv` em bootstrap tests: `_ = os.Setenv(...)` com comentário.

- [ ] **Step 3: Validar**

```bash
cd laura-go && go test -short ./internal/bootstrap/ ./internal/obs/ ./internal/whatsapp/ 2>&1 | tail -5
errcheck ./internal/bootstrap/... ./internal/obs/... ./internal/whatsapp/... 2>&1 | wc -l
```

Esperado: tests PASS + `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/bootstrap/db_test.go \
        laura-go/internal/obs/metrics_integration_test.go \
        laura-go/internal/whatsapp/client_test.go
git commit -m "lint(bootstrap+obs+whatsapp): errcheck tests restantes"
```

### Task B.8: Ativar errcheck no `.golangci.yml`

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Adicionar errcheck nos linters**

```yaml
linters:
  default: none
  enable:
    - errcheck       # <-- adicionar
    - govet
    - ineffassign
    - staticcheck
  settings:
    errcheck:
      check-type-assertions: false
      check-blank: false
      exclude-functions:
        - (io.Closer).Close
        - os.Setenv
        - os.Unsetenv
    staticcheck:
      # ... (mantém por enquanto, destravaremos no Sprint E)
```

- [ ] **Step 2: Run golangci-lint completo**

```bash
cd laura-go && golangci-lint run --timeout 5m 2>&1 | tee /tmp/golangci-after-B.out | tail -20
```

Esperado: 0 warnings errcheck; mantém SA1019 ×5 silenciado.

- [ ] **Step 3: Se vazar algum errcheck residual, fixar e voltar step 2**

- [ ] **Step 4: Commit**

```bash
git add laura-go/.golangci.yml
git commit -m "lint(ci): habilitar errcheck no golangci-lint"
```

---

## Sprint C — SA1019 whatsmeow migration

### Task C.0: Baseline teste whatsmeow

- [ ] **Step 1: Confirmar Postgres local up**

```bash
docker ps --format "{{.Names}}\t{{.Status}}" | grep postgres
```

Esperado: `infrastructure-postgres-1 Up ... (healthy)`.

- [ ] **Step 2: Export TEST_DATABASE_URL**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
```

- [ ] **Step 3: Rodar test regression container**

```bash
cd laura-go && go test ./internal/whatsapp/ -run "TestContainer" -v 2>&1 | tail -10
```

Esperado: PASS (valida `sqlstore.New + Container.Upgrade` cria tabelas `whatsmeow_*`).

- [ ] **Step 4: Coverage baseline**

```bash
cd laura-go && go test -short ./internal/whatsapp/... -cover 2>&1 | tail -3
```

Esperado: `coverage: 16.2%` (ou valor Fase 16).

### Task C.1: Migrar `client.go`

**Files:**
- Modify: `laura-go/internal/whatsapp/client.go`

- [ ] **Step 1: Ler imports atuais**

```bash
cd laura-go && sed -n '1,30p' internal/whatsapp/client.go
```

- [ ] **Step 2: Trocar import**

```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
```

- [ ] **Step 3: Ler callsites linhas 229 e 264**

```bash
sed -n '225,235p' internal/whatsapp/client.go
sed -n '260,270p' internal/whatsapp/client.go
```

- [ ] **Step 4: Substituir `waProto.Message` por `waE2E.Message`**

Replace-all no arquivo:
```go
&waProto.Message{ -> &waE2E.Message{
```

- [ ] **Step 5: Validar build**

```bash
cd laura-go && go build ./internal/whatsapp/ 2>&1 | head -20
```

Esperado: sem erros. Se houver erro de tipo (ex.: campo renomeado), ler erro e ajustar.

- [ ] **Step 6: Validar vet**

```bash
cd laura-go && go vet ./internal/whatsapp/...
```

Esperado: sem saída (sem issues).

### Task C.2: Migrar `instance_manager.go`

**Files:**
- Modify: `laura-go/internal/whatsapp/instance_manager.go`

- [ ] **Step 1: Trocar import (linha 19)**

Mesmo padrão de C.1.

- [ ] **Step 2: Substituir `waProto.Message` no callsite 278**

- [ ] **Step 3: Validar build**

```bash
cd laura-go && go build ./internal/whatsapp/
```

### Task C.3: Validar testes whatsapp

- [ ] **Step 1: Short tests**

```bash
cd laura-go && go test -short ./internal/whatsapp/... -cover 2>&1 | tail -5
```

Esperado: PASS + coverage ≥16% (sem regressão).

- [ ] **Step 2: Smoke test integração**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
cd laura-go && go test ./internal/whatsapp/ -run "TestContainer" -v 2>&1 | tail -10
```

Esperado: PASS.

- [ ] **Step 3: staticcheck zero SA1019**

```bash
cd laura-go && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep SA1019 | wc -l
```

Esperado: `0`.

### Task C.4: Commit Sprint C

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/whatsapp/client.go laura-go/internal/whatsapp/instance_manager.go
git commit -m "lint(whatsapp): SA1019 migrar binary/proto para proto/waE2E"
```

---

## Sprint D — revive enable

### Task D.1: Habilitar revive no `.golangci.yml`

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Adicionar revive**

```yaml
linters:
  default: none
  enable:
    - errcheck
    - govet
    - ineffassign
    - revive          # <-- adicionar
    - staticcheck
  settings:
    # ... errcheck e staticcheck inalterados
    revive:
      severity: error
      confidence: 0.8
      rules:
        - name: error-strings
        - name: error-naming
        - name: error-return
        - name: errorf
        - name: if-return
        - name: var-declaration
        - name: receiver-naming
        - name: time-naming
        - name: unexported-return
        - name: indent-error-flow
        - name: increment-decrement
        - name: range
        - name: superfluous-else
        - name: unreachable-code
```

- [ ] **Step 2: Dry-run**

```bash
cd laura-go && golangci-lint run --default none --enable revive --timeout 5m 2>&1 | tee /tmp/revive-after.out | tail -10
wc -l /tmp/revive-after.out
```

Esperado: contagem baixa (0-30). Se >50, reavaliar perfil.

### Task D.2: Fix warnings revive remanescentes

- [ ] **Step 1: Ler warnings por arquivo**

```bash
cat /tmp/revive-after.out | head -40
```

- [ ] **Step 2: Para cada warning, aplicar fix mecânico**

Exemplos por regra:
- `error-strings`: lowercase + sem ponto final.
- `if-return`: `if err != nil { return err }; return nil` → `return err`.
- `indent-error-flow`: remover else após return.
- `superfluous-else`: mesmo padrão.
- `increment-decrement`: `x += 1` → `x++`.
- `range`: `for _ = range s` → `for range s`.

- [ ] **Step 3: Validar**

```bash
cd laura-go && golangci-lint run --default none --enable revive --timeout 5m 2>&1 | tail -5
```

Esperado: `0 issues`.

### Task D.3: Commit Sprint D

- [ ] **Step 1: Commit**

```bash
git add laura-go/.golangci.yml laura-go/
git commit -m "lint(ci): habilitar revive com perfil seletivo (ADR 005)"
```

---

## Sprint E — Destravar `.golangci.yml`

### Task E.1: Remover supressões staticcheck desnecessárias

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Editar staticcheck.checks**

**Antes:**
```yaml
staticcheck:
  checks:
    - "all"
    - "-ST1000" - "-ST1003" - "-ST1005" - "-ST1020" - "-ST1021" - "-ST1022"
    - "-SA1012" - "-SA1019" - "-SA9003"
    - "-QF1003" - "-QF1007" - "-QF1008"
    - "-S1025" - "-S1039"
```

**Depois:**
```yaml
staticcheck:
  checks:
    - "all"
    # ADR 005 — godoc/naming não exigidos:
    - "-ST1000"  # package godoc
    - "-ST1003"  # naming (PT-BR acronyms) - reavaliar 17B
    - "-ST1020"  # godoc exported
    - "-ST1021"  # godoc type
    - "-ST1022"  # godoc var
    # Estilística caso-a-caso:
    - "-QF1008"  # embedded fields - legibilidade subjetiva
```

- [ ] **Step 2: Run final golangci-lint**

```bash
cd laura-go && golangci-lint run --timeout 5m 2>&1 | tee /tmp/golangci-final.out | tail -20
```

Esperado: `0 issues`. Se não for, voltar ao Sprint correspondente.

### Task E.2: Smoke local end-to-end

- [ ] **Step 1: Build + vet + test**

```bash
cd laura-go && go build ./... && go vet ./... && go test -short ./... 2>&1 | tail -10
```

Esperado: OK.

- [ ] **Step 2: Test integração whatsapp**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
cd laura-go && go test ./internal/whatsapp/ -run "TestContainer" -v 2>&1 | tail -5
```

Esperado: PASS.

### Task E.3: Commit Sprint E

- [ ] **Step 1: Commit**

```bash
git add laura-go/.golangci.yml
git commit -m "lint(ci): destravar golangci-lint (supressoes 14 -> 6)"
```

---

## Sprint F — Docs + tag

### Task F.1: Validar lefthook

- [ ] **Step 1: Simular pre-commit em arquivo lint**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
lefthook run pre-commit --files laura-go/internal/services/llm.go 2>&1 | tail -10
```

Esperado: PASS.

- [ ] **Step 2: Se FAIL, diagnosticar**

Se comando legacy golangci v1: atualizar `lefthook.yml`. (Não esperado — já é v2 compatível.)

### Task F.2: Encerrar ADR 001

**Files:**
- Modify: `docs/architecture/adr/001-golangci-lint-aguarda-v2.md`

- [ ] **Step 1: Ler ADR existente**

```bash
cat docs/architecture/adr/001-golangci-lint-aguarda-v2.md | head -30
```

- [ ] **Step 2: Adicionar seção Encerramento no fim**

```markdown
## Encerramento — 2026-04-16

**Status:** RESOLVIDO.

- golangci-lint v2.11.4 ativo desde Fase 16 (commit 9c8cf85).
- Cleanup completo dos 199 warnings pré-existentes (errcheck 38,
  staticcheck 16, revive 145) entregue na Fase 17A.
- `.golangci.yml` destravado: supressões 14 → 6, todas documentadas
  inline com motivo.
- ADR supersedido por ADR 004 (whatsmeow proto migration) + ADR 005
  (revive profile).
```

- [ ] **Step 3: Commit parcial**

```bash
git add docs/architecture/adr/001-golangci-lint-aguarda-v2.md
git commit -m "docs(adr): encerrar ADR 001 golangci-lint v2 wait"
```

### Task F.3: Criar ADR 004

**Files:**
- Create: `docs/architecture/adr/004-whatsmeow-proto-migration.md`

- [ ] **Step 1: Escrever ADR**

```markdown
# ADR 004 — whatsmeow proto migration (binary/proto → proto/waE2E)

**Status:** ACEITO 2026-04-16.

## Contexto

Staticcheck SA1019 reportava 5 warnings por uso de
`go.mau.fi/whatsmeow/binary/proto` (deprecated). Pacote
`go.mau.fi/whatsmeow/proto/waE2E` já está disponível em
`whatsmeow v0.0.0-20260305215846-fc65416c22c4` com as mesmas
structs (ex.: `Message{Conversation, ExtendedTextMessage, ...}`).

## Decisão

Migrar os 5 callsites (client.go ×3, instance_manager.go ×2) para
`waE2E`:

```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
waProto.Message{...}
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
waE2E.Message{...}
```

## Consequências

- Zero SA1019 remanescente.
- Alinhamento com upstream; sem risco em remoção futura de
  `binary/proto`.
- Cobertura whatsapp (Fase 16: 16.2%) mantida; teste regression
  `TestContainer` valida schema sqlstore intacto.

## Alternativas consideradas

- Manter `binary/proto` com supressão SA1019 permanente. Rejeitado:
  dívida crescente conforme upstream remove pacote legacy.
- Aguardar whatsmeow vX.Y com nova API unificada. Rejeitado: sem
  sinal de roadmap; `proto/waE2E` já é estável.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/adr/004-whatsmeow-proto-migration.md
git commit -m "docs(adr): ADR 004 whatsmeow proto migration aceito"
```

### Task F.4: Criar ADR 005

**Files:**
- Create: `docs/architecture/adr/005-revive-profile.md`

- [ ] **Step 1: Escrever ADR**

```markdown
# ADR 005 — revive profile seletivo

**Status:** ACEITO 2026-04-16.

## Contexto

`revive` com perfil default reportava **145 warnings**, dos quais
~140 eram `exported X should have comment or be unexported`
(pacotes: migrations, db, cache, bootstrap, obs, handlers, services,
whatsapp, pluggy). Adicionar doc comments em todos teria custo alto
(~140 edits) e retorno proporcionalmente baixo: o projeto não é
SDK público, a API exposta é só o Fiber app.

## Decisão

Adotar perfil revive **seletivo**, excluindo regras de documentação
e deixando apenas regras de estilo de erro/retorno:

**Regras ativas:**
- `error-strings`, `error-naming`, `error-return`, `errorf`
- `if-return`, `indent-error-flow`, `superfluous-else`
- `var-declaration`, `receiver-naming`, `time-naming`
- `unexported-return`, `increment-decrement`, `range`,
  `unreachable-code`

**Regras excluídas:**
- `exported` — documentação de símbolos exportados.
- `package-comments` — godoc header de pacote.
- `var-naming` — já coberto por `staticcheck ST1003/ST1020-1022`.

## Consequências

- Lint rápido no CI (~30s); 0 warnings revive.
- Dívida de documentação assumida explicitamente; reavaliar quando
  abrir código para terceiros ou lançar SDK cliente.
- Config revive vive **inline** no `.golangci.yml` (sem arquivo
  `.revive.toml` separado).

## Alternativas consideradas

- Adicionar ~140 doc comments cobrindo todos exportados. Rejeitado
  por custo/benefício baixo no estágio atual.
- Deixar revive desligado. Rejeitado: perderia regras valiosas de
  estilo de erro (error-strings, indent-error-flow, etc.).
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/adr/005-revive-profile.md
git commit -m "docs(adr): ADR 005 revive profile seletivo aceito"
```

### Task F.5: Atualizar HANDOFF.md

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Adicionar seção no topo do "Histórico de atualizações"**

```markdown
### 2026-04-16 — Fase 17A preparada (lint sweep final)

- **errcheck 38 → 0** — 7 fixes prod (pluggy, llm_helpers, rollover,
  categories) + 31 fixes test (cache, services/llm_extra,
  bootstrap, obs, whatsapp).
- **staticcheck 16 → 0** — SA1019 migração whatsmeow
  binary/proto → proto/waE2E (5 callsites em client.go +
  instance_manager.go); 10 fixes 1-liner (ST1005 ×3, SA9003 ×2,
  QF1003 ×2, SA1012, S1039, S1025, QF1007).
- **revive habilitado** com perfil seletivo inline no
  `.golangci.yml` (14 regras, 0 warnings). ADR 005.
- **`.golangci.yml` destravado** — supressões 14 → 6 (−57%).
- **ADRs**: 001 encerrado (golangci-lint v2 wait resolvido), 004
  aceito (whatsmeow proto migration), 005 aceito (revive profile).
- **CI verde** no push pós-Sprint E; gate coverage 30% mantido.
- **Tag**: `phase-17a-prepared`.
- **Concerns Fase 17B+**: mobile native foundation, multi-region
  read replica, PWA E2E expansão, ST1003 PT-BR acronyms reavaliar.
```

- [ ] **Step 2: Atualizar "Estado atual" se presente**

- [ ] **Step 3: Commit (agregado com F.6)**

### Task F.6: Atualizar `_bmad-output/project-context.md`

**Files:**
- Modify: `_bmad-output/project-context.md`

- [ ] **Step 1: Localizar seção de status/fases**

```bash
grep -n "Fase 16\|phase-16" _bmad-output/project-context.md | head -5
```

- [ ] **Step 2: Adicionar entrada Fase 17A (resumo curto)**

Frase condensada, 3-5 linhas max.

- [ ] **Step 3: Commit combinado com F.5**

```bash
git add docs/HANDOFF.md _bmad-output/project-context.md
git commit -m "docs(handoff+context): Fase 17A lint sweep preparada"
```

### Task F.7: Gravar memory `phase_17a_complete.md`

**Files:**
- Create: `.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/phase_17a_complete.md`

- [ ] **Step 1: Escrever memory**

```markdown
---
name: phase_17a_complete
description: Fase 17A (lint sweep final) preparada 2026-04-16 com 199 warnings zerados e .golangci.yml destravado
type: project
---

Fase 17A entregue em 2026-04-16. Lint sweep final:

- errcheck 38 → 0 | staticcheck 16 → 0 | revive 145 → 0 (perfil
  seletivo) = 199 → 0.
- SA1019 whatsmeow: migração binary/proto → proto/waE2E (5 callsites).
- .golangci.yml destravado: supressões 14 → 6.
- ADRs: 001 encerrado, 004 + 005 aceitos.
- Tag `phase-17a-prepared`.

**Why:** fechar dívida técnica acumulada desde Fase 14 (ADR 001
bloqueou golangci-lint v2 até Go 1.26 support existir) e do
escopo defensivo da Fase 16.

**How to apply:** próximas fases podem confiar em lint CI verde
end-to-end. Fase 17B (PWA E2E), 17C (mobile foundation), 17D
(multi-region) seguem em plans separados.
```

- [ ] **Step 2: Atualizar MEMORY.md index**

```bash
# adicionar linha:
# - [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005
```

### Task F.8: Validação final + push

- [ ] **Step 1: Validar árvore limpa**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git status
```

Esperado: `nothing to commit, working tree clean`.

- [ ] **Step 2: Log final**

```bash
git log --oneline -15
```

Esperado: série de commits `lint(*): ...` + `docs(adr/handoff): ...`.

- [ ] **Step 3: Tag**

```bash
git tag phase-17a-prepared
git tag --list "phase-17a*"
```

Esperado: `phase-17a-prepared`.

- [ ] **Step 4: Push**

```bash
git push origin master && git push origin phase-17a-prepared
```

- [ ] **Step 5: Aguardar CI verde**

Monitorar `gh run watch` na última run ou conferir `gh run list --limit 3`.

Esperado: todos os jobs `go-ci.yml` verdes.

- [ ] **Step 6: Checar coverage merged ≥30%**

```bash
gh run view --log 2>&1 | grep -E "merged coverage|coverage:" | tail -5
```

Esperado: `merged coverage: XX%` ≥ 30.

---

## Critérios globais de conclusão

- [ ] `golangci-lint run --timeout 5m` local → `0 issues`.
- [ ] `go test -short ./...` → todos PASS; sem regressão de cobertura.
- [ ] CI `go-ci.yml` verde no push final.
- [ ] Gate `coverage-gate` (main only) ≥30%.
- [ ] 3 ADRs atualizados (001 encerrado, 004, 005 novos).
- [ ] HANDOFF, project-context, memory gravados.
- [ ] Tag `phase-17a-prepared` no remoto.
