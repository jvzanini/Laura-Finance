import { test, expect } from '@playwright/test';

test('auth: register + login + logout happy path', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  const stamp = Date.now();
  const email = `user${stamp}@laura.test`;
  await page.goto('/register');
  await page.getByTestId('input-name').fill('User E2E');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill('Senha123!');
  await page.getByTestId('btn-register-submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByTestId('btn-logout').click();
  await expect(page).toHaveURL(/\/login/);
});
