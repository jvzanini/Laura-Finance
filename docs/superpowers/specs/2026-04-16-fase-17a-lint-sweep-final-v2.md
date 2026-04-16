# Fase 17A — Lint Sweep Final (spec v2 — review #1)

**Base:** concerns Fase 17 listados no HANDOFF (Fase 16). Decomposto de "Fase 17 Quality Final Sweep" em sub-fase A (lint) para preservar granularidade alta. 17B (PWA E2E expansão), 17C (mobile native foundation), 17D (multi-region read replica) ficam para fases subsequentes.

**v1→v2:**
- Contagem errcheck corrigida: **7 prod** + **31 tests** (não 6+32). Breakdown exato por arquivo abaixo.
- Lista preliminar de `errcheck.exclude-functions` adicionada.
- Decisão sobre config revive: **inline no `.golangci.yml`** (sem `.revive.toml` separado) — consistência com padrão golangci v2 do projeto.
- Encerramento explícito de ADR 001 (golangci-lint v2 desbloqueado definitivamente).
- Nota sobre `lefthook` pre-commit.
- Update `_bmad-output/project-context.md` listado como entregável.
- Plano de smoke whatsmeow detalhado.

## Contexto e motivação

O CI hoje roda `golangci-lint v2.11.4` com `.golangci.yml` em modo defensivo (`default: none`, apenas `govet + ineffassign + staticcheck` com **11 staticcheck checks suprimidos**: `ST1000/1003/1005/1020/1021/1022`, `SA1012`, `SA1019`, `SA9003`, `QF1003/1007/1008`, `S1025`, `S1039`). `errcheck` e `revive` não participam. Isso foi decisão explícita da Fase 16 (ADR 001 desbloqueou a v2 e deixou cleanup para "17+ sweep").

Snapshot do débito técnico medido em **2026-04-16** (após Fase 16):

| Ferramenta | Warnings | Distribuição |
|---|---|---|
| `errcheck` | **38** | **7 prod** + **31 tests** (breakdown abaixo) |
| `staticcheck` **full** | **16** | `SA1019` ×5 (whatsmeow `binary/proto` deprecated), `ST1005` ×3, `SA9003` ×2, `QF1003` ×2, `SA1012` ×1, `S1039` ×1, `S1025` ×1, `QF1007` ×1 |
| `revive` (defaults) | **145** | ~140 "exported X should have comment or be unexported"; ~5 outros |

**Breakdown errcheck por arquivo (medido):**

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

**whatsmeow** `v0.0.0-20260305215846-fc65416c22c4` já expõe `go.mau.fi/whatsmeow/proto/waE2E` com `type Message struct` (confirmado em `~/go/pkg/mod/go.mau.fi/whatsmeow@.../proto/waE2E/WAWebProtobufsE2E.pb.go:9581`) — destino da migração SA1019 está disponível no módulo já vendorizado, sem bump de dependência.

## Objetivos (refinados)

1. **errcheck** ativado no `.golangci.yml`, zero warnings.
2. **revive** ativado com **perfil seletivo** (regras de estilo de erro/retorno; `exported` e `package-comments` **excluídos** explicitamente via ADR), zero warnings sob esse perfil. Config **inline** no `.golangci.yml` — sem arquivo `.revive.toml` separado.
3. **SA1019 whatsmeow** zerado via migração `binary/proto` → `proto/waE2E`, cobertura existente mantida (`whatsapp` ≥16%).
4. **Staticcheck destravado**: supressões `ST1005`, `SA9003`, `QF1003`, `QF1007`, `SA1012`, `S1039`, `S1025`, `SA1019` removidas do `.golangci.yml` após fixes dos warnings correspondentes.
5. **Supressões que permanecem** documentadas com comentário inline: `ST1000/1003/1020/1021/1022` (godoc/naming — cobertos por ADR 005), `QF1008` (embedded fields — legibilidade caso-a-caso).
6. **`golangci-lint run --timeout 5m`** retorna **0 issues** no `laura-go/` com config atualizado.
7. **CI `go-ci.yml`** continua verde; gate coverage 30% mantido; sem regressão de cobertura (tolerância −0.5pp).
8. **ADR 001** atualizado com status "resolvido" (golangci-lint v2 desbloqueado desde Fase 16, cleanup completo em 17A).
9. **ADR 004** — whatsmeow proto migration (decisão aceita).
10. **ADR 005** — revive profile seletivo (decisão aceita, com trade-off explícito sobre não exigir doc comments em exportados).
11. **`lefthook.yml`** pre-commit atualizado (se existir) para rodar `golangci-lint run --fast` — ou nota explícita se hoje já está configurado.
12. Tag `phase-17a-prepared`.

