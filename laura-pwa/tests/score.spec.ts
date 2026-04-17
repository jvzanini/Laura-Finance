import { test, expect } from './fixtures/auth';

test('score: gauge renderizado com valor numerico', async ({ authedPage: page }) => {
  await page.goto('/dashboard');
  await expect(page.getByTestId('score-gauge')).toBeVisible({ timeout: 15_000 });
  // Score anima de 0 até valor final; esperamos um numero de 1-3 dígitos
  await expect(page.getByTestId('score-value')).toHaveText(/^\d{1,3}$/, { timeout: 10_000 });
});
