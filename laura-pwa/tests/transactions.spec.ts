import { test, expect } from './fixtures/auth';

test('transactions: criar receita + listar + deletar', async ({ authedPage: page }) => {
  await page.goto('/transactions');
  await page.getByTestId('btn-new-transaction').click();
  await page.getByTestId('input-amount').fill('150,00');
  await page.getByTestId('input-description').fill('Receita E2E');
  await page.getByTestId('select-type-income').click();
  await page.getByTestId('btn-save-transaction').click();
  await expect(page.getByText('Receita E2E')).toBeVisible();
  await page.getByTestId('btn-delete-transaction').first().click();
  await page.getByTestId('btn-confirm-delete').click();
  await expect(page.getByText('Receita E2E')).not.toBeVisible();
});
