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
- **[⚠️ Pendente]** `billsOnTime` ainda usa fallback fixo (85) — depende de colunas `paid_at` / histórico de pagamento em `invoices`, que não existem no schema atual. Comentário `// TODO backlog` deixado na action.
- **[Backlog]** Sem persistência histórica: impossível gerar gráfico "evolução do score nos últimos 6 meses". Futuro: tabela `financial_score_snapshots` com cron diário.
- **[Backlog]** Integração com nudges do Epic 4: quando o score cair de uma faixa para outra (ex: Bom → Regular), deveria disparar um alerta WhatsApp.
### File List
- `laura-pwa/src/components/features/FinancialScore.tsx`
- `laura-pwa/src/components/features/FinancialScoreCard.tsx` (server wrapper, adicionado 2026-04-11)
- `laura-pwa/src/lib/actions/financialScore.ts` (adicionado 2026-04-11)
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
