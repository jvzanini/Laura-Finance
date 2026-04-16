# Fase 17A — Lint Sweep Final (spec v1)

**Base:** concerns Fase 17 listados no HANDOFF (Fase 16). Decomposto de "Fase 17 Quality Final Sweep" em sub-fase A (lint) para preservar granularidade alta. 17B (PWA E2E expansão), 17C (mobile native foundation), 17D (multi-region read replica) ficam para fases subsequentes.

## Contexto e motivação

O CI hoje roda `golangci-lint v2.11.4` com `.golangci.yml` em modo defensivo (`default: none`, apenas `govet + ineffassign + staticcheck` com **11 staticcheck checks suprimidos**: `ST1000/1003/1005/1020/1021/1022`, `SA1012`, `SA1019`, `SA9003`, `QF1003/1007/1008`, `S1025`, `S1039`). `errcheck` e `revive` não participam. Isso foi decisão explícita da Fase 16 (ADR 001 desbloqueou a v2 e deixou cleanup para "17+ sweep").

Snapshot do débito técnico medido em **2026-04-16** (após Fase 16):

| Ferramenta | Warnings | Distribuição |
|---|---|---|
| `errcheck` | **38** | 32 em tests (cache/bootstrap/services/obs), 6 em prod (`pluggy/client.go` ×3, `services/llm_helpers.go` ×2, `services/rollover.go` ×1, `handlers/categories.go` ×1 — um dos 6 pode estar em test) |
| `staticcheck` **full** | **16** | `SA1019` ×5 (whatsmeow `binary/proto` deprecated), `ST1005` ×3, `SA9003` ×2, `QF1003` ×2, `SA1012` ×1, `S1039` ×1, `S1025` ×1, `QF1007` ×1 |
| `revive` (defaults) | **145** | ~140 "exported X should have comment or be unexported"; ~5 outros |

**whatsmeow** `v0.0.0-20260305215846-fc65416c22c4` já expõe `go.mau.fi/whatsmeow/proto/waE2E` com `type Message struct` — destino da migração SA1019 está disponível no módulo já vendorizado, sem bump de dependência.

## Objetivos (refinados)

1. **errcheck** ativado no `.golangci.yml`, zero warnings.
2. **revive** ativado com **perfil seletivo** (regras de estilo de erro/retorno; `exported` e `package-comments` **excluídos** explicitamente via ADR), zero warnings sob esse perfil.
3. **SA1019 whatsmeow** zerado via migração `binary/proto` → `proto/waE2E`, cobertura existente mantida (`whatsapp` 16.2%).
4. **Staticcheck destravado**: supressões `ST1005`, `SA9003`, `QF1003`, `QF1007`, `SA1012`, `S1039`, `S1025` removidas do `.golangci.yml` após fixes dos warnings correspondentes.
5. **Supressões que permanecem** documentadas: `ST1000/1003/1020/1021/1022`, `QF1008`, `SA1012` se houver resíduo em test com nil-context legítimo (caso-a-caso). Justificativa por item vira comentário inline no `.golangci.yml`.
6. **`golangci-lint run --timeout 5m`** retorna **0 issues** no `laura-go/` com config atualizado.
7. **CI `go-ci.yml`** continua verde; gate coverage 30% mantido; sem regressão de cobertura (tolerância −0.5pp).
8. **ADR 004** — whatsmeow proto migration (decisão aceita).
9. **ADR 005** — revive profile seletivo (decisão aceita, com trade-off explícito sobre não exigir doc comments em exportados).
10. Tag `phase-17a-prepared`.

## Non-goals

- Adicionar doc comments em todos os ~140 exportados flagados pelo revive default (seria trabalho alto sem retorno proporcional; ADR 005 registra a decisão).
- Ativar linters adicionais (gocritic, gocyclo, dupl, funlen, etc.) — fora do escopo do "sweep".
- Tocar no PWA (ESLint PWA já está com `no-explicit-any: error` full desde Fase 15).
- Refactor funcional (feature, performance) — só código afetado pelo fix do warning.
- Mobile, multi-region, deploy real, features de produto.

## Escopo detalhado

### 1. errcheck: 38 → 0

**Estratégia por categoria:**

- **Tests (32):** usar `require.NoError(t, err)` quando já há `testify`, ou `_ = fn()` com comentário quando a chamada é puramente setup (ex.: `c.Set` em cache tests que só popula estado). Preferir `require.NoError` sempre que o test já importar testify.
- **Produção (6):** cada chamada analisada:
  - `pluggy/client.go` ×3 — provavelmente `resp.Body.Close()` e encoder/decoder; wrappear em `defer func() { _ = resp.Body.Close() }()` ou log+`slog.Error` se o erro for relevante.
  - `services/llm_helpers.go` ×2 — idem, Body.Close esperado.
  - `services/rollover.go` ×1 — avaliar: se retorno ignorado for erro de log/metric, `_ = ...` com comentário; se for query, propagar.
  - `handlers/categories.go` ×1 — mesma análise.

