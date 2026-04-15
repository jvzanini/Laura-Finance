/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, Page } from '@playwright/test';
import path from 'node:path';

const STORAGE = path.resolve(__dirname, '../.auth/user.json');

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-login-submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function expectDarkMode(page: Page) {
  await expect(page.locator('html')).toHaveClass(/dark/);
}
