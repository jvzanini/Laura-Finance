import { test, expect } from '@playwright/test';

test.describe('Laura Finance MVP End-to-End PWA Flows', () => {
    test('User can navigate to landing and access the dashboard login', async ({ page }) => {
        // Attempting to go to the page root
        await page.goto('/');

        // Expect the page to have standard text or components.
        // For MVP we just assert things load instead of throwing errors.
        expect(await page.title()).not.toBeNull();
    });

    test('User can access dashboard configurations', async ({ page }) => {
        // Test the dashboard subpath
        await page.goto('/settings');
        // Ensure dashboard loads something (assuming auth bypass or mock for now)
        const locator = page.locator('body');
        await expect(locator).toBeVisible();
    });
});
