import { test, expect } from './fixtures/auth';

test('goals: criar meta + verificar progresso 0%', async ({ authedPage: page }) => {
  await page.goto('/goals');
  await page.getByTestId('btn-new-goal').click();
  await page.getByTestId('input-goal-name').fill('Viagem E2E');
  await page.getByTestId('input-goal-target').fill('10000');
  await page.getByTestId('input-goal-deadline').fill('2027-12-31');
  await page.getByTestId('btn-save-goal').click();
  await expect(page.getByText('Viagem E2E')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('goal-progress-bar').first()).toContainText(/0\s*%/);
});
