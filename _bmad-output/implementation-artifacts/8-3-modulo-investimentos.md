# Story 8.3: Módulo de Investimentos (Investment Tracking por Corretora)

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->

## Story

As a Proprietário Prosumer,
I want cadastrar meus investimentos por corretora (broker), tipo e aporte mensal,
So that eu veja meu patrimônio total, rendimento percentual e disciplina de aportes consolidados no mesmo dashboard dos gastos.

## Acceptance Criteria

1. **Given** a migration `000013_create_investments.sql` aplicada
2. **When** eu acesso `/investments` no PWA
3. **Then** devo ver 4 summary cards: Patrimônio Total, Total Investido, Rendimento (com % e sinal), Aporte Mensal
4. **And** o formulário deve permitir seleção de broker a partir de uma lista visual com 10 opções (Ágora, BTG, Clear, Inter, Nu Invest, Rico, XP, Binance, IC Markets, IQ Option)
5. **And** o campo `type` deve aceitar `Investimentos | Cripto | Poupança`
6. **And** cada card da grid deve exibir broker, tipo, emoji, valor atual, rendimento percentual calculado em view `((current − invested) / invested) * 100`, e aporte mensal
7. **And** `invested_cents`, `current_cents` e `monthly_contribution_cents` devem ser INTEGER em centavos — proibido float
8. **And** `workspace_id` com `ON DELETE CASCADE` e index `idx_investments_workspace`
9. **And** emoji default `🏦` editável no cadastro

## Tasks / Subtasks
- [x] Migration `000013_create_investments.sql` com UUID, workspace cascade, index tenant.
- [x] Página `/investments` (292 linhas) com 4 summary cards e grid de cards.
- [x] Broker picker visual com 10 opções (tradicionais, crypto, forex).
- [x] Server action `addInvestmentAction(FormData)` validando name/broker/type e convertendo R$ → cents.
- [x] Server action `fetchInvestmentsAction()` retornando investments do workspace.
- [x] Cálculo de rendimento % feito em view layer (inline), sem persistência.

## Dev Notes

### Technical Requirements
- Rendimento percentual **não** é armazenado — calculado on-the-fly para sempre refletir `invested_cents` e `current_cents` atuais.
- `type` é VARCHAR(50) controlado pela app (não enum) para permitir expansão futura (ex: "Previdência", "Fundos Imobiliários").
- Respeitar `project-context.md`: dark mode, shadcn, cores do Design System.
- Valores de atualização do `current_cents` hoje são manuais — integração com APIs de corretoras é backlog futuro.

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- **Gap conhecido**: não há mecanismo de atualização automática de `current_cents` (cotações). Usuário atualiza manualmente. Integração com broker APIs / B3 é trabalho futuro.
- Falta consolidação no Score Financeiro (Story 9.2) — o fator `savingsRate` deveria considerar aportes mensais da tabela `investments`.
### File List
- `infrastructure/migrations/000013_create_investments.sql`
- `laura-pwa/src/app/(dashboard)/investments/page.tsx`
- `laura-pwa/src/lib/actions/investments.ts`
