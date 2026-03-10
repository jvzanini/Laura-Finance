# Story 3.1: Visualização de Transações Instantâneas

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Usuário Ativo
I want abrir o PWA da Laura e ver meus lançamentos em tempo real no feed de transações
So that eu possa ter controle e visibilidade imediata das finanças (quem gastou, quanto, quando e o grau de confiança da IA).

## Acceptance Criteria

1. **Given** o Dashboard logado no PWA
2. **When** ocorrer um insert na tabela `transactions` pelo WhatsApp/Go e eu atualizar a página PWA
3. **Then** a transação nova aparece no topo de um "Feed de Lançamentos Recentes".
4. **And** mostra o ícone de Warning ⚠️ se `needs_review = true` ou confiança < 0.8.

## Tasks / Subtasks
- [x] Criar Server Action em PWA `lib/actions/transactions.ts` e exportar `fetchRecentTransactionsAction()`.
- [x] Criar UI `RecentTransactionsFeed` importável no Dashboard.
- [x] Desenhar o feed usando lucide-react, cards estilizados com badge "Credit/Income/Expense" e data/hora relativas.
- [x] Injetar o componente `RecentTransactionsFeed` abaixo dos Wizards no `dashboard/page.tsx`.

## Dev Notes

### Technical Requirements
- Mostrar transações ordenadas decrescente por `transaction_date`.
- Limitar a 10 recentes para não explodir tela (com botão "ver mais" no futuro).
- Usar Tailwind CSS para diferenciar gastos (vermelho) de ganhos (verde).

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/lib/actions/transactions.ts`
- `laura-pwa/src/components/features/RecentTransactionsFeed.tsx`
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
