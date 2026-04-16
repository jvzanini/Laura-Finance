import { test, expect } from './fixtures/auth';

test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/reports');
  for (let i = 1; i <= 9; i++) {
    await page.getByTestId(`tab-report-${i}`).click();
    await expect(page.getByTestId(`report-${i}-content`)).toBeVisible();
  }
});
