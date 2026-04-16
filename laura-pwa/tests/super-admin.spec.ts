import { test, expect, loginAs } from './fixtures/auth';

test('super-admin: lista workspaces', async ({ page }) => {
  test.fixme(true, 'needs data-testid in PWA components — reativar em Fase 17B.2');
  await loginAs(page, 'admin@laura.test', 'admin123!');
  await page.goto('/admin/workspaces');
  await expect(page.getByTestId('list-workspaces')).toBeVisible();
});
