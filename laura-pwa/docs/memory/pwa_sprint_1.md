# PWA Lint Sprint 1 — cleanup `any`

Data: 2026-04-15
Fase: 13 (parte E do plano v3)
Comando base: grep `": any\b| any\[\]| any,| any\)"` em `src/lib/actions/`

## Top arquivos com `any` (lib/actions)

| Arquivo                             | Ocorrências |
| ----------------------------------- | ----------- |
| src/lib/actions/adminConfig.ts      | 21          |
| src/lib/actions/categories.ts       | 3           |
| src/lib/actions/userProfile.ts      | 2           |
| src/lib/actions/phones.ts           | 1           |

Total: 27 ocorrências em 4 arquivos.

## Estratégia

1. `adminConfig.ts` é o maior ofensor (21) — provavelmente wrappers
   de config + respostas dinâmicas. Priorizar para sprint 1.
2. Demais têm 1-3 ocorrências — cleanup rápido em sprint 2.

## Status

- Iniciado: 2026-04-15
- Status: in-progress (POC)
- Commits: TBD
- Próximos passos: tipar primeiros `any` de `adminConfig.ts` como POC;
  concluir cleanup nas próximas fases (14+).

## Ver também

- Plano Fase 13 v3 parte E.
- `.eslintrc` do PWA (regra `@typescript-eslint/no-explicit-any`).
