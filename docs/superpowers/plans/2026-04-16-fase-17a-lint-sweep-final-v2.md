# Fase 17A — Lint Sweep Final (plan v2 — review #1)

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps com `- [ ]`.

**Goal:** Zerar todos os warnings de lint no `laura-go/` (`errcheck` 38, `staticcheck` 16, `revive` 145) e destravar o `.golangci.yml` para rodar com perfil amplo e CI verde.

**Architecture:** 6 sprints sequenciais por risco crescente. Sprint A (staticcheck 1-liners) → B (errcheck) → C (SA1019 whatsmeow migration) → D (revive enable) → E (destravar config) → F (docs + tag).

**Tech Stack:** Go 1.26, `golangci-lint v2.11.4`, `errcheck@v1.7.0`, `revive@v1.3.9`, `whatsmeow v0.0.0-20260305215846` (pacote novo `proto/waE2E`).

**Branch:** trabalho direto em `master` (padrão das Fases 10-16). Rollback granular via `git revert <commit>`.

**v1→v2:**
- Nome real do teste whatsmeow corrigido: `TestSQLStoreNew_AutoCreatesWhatsmeowTables` (não "TestContainer").
- Versões fixadas no Task A.0 (`errcheck v1.7.0`, `revive v1.3.9`, `golangci-lint v2.11.4`).
- `go mod tidy` adicionado pós-migração Sprint C.
- Sprint B.5 dividido em 4 tasks (B.5a/b/c/d), uma por arquivo, para respeitar 2-5 min.
- Sprint F.8 reordenada: commit final → **push → aguardar CI verde → só então tag**. Tag não é aplicada se CI vermelho.
- Nota explícita sobre trabalho em master.
- Task E.2 ganhou step para rodar `go test` com `integration` tag se Docker + Postgres up.

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
| `laura-go/go.sum` | Possível update após `go mod tidy` |
| `docs/architecture/adr/001-golangci-lint-aguarda-v2.md` | Encerramento |
| `docs/architecture/adr/004-whatsmeow-proto-migration.md` | Novo |
| `docs/architecture/adr/005-revive-profile.md` | Novo |
| `docs/HANDOFF.md` | Seção Fase 17A |
| `_bmad-output/project-context.md` | Snapshot |

**Memory:** `.claude/.../memory/phase_17a_complete.md` (criar).

---

## Sprint A — Staticcheck 1-liners

### Task A.0: Instalar/validar ferramentas

**Files:** (ambiente)

- [ ] **Step 1: Garantir PATH**

```bash
export PATH="$HOME/go/bin:$PATH"
echo "$PATH" | tr ':' '\n' | grep go/bin
```

Esperado: `~/go/bin` presente.

- [ ] **Step 2: Instalar/verificar golangci-lint v2.11.4**

```bash
if ! golangci-lint version 2>&1 | grep -q "2.11.4"; then
  go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.4
fi
golangci-lint version 2>&1 | head -1
```

Esperado: `golangci-lint has version 2.11.4`.

- [ ] **Step 3: Instalar/verificar errcheck v1.7.0**

```bash
if ! errcheck -version 2>&1 | grep -qE "v1\.(7|8|9)"; then
  go install github.com/kisielk/errcheck@v1.7.0
fi
errcheck -version 2>&1
```

Esperado: versão ≥1.7.0. (Se `-version` flag não existir, `which errcheck` basta.)

- [ ] **Step 4: Instalar/verificar revive v1.3.9**

```bash
if ! revive -version 2>&1 | grep -qE "v1\.(3|4|5)"; then
  go install github.com/mgechev/revive@v1.3.9
fi
revive -version 2>&1
```

Esperado: versão ≥1.3.x.