## Non-goals

- Adicionar doc comments em todos os ~140 exportados flagados pelo revive default (seria trabalho alto sem retorno proporcional; ADR 005 registra a decisão).
- Ativar linters adicionais (gocritic, gocyclo, dupl, funlen, etc.) — fora do escopo do "sweep".
- Tocar no PWA (ESLint PWA já está com `no-explicit-any: error` full desde Fase 15).
- Refactor funcional (feature, performance) — só código afetado pelo fix do warning.
- Mobile, multi-region, deploy real, features de produto.

## Escopo detalhado

### 1. errcheck: 38 → 0

**Estratégia por categoria:**

- **Tests (31):** usar `require.NoError(t, err)` quando o test já importa testify, ou `_ = fn()` com comentário quando a chamada é puramente setup (ex.: `c.Set` em cache tests que só popula estado).
- **Produção (7):**
  - `pluggy/client.go` ×3 — majoritariamente `resp.Body.Close()`. Wrappear em `defer func() { _ = resp.Body.Close() }()` ou log com `slog.Warn` se for caso não-trivial.
  - `services/llm_helpers.go` ×2 — mesma análise (idem Body.Close esperado).
  - `services/rollover.go` ×1 — avaliar individualmente: se retorno ignorado for erro de log/metric, `_ = ...` com comentário; se for query, propagar.
  - `handlers/categories.go` ×1 — mesma análise.

**Regra inviolável:** nenhum `_ = err` silenciando erro de persistência, LLM ou HTTP externo. Esses propagam ou logam com `slog.Error`.

**Config golangci inline:**
```yaml
linters:
  enable:
    - errcheck
  settings:
    errcheck:
      check-type-assertions: true
      check-blank: false
      exclude-functions:
        # closers comuns — defer+ignorar é idioma padrão Go
        - (io.Closer).Close
        - (net/http.ResponseWriter).Write
        # fmt.Fprintln em stderr/buffer em tests — retorno ignorado é idiomático
        - fmt.Fprint
        - fmt.Fprintf
        - fmt.Fprintln
        # os.Setenv/Unsetenv em tests — raramente falham
        - os.Setenv
        - os.Unsetenv
```
A lista exata será ajustada após primeira run — adicionar funções que gerarem ruído manifestamente inofensivo.

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

Substituir `waProto.Message{...}` por `waE2E.Message{...}` em todos os callsites. Os campos (`Conversation`, `ExtendedTextMessage`, etc.) são os mesmos — são re-exports do mesmo schema proto. Confirmação: `type Message struct` existe em `proto/waE2E/WAWebProtobufsE2E.pb.go`.

**Validação:**
- `go build ./...` OK.
- `go vet ./internal/whatsapp/...` OK.
- `go test -short ./internal/whatsapp/...` mantém ≥16% coverage.
- **Smoke manual:** em branch isolada, rodar `DISABLE_WHATSAPP=false` + `WHATSAPP_QR_TERMINAL=true` localmente com Postgres up; enviar/receber 1 mensagem de texto via QR scan real. Documentar resultado (screenshot ou log) em `docs/ops/whatsapp.md` seção "Smoke Fase 17A". Esse smoke **não** é automatizável — é limitação conhecida do teste em WhatsApp.

