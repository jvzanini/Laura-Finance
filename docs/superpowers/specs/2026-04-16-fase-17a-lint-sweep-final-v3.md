# Fase 17A — Lint Sweep Final (spec v3 FINAL — review #2)

**Base:** concerns Fase 17 listados no HANDOFF (Fase 16). Decomposto de "Fase 17 Quality Final Sweep" em sub-fase A (lint) para preservar granularidade alta. 17B (PWA E2E expansão), 17C (mobile native foundation), 17D (multi-region read replica) ficam para fases subsequentes.

**v1→v2:**
- Contagem errcheck corrigida: **7 prod** + **31 tests** (não 6+32).
- Lista preliminar de `errcheck.exclude-functions` adicionada.
- Config revive **inline** no `.golangci.yml` (sem `.revive.toml` separado).
- Encerramento explícito de ADR 001 listado.
- Nota sobre `lefthook` pre-commit.
- Update `_bmad-output/project-context.md` listado como entregável.

**v2→v3:**
- ADR 001 filename confirmado: `docs/architecture/adr/001-golangci-lint-aguarda-v2.md` (existente).
- `lefthook.yml` confirmado na raiz: já roda `golangci-lint run --new-from-rev=HEAD~1 --timeout=2m {staged_files}` no pre-commit. Config novo é **backward-compatible** (só amplia conjunto de linters). Nenhuma mudança obrigatória em `lefthook.yml`.
- **Smoke whatsmeow automatizado:** `go test ./internal/whatsapp/ -run "TestContainer"` com `TEST_DATABASE_URL=postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable` (teste existente `client_test.go` valida `sqlstore.New + Container.Upgrade` cria tabelas `whatsmeow_*`). Smoke QR manual **não** é obrigatório — fallback.
- **Ordem sprints reordenada por risco crescente:** staticcheck 1-liners → errcheck → SA1019 whatsmeow (alto risco, isolado) → revive → destravar config → docs/tag.
- `errcheck.check-type-assertions: false` (conservador — escopo é zerar os 38 existentes, não introduzir warnings novos).
- `exclude-functions`: removido `(net/http.ResponseWriter).Write` (silenciar write de handler é risco real).
- Coverage gates explicitados: **short sem regressão (>20%)** + **merged ≥30%**.
- **Ambiente:** ferramentas e versões listadas.

## Contexto e motivação

O CI hoje roda `golangci-lint v2.11.4` com `.golangci.yml` em modo defensivo (`default: none`, apenas `govet + ineffassign + staticcheck` com **11 staticcheck checks suprimidos**: `ST1000/1003/1005/1020/1021/1022`, `SA1012`, `SA1019`, `SA9003`, `QF1003/1007/1008`, `S1025`, `S1039`). `errcheck` e `revive` não participam. Isso foi decisão explícita da Fase 16 (ADR 001 desbloqueou a v2 e deixou cleanup para "17+ sweep").

Snapshot do débito técnico medido em **2026-04-16** (após Fase 16):

| Ferramenta | Warnings | Distribuição |
|---|---|---|
| `errcheck` | **38** | **7 prod** + **31 tests** (breakdown abaixo) |
| `staticcheck` **full** | **16** | `SA1019` ×5, `ST1005` ×3, `SA9003` ×2, `QF1003` ×2, `SA1012` ×1, `S1039` ×1, `S1025` ×1, `QF1007` ×1 |
| `revive` (defaults) | **145** | ~140 "exported X should have comment or be unexported"; ~5 outros |

**Breakdown errcheck por arquivo (medido em 2026-04-16):**

| Arquivo | Count | Categoria |
|---|---|---|
| `internal/services/llm_extra_test.go` | 8 | test |
| `internal/cache/memory_test.go` | 8 | test |
| `internal/cache/invalidate_test.go` | 6 | test |
| `internal/bootstrap/db_test.go` | 3 | test |
| `internal/obs/metrics_integration_test.go` | 2 | test |
| `internal/cache/cache_bench_test.go` | 2 | test |
| `internal/whatsapp/client_test.go` | 1 | test |
| `internal/cache/cache_test.go` | 1 | test |
| **Total tests** | **31** | |
| `internal/pluggy/client.go` | 3 | **prod** |
| `internal/services/llm_helpers.go` | 2 | **prod** |
| `internal/services/rollover.go` | 1 | **prod** |
| `internal/handlers/categories.go` | 1 | **prod** |
| **Total prod** | **7** | |
| **Total** | **38** | |

