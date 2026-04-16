# ADR 005 — revive profile seletivo

**Data:** 2026-04-16
**Status:** ACEITO (Fase 17A).

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

- Lint rápido no CI; 0 warnings revive sob o perfil.
- Dívida de documentação assumida explicitamente; reavaliar quando
  abrir código para terceiros ou lançar SDK cliente.

## Alternativas consideradas

- Adicionar ~140 doc comments. Rejeitado por custo/benefício baixo.
- Deixar revive desligado. Rejeitado: perderia regras valiosas
  (error-strings, indent-error-flow, etc.).