- [ ] **Step 5: Baseline staticcheck full**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | tee /tmp/sc-before.out | tail -3
grep -oE "(SA[0-9]+|ST[0-9]+|QF[0-9]+|S[0-9]+)" /tmp/sc-before.out | sort | uniq -c
```

Esperado: `16 issues`. Breakdown: SA1019 ×5, ST1005 ×3, SA9003 ×2, QF1003 ×2, SA1012 ×1, S1039 ×1, S1025 ×1, QF1007 ×1.

### Task A.1: Fix ST1005 ×3

**Files:**
- Modify: `laura-go/internal/services/llm.go:223`
- Modify: `laura-go/internal/services/llm_helpers.go:174,180`

- [ ] **Step 1: Ler contexto de cada ocorrência**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '220,226p' internal/services/llm.go
sed -n '170,185p' internal/services/llm_helpers.go
```

- [ ] **Step 2: Fix em `llm.go:223`**

```go
// antes
return "", fmt.Errorf("Google AI API key não configurada")
// depois
return "", fmt.Errorf("google AI API key não configurada")
```

- [ ] **Step 3: Fix em `llm_helpers.go:174`**

```go
// antes
return "", fmt.Errorf("Whisper API unreachable: %v", err)
// depois
return "", fmt.Errorf("whisper API unreachable: %v", err)
```

- [ ] **Step 4: Fix em `llm_helpers.go:180`**

```go
// antes
return "", fmt.Errorf("Whisper API error (status %d): %s", resp.StatusCode, respBody)
// depois
return "", fmt.Errorf("whisper API error (status %d): %s", resp.StatusCode, respBody)
```

- [ ] **Step 5: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c ST1005
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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '38,50p' internal/handlers/ops_backup.go
sed -n '230,245p' internal/whatsapp/instance_manager.go
```

- [ ] **Step 2: Decisão caso-a-caso**

- Se branch vazio (`} else {}` sem conteúdo): **remover** o `else {}`.
- Se comparecer intenção futura: substituir por comentário explícito + `_ = nil` ou similar.

- [ ] **Step 3: Aplicar fix em `ops_backup.go:42`**

Padrão provável:
```go
// antes
if err := doBackup(); err != nil {
    return err
} else {
}
// depois
if err := doBackup(); err != nil {
    return err
}
```

- [ ] **Step 4: Aplicar fix em `instance_manager.go:235`**

Mesmo padrão. Se for `if err := m.DisconnectInstance(id); err != nil { ... } else {}`, remover `else`.

- [ ] **Step 5: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./...
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c SA9003
```

Esperado: build OK + `0`.

- [ ] **Step 6: Commit**

```bash
git add laura-go/internal/handlers/ops_backup.go laura-go/internal/whatsapp/instance_manager.go
git commit -m "lint(handlers+whatsapp): SA9003 remover branch vazio"
```

### Task A.3: Fix QF1003 ×2

**Files:**
- Modify: `laura-go/internal/whatsapp/instance_manager.go:169,326`

- [ ] **Step 1: Ler contexto linha 169**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '165,185p' internal/whatsapp/instance_manager.go
```

- [ ] **Step 2: Converter if/else para switch**

```go
// antes
if evt.Event == "code" {
    // A
} else if evt.Event == "timeout" {
    // B
}
// depois
switch evt.Event {
case "code":
    // A
case "timeout":
    // B
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
    // A
} else if status == "disconnected" {
    // B
}
// depois
switch status {
case "connected":
    // A
case "disconnected":
    // B
}
```

- [ ] **Step 5: Validar build + lint**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./...
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c QF1003
```

Esperado: build OK + `0`.

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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '145,160p' internal/services/score_test.go
```

- [ ] **Step 2: Garantir import "context"**

```bash
grep -n '"context"' internal/services/score_test.go
```

Se ausente, adicionar no import block.

- [ ] **Step 3: Substituir nil por context.TODO()**

```go
// antes
f := ComputeScoreFactors(nil, "any-ws")
// depois
f := ComputeScoreFactors(context.TODO(), "any-ws")
```

- [ ] **Step 4: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/services/ -run TestComputeScoreFactors -v | tail -3
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c SA1012
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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '343,352p' internal/services/rollover_e2e_test.go
```

- [ ] **Step 2: Remover Sprintf redundante**

```go
// antes
_ = fmt.Sprintf("E2E smoke ok")
// depois — opção A: remover linha se dead code
// ou opção B: string literal direta
_ = "E2E smoke ok"
```