**Fallback:** se campo quebrar em runtime (improvável, mas possível se o novo pacote reorganizou alguma struct menor), rollback para `waProto` + reabertar supressão `SA1019` + documentar em ADR 004 como "tentativa adiada, nova janela em whatsmeow vX.Y".

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

**Perfil aceito (ADR 005) — inline no `.golangci.yml`:**
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
- `exported` — exigiria ~140 doc comments em funções/vars/types exportados. Custo/benefício baixo no estágio atual; API pública é só o Fiber app (não é SDK).
- `package-comments` — idem, ~10 pacotes precisariam godoc header.
- `var-naming` — já coberto por `staticcheck ST1003/1020/1021/1022` cujas supressões mantemos.

Após config, esperamos **zero warnings** sob o perfil. Se algum aparecer, fixar in-line (majoritariamente estilo). Dry-run antes de commit para confirmar contagem.

### 5. `.golangci.yml` destravado

**Antes** (atual):
```yaml
staticcheck:
  checks:
    - "all"
    - "-ST1000" - "-ST1003" - "-ST1005" - "-ST1020" - "-ST1021" - "-ST1022"
    - "-SA1012" - "-SA1019" - "-SA9003"
    - "-QF1003" - "-QF1007" - "-QF1008"
    - "-S1025" - "-S1039"
```

**Depois** (meta):
```yaml
staticcheck:
  checks:
    - "all"
    # Suprimidos deliberadamente (ADR 005 — revive profile):
    - "-ST1000"  # package godoc não exigido
    - "-ST1003"  # naming (acrônimos PT-BR) - avaliar em 17B
    - "-ST1020"  # godoc exported
    - "-ST1021"  # godoc type
    - "-ST1022"  # godoc var
    # Estilística dupla cost/benefit baixo:
    - "-QF1008"  # embedded fields - legibilidade caso-a-caso
linters:
  default: none
  enable:
    - errcheck
    - govet
    - ineffassign
    - revive
    - staticcheck
```

Cada supressão ganha comentário inline explicando motivo.

### 6. lefthook pre-commit

Verificar `lefthook.yml` na raiz:
- Se já roda `golangci-lint run --fast`: validar que passa com config novo.
- Se não roda: **não adicionar** (escopo mínimo de 17A; CI já cobre). Documentar em HANDOFF "considerar em 17C/próxima".
- Se roda comando legacy (v1): atualizar para v2 sintaxe.

### 7. ADRs

**`docs/architecture/adr/001-golangci-lint-v2-wait.md`** (existente) — adicionar seção de **encerramento**:
- Status atualizado para `RESOLVIDO 2026-04-16`.
- Nota: v2.11.4 ativo desde Fase 16, cleanup completo em Fase 17A.

**`docs/architecture/adr/004-whatsmeow-proto-migration.md`** (novo):
- **Contexto:** SA1019 deprecation de `binary/proto`, pacote `proto/waE2E` disponível no módulo.
- **Decisão:** migrar todos os 5 callsites para `waE2E`.
- **Consequências:** zero SA1019 remanescente; alinhamento com upstream; nenhum risco de breakage em binary/proto removal futura.
- **Alternativas consideradas:** manter `binary/proto` com supressão (rejeitado — dívida crescente conforme upstream remove).

**`docs/architecture/adr/005-revive-profile.md`** (novo):
- **Contexto:** projeto não é SDK público; ~140 exportados sem doc comment.
- **Decisão:** adotar perfil revive seletivo, excluir `exported`/`package-comments`/`var-naming`.
- **Consequências:** lint passa rápido no CI; dívida de documentação assumida explicitamente; re-avaliar quando abrir código para terceiros ou lançar SDK cliente.
- **Alternativas consideradas:** (a) adicionar ~140 doc comments (rejeitado — custo/benefício baixo); (b) deixar revive desligado (rejeitado — perde regras de estilo de erro relevantes).

