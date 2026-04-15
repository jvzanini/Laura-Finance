import { test, expect } from './fixtures/auth';

test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  await page.goto('/dashboard');
  await expect(page.getByTestId('score-gauge')).toBeVisible();
  const valor = await page.getByTestId('score-value').textContent();
  expect(valor).toMatch(/^\d{1,3}$/);
});
