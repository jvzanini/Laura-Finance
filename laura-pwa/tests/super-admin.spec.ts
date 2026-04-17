import { test, expect, loginAs } from './fixtures/auth';

test('super-admin: lista workspaces', async ({ page }) => {
  await loginAs(page, 'admin@laura.test', 'admin123!');
  await page.goto('/admin/workspaces');
  await expect(page.getByTestId('list-workspaces')).toBeVisible({ timeout: 10_000 });
});
