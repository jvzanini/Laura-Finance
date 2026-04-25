import { test } from '@playwright/test';

test.describe('Laura visual snapshots fase 19.2', () => {
  test('LP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3100/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/laura-shot-lp.png', fullPage: true });
  });

  test('Login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3100/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/laura-shot-login.png', fullPage: true });
  });

  test('CTA section LP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3100/');
    await page.waitForLoadState('networkidle');
    const cta = page.locator('section[aria-labelledby="cta-final-heading"]');
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await cta.screenshot({ path: '/tmp/laura-shot-cta.png' });
  });

  test('Hero section LP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3100/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const hero = page.locator('section').first();
    await hero.screenshot({ path: '/tmp/laura-shot-hero.png' });
  });

  test('Navbar zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3100/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const navbar = page.locator('header').first();
    await navbar.screenshot({ path: '/tmp/laura-shot-navbar.png' });
  });
});