## Ordem de execução (antecipa o plan)

1. **Sprint A — SA1019 whatsmeow migration** (criticidade alta, bloqueante para destravar staticcheck).
2. **Sprint B — Staticcheck 1-liners** (ST1005/SA9003/QF1003/SA1012/S1039/S1025/QF1007).
3. **Sprint C — errcheck prod (7) + errcheck tests (31)**.
4. **Sprint D — revive enable + perfil + fixes remanescentes**.
5. **Sprint E — `.golangci.yml` destravado + run final + CI verde**.
6. **Sprint F — lefthook check (se aplicável) + ADR 001 encerramento + ADR 004 + ADR 005 + HANDOFF + `_bmad-output/project-context.md` snapshot + memory `phase_17a_complete.md` + tag `phase-17a-prepared`**.

## Critérios de aceite

- [ ] `golangci-lint run --timeout 5m` em `laura-go/` → 0 issues.
- [ ] `errcheck ./...` → 0 warnings.
- [ ] `staticcheck ./...` full → 0 warnings (excluídas apenas as supressões ADR 005).
- [ ] `revive` sob perfil seletivo → 0 warnings.
- [ ] `go build ./...` → OK.
- [ ] `go test -short ./...` → OK; cobertura whatsapp ≥16%, total short ≥20%.
- [ ] Smoke whatsmeow manual documentado em `docs/ops/whatsapp.md`.
- [ ] CI `go-ci.yml` verde.
- [ ] Gate `coverage-gate` (main only) ≥30% mantido.
- [ ] ADR 001 encerrado + ADR 004 + ADR 005 commitados.
- [ ] HANDOFF.md atualizado (seção Fase 17A).
- [ ] `_bmad-output/project-context.md` snapshot atualizado.
- [ ] Memory `phase_17a_complete.md` gravada.
- [ ] Tag `phase-17a-prepared` aplicada.

## STANDBYs

Nenhum novo. Herdados das fases anteriores (GROQ-REVOKE, VERCEL/FLY/etc.).

## Documentação entregável

- `docs/architecture/adr/001-golangci-lint-v2-wait.md` (encerramento)
- `docs/architecture/adr/004-whatsmeow-proto-migration.md`
- `docs/architecture/adr/005-revive-profile.md`
- `laura-go/.golangci.yml` atualizado (revive inline)
- `docs/ops/whatsapp.md` (seção smoke 17A)
- `docs/HANDOFF.md` (seção Fase 17A)
- `_bmad-output/project-context.md` (snapshot atualizado)
- Memory `phase_17a_complete.md`

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migração whatsmeow quebra runtime (conexão WhatsApp) | Smoke manual antes de tag; fallback documentado (rollback import) |
| errcheck em tests tem falsos positivos que pedem refactor grande | Perfil errcheck com `exclude-functions` para closers comuns |
| revive perfil é restrito demais e gera mais warnings do que 145 | Rodar dry-run antes de commitar; ajustar perfil iterativamente |
| Destravar QF1003/QF1007 gera side-effect em arquivo que não queríamos tocar | Fixes escopados por commit, revert granular fácil |
| CI coverage 30% cai abaixo do gate após refactor whatsmeow | Tolerância −0.5pp; se cair mais, adicionar testes complementares no Sprint A |
| `lefthook` local desatualizado causa commits que reprovam no CI | Validar lefthook atual em Sprint F; se v1 legacy, atualizar comando |

## Métricas de sucesso

- **Warnings lint**: 38 (errcheck) + 16 (staticcheck) + 145 (revive) = **199 → 0**.
- **Supressões `.golangci.yml`**: 14 → 6 (−57%).
- **ADRs aceitos**: +2 novos (004, 005) + 1 encerramento (001).
- **Cobertura:** sem regressão (tolerância −0.5pp).