**whatsmeow** `v0.0.0-20260305215846-fc65416c22c4` já expõe `go.mau.fi/whatsmeow/proto/waE2E` com `type Message struct` (confirmado em `proto/waE2E/WAWebProtobufsE2E.pb.go:9581`) — migração SA1019 não requer bump de dependência.

**Teste regressão whatsmeow** existente em `internal/whatsapp/client_test.go`: valida `sqlstore.New` + `Container.Upgrade` cria tabelas `whatsmeow_*` no Postgres alvo (via `TEST_DATABASE_URL`). Vira smoke automatizado pós-migração SA1019.

## Objetivos (refinados)

1. **errcheck** ativado no `.golangci.yml`, zero warnings.
2. **revive** ativado com **perfil seletivo** inline no `.golangci.yml` (regras de estilo de erro/retorno; `exported` e `package-comments` excluídos via ADR 005), zero warnings sob esse perfil.
3. **SA1019 whatsmeow** zerado via migração `binary/proto` → `proto/waE2E`, cobertura existente mantida (`whatsapp` ≥16%).
4. **Staticcheck destravado**: supressões `ST1005`, `SA9003`, `QF1003`, `QF1007`, `SA1012`, `S1039`, `S1025`, `SA1019` removidas do `.golangci.yml` após fixes.
5. **Supressões que permanecem** documentadas com comentário inline: `ST1000/1003/1020/1021/1022` (godoc/naming — ADR 005), `QF1008` (embedded fields — legibilidade caso-a-caso).
6. **`golangci-lint run --timeout 5m`** em `laura-go/` retorna **0 issues**.
7. **CI `go-ci.yml` verde**; coverage short sem regressão (>20%); merged ≥30% (gate Fase 16 mantido).
8. **ADR 001** encerrado (status `RESOLVIDO 2026-04-16`).
9. **ADR 004** — whatsmeow proto migration (novo, aceito).
10. **ADR 005** — revive profile seletivo (novo, aceito).
11. **`lefthook.yml`** validado — **nenhuma mudança obrigatória** (comando `golangci-lint run --new-from-rev` é backward-compatible com config novo). Confirmar em Sprint F.
12. Tag `phase-17a-prepared`.

## Non-goals

- Adicionar doc comments em todos os ~140 exportados (ADR 005 registra a decisão).
- Ativar linters adicionais (gocritic, gocyclo, dupl, funlen, etc.).
- Tocar no PWA.
- Refactor funcional (feature, performance) — só código afetado pelo fix do warning.
- Mobile, multi-region, deploy real, features de produto.
- ST1003 (PT-BR naming) — reavaliar em 17B.

## Ambiente necessário

**Ferramentas instaladas em `~/go/bin/`:**
- `golangci-lint@v2.11.4` (CI paridade)
- `errcheck@latest` (≥v1.7.0)
- `revive@latest` (≥v1.3.0)
- `go` 1.26.x

**Postgres local rodando** (`docker compose up -d postgres`) para smoke whatsmeow — opcional mas recomendado.

**Variáveis de ambiente:**
- `TEST_DATABASE_URL=postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable` para smoke.
- `DISABLE_WHATSAPP=true` no ambiente do CI (já está).

## Escopo detalhado

### 1. errcheck: 38 → 0

**Estratégia por categoria:**

- **Tests (31):** `require.NoError(t, err)` quando o test já importa testify; `_ = fn()` com comentário quando a chamada é puramente setup (ex.: `c.Set` em cache tests).
- **Produção (7):**
  - `pluggy/client.go` ×3 — esperado ser `resp.Body.Close()`. Wrappear em `defer func() { _ = resp.Body.Close() }()`.
  - `services/llm_helpers.go` ×2 — idem.
  - `services/rollover.go` ×1 — avaliar individualmente; se log/metric, `_ = ...` com comentário; se query, propagar.
  - `handlers/categories.go` ×1 — mesma análise.