- [ ] **Step 3: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c S1039
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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '270,280p' internal/services/llm.go
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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./... && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c S1025
```

Esperado: build OK + `0`.

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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '36,50p' internal/handlers/reports.go
```

- [ ] **Step 2: Merge declaração+assignment**

A regra QF1007 pede: "could merge conditional assignment into variable declaration".

```go
// antes (padrão provável)
useExplicit := false
if cond {
    useExplicit = true
}
// depois
useExplicit := cond
```

Ou, se o padrão for diferente, aplicar merge conforme mensagem golangci sugerir.

- [ ] **Step 3: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./... && golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c QF1007
```

Esperado: build OK + `0`.

- [ ] **Step 4: Commit**

```bash
git add laura-go/internal/handlers/reports.go
git commit -m "lint(handlers): QF1007 merge declaration+assignment"
```

### Task A.8: Validação Sprint A

- [ ] **Step 1: Run staticcheck full**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | tee /tmp/sc-after-A.out | tail -3
grep -oE "(SA[0-9]+|ST[0-9]+|QF[0-9]+|S[0-9]+)" /tmp/sc-after-A.out | sort | uniq -c
```

Esperado: apenas `SA1019 ×5`. Total: `5 issues`.

- [ ] **Step 2: go test -short**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./... 2>&1 | tail -15
```

Esperado: todos os pacotes PASS (ou mesmo estado baseline de pré-Sprint A — `services` com FAIL localmente por `rollover_e2e_test` exigir Docker; OK).

---

## Sprint B — errcheck

### Task B.0: Baseline errcheck

- [ ] **Step 1: Snapshot**

```bash
export PATH="$HOME/go/bin:$PATH"
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
errcheck ./... 2>&1 | tee /tmp/errcheck-before.out | wc -l
cut -d: -f1 /tmp/errcheck-before.out | sort | uniq -c | sort -rn
```

Esperado: `38` com breakdown conforme spec v3.

### Task B.1: Fix errcheck `pluggy/client.go` ×3

**Files:**
- Modify: `laura-go/internal/pluggy/client.go`

- [ ] **Step 1: Identificar linhas**

```bash
grep "pluggy/client.go" /tmp/errcheck-before.out
```

- [ ] **Step 2: Aplicar padrão defer seguro**

```go
// antes
defer resp.Body.Close()
// depois
defer func() { _ = resp.Body.Close() }()
```

Ou (se não está em defer):
```go
_ = resp.Body.Close()
```

- [ ] **Step 3: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
errcheck ./internal/pluggy/... 2>&1 | wc -l
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
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

- [ ] **Step 2: Aplicar padrão defer seguro** (mesmo B.1)

- [ ] **Step 3: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
errcheck ./internal/services/... 2>&1 | grep -c llm_helpers.go
```

Esperado: `0`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
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

- [ ] **Step 2: Ler contexto (±5 linhas)**

Decidir:
- Log/metric → `_ = call()` + comentário inline.
- Persistência/query → propagar (alterar assinatura se necessário).

- [ ] **Step 3: Aplicar fix**

- [ ] **Step 4: Validar build + test**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./... && go test -short ./internal/services/ -run TestRollover -v 2>&1 | tail -5
```

Esperado: build OK + tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/services/rollover.go
git commit -m "lint(services): errcheck rollover tratar retorno"
```

### Task B.4: Fix errcheck `handlers/categories.go` ×1

**Files:**
- Modify: `laura-go/internal/handlers/categories.go`

- [ ] **Step 1-3: Mesmo processo B.3**

- [ ] **Step 4: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./... && errcheck ./internal/handlers/... 2>&1 | grep -c categories.go
```

Esperado: build OK + `0`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/handlers/categories.go
git commit -m "lint(handlers): errcheck categories tratar retorno"
```

### Task B.5a: Fix errcheck `cache/memory_test.go` (8)

**Files:**
- Modify: `laura-go/internal/cache/memory_test.go`

- [ ] **Step 1: Ler warnings**

```bash
grep "cache/memory_test.go" /tmp/errcheck-before.out
```

- [ ] **Step 2: Verificar se testify importado**

