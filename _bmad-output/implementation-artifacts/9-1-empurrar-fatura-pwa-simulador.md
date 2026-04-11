# Story 9.1: Simulador "Empurrar Fatura" no PWA + Persistência de Rolagens

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->
<!-- Esta story é a contraparte PWA do Epic 5 (que era WhatsApp-only). -->

## Story

As a Proprietário em aperto,
I want simular "empurrar" uma fatura de cartão usando maquininhas (saques no crédito) direto no PWA, escolhendo institution, parcelamento e pagamento inicial,
So that eu veja exatamente quanto vou pagar em taxas antes de fazer a operação real, e tenha um histórico permanente das rolagens feitas.

## Acceptance Criteria

1. **Given** a migration `000014_create_debt_rollovers.sql` aplicada e pelo menos um cartão cadastrado no workspace
2. **When** eu acesso `/invoices/push` no PWA
3. **Then** devo preencher: cartão (dropdown alimentado de `cards`), valor da fatura, pagamento inicial, maquininha (InfinitePay, Ton, Stone, Mercado Pago, Cielo, PagBank), parcelamento 1x–12x
4. **And** a tela deve calcular e exibir uma **timeline de operações** com pagamento + saque detalhado, usando a tabela de taxas hardcoded por `institution × parcelamento`
5. **And** 4 summary cards devem mostrar: Valor Fatura, Total Sacado, Total Taxas, Quantidade de Operações
6. **And** o botão "Salvar operação" deve persistir em `debt_rollovers` com:
   - `operations_json` JSONB contendo a timeline completa (array de `{type, amount_cents, description, fee_cents}`)
   - `fee_percentage` DECIMAL(5,2) da maquininha
   - `total_fees_cents` e `invoice_value_cents` como INTEGER
   - `status` default `concluido` (aceita `parcial`, `cancelado`)
7. **And** `card_id` deve ter FK `ON DELETE SET NULL` (preservar histórico mesmo se o cartão for removido do workspace)
8. **And** indexes `idx_rollovers_workspace` e `idx_rollovers_card` para queries de histórico
9. **And** esta story representa a **contraparte PWA do Epic 5**: o motor matemático continua sendo o ponto autoritativo quando acionado via WhatsApp; o PWA oferece a mesma capacidade visualmente.

## Tasks / Subtasks
- [x] Migration `000014_create_debt_rollovers.sql` com UUID, workspace cascade, card SET NULL, JSONB.
- [x] Página `/invoices/push` (315 linhas) com form + timeline visual + summary cards.
- [x] Tabela de taxas hardcoded por institution × parcelamento (InfinitePay, Ton, Stone, Mercado Pago, Cielo, PagBank, 1x–12x).
- [x] Server action `addDebtRolloverAction(data)` serializando `operations_json` como JSONB.
- [x] Server action `fetchDebtRolloversAction()` retornando histórico com status, institution, fees.

## Dev Notes

### Technical Requirements
- `operations_json` JSONB permite consultas com operadores `->` e `->>` (ex: `WHERE operations_json->'summary'->>'total' > '100000'`) — não usar `TEXT`.
- `fee_percentage DECIMAL(5,2)` é **exceção** à regra de "cents-only" porque é uma taxa percentual, não um valor monetário — armazena ex: `3.99` para "3,99%".
- Todos os valores monetários (`invoice_value_cents`, `total_fees_cents`, e cada `amount_cents` dentro do JSONB) permanecem INTEGER em centavos.
- `card_id ON DELETE SET NULL` é intencional: se o usuário remove o cartão, o histórico permanece utilizável para contabilidade/relatórios.
- Em paralelo, o motor Go do Epic 5 continua fonte de verdade para o cálculo — o PWA hoje usa tabela hardcoded mas deve migrar para chamar um endpoint Go quando disponível.

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- **Gap crítico**: tabela de taxas está hardcoded no frontend. Precisa migrar para backend (Go ou tabela `payment_processors`) para permitir atualização sem deploy.
- Falta sincronização bidirecional com Epic 5 (WhatsApp): uma rolagem feita via chat não aparece no `/invoices/push`. Backlog: usar a mesma tabela `debt_rollovers` como sink único para ambos os fluxos.
### File List
- `infrastructure/migrations/000014_create_debt_rollovers.sql`
- `laura-pwa/src/app/(dashboard)/invoices/push/page.tsx`
- `laura-pwa/src/lib/actions/invoices.ts`
