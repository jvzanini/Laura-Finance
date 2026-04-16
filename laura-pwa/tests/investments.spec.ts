import { test, expect } from './fixtures/auth';

test('investments: criar CDB + listar', async ({ authedPage: page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await page.goto('/investments');
  await page.getByTestId('btn-new-investment').click();
  await page.getByTestId('input-investment-name').fill('CDB E2E');
  await page.getByTestId('input-investment-amount').fill('1000,00');
  await page.getByTestId('select-investment-type-cdb').click();
  await page.getByTestId('btn-save-investment').click();
  await expect(page.getByText('CDB E2E')).toBeVisible();
});
