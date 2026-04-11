# Story 9.3: Relatórios Multidimensionais — 9 Abas Analíticas

Status: done

<!-- Story retro-documentada em 2026-04-11. Código já em produção nos commits 490b3ec e 0b50751. -->
<!-- Esta story supersedes parcialmente a Story 6.2 (DRE Simplificado). -->

## Story

As a Empreendedor/Proprietário,
I want que a rota `/reports` tenha abas analíticas profundas com filtros cruzados,
So that eu consiga responder qualquer pergunta sobre onde o dinheiro vai sem precisar exportar CSV.

## Acceptance Criteria

1. **Given** o Workspace aberto em desktop ≥ 1024px
2. **When** acessada `/reports`
3. **Then** devem existir **9 abas** navegáveis (ordem e nomes canônicos):
   1. **DRE** (default) — Receitas Brutas, Despesas Fixas, Despesas Variáveis, Investimentos, Resultado Líquido
   2. **Categorias** — breakdown por categoria-raiz
   3. **Subcategorias** — drill-down na árvore da Story 8.1
   4. **Por Membro** — segmentação por `user_id` do workspace
   5. **Por Cartão** — segmentação por `card_id`
   6. **Método de Pagamento** — crédito / débito / pix / dinheiro
   7. **Modo Viagem** — view especial gated por toggle na sidebar
   8. **Comparativo** — mês atual vs mês anterior (ou período customizado)
   9. **Tendência** — série temporal móvel
4. **And** os filtros globais (mês, membro, categoria, tipo entrada/saída/saque) devem afetar **todas** as abas simultaneamente
5. **And** a aba **Modo Viagem** só deve ser acessível quando o usuário ativa o toggle "Modo Viagem" na sidebar — antes disso, a aba fica oculta ou desabilitada
6. **And** esta story **supersedes parcialmente a Story 6.2** (DRE Simplificado): os ACs da 6.2 continuam válidos como subconjunto (a aba DRE faz o papel dela), mas a implementação real é multi-aba
7. **And** o export CSV da Story 6.3 continua sendo fornecido como ponte para o contador — disponível em cada aba
8. **And** o layout deve respeitar o `project-context.md`: dark mode, shadcn Tabs, Recharts, tap targets ≥ 44px no mobile

## Tasks / Subtasks
- [x] Página `/reports` (413 linhas) com shadcn `Tabs` de 9 abas.
- [x] Componente DRE com as 5 linhas canônicas (Receitas Brutas, Despesas Fixas, Despesas Variáveis, Investimentos, Resultado Líquido).
- [x] Filtros globais (mês, membro, categoria, tipo) aplicados via state compartilhado.
- [x] Gating da aba "Modo Viagem" por toggle na sidebar.
- [x] Export CSV herdado da Story 6.3.

## Dev Notes

### Technical Requirements
- Estado dos filtros deve ficar em URL search params para permitir compartilhamento de view (ex: enviar link para contador).
- Abas pesadas (Tendência, Comparativo) devem usar `Suspense` + skeletons para não bloquear o render inicial.
- Aba "Modo Viagem" existe para separar gastos de uma viagem específica do baseline mensal — os ACs detalhados do Modo Viagem são tópico para uma story futura 9.4.

## Dev Agent Record
### Agent Model Used
N/A — Implementação feita fora do fluxo BMAD (vibe coding), retro-documentada por auditoria de 2026-04-11.
### Completion Notes List
- **Relação com Story 6.2**: a aba "DRE" é a implementação concreta da Story 6.2. Nenhum AC da 6.2 é violado.
- **Gap conhecido**: o toggle "Modo Viagem" na sidebar hoje é um estado local sem persistência. Para virar feature confiável, precisa persistir em `workspaces.settings` ou tabela dedicada `travel_modes`.
- Abas "Por Cartão", "Por Membro", "Método de Pagamento" requerem joins Postgres otimizados — considerar materialized views se a tabela `transactions` crescer muito.
### File List
- `laura-pwa/src/app/(dashboard)/reports/page.tsx`
