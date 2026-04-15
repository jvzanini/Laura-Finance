import { test, expect } from './fixtures/auth';

test('reports: navega 9 abas + grafico presente', async ({ authedPage: page }) => {
  await page.goto('/reports');
  for (let i = 1; i <= 9; i++) {
    await page.getByTestId(`tab-report-${i}`).click();
    await expect(page.getByTestId(`report-${i}-content`)).toBeVisible();
  }
});