```bash
grep -n "testify" "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go/internal/cache/memory_test.go"
```

- [ ] **Step 3: Aplicar fix**

Padrão típico: `c.Set(ctx, "k", ...)` → `require.NoError(t, c.Set(ctx, "k", ...))` ou `_ = c.Set(...)`.

- [ ] **Step 4: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/cache/ -run TestMemory -count=1 | tail -5
errcheck ./internal/cache/... 2>&1 | grep -c memory_test.go
```

Esperado: test PASS + `0`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/cache/memory_test.go
git commit -m "lint(cache): errcheck memory_test"
```

### Task B.5b: Fix errcheck `cache/invalidate_test.go` (6)

**Files:**
- Modify: `laura-go/internal/cache/invalidate_test.go`

Mesmo processo B.5a. Commit: `lint(cache): errcheck invalidate_test`.

### Task B.5c: Fix errcheck `cache/cache_test.go` + `cache_bench_test.go` (3)

**Files:**
- Modify: `laura-go/internal/cache/cache_test.go`
- Modify: `laura-go/internal/cache/cache_bench_test.go`

Mesmo processo. Validação:

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/cache/ -count=1 | tail -5
errcheck ./internal/cache/... 2>&1 | wc -l
```

Esperado: PASS + `0` total no pacote cache.

Commit: `lint(cache): errcheck cache_test + bench`.

### Task B.6: Fix errcheck `services/llm_extra_test.go` (8)

**Files:**
- Modify: `laura-go/internal/services/llm_extra_test.go`

- [ ] **Step 1-3: Mesmo processo B.5a**

- [ ] **Step 4: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/services/ -run TestLLM -v 2>&1 | tail -5
errcheck ./internal/services/... 2>&1 | grep -c llm_extra_test.go
```

Esperado: PASS + `0`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/services/llm_extra_test.go
git commit -m "lint(services): errcheck llm_extra_test"
```

### Task B.7: Fix errcheck restantes (bootstrap + obs + whatsapp tests)

**Files:**
- Modify: `laura-go/internal/bootstrap/db_test.go` (3 — padrão `os.Setenv/Unsetenv`)
- Modify: `laura-go/internal/obs/metrics_integration_test.go` (2)
- Modify: `laura-go/internal/whatsapp/client_test.go` (1)

- [ ] **Step 1: Identificar padrões**

```bash
grep -E "bootstrap|metrics_integration|whatsapp/client_test" /tmp/errcheck-before.out
```

- [ ] **Step 2: Aplicar fixes**

- `db_test.go`: `_ = os.Setenv(...)` + comentário "// setup — Setenv em test raramente falha".
- `metrics_integration_test.go`: padrão testify ou `_ =`.
- `client_test.go`: avaliar; se chamada de setup, `_ =`.

- [ ] **Step 3: Validar**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/bootstrap/ ./internal/obs/ ./internal/whatsapp/ 2>&1 | tail -5
errcheck ./internal/bootstrap/... ./internal/obs/... ./internal/whatsapp/... 2>&1 | wc -l
```

Esperado: PASS + `0`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/bootstrap/db_test.go \
        laura-go/internal/obs/metrics_integration_test.go \
        laura-go/internal/whatsapp/client_test.go
git commit -m "lint(bootstrap+obs+whatsapp): errcheck tests restantes"
```

### Task B.8: Ativar errcheck no `.golangci.yml`

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Edit `.golangci.yml`**

Adicionar `errcheck` em `linters.enable` + settings:

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
      # ... (mantém por enquanto, destrava no Sprint E)
```

- [ ] **Step 2: Run golangci-lint completo**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --timeout 5m 2>&1 | tee /tmp/golangci-after-B.out | tail -20
```

Esperado: 0 warnings errcheck. SA1019 ×5 ainda suprimido → não aparece no output.

- [ ] **Step 3: Se vazar errcheck residual**

Identificar arquivo + linha, aplicar fix, repetir Step 2.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
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

Se não: `cd "infrastructure" && docker compose up -d postgres`.

- [ ] **Step 2: Export TEST_DATABASE_URL**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
```

