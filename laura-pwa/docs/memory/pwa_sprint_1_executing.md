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

- Extrair tipos para `src/types/admin.ts` quando repetidos.
- `any` → tipo concreto ou `unknown` + type guard.
- Validar via `npx tsc --noEmit` e `npm run lint`.
- Foco pragmatico: arquivos top em actions/, commit incremental.

## Resultado

- Arquivos tipados: **4/4 em `src/lib/actions/`**
  - `adminConfig.ts` — 20 any removidos (JsonValue + tipos concretos + AdminWriteResult)
  - `categories.ts` — 3 any removidos (CategorySeedItem / CategoryTemplateRow)
  - `userProfile.ts` — 2 any removidos (unknown + type guard pontual)
  - `phones.ts` — 1 any removido (unknown + type guard pontual)
- Novo arquivo: `src/types/admin.ts` (JsonValue, SystemConfigRow, SubscriptionPlanRow, PaymentProcessorRow, AdminOptionRow, AdminWorkspaceRow, AdminAuditLogEntry, AdminWriteResult, LauraGoError, isLauraGoError).
- Warnings antes: **71**
- Warnings depois: **42**
- Delta: **−29 (−41%)**
- `tsc --noEmit`: limpo.

## Commits

1. `docs(pwa): kickoff sprint 1 real execution (top 5 arquivos)`
2. `fix(pwa): tipa adminConfig.ts (reduz no-explicit-any -23)`
3. `fix(pwa): tipa categories.ts (reduz no-explicit-any -3)`
4. `fix(pwa): tipa userProfile.ts + phones.ts (reduz no-explicit-any -3)`

## Próximos passos (Fase 15)

- Tipar 42 warnings restantes (todos em `src/app/(admin)/*` e `src/components/admin/*`):
  - `AuditLogView.tsx`, `AdminConfigEditor.tsx`, `AdminOptionsCrud.tsx`, `GoalTemplatesEditor.tsx`, `ScoreEditor.tsx`, `WorkspacesView.tsx`
  - `ai-config/AiConfigEditor.tsx`, `plans/PlansEditor.tsx`, `processors/page.tsx`, `scoring/page.tsx`, `workspaces/page.tsx`, `audit-log/page.tsx`, `ai-config/page.tsx`
  - `components/features/MemberWizard.tsx`
- Considerar zod schemas para runtime validation de payloads admin (configs jsonb).
- Reusar `JsonValue` e tipos de `src/types/admin.ts` nos componentes UI.
