# PWA Lint Sprint 1 — Execução

Data: 2026-04-15

## Baseline

- Total `no-explicit-any` no PWA (npm run lint): **71 warnings**
- Escopo sprint 1: `src/lib/actions/`

## Top arquivos em `src/lib/actions/` (grep)

| Arquivo | Ocorrências any |
|---|---|
| src/lib/actions/adminConfig.ts | 20 |
| src/lib/actions/categories.ts | 3 |
| src/lib/actions/userProfile.ts | 2 |
| src/lib/actions/phones.ts | 1 |

Total em actions: ~26 ocorrências. Outros 45 warnings vivem em `src/app/(admin)/*` e `src/components/admin/*` (fora do escopo sprint 1).

## Estratégia

- Extrair tipos para `src/types/` quando repetidos.
- `any` → tipo concreto ou `unknown` + type guard.
- Validar via `npx tsc --noEmit` e `npx eslint <file> --max-warnings=0`.
- Foco pragmatico: 2-3 arquivos top, commit incremental.