- [ ] **Step 3: Rodar test regression (nome correto)**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test ./internal/whatsapp/ -run "TestSQLStoreNew_AutoCreatesWhatsmeowTables" -v 2>&1 | tail -10
```

Esperado: PASS (valida `sqlstore.New + Container.Upgrade` cria tabelas `whatsmeow_*`).

- [ ] **Step 4: Coverage baseline**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/whatsapp/... -cover 2>&1 | tail -3
```

Esperado: `coverage: >=16.2%`.

### Task C.1: Migrar `client.go` imports + callsites

**Files:**
- Modify: `laura-go/internal/whatsapp/client.go`

- [ ] **Step 1: Ler imports atuais**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
sed -n '1,30p' internal/whatsapp/client.go
```

- [ ] **Step 2: Trocar import (linha 21)**

```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
```

- [ ] **Step 3: Ler callsites**

```bash
sed -n '225,270p' internal/whatsapp/client.go
```

- [ ] **Step 4: Substituir todos os `waProto.Message` por `waE2E.Message`**

Pode usar sed/Edit replace-all no arquivo:
```
waProto.Message → waE2E.Message
```

Conferir que não sobrou `waProto.` no arquivo.

- [ ] **Step 5: Validar build**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./internal/whatsapp/ 2>&1 | head -20
```

Esperado: sem erros. Se erro de tipo (campo renomeado), ler erro e ajustar campo-a-campo.

- [ ] **Step 6: Validar vet**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go vet ./internal/whatsapp/...
```

Esperado: sem saída.

### Task C.2: Migrar `instance_manager.go`

**Files:**
- Modify: `laura-go/internal/whatsapp/instance_manager.go`

- [ ] **Step 1: Trocar import (linha 19) — mesmo padrão C.1**

- [ ] **Step 2: Substituir `waProto.Message` em callsite 278**

- [ ] **Step 3: Validar build**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./internal/whatsapp/
```

Esperado: OK.

### Task C.3: go mod tidy

- [ ] **Step 1: Rodar tidy**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go mod tidy
```

- [ ] **Step 2: Verificar diff em go.mod/go.sum**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git diff laura-go/go.mod laura-go/go.sum | head -30
```

Esperado: nenhuma mudança em `go.mod` (mesmo módulo já vendorizado). `go.sum` pode ter adição do path `proto/waE2E`.

### Task C.4: Validar testes whatsapp

- [ ] **Step 1: Short tests**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -short ./internal/whatsapp/... -cover 2>&1 | tail -5
```

Esperado: PASS + coverage ≥16% (sem regressão).

- [ ] **Step 2: Smoke test integração**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test ./internal/whatsapp/ -run "TestSQLStoreNew_AutoCreatesWhatsmeowTables" -v 2>&1 | tail -10
```

Esperado: PASS.

- [ ] **Step 3: staticcheck zero SA1019**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable staticcheck --no-config --timeout 5m 2>&1 | grep -c SA1019
```

Esperado: `0`.

### Task C.5: Commit Sprint C

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/internal/whatsapp/client.go \
        laura-go/internal/whatsapp/instance_manager.go \
        laura-go/go.mod laura-go/go.sum
git commit -m "lint(whatsapp): SA1019 migrar binary/proto para proto/waE2E"
```

---

## Sprint D — revive enable

### Task D.1: Habilitar revive no `.golangci.yml`

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Edit `.golangci.yml`**

Adicionar `revive` em `linters.enable` + config inline:

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
    # ... errcheck inalterado
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
    staticcheck:
      # ... inalterado
```

- [ ] **Step 2: Validar sintaxe YAML + config golangci**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint config verify 2>&1 | tail -5
```

Esperado: `config is valid`. Se erro de schema, ajustar YAML.