**Regra inviolável:** nenhum `_ = err` silenciando erro de persistência, LLM, HTTP externo ou `w.Write()`. Esses propagam ou logam com `slog.Error`.

**Config golangci inline:**
```yaml
linters:
  enable:
    - errcheck
  settings:
    errcheck:
      check-type-assertions: false  # escopo 17A: zerar 38 atuais, não introduzir novos
      check-blank: false
      exclude-functions:
        # Closers idiomáticos em defer
        - (io.Closer).Close
        # os.Setenv/Unsetenv em tests — raramente falham
        - os.Setenv
        - os.Unsetenv
        # fmt.Fprintln/Fprintf para stderr/io.Discard em tests (não silencia escrita de response)
        - fmt.Fprintln(os.Stderr)
        - fmt.Fprintf(os.Stderr)
```

**Propositalmente fora da exclude:**
- `(net/http.ResponseWriter).Write` — escrita pode falhar (cliente desconectou); não silenciar.
- `(*database/sql.DB).Close` — deve ser propagado em shutdown.
- `(*database/sql.Rows).Close` — `defer rows.Close()` ignora OK, mas errcheck reporta; adicionar explicitamente `_ = rows.Close()` em cada call ao invés de excluir globalmente.

Lista final exata ajustada após primeira run no Sprint B.

### 2. Staticcheck destravado: 10 fixes 1-liner (ordem Sprint A)

| Código | Locais | Fix |
|---|---|---|
| `ST1005` ×3 | `services/llm.go:223`, `services/llm_helpers.go:174`, `:180` | lowercase inicial do error string |
| `SA9003` ×2 | `handlers/ops_backup.go:42`, `whatsapp/instance_manager.go:235` | remover branch vazio ou adicionar comentário |
| `QF1003` ×2 | `whatsapp/instance_manager.go:169`, `:326` | converter `if/else if` para `switch` |
| `SA1012` ×1 | `services/score_test.go:156` | `nil` → `context.TODO()` em `ComputeScoreFactors(nil, ...)` |
| `S1039` ×1 | `services/rollover_e2e_test.go:347` | remover `fmt.Sprintf` redundante |
| `S1025` ×1 | `services/llm.go:275` | remover `fmt.Sprintf("%s", ...)` redundante |
| `QF1007` ×1 | `handlers/reports.go:41` | merge declaração com assignment inicial |

Refactors mecânicos de 1 linha cada. Impacto zero em comportamento.

### 3. SA1019 whatsmeow: 5 → 0 (Sprint C — alto risco, isolado)

**Alvos:**
- `internal/whatsapp/client.go:21` (import `waProto`)
- `internal/whatsapp/client.go:229` (`waProto.Message{...}`)
- `internal/whatsapp/client.go:264` (`waProto.Message{...}`)
- `internal/whatsapp/instance_manager.go:19` (import `waProto`)
- `internal/whatsapp/instance_manager.go:278` (`waProto.Message{...}`)

**Migração:**
```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
```

Substituir `waProto.Message{...}` por `waE2E.Message{...}` em todos os 5 callsites. Campos (`Conversation`, `ExtendedTextMessage`, etc.) são os mesmos — re-exports do mesmo schema.

**Validação automatizada:**
- `go build ./...` OK.
- `go vet ./internal/whatsapp/...` OK.
- `go test -short ./internal/whatsapp/...` mantém ≥16% coverage.
- **Smoke via teste existente:** com Postgres local + `TEST_DATABASE_URL`, rodar:
  ```bash
  export TEST_DATABASE_URL="postgres://laura:laura_password@127.0.0.1:5433/laura_finance?sslmode=disable"
  go test ./internal/whatsapp/ -run "TestContainer" -v
  ```
  Se passar, `sqlstore.New + Container.Upgrade` continua criando schema `whatsmeow_*` — confirma migração não quebrou integração upstream.

**Smoke manual (opcional):** QR scan em `DISABLE_WHATSAPP=false` para enviar 1 mensagem. Não obrigatório — teste automatizado é suficiente em ambiente dev.

