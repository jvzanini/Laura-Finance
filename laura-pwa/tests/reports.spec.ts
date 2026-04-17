import { test, expect } from './fixtures/auth';

// Reports tabs usam ids string (não numéricos). 9 tabs no ReportsView.
const REPORT_TABS = [
  'dre',
  'categorias',
  'subcategorias',
  'membro',
  'cartao',
  'metodo',
  'viagem',
  'comparativo',
  'tendencia',
] as const;

test('reports: navega 9 abas + conteudo presente', async ({ authedPage: page }) => {
  await page.goto('/reports');
  for (const id of REPORT_TABS) {
    await page.getByTestId(`tab-report-${id}`).click();
    await expect(page.getByTestId(`report-${id}-content`)).toBeVisible({ timeout: 10_000 });
  }
});
