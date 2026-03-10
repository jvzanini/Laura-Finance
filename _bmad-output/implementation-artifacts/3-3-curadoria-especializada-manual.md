# Story 3.3: Curadoria Especializada (Manual e Ajustes)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Analista/Dono das Finanças
I want clicar numa transação no Feed que está com "AI Review" ou que foi classificada erroneamente
So that eu possa re-classificar a categoria manualmente, treinando indiretamente minhas finanças.

## Acceptance Criteria

1. **Given** A lista de transações (RecentTransactionsFeed)
2. **When** Eu clico em um botão "Editar/Re-categorizar" ao lado da transação
3. **Then** Abre um popover/dropdown listando as `categories` do meu workspace
4. **And** Ao selecionar uma, a Server Action `updateTransactionCategory(txId, categoryId)` é chamada.
5. **And** A transação perde a tag "Review" e atualiza o seu `category_name` no feed.

## Tasks / Subtasks
- [x] Criar action `updateTransactionCategoryAction(transactionId, categoryId)` em `transactions.ts`.
- [x] Construir combo box/dropdown em `RecentTransactionsFeed.tsx` para listar as categorias ativas (fetch do workspace) e permitir a troca.
- [x] Atualizar UI optimisticamente.

## Dev Notes

### Technical Requirements
- Pode compartilhar a action ou o state de `CategoryBudget` ou fazer fetch unificado para não dar over-fetching. Mas para simplicidade, um server action simples buscando categorias no ato de abrir o Popover resolve e mantem Vibe clean.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
