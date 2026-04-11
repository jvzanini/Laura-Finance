# Story 8.2: Módulo de Metas Financeiras (Financial Goals)

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->

## Story

As a Proprietário/Administrador,
I want cadastrar e acompanhar metas financeiras com prazo, valor-alvo, emoji e cor,
So that eu visualize o progresso de objetivos concretos (Viagem, Carro, Casa, iPhone, Fundo de Emergência, Educação, Casamento, Investimento) e mantenha a família motivada a poupar.

## Acceptance Criteria

1. **Given** a migration `000012_create_financial_goals.sql` aplicada
2. **When** eu acesso `/goals` no PWA
3. **Then** devo ver 3 summary cards (Total Acumulado, Meta Total, Objetivos Ativos) e uma grid de cards por meta
4. **And** cada card deve mostrar emoji, progress bar, valor acumulado vs meta, prazo, e "guardar por mês" calculado via `(target − current) / meses_restantes`
5. **And** o formulário de criação deve expor 8 presets pré-configurados (Viagem ✈️, Carro 🚗, Casa 🏠, iPhone 📱, Fundo de Emergência 🛡️, Educação 🎓, Casamento 💍, Investimento 📈) + modo manual
6. **And** `target_cents` e `current_cents` devem ser INTEGER (centavos) — proibido float
7. **And** `deadline` deve ser DATE NULL-safe, `status` default `active` com transições para `completed` e `paused`
8. **And** a tabela deve ter `workspace_id` com `ON DELETE CASCADE` e index `idx_goals_workspace` garantindo isolamento multi-tenant e performance
9. **And** `color` default `#8B5CF6` (violeta do Design System) e `emoji` default `🎯`

## Tasks / Subtasks
- [x] Migration `000012_create_financial_goals.sql` com UUID PK, workspace cascade, index tenant.
- [x] Página `/goals` (351 linhas) com 3 summary cards, grid de cards com progress bars.
- [x] Form de criação com 8 presets + modo manual.
- [x] Server action `addGoalAction(FormData)` validando nome/meta/prazo e convertendo Reais → cents via `Math.round(x * 100)`.
- [x] Server action `fetchGoalsAction()` retornando goals do workspace com campos formatados (`targetAmount`, `currentAmount` em Reais para view).
- [x] Cálculo "guardar por mês" feito em view layer (sem persistência).

## Dev Notes

### Technical Requirements
- Converter Reais → cents **apenas na entrada** da server action.
- Converter cents → Reais **apenas no render** (view layer).
- Usar `gen_random_uuid()` no default do ID (PostgreSQL 13+).
- `status` NÃO é enum — string livre controlada pela aplicação. Valores canônicos: `active`, `completed`, `paused`.
- Respeitar `project-context.md`: dark mode, shadcn Card/Progress, cores do Design System.

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- A transição de status (`active → completed`) ainda é manual na UI. Backlog implícito: trigger automático quando `current_cents >= target_cents`.
- Falta backend Go consumindo a tabela para nudges preditivos ("você está 20% atrás da meta X") — análogo ao Epic 4 para categorias.
### File List
- `infrastructure/migrations/000012_create_financial_goals.sql`
- `laura-pwa/src/app/(dashboard)/goals/page.tsx`
- `laura-pwa/src/lib/actions/goals.ts`
