# Story 9.2: Score Financeiro no Dashboard (Gauge Animado)

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->

## Story

As a Proprietário,
I want ver um Score Financeiro de 0–100 no topo do dashboard, com decomposição dos 4 fatores que o formam,
So that eu tenha um sinal único de saúde financeira sem precisar interpretar 10 gráficos.

## Acceptance Criteria

1. **Given** o usuário logado e o dashboard aberto
2. **When** o componente `FinancialScore` é montado
3. **Then** um gauge SVG animado deve renderizar o score 0–100 com cor e emoji por faixa:
   - Excelente: ≥ 80 ⭐ (verde)
   - Bom: 60–79 🟢 (verde claro)
   - Regular: 40–59 🟡 (amarelo)
   - Crítico: < 40 🔴 (vermelho)
4. **And** 4 barras de progresso animadas devem mostrar a decomposição:
   - `billsOnTime` (peso **35%**) — % de contas pagas em dia
   - `budgetRespect` (peso **25%**) — % de categorias dentro do teto
   - `savingsRate` (peso **25%**) — taxa de poupança sobre receita
   - `debtLevel` (peso **15%**) — razão dívida/receita invertida
5. **And** o layout no dashboard deve usar `lg:col-span-2` ao lado do `DashboardChart` em `lg:col-span-3`
6. **And** animações devem respeitar a regra do `project-context.md`: Framer Motion é permitido neste componente por ele estar na whitelist de "complexidade alta" (ao lado do `MetricCard countUp` e `StreakBadge`)
7. **And** o score deve seguir o Design System: paleta `#10B981` (verde), `#F59E0B` (amarelo), `#EF4444` (vermelho), respeitando contraste WCAG AA
8. **And** ícones de status (✅, ⚠️, ❌) devem acompanhar as cores para não depender só de cor (a11y — daltonismo)

## Tasks / Subtasks
- [x] Componente `FinancialScore.tsx` (154 linhas) com gauge SVG animado.
- [x] Cálculo ponderado de 4 fatores com fórmula `score = 35*bills + 25*budget + 25*savings + 15*debt`.
- [x] Níveis Excelente/Bom/Regular/Crítico com emoji e cor.
- [x] Barras de progresso animadas para cada fator.
- [x] Integração no `dashboard/page.tsx` em `lg:col-span-2`.

## Dev Notes

### Technical Requirements
- **Importante**: no estado atual, a lógica do score vive **apenas no frontend** e usa dados passados via props. Não há persistência histórica do score em banco.
- Integração real com fontes de dados:
  - `billsOnTime` → `cards` + futuras `invoices` pagas
  - `budgetRespect` → `categories.monthly_limit_cents` vs. `transactions` do mês
  - `savingsRate` → `transactions` de entrada vs saída + `investments.monthly_contribution_cents` (Story 8.3)
  - `debtLevel` → soma de `debt_rollovers` + faturas em aberto
- O cálculo deve idealmente migrar para backend Go para consistência entre PWA e nudges do WhatsApp (Epic 4).

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- **[✅ Resolvido 2026-04-11]** ~~Gap crítico: fórmula hardcoded e fatores calculados apenas em memória~~. Criada `fetchFinancialScoreAction` em `laura-pwa/src/lib/actions/financialScore.ts` que consulta `categories` + `transactions` + `debt_rollovers` para calcular `budgetRespect`, `savingsRate` e `debtLevel` reais. `FinancialScore` agora aceita `factors` via prop com fallback. Wrapper `FinancialScoreCard` (server component) chama a action e passa os fatores para o componente visual.
- **[✅ Resolvido 2026-04-11 — commit `acf7994`]** ~~billsOnTime usa fallback fixo~~. Criada migration `000017_create_invoices` (workspace_id, card_id, month_ref, total_cents, due_date, paid_at, status) + refactor da `fetchFinancialScoreAction` para calcular `billsOnTime` como razão entre faturas com `paid_at <= due_date` e faturas liquidadas (`paid_at IS NOT NULL OR due_date < CURRENT_DATE`) nos últimos 90 dias. Fallback 85 só permanece quando o workspace ainda não tem invoices cadastradas (empty dataset, não gap de schema).
- **[✅ Resolvido 2026-04-11 — commits `5d56a31`, `3fc3c0b`, `acf7994`]** ~~Sem persistência histórica do score~~. Migration `000018_create_financial_score_snapshots` + job cron diário `runDailyScoreSnapshot` em Go às 3h server time + server action `fetchScoreHistoryAction` no PWA que devolve os últimos N snapshots ordenados cronologicamente. A base para um componente `ScoreEvolutionChart` no dashboard está pronta — só falta plugar o gráfico.
- **[Backlog]** Integração com nudges do Epic 4 (disparar alerta WhatsApp quando score cair de faixa entre dois snapshots consecutivos) — os dados históricos já existem, falta só o trigger diário que compara `snapshot_date - 1` vs hoje e envia a mensagem.
### File List
- `laura-pwa/src/components/features/FinancialScore.tsx`
- `laura-pwa/src/components/features/FinancialScoreCard.tsx` (server wrapper, adicionado 2026-04-11)
- `laura-pwa/src/lib/actions/financialScore.ts` (adicionado 2026-04-11)
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