**Fallback:** se `go build` ou teste quebrar, rollback para `waProto` + reabertar supressão `SA1019` + documentar em ADR 004 como "tentativa adiada, re-avaliar em whatsmeow vX.Y".

### 4. revive: 145 → 0 (Sprint D — sob perfil seletivo)

**Perfil inline no `.golangci.yml`:**
```yaml
linters:
  enable:
    - revive
  settings:
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

**Explicitamente excluídas:**
- `exported` — ~140 doc comments em exportados. Custo/benefício baixo.
- `package-comments` — ~10 pacotes precisariam godoc header.
- `var-naming` — já coberto por `staticcheck ST1003/1020/1021/1022` suprimidos.

**Processo:**
1. Adicionar revive ao `.golangci.yml`.
2. Dry-run: `golangci-lint run --default none --enable revive --timeout 5m`.
3. Se contagem > 0, fixar in-line (tipicamente 5-20 warnings de estilo, não 145).
4. Se contagem > 50 (inesperado), reavaliar perfil antes de commit massivo.

### 5. `.golangci.yml` destravado (Sprint E)

**Depois** (meta):
```yaml
version: "2"

run:
  timeout: 5m
  tests: true

linters:
  default: none
  enable:
    - errcheck
    - govet
    - ineffassign
    - revive
    - staticcheck
  settings:
    errcheck:
      check-type-assertions: false
      check-blank: false
      exclude-functions:
        - (io.Closer).Close
        - os.Setenv
        - os.Unsetenv
        # (lista refinada após primeira run Sprint B)
    revive:
      severity: error
      confidence: 0.8
      rules:
        # (lista acima replicada)
    staticcheck:
      checks:
        - "all"
        # ADR 005 (revive profile) — doc/naming não exigidos:
        - "-ST1000"  # package godoc
        - "-ST1003"  # naming (PT-BR acronyms) - reavaliar 17B
        - "-ST1020"  # godoc exported
        - "-ST1021"  # godoc type
        - "-ST1022"  # godoc var
        # Estilística caso-a-caso:
        - "-QF1008"  # embedded fields - legibilidade subjetiva

issues:
  max-issues-per-linter: 0
  max-same-issues: 0
```

### 6. lefthook (Sprint F — validação)

`lefthook.yml` atual:
```yaml
pre-commit:
  commands:
    golangci-lint:
      glob: "laura-go/**/*.go"
      run: cd laura-go && golangci-lint run --new-from-rev=HEAD~1 --timeout=2m {staged_files}
