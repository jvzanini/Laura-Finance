# Fase 17B.2 — data-testids PWA + reativar 8 specs (spec v3 FINAL)

**Base:** Fase 17B entregou infra CI E2E real com 8 specs skipped via `test.fixme` pela ausência de data-testids no PWA. Esta fase adiciona os testids, implementa login real via UI no global-setup, e reativa os testes.

**v1→v3 (consolidado):**
- Reports: tabs não usam shadcn Tabs — são botões custom com ids string (`dre`, `categorias`, `subcategorias`, `membro`, `cartao`, `metodo`, `viagem`, `comparativo`, `tendencia`). `reports.spec.ts` será reescrito para iterar essas ids (ao invés de `1..9`).
- Adicionado entregável: atualizar `HANDOFF.md`, `MEMORY.md` + memory `phase_17b2_complete.md`.
- Confirmadas páginas alvo: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(dashboard)/{cards,transactions,goals,investments,reports,dashboard}/page.tsx`, `app/(dashboard)/layout.tsx`, `app/(admin)/admin/workspaces/page.tsx`, `components/features/CardWizard.tsx`, `components/features/FinancialScore.tsx`, `components/features/FinancialScoreCard.tsx`.

## Objetivos

1. ~38 data-testids adicionados nos componentes mapeados.
2. `global-setup.ts` com login real via UI (navegação → form submit → storageState).
3. `reports.spec.ts` reescrito com ids string reais.
4. 8 `test.fixme` removidos.
5. CI `Playwright Tests` verde com **24 passed** + **0 skipped**.
6. Tag `phase-17b2-prepared`.
7. HANDOFF + memory atualizados.

## Non-goals

- Novos specs (17B.3).
- Lifecycle completo (cards/invoices pay, transactions edit, goals progress real) — 17B.3.
- Cross-browser — só chromium.
- Mobile viewport — 17C.

## Escopo detalhado

### 1. Testids por componente

| Componente | Testids |
|---|---|
| `app/(auth)/login/page.tsx` | `input-email`, `input-password`, `btn-login-submit` |
| `app/(auth)/register/page.tsx` | `input-name`, `input-email`, `input-password`, `btn-register-submit` |
| `app/(dashboard)/layout.tsx` (ou AppSidebar dentro) | `btn-logout` |
| `app/(dashboard)/cards/page.tsx` | `btn-new-card` |
| `components/features/CardWizard.tsx` | `input-card-name`, `input-card-limit`, `input-card-closing-day`, `input-card-due-day`, `btn-save-card` |
| `app/(dashboard)/invoices/page.tsx` | `list-invoices` |
| `app/(dashboard)/transactions/page.tsx` + wizard | `btn-new-transaction`, `input-amount`, `input-description`, `select-type-income`, `btn-save-transaction`, `btn-delete-transaction`, `btn-confirm-delete` |
| `app/(dashboard)/goals/page.tsx` + wizard | `btn-new-goal`, `input-goal-name`, `input-goal-target`, `input-goal-deadline`, `btn-save-goal`, `goal-progress-bar` |
| `app/(dashboard)/investments/page.tsx` + wizard | `btn-new-investment`, `input-investment-name`, `input-investment-amount`, `select-investment-type-cdb`, `btn-save-investment` |
| `app/(dashboard)/reports/ReportsView.tsx` | `tab-report-{dre,categorias,subcategorias,membro,cartao,metodo,viagem,comparativo,tendencia}`, `report-{id}-content` |
| `components/features/FinancialScore.tsx` (ou Card) | `score-gauge`, `score-value` |
| `app/(admin)/admin/workspaces/page.tsx` | `list-workspaces` |

### 2. global-setup real

Navega `/login`, preenche via testids, submete, aguarda redirect `/dashboard`, salva storageState. Substitui placeholder atual.

### 3. reports.spec.ts reescrito

Iterar os 9 ids string reais (não índices numéricos).

### 4. Remove `test.fixme`

Uma linha por spec (8 edits).

## Ordem de execução

1. Sprint A — Login + Register + layout logout testids.
2. Sprint B — global-setup.ts real via UI login.
3. Sprint C — Remove fixme `auth.spec.ts` + validar localmente se Docker voltar (senão CI).
4. Sprint D — Cards + CardWizard testids + remove fixme cards-invoices.
5. Sprint E — Transactions testids + remove fixme.
6. Sprint F — Goals testids + remove fixme.
7. Sprint G — Investments testids + remove fixme.
8. Sprint H — Reports testids (9 tabs+contents) + spec reescrito + remove fixme.
9. Sprint I — Score testids + remove fixme.
10. Sprint J — Super-admin workspaces testid + remove fixme.
11. Sprint K — CI final verde + HANDOFF + memory + tag `phase-17b2-prepared`.

## Critérios de aceite

- [ ] 38 data-testids adicionados.
- [ ] `global-setup.ts` faz login UI real; storageState válido.
- [ ] `reports.spec.ts` usa ids string reais.
- [ ] 8 linhas `test.fixme` removidas.
- [ ] CI `Playwright Tests` verde com 24 passed.
- [ ] HANDOFF + memory + MEMORY.md atualizados.
- [ ] Tag `phase-17b2-prepared` no remoto.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Wizard multistep não compatível com flow do spec | Ler wizard antes; ajustar spec se houver step extra |
| Goal progress bar sem texto literal "0%" | Fallback: assertion mais permissiva (regex `/0\s*%/` ou `toBeVisible()` só) |
| Score component retorna texto não-numérico antes de data carregar | `await page.waitForFunction` ou aumentar timeout |
| CardWizard em modal/dialog vs. página | Modal OK se testids dentro dele forem visíveis pós-click `btn-new-card` |
| Reports `report-{id}-content` só existe para aba ativa | Use `isVisible()` após click + small delay se async |
| select-type-income como select nativo (value=income) | Se for native select, spec precisa usar `selectOption({value: 'income'})` em vez de testid click |
