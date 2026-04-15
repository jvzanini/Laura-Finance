# ADR 003 — Coverage strategy: short vs integration, merge no gate

**Data:** 2026-04-15
**Status:** Aceito
**Fase:** 16

## Contexto

O suite Go tem dois tipos de teste:
- **Short-mode** (`go test ./...`): sem `-tags=integration`, roda em
  todo PR. Não depende de containers externos.
- **Integration** (`go test -tags=integration ./...`): usa
  testcontainers-go (Postgres pgvector, Redis), roda somente em main
  (tempo/custo). Com retry via `nick-fields/retry@v3`.

Até Fase 15 o gate de cobertura olhava apenas o short-mode
(fixado em 20%, baseline 21.9%). O teto real (integration) era de
47.5% mas não era gated. Isso mascara regressões em código coberto
apenas por testes integration (handlers, banking worker, cache
pub/sub cross-instance).

## Alternativas consideradas

1. **Gate só no short** — simples, mas esconde regressões das
   camadas só cobertas por integration.
2. **Gate em cada job separado** — PR bloqueia ao passar um mas não
   o outro; não dá visão unificada.
3. **Merge via `gocovmerge` e gate único** — combina
   `coverage-short.out` + `coverage-integration.out`, aplica
   threshold no merged. Escolhido.
4. **Codecov/Coveralls externo** — adiciona dependência externa
   paga/gratuita com rate limits. Descartado por hora.

## Decisão

Adotar (3). Implementação:

- Job `test` (PR) uploada artifact `go-coverage-short`.
- Job `test-integration` (main) uploada `go-coverage-integration`.
- Novo job `coverage-gate` (main only) needs ambos, baixa, merge com
  `github.com/wadey/gocovmerge`, aplica threshold **30%**.

## Consequências

**Positivas:**
- Gate reflete cobertura real.
- PR individual não quebra por integration (que só roda em main).
- Merge determinístico via tool oficial da comunidade Go.

**Negativas:**
- PR que reduz cobertura só é detectado no push para main.
- Mitigação: cada sprint inclui comando local
  `go test -tags=integration -coverprofile=...` no checklist.
- `coverage-gate` só roda em main — portanto é detector, não
  preventor. Sprint de recovery é caro.

## Revisão

Revisitar se:
- `coverage-gate` falhar recorrente (≥3x em 30d): considerar rodar
  em PR também.
- Cobertura estabilizar ≥40%: bump gate.

## Referências

- Commit `ci(go): habilitar golangci-lint v2.11.4`.
- Commit `feat(webhooks): rotacao automatica pluggy secret +
  coverage merge CI`.
- Plan Fase 16 Sprint D.