```

**Análise:** `--new-from-rev` só reporta issues em código diff. Config novo amplia os linters mas não adiciona regras retroativas a código não-tocado. **Backward-compatível → nenhuma mudança necessária.** Validar em Sprint F rodando `lefthook run pre-commit --files <arquivo alterado>` contra um arquivo de test e contra um arquivo prod.

### 7. ADRs

**`docs/architecture/adr/001-golangci-lint-aguarda-v2.md`** (existente) — adicionar seção **Encerramento**:
- Status atualizado para `RESOLVIDO 2026-04-16`.
- Nota: v2.11.4 ativo desde Fase 16, cleanup completo em Fase 17A.

**`docs/architecture/adr/004-whatsmeow-proto-migration.md`** (novo):
- **Contexto:** SA1019 deprecation de `binary/proto`; `proto/waE2E` disponível.
- **Decisão:** migrar 5 callsites para `waE2E`.
- **Consequências:** zero SA1019; alinhamento com upstream; sem risco de breakage em binary/proto removal futura.
- **Alternativas consideradas:** manter `binary/proto` suprimido (rejeitado — dívida crescente).

**`docs/architecture/adr/005-revive-profile.md`** (novo):
- **Contexto:** projeto não é SDK público; ~140 exportados sem doc comment.
- **Decisão:** perfil revive seletivo; excluir `exported`/`package-comments`/`var-naming`.
- **Consequências:** lint rápido no CI; dívida de documentação assumida; reavaliar quando abrir código ou lançar SDK cliente.
- **Alternativas consideradas:** (a) adicionar ~140 doc comments (rejeitado — custo/benefício baixo); (b) revive desligado (rejeitado — perde regras de estilo de erro relevantes).

## Ordem de execução (antecipa o plan)

**Reordenada por risco crescente:**

1. **Sprint A — Staticcheck 1-liners** (10 fixes, baixo risco, dá confiança ao ciclo).
2. **Sprint B — errcheck prod (7) + errcheck tests (31)** (médio risco).
3. **Sprint C — SA1019 whatsmeow migration** (alto risco, isolado — com smoke automatizado).
4. **Sprint D — revive enable + perfil seletivo + fixes remanescentes** (médio risco).
5. **Sprint E — `.golangci.yml` destravado** (mecânico) + run final + CI verde.
6. **Sprint F — lefthook check + ADR 001 encerramento + ADR 004 + ADR 005 + HANDOFF + `_bmad-output/project-context.md` snapshot + memory `phase_17a_complete.md` + tag `phase-17a-prepared`**.

## Critérios de aceite

- [ ] `golangci-lint run --timeout 5m` em `laura-go/` → **0 issues**.
- [ ] `errcheck ./...` → **0 warnings**.
- [ ] `staticcheck ./...` full (sem supressões ADR 005) → **0 warnings**.
- [ ] `revive` sob perfil seletivo → **0 warnings**.
- [ ] `go build ./...` → OK.
- [ ] `go test -short ./...` → OK; whatsapp ≥16%; total short sem regressão (>20%).
- [ ] `go test ./internal/whatsapp/ -run "TestContainer"` com `TEST_DATABASE_URL` → PASS (smoke SA1019).
- [ ] CI `go-ci.yml` verde.
- [ ] Gate `coverage-gate` (main only) ≥30% mantido.
- [ ] ADR 001 encerrado + ADR 004 + ADR 005 commitados.
- [ ] `HANDOFF.md` atualizado (seção Fase 17A).
- [ ] `_bmad-output/project-context.md` snapshot atualizado.
- [ ] Memory `phase_17a_complete.md` gravada.
- [ ] Tag `phase-17a-prepared` aplicada.

## STANDBYs

Nenhum novo. Herdados das fases anteriores (GROQ-REVOKE, VERCEL/FLY/etc.).

## Documentação entregável

- `docs/architecture/adr/001-golangci-lint-aguarda-v2.md` (encerramento)
- `docs/architecture/adr/004-whatsmeow-proto-migration.md` (novo)
- `docs/architecture/adr/005-revive-profile.md` (novo)
- `laura-go/.golangci.yml` (atualizado, revive inline)
- `docs/HANDOFF.md` (seção Fase 17A)
- `_bmad-output/project-context.md` (snapshot atualizado)
- Memory `phase_17a_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migração whatsmeow quebra runtime | Smoke `TestContainer` automatizado com Postgres local antes de commit; fallback rollback import |
| errcheck em tests tem falsos positivos que pedem refactor grande | `exclude-functions` para closers comuns + `require.NoError` onde cabe |
| revive perfil gera mais warnings que 145 | Dry-run antes de commit; ajustar perfil iterativamente antes de edições massivas |
| Destravar QF1003/QF1007 gera side-effect fora do esperado | Fixes escopados por commit, revert granular fácil |
| CI coverage cai abaixo do gate após refactor whatsmeow | Tolerância −0.5pp; testes complementares no Sprint C se necessário |
| `lefthook` local silenciosamente passa mas CI reprova | Sprint F: `lefthook run pre-commit` contra arquivo teste/prod para validação |
| Ferramenta não instalada (errcheck/revive/golangci v2.11.4) | Step 0 do plan: verificar/instalar em `~/go/bin/` |

## Métricas de sucesso

- **Warnings lint**: 38 (errcheck) + 16 (staticcheck) + 145 (revive) = **199 → 0**.
- **Supressões `.golangci.yml`**: 14 → 6 (−57%).
- **ADRs**: +2 novos (004, 005) + 1 encerramento (001).
- **Cobertura:** sem regressão (tolerância −0.5pp).
- **CI verde** no push pós-commit final do Sprint E.
