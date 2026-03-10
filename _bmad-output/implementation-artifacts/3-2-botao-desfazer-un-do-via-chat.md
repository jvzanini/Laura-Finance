# Story 3.2: Botão Desfazer (Excluir Transação)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Usuário
I want poder deletar uma transação listada no feed recente do Dashboard
So that se a IA errou na categorização ou eu registrei sem querer, eu possa desfazer a ação imediatamente.

## Acceptance Criteria

1. **Given** A lista de transações recentes (RecentTransactionsFeed)
2. **When** o usuário clica no botão "🗑️ Desfazer" (Trash/Delete icon) ao lado do card
3. **Then** é chamada a action `deleteTransactionAction(id)`
4. **And** a transação é deletada do Postgres de forma segura (aprovada apenas se pertencer ao workspace do caller).
5. **And** a lista local de transações atualiza removendo a linha em tempo real sem reload total.

## Tasks / Subtasks
- [x] Criar Action `deleteTransactionAction(id: string)` em `lib/actions/transactions.ts`.
- [x] Incorporar botão "Trash/Desfazer" na div de cada transação do `RecentTransactionsFeed.tsx`.
- [x] Usar `useState` ou re-fetch para atualizar localmente a tela mitigando flicker e reload de página.

## Dev Notes

### Technical Requirements
- Garantir segurança confirmando `workspace_id = sessão` no `DELETE FROM transactions` in PostgreSQL.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/components/features/RecentTransactionsFeed.tsx`
- `laura-pwa/src/lib/actions/transactions.ts`
