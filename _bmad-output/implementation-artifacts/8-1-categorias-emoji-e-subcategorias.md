# Story 8.1: Enriquecimento da Taxonomia de Categorias (Emoji, Descrição e Subcategorias)

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->
<!-- Esta story formaliza decisões de design que foram implementadas fora do fluxo BMAD. -->

## Story

As a Proprietário/Administrador,
I want que cada Categoria tenha emoji, descrição textual e uma lista de subcategorias navegáveis,
So that eu e minha família tenhamos uma linguagem visual imediata e consistente ao classificar gastos, reduzindo fricção cognitiva.

## Acceptance Criteria

1. **Given** a tabela `categories` pré-existente do Epic 1.6
2. **When** a migration `000015_add_emoji_to_categories.sql` é aplicada
3. **Then** as colunas `emoji VARCHAR(10)` e `description VARCHAR(500)` devem ser adicionadas sem perda de dados (uso de `ADD COLUMN IF NOT EXISTS`).
4. **And** a rota `/categories` deve renderizar uma árvore expansível de 8 categorias-raiz (Pessoal, Moradia, Alimentação, Transporte, Lazer, Finanças, Trabalho, Viagem) com ~36 subcategorias, cada uma com emoji próprio.
5. **And** a server action `seedCategoriesAction` deve popular em batch transacional (BEGIN/COMMIT/ROLLBACK) a árvore default a partir de um payload JSON tipado.
6. **And** a action `addCategoryAction` deve aceitar emoji e description em novos cadastros, preservando a regra de `monthly_limit_cents` (INTEGER, nunca float).
7. **And** a action `fetchCategoriesAction` deve fazer JOIN com `subcategories` e retornar a árvore (categoria > subcategorias) para render no PWA.

## Tasks / Subtasks
- [x] Migration `000011_create_subcategories.sql` (pré-requisito — define a hierarquia).
- [x] Migration `000015_add_emoji_to_categories.sql` com `ADD COLUMN IF NOT EXISTS` para idempotência.
- [x] Página `/categories` com lista expansível, 8 categorias hardcoded com subcategorias, emoji por item.
- [x] Server action `addCategoryAction(FormData)` incluindo emoji + description + monthly_limit_cents.
- [x] Server action `fetchCategoriesAction()` com JOIN em subcategories retornando árvore.
- [x] Server action `fetchCategorySummariesAction()` retornando apenas id+name (usada em dropdowns).
- [x] Server action `seedCategoriesAction(data)` com BEGIN/COMMIT/ROLLBACK para seed transacional em batch.

## Dev Notes

### Technical Requirements
- `emoji VARCHAR(10)` acomoda sequências ZWJ do Unicode (ex: bandeiras).
- `description VARCHAR(500)` cabe tooltip/explicação sem custo de TEXT.
- **Sempre** usar transação para batch inserts (seed) para evitar categoria sem subcategorias em caso de falha parcial.
- Respeitar a regra do `project-context.md`: `monthly_limit_cents` é INTEGER, **nunca** float/decimal.

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- **[✅ Resolvido 2026-04-11]** ~~A listagem do /categories consumia dados hardcoded~~. Separado em `page.tsx` (server component que chama `fetchCategoriesAction`) + `CategoriesView.tsx` (client component que renderiza e guarda o estado de expansão) + `default-seed.ts` (payload estático das 8 categorias × 36 subcategorias). Quando o workspace está vazio, um empty state mostra um CTA "Popular categorias padrão" que chama `seedCategoriesAction(DEFAULT_SEED_CATEGORIES)` via `useTransition` — um clique popula o banco via batch transacional e o `window.location.reload()` busca o estado real. O limite mensal de cada categoria agora aparece como badge quando > 0.
### File List
- `infrastructure/migrations/000011_create_subcategories.sql`
- `infrastructure/migrations/000015_add_emoji_to_categories.sql`
- `laura-pwa/src/app/(dashboard)/categories/page.tsx` (server component, refatorado 2026-04-11)
- `laura-pwa/src/app/(dashboard)/categories/CategoriesView.tsx` (client component visual, adicionado 2026-04-11)
- `laura-pwa/src/app/(dashboard)/categories/default-seed.ts` (seed payload, adicionado 2026-04-11)
- `laura-pwa/src/lib/actions/categories.ts`
