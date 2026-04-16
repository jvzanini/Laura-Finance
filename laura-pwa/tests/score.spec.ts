import { test, expect } from './fixtures/auth';

test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/dashboard');
  await expect(page.getByTestId('score-gauge')).toBeVisible();
  const valor = await page.getByTestId('score-value').textContent();
  expect(valor).toMatch(/^\d{1,3}$/);
});