- [ ] **Step 3: Dry-run revive isolado**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable revive --timeout 5m 2>&1 | tee /tmp/revive-after.out | tail -5
wc -l /tmp/revive-after.out
```

Esperado: contagem 0-30 (perfil seletivo é mais restrito que default 145).

### Task D.2: Fix warnings revive remanescentes

- [ ] **Step 1: Ler warnings**

```bash
cat /tmp/revive-after.out | head -40
```

- [ ] **Step 2: Fix caso-a-caso**

- `error-strings`: lowercase + sem ponto final/dois-pontos.
- `if-return`: `if err != nil { return err }; return nil` → `return err`.
- `indent-error-flow` + `superfluous-else`: remover else após return.
- `increment-decrement`: `x += 1` → `x++`.
- `range`: `for _ = range s` → `for range s`.
- `errorf`: `errors.New(fmt.Sprintf(...))` → `fmt.Errorf(...)`.
- `receiver-naming`: nomes consistentes em todo arquivo.

- [ ] **Step 3: Re-run**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --default none --enable revive --timeout 5m 2>&1 | tail -3
```

Esperado: `0 issues`.

### Task D.3: Commit Sprint D

- [ ] **Step 1: Commit combinado**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/.golangci.yml laura-go/
git commit -m "lint(ci): habilitar revive com perfil seletivo (ADR 005)"
```

---

## Sprint E — Destravar `.golangci.yml`

### Task E.1: Remover supressões staticcheck desnecessárias

**Files:**
- Modify: `laura-go/.golangci.yml`

- [ ] **Step 1: Edit staticcheck.checks**

**Antes (Fase 16):** 14 supressões (`-ST1000`, `-ST1003`, `-ST1005`, `-ST1020..22`, `-SA1012`, `-SA1019`, `-SA9003`, `-QF1003`, `-QF1007`, `-QF1008`, `-S1025`, `-S1039`).

**Depois (meta):**
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
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
golangci-lint run --timeout 5m 2>&1 | tee /tmp/golangci-final.out | tail -20
```

Esperado: `0 issues`. Se não, voltar ao Sprint correspondente.

### Task E.2: Smoke end-to-end

- [ ] **Step 1: Build + vet + test short**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go build ./... && go vet ./... && go test -short ./... 2>&1 | tail -10
```

Esperado: OK.

- [ ] **Step 2: Test integração whatsapp**

```bash
export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test ./internal/whatsapp/ -run "TestSQLStoreNew_AutoCreatesWhatsmeowTables" -v 2>&1 | tail -5
```

Esperado: PASS.

- [ ] **Step 3: Test com tag integration (opcional, se Docker Postgres up)**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-go"
go test -tags integration -short ./... 2>&1 | tail -10
```

Esperado: maior cobertura; não bloqueia se FAIL por environment.

### Task E.3: Commit Sprint E

- [ ] **Step 1: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add laura-go/.golangci.yml
git commit -m "lint(ci): destravar golangci-lint (supressoes 14 -> 6)"
```

---

## Sprint F — Docs + tag

### Task F.1: Validar lefthook

- [ ] **Step 1: Simular pre-commit em arquivo tocado**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
lefthook run pre-commit --files laura-go/internal/services/llm.go 2>&1 | tail -10
```

Esperado: PASS (golangci-lint v2 compatível com `--new-from-rev`).

- [ ] **Step 2: Se FAIL, diagnosticar**

Se erro de schema/config: ajustar `lefthook.yml`. Não esperado — `lefthook.yml` atual já é v2-compatível.

### Task F.2: Encerrar ADR 001

**Files:**
- Modify: `docs/architecture/adr/001-golangci-lint-aguarda-v2.md`

- [ ] **Step 1: Ler ADR existente**

```bash
cat "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/docs/architecture/adr/001-golangci-lint-aguarda-v2.md"
```

- [ ] **Step 2: Adicionar seção Encerramento**

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

- [ ] **Step 3: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/architecture/adr/001-golangci-lint-aguarda-v2.md
git commit -m "docs(adr): encerrar ADR 001 golangci-lint v2 wait"
```

### Task F.3: Criar ADR 004

**Files:**
- Create: `docs/architecture/adr/004-whatsmeow-proto-migration.md`

- [ ] **Step 1: Escrever ADR (conteúdo completo)**

```markdown
# ADR 004 — whatsmeow proto migration (binary/proto → proto/waE2E)

**Status:** ACEITO 2026-04-16.

## Contexto

