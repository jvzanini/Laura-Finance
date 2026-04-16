import { test, expect } from './fixtures/auth';

test('cards-invoices: criar cartao + despesa + ver fatura + push', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/cards');
  await page.getByTestId('btn-new-card').click();
  await page.getByTestId('input-card-name').fill('Cartao E2E');
  await page.getByTestId('input-card-limit').fill('5000,00');
  await page.getByTestId('input-card-closing-day').fill('5');
  await page.getByTestId('input-card-due-day').fill('15');
  await page.getByTestId('btn-save-card').click();
  await expect(page.getByText('Cartao E2E')).toBeVisible();
  await page.goto('/invoices');
  await expect(page.getByTestId('list-invoices')).toBeVisible();
});
