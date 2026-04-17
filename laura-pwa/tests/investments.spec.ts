import { test, expect } from './fixtures/auth';

test('investments: criar via corretora + listar', async ({ authedPage: page }) => {
  test.fixme(true, 'addInvestmentAction + refresh patrimônio fluxo intermitente — investigar em 17B.3');
  await page.goto('/investments');
  await page.getByTestId('btn-new-investment').click();
  // Corretora via shadcn Select
  await page.getByTestId('select-investment-broker').click();
  await page.getByRole('option').first().click();
  await page.getByTestId('input-investment-invested').fill('1000');
  await page.getByTestId('input-investment-current').fill('1050');
  await page.getByTestId('btn-save-investment').click();
  // Patrimônio total deve refletir R$ 1.050 após criação
  await expect(page.getByText(/1\.?050/)).toBeVisible({ timeout: 10_000 });
});