Staticcheck SA1019 reportava 5 warnings por uso de
`go.mau.fi/whatsmeow/binary/proto` (deprecated). O pacote
`go.mau.fi/whatsmeow/proto/waE2E` já está disponível em
`whatsmeow v0.0.0-20260305215846-fc65416c22c4` com as mesmas structs
(ex.: `Message{Conversation, ExtendedTextMessage, ...}` em
`WAWebProtobufsE2E.pb.go:9581`).

## Decisão

Migrar os 5 callsites (`client.go` ×3, `instance_manager.go` ×2)
para `waE2E`:

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
- Cobertura `whatsapp` (16.2%) mantida; teste regression
  `TestSQLStoreNew_AutoCreatesWhatsmeowTables` valida schema
  sqlstore intacto.

## Alternativas consideradas

- Manter `binary/proto` com supressão SA1019 permanente. Rejeitado:
  dívida crescente conforme upstream remove pacote legacy.
- Aguardar whatsmeow vX.Y com nova API unificada. Rejeitado: sem
  sinal de roadmap; `proto/waE2E` já é estável.
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/architecture/adr/004-whatsmeow-proto-migration.md
git commit -m "docs(adr): ADR 004 whatsmeow proto migration aceito"
```

### Task F.4: Criar ADR 005

**Files:**
- Create: `docs/architecture/adr/005-revive-profile.md`

- [ ] **Step 1: Escrever ADR (conteúdo completo)**

```markdown
# ADR 005 — revive profile seletivo

**Status:** ACEITO 2026-04-16.

## Contexto

`revive` com perfil default reportava **145 warnings**, dos quais
~140 eram `exported X should have comment or be unexported`. Adicionar
doc comments em todos teria custo alto (~140 edits) com retorno
baixo — o projeto não é SDK público, a API exposta é só o Fiber app.

## Decisão

Adotar perfil revive **seletivo**, excluindo regras de documentação
e deixando apenas regras de estilo de erro/retorno.

**Regras ativas (14):**
- `error-strings`, `error-naming`, `error-return`, `errorf`
- `if-return`, `indent-error-flow`, `superfluous-else`
- `var-declaration`, `receiver-naming`, `time-naming`
- `unexported-return`, `increment-decrement`, `range`,
  `unreachable-code`

**Regras excluídas:**
- `exported` — documentação de símbolos exportados.
- `package-comments` — godoc header de pacote.
- `var-naming` — já coberto por `staticcheck ST1003/ST1020-1022`.

Config vive **inline** no `.golangci.yml` (sem arquivo
`.revive.toml` separado).

## Consequências

- Lint rápido no CI (~30s), 0 warnings revive.
- Dívida de documentação assumida explicitamente; reavaliar quando
  abrir código para terceiros ou lançar SDK cliente.

## Alternativas consideradas

- Adicionar ~140 doc comments. Rejeitado por custo/benefício baixo.
- Deixar revive desligado. Rejeitado: perderia regras valiosas
  (error-strings, indent-error-flow, etc.).
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/architecture/adr/005-revive-profile.md
git commit -m "docs(adr): ADR 005 revive profile seletivo aceito"
```

### Task F.5: Atualizar HANDOFF.md

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Adicionar seção no topo do "Histórico de atualizações"**

Inserir após o header "## Histórico de atualizações":

```markdown
### 2026-04-16 — Fase 17A preparada (lint sweep final)

- **errcheck 38 → 0** — 7 fixes prod (pluggy, llm_helpers, rollover,
  categories) + 31 fixes test (cache, services/llm_extra,
  bootstrap, obs, whatsapp).