**Regra:** nenhum `_ = err` silenciando erro de persistência ou de LLM. Esses propagam ou logam com `slog`.

**Config:** `.golangci.yml` ganha `errcheck` em `linters.enable`, com `settings.errcheck.exclude-functions` listando `io.Copy`, `(io.Closer).Close` se necessário para evitar ruído em defers comuns (decisão caso-a-caso após primeira run).

### 2. SA1019 whatsmeow: 5 → 0

**Alvos:**
- `internal/whatsapp/client.go:21` (import `waProto`)
- `internal/whatsapp/client.go:229` (`waProto.Message{...}` em send)
- `internal/whatsapp/client.go:264` (`waProto.Message{...}` em send alternativo)
- `internal/whatsapp/instance_manager.go:19` (import `waProto`)
- `internal/whatsapp/instance_manager.go:278` (`waProto.Message{...}` em SendMessage)

**Migração:**
```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
```

Substituir `waProto.Message{...}` por `waE2E.Message{...}` em todos os callsites. Os campos (`Conversation`, `ExtendedTextMessage`, etc.) são os mesmos — são re-exports do mesmo schema proto.

**Validação:**
- `go build ./...` OK.
- `go test -short ./internal/whatsapp/...` mantém ≥16.2% coverage.
- Smoke manual documentado em `docs/ops/whatsapp.md` (não automatizável sem QR scan real — já é limitação conhecida).

**Fallback:** se campo quebrar em runtime (improvável, mas possível se o novo pacote reorganizou alguma struct menor), rollback para `waProto` + reabertar supressão `SA1019` + documentar em ADR 004 como "tentativa adiada".

### 3. Staticcheck destravado: 10 fixes 1-liner

| Código | Locais | Fix |
|---|---|---|
| `ST1005` ×3 | `services/llm.go:223`, `services/llm_helpers.go:174`, `:180` | lowercase inicial do error string |
| `SA9003` ×2 | `handlers/ops_backup.go:42`, `whatsapp/instance_manager.go:235` | remover branch vazio ou adicionar comentário explicando why |
| `QF1003` ×2 | `whatsapp/instance_manager.go:169`, `:326` | converter `if/else if` para `switch` |
| `SA1012` ×1 | `services/score_test.go:156` | `nil` → `context.TODO()` em `ComputeScoreFactors(nil, ...)` |
| `S1039` ×1 | `services/rollover_e2e_test.go:347` | remover `fmt.Sprintf` redundante |
| `S1025` ×1 | `services/llm.go:275` | remover `fmt.Sprintf("%s", ...)` redundante |
| `QF1007` ×1 | `handlers/reports.go:41` | merge declaração com assignment inicial |

Todos são refactors mecânicos de 1 linha cada. Impacto zero em comportamento.

### 4. revive: 145 → 0 (sob perfil seletivo)

**Perfil aceito (ADR 005):**
```toml
# laura-go/.revive.toml
[rule.error-strings]
[rule.error-naming]
[rule.error-return]
[rule.errorf]
[rule.if-return]
[rule.var-declaration]
[rule.receiver-naming]
[rule.time-naming]
[rule.unexported-return]
[rule.indent-error-flow]
[rule.increment-decrement]
[rule.range]
[rule.superfluous-else]
[rule.unreachable-code]
```

**Explicitamente excluídas:**
- `exported` — exigiria ~140 doc comments em funções/vars/types exportados. Custo/benefício baixo no estágio atual; API pública é só o Fiber app (não é SDK).
- `package-comments` — idem, ~10 pacotes precisariam godoc header.
- `var-naming` — já coberto por `staticcheck ST1003/1020/1021/1022` cujas supressões mantemos.

Após config, esperamos **zero warnings** sob o perfil. Se algum aparecer, fixar in-line (majoritariamente estilo).

**Config golangci:**
```yaml
linters:
  enable:
    - revive
  settings:
    revive:
      severity: error
      confidence: 0.8
      rules:
        # lista replicada do .revive.toml (golangci não lê arquivo externo)
```

### 5. `.golangci.yml` destravado

**Antes** (atual):
```yaml
staticcheck:
  checks:
    - "all"
    - "-ST1000"
    - "-ST1003"
    - "-ST1005"  # remover supressão
    - "-ST1020"
    - "-ST1021"
    - "-ST1022"
    - "-SA1012"  # remover supressão (ou manter se resíduo)
    - "-SA1019"  # remover supressão após migração
    - "-SA9003"  # remover supressão
    - "-QF1003"  # remover supressão
    - "-QF1007"  # remover supressão
    - "-QF1008"
    - "-S1025"   # remover supressão
    - "-S1039"   # remover supressão
```

