# Fase 17B.2 — data-testids PWA + reativar 8 specs (spec v1)

**Base:** Fase 17B preparou infra CI E2E real com 8 specs skipped via `test.fixme` pela ausência de data-testids no PWA. Esta fase adiciona os testids e reativa os testes.

## Contexto

Mapeamento concluído em 17B:

| Domínio | Componente alvo | Testids necessários |
|---|---|---|
| Login | `app/(auth)/login/page.tsx` | `input-email`, `input-password`, `btn-login-submit` |
| Register | `app/(auth)/register/page.tsx` | `input-name`, `input-email`, `input-password`, `btn-register-submit` |
| Dashboard layout | `app/(dashboard)/layout.tsx` (Sidebar/Nav) | `btn-logout` |
| Cards | `app/(dashboard)/cards/page.tsx` + `components/features/CardWizard.tsx` | `btn-new-card`, `input-card-name`, `input-card-limit`, `input-card-closing-day`, `input-card-due-day`, `btn-save-card` |
| Invoices | `app/(dashboard)/invoices/page.tsx` | `list-invoices` |
| Transactions | `app/(dashboard)/transactions/page.tsx` + wizard | `btn-new-transaction`, `input-amount`, `input-description`, `select-type-income`, `btn-save-transaction`, `btn-delete-transaction`, `btn-confirm-delete` |
| Goals | `app/(dashboard)/goals/page.tsx` + wizard | `btn-new-goal`, `input-goal-name`, `input-goal-target`, `input-goal-deadline`, `btn-save-goal`, `goal-progress-bar` |
| Investments | `app/(dashboard)/investments/page.tsx` + wizard | `btn-new-investment`, `input-investment-name`, `input-investment-amount`, `select-investment-type-cdb`, `btn-save-investment` |
| Reports | `app/(dashboard)/reports/ReportsView.tsx` | `tab-report-1..9`, `report-1..9-content` |
| Score | `components/features/FinancialScore.tsx` | `score-gauge`, `score-value` |
| Super-admin | `app/(admin)/admin/workspaces/page.tsx` | `list-workspaces` |

**Total:** ~38 testids únicos em ~12 arquivos.

**Login real via UI**: `global-setup.ts` deixa de ser placeholder e passa a fazer login via UI (navegar `/login` + preencher form + submit + salvar storageState). Requer testids de login antes de qualquer authed test.

**Seed E2E** (`scripts/e2e-seed.sql`) já cria `e2e@laura.test` / `e2epass123!` — só precisamos usar.

## Objetivos

1. **Adicionar ~38 data-testids** nos componentes PWA listados acima.
2. **`global-setup.ts`**: trocar placeholder por login real via UI (usa Playwright Chromium headless para navegar login form e salvar storageState).
3. **Remover `test.fixme`** dos 8 specs: auth, cards-invoices, goals, investments, reports, score, super-admin, transactions.
4. **CI `Playwright Tests`** verde com **16+8 = 24 testes passed** (zero skipped).
5. **Commits granulares** por domínio (login/register/dashboard/cards/transactions/goals/investments/reports/score/super-admin).
6. **Tag `phase-17b2-prepared`** aplicada.

## Non-goals

- **Novos specs** (17B.3).
- **Lifecycle completo** de cards (criar → parcelar → pagar). Tests existentes já cobrem happy path superficial. Expansion fica para 17B.3.
- **Mobile viewport** — 17C.
- **Cross-browser** — só chromium (mantém ADR 006).

## Arquitetura

### 1. Padrão data-testid

- Usar prop `data-testid="..."` direto no JSX.
- Em componentes shadcn `<Input>`/`<Button>`, passar como prop comum — shadcn componentes repassam props ao elemento base.
- Convenção:
  - `input-<campo>`: campos de formulário.
  - `btn-<acao>`: botões de ação.
  - `select-<opcao>`: items de select/dropdown.
  - `list-<entidade>`: containers de listas.
  - `<entidade>-<identificador>`: elementos derivados (ex: `score-gauge`, `goal-progress-bar`).

### 2. global-setup real

```ts
import { chromium, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.API_URL || 'http://localhost:8080';
const PWA = process.env.BASE_URL || 'http://localhost:3100';
const AUTH_DIR = path.resolve(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

async function waitHealthy() { /* ... inalterado ... */ }

export default async function globalSetup() {
  if (process.env.SKIP_E2E_AUTH === '1') return;
  await waitHealthy();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${PWA}/login`);
  await page.getByTestId('input-email').fill('e2e@laura.test');
  await page.getByTestId('input-password').fill('e2epass123!');
  await page.getByTestId('btn-login-submit').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await ctx.storageState({ path: AUTH_FILE });
  await browser.close();
}
```

### 3. Remoção de `test.fixme`

Edit linha única em cada um dos 8 specs: remover a linha `test.fixme(true, ...)` — código existente do test funciona quando storageState está válido + testids existem.

## Ordem de execução

1. Sprint A — Login + Register testids (3 + 4 testids).
2. Sprint B — Dashboard layout logout (1 testid).
3. Sprint C — `global-setup.ts` real + `fixtures/auth.ts` verify (já pronta).
4. Sprint D — Remove `auth.spec.ts` fixme + validar local/CI.
5. Sprint E — Cards + CardWizard testids + remove fixme cards-invoices.
6. Sprint F — Transactions testids + remove fixme.
7. Sprint G — Goals testids + remove fixme.
8. Sprint H — Investments testids + remove fixme.
9. Sprint I — Reports tabs + remove fixme.
10. Sprint J — Score component + remove fixme.
11. Sprint K — Super-admin workspaces + remove fixme.
12. Sprint L — CI verde validado + HANDOFF + memory + tag `phase-17b2-prepared`.

## Critérios de aceite

- [ ] 38 data-testids adicionados aos componentes corretos.
- [ ] `global-setup.ts` faz login real UI + storageState.
- [ ] 8 linhas `test.fixme` removidas (uma por spec).
- [ ] `npx playwright test` local (se Docker OK): **24 passed** (0 skipped).
- [ ] CI `Playwright Tests`: **24 passed** + tag `phase-17b2-prepared`.
- [ ] HANDOFF + memory atualizados.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Alguns selects/wizards têm estrutura diferente do esperado (ex.: select nativo vs shadcn Select) | Ler componente antes + adaptar testid apropriadamente |
| Reports tabs pode não ter 9 abas reais | Ler `ReportsView.tsx`; ajustar `tab-report-*` ao número real; spec pode precisar update |
| `btn-logout` pode estar em AppSidebar (não layout direto) | Buscar onde está o handler `/api/auth/logout`; colocar testid no elemento correto |
| Goal progress bar pode ser %CSS sem texto "0%" | Ler componente; se não tiver texto, spec `toContainText('0%')` pode precisar ajuste |
| Wizards (CardWizard, MemberWizard) podem ter steps múltiplos | Testid em cada step necessário para flow completo; spec atual usa só step 1 |
| CI falha se ordem wizard/tests esperam estado ausente | Validar em batch por domínio antes de reabilitar fixme |