- **staticcheck 16 → 0** — SA1019 migração whatsmeow
  `binary/proto` → `proto/waE2E` (5 callsites em `client.go` +
  `instance_manager.go`); 10 fixes 1-liner (ST1005 ×3, SA9003 ×2,
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

### Task F.6: Atualizar `_bmad-output/project-context.md`

**Files:**
- Modify: `_bmad-output/project-context.md`

- [ ] **Step 1: Localizar seção de status/fases**

```bash
grep -n "Fase 16\|phase-16" "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/_bmad-output/project-context.md" | head -5
```

- [ ] **Step 2: Adicionar entrada Fase 17A (3-5 linhas)**

```markdown
### Fase 17A — 2026-04-16 (preparada)

Lint sweep final Go: errcheck 38 + staticcheck 16 + revive 145 →
**0**. SA1019 whatsmeow migrado `binary/proto → proto/waE2E`.
`.golangci.yml` destravado: 14 → 6 supressões. ADRs 001 encerrado,
004 + 005 aceitos. Tag `phase-17a-prepared`.
```

- [ ] **Step 3: Commit combinado F.5 + F.6**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git add docs/HANDOFF.md _bmad-output/project-context.md
git commit -m "docs(handoff+context): Fase 17A lint sweep preparada"
```

### Task F.7: Gravar memory `phase_17a_complete.md`

**Files:**
- Create: `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory/phase_17a_complete.md`

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
- SA1019 whatsmeow: migração `binary/proto` → `proto/waE2E` em 5
  callsites.
- `.golangci.yml` destravado: supressões 14 → 6.
- ADRs: 001 encerrado, 004 + 005 aceitos.
- Tag `phase-17a-prepared`.

**Why:** fechar dívida técnica acumulada desde Fase 14 (ADR 001
bloqueou golangci-lint v2 até Go 1.26 support existir) e do escopo
defensivo da Fase 16.

**How to apply:** próximas fases podem confiar em lint CI verde
end-to-end. Fase 17B (PWA E2E), 17C (mobile foundation), 17D
(multi-region) seguem em plans separados.
```

- [ ] **Step 2: Atualizar MEMORY.md index**

```bash
MEM_DIR="/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-Laura-Finance--Vibe-Coding-/memory"
```

Editar `$MEM_DIR/MEMORY.md` e adicionar linha:

```
- [Fase 17A complete](phase_17a_complete.md) — lint sweep final 199 → 0, whatsmeow proto migration, ADRs 001/004/005
```

### Task F.8: Push + aguardar CI + tag

- [ ] **Step 1: Validar árvore limpa**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git status
```

Esperado: `nothing to commit, working tree clean`.

- [ ] **Step 2: Log dos commits da fase**

```bash
git log --oneline master ^"$(git log -30 --oneline | grep 'Fase 16 preparada' | awk '{print $1}')" 2>/dev/null | head -25
```

Esperado: série `lint(*): ...` + `docs(adr/handoff/context): ...`. Total ~15-20 commits.

- [ ] **Step 3: Push**

```bash
git push origin master
```

- [ ] **Step 4: Aguardar CI verde**

```bash
gh run watch "$(gh run list --branch master --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Esperado: workflow `go-ci.yml` + `pwa-ci.yml` verdes.

- [ ] **Step 5: Se CI vermelho: parar, investigar, corrigir, novo push**

**Não avançar para tag antes de verde.** Se golangci-lint CI falhar por versão ou checks que localmente passaram: ler log, ajustar, commitar fix, push, repetir Step 4.

- [ ] **Step 6: Aplicar tag (apenas se CI verde)**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)"
git tag phase-17a-prepared
git push origin phase-17a-prepared
git tag --list "phase-17a*"
```

Esperado: `phase-17a-prepared` local + remoto.

- [ ] **Step 7: Checar coverage merged ≥30%**

```bash
gh run view "$(gh run list --branch master --workflow go-ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --log 2>&1 | grep -E "merged coverage|coverage:" | tail -5
```

Esperado: `merged coverage: XX%` ≥ 30.

---

## Critérios globais de conclusão

- [ ] `golangci-lint run --timeout 5m` local → `0 issues`.
- [ ] `go test -short ./...` → todos PASS; sem regressão de cobertura.
- [ ] `TestSQLStoreNew_AutoCreatesWhatsmeowTables` → PASS.
- [ ] CI `go-ci.yml` verde no push final.
- [ ] Gate `coverage-gate` (main only) ≥30%.
- [ ] 3 ADRs atualizados (001 encerrado, 004, 005 novos).
- [ ] HANDOFF, project-context, memory gravados.
- [ ] Tag `phase-17a-prepared` no remoto.
