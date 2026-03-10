# Story 1.6: Setup de Categorias e Orçamentos Básicos

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Proprietário/Administrador,
I want visualizar e construir caçambas financeiras ("Lazer, Mercado") especificando Tetos Fixos Mensais,
So that os alertas e nudges de 80% possuam referências estáticas e matemáticas precisas para avisar o usuário desatento.

## Acceptance Criteria

1. **Given** a tela do dashboard com categorias 
2. **When** eu defino, por exemplo, R$ 2000,00 limitando 'Supermercado'
3. **Then** eu visualizarei componentes dinâmicos de barra de progresso (CategoryProgressBars) 
4. **And** este valor será gravado em `cents` no backend atrelado o ID global orgânico dos gastos.

## Tasks / Subtasks
- [x] Construir Migration de Categorias (`000005_create_categories.sql`).
  - [x] Campos: `workspace_id`, `name`, `monthly_limit_cents` e `color`.
- [x] Componente `CategoryBudget` renderizando Barras de progresso com `shadcn/ui/progress`.
  - [x] Formulário integrado "Add Category" para estipular o limite em Reais e injetar o Server Action.
- [x] Logica Server-Side (`lib/actions/categories.ts`)
  - [x] Converter R$ inserido pelo usuário no PWA (Float/Decimal) para `Cents` (Integer) em prol da restrição técnica.

## Dev Notes

### Technical Requirements
- Utilize `shadcn/ui` `card` e `progress`.
- Ao receber `2000.50`, faça `Math.round(2000.50 * 100)` para salvar `200050` (Cents) no PostgreSQL! Nenhuma coluna FLOAT.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `infrastructure/migrations/000005_create_categories.sql`
- `laura-pwa/src/lib/actions/categories.ts`
- `laura-pwa/src/components/features/CategoryBudget.tsx`
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