**Depois** (meta):
```yaml
staticcheck:
  checks:
    - "all"
    - "-ST1000"  # package godoc não exigido (ADR 005)
    - "-ST1003"  # naming (acrônimos PT-BR) - avaliar em 17B
    - "-ST1020"  # godoc exported - ADR 005
    - "-ST1021"  # godoc type - ADR 005
    - "-ST1022"  # godoc var - ADR 005
    - "-QF1008"  # embedded fields - conflito de legibilidade caso-a-caso
linters:
  enable:
    - errcheck
    - govet
    - ineffassign
    - revive
    - staticcheck
```

Cada supressão restante ganha comentário 1-liner explicando motivo.

### 6. ADR 004 — whatsmeow proto migration

`docs/architecture/adr/004-whatsmeow-proto-migration.md`:
- **Contexto:** SA1019 deprecation de `binary/proto`, pacote `proto/waE2E` disponível no módulo.
- **Decisão:** migrar todos os callsites para `waE2E`.
- **Consequências:** zero SA1019 remanescente; alinhamento com upstream; nenhum risco de breakage em binary/proto removal futura.

### 7. ADR 005 — revive profile seletivo

`docs/architecture/adr/005-revive-profile.md`:
- **Contexto:** projeto não é SDK público; ~140 exportados sem doc comment.
- **Decisão:** adotar perfil revive seletivo, excluir `exported`/`package-comments`/`var-naming`.
- **Consequências:** lint passa rápido no CI; dívida de documentação assumida explicitamente; re-avaliar quando abrir código para terceiros ou lançar SDK cliente.

## Ordem de execução (antecipa o plan)

1. **Sprint A — SA1019 whatsmeow migration** (criticidade alta, bloqueante para destravar staticcheck).
2. **Sprint B — Staticcheck 1-liners** (ST1005/SA9003/QF1003/SA1012/S1039/S1025/QF1007).
3. **Sprint C — errcheck prod (6)** + **errcheck tests (32)**.
4. **Sprint D — revive enable + perfil + fixes remanescentes**.
5. **Sprint E — `.golangci.yml` destravado + run final + CI verde**.
6. **Sprint F — ADR 004 + ADR 005 + HANDOFF + memory + tag**.

## Critérios de aceite

- [ ] `golangci-lint run --timeout 5m` em `laura-go/` → 0 issues.
- [ ] `errcheck ./...` → 0 warnings.
- [ ] `staticcheck ./...` full → 0 warnings (excluídas apenas as supressões ADR 005).
- [ ] `revive` sob perfil seletivo → 0 warnings.
- [ ] `go build ./...` → OK.
- [ ] `go test -short ./...` → OK; cobertura whatsapp ≥16%, total short ≥20%.
- [ ] CI `go-ci.yml` verde.
- [ ] Gate `coverage-gate` (main only) ≥30% mantido.
- [ ] ADR 004 + ADR 005 commitados.
- [ ] HANDOFF.md atualizado (seção Fase 17A).
- [ ] Memory `phase_17a_complete.md` gravada.
- [ ] Tag `phase-17a-prepared` aplicada.

## STANDBYs

Nenhum novo. Herdados das fases anteriores (GROQ-REVOKE, VERCEL/FLY/etc.).

## Documentação entregável

- `docs/architecture/adr/004-whatsmeow-proto-migration.md`
- `docs/architecture/adr/005-revive-profile.md`
- `laura-go/.golangci.yml` atualizado
- `laura-go/.revive.toml` (ou config equivalente no `.golangci.yml`)
- `docs/HANDOFF.md` (seção Fase 17A)
- Memory `phase_17a_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migração whatsmeow quebra runtime (conexão WhatsApp) | Smoke manual antes de tag; fallback documentado (rollback import) |
| errcheck em tests tem falsos positivos que pedem refactor grande | Perfil errcheck com `exclude-functions` para closers comuns |
| revive perfil é restrito demais e gera mais warnings do que 145 | Rodar dry-run antes de commitar; ajustar perfil iterativamente |
| Destravar QF1003/QF1007 gera side-effect em arquivo que não queríamos tocar | Fixes escopados por commit, revert granular fácil |
| CI coverage 30% cai abaixo do gate após refactor whatsmeow | Tolerância −0.5pp; se cair mais, adicionar testes complementares no Sprint A |

## Métricas de sucesso

- **Warnings lint**: 38 (errcheck) + 16 (staticcheck) + 145 (revive) = **199 → 0**.
- **Supressões `.golangci.yml`**: 11 → 5 (−54%).
- **ADRs aceitos**: +2 (004, 005).
- **Cobertura:** sem regressão (tolerância −0.5pp).
