import { test, expect } from '@playwright/test';

// Smoke tests — apenas verificam que rotas públicas carregam e rotas
// protegidas redirecionam para /login quando não autenticado.
// Fixtures de auth virão em fase posterior de E2E expandido.

test.describe('Laura Finance MVP — smoke tests de rotas', () => {
    test('landing carrega', async ({ page }) => {
        await page.goto('/');
        expect(await page.title()).not.toBeNull();
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });

    test.describe('rotas públicas de auth', () => {
        const publicRoutes = ['/login', '/register', '/forgot-password'];

        for (const route of publicRoutes) {
            test(`${route} carrega`, async ({ page }) => {
                const response = await page.goto(route);
                // Aceita 200 ou 3xx (ex: rewrite interno do Next). Rejeita 5xx.
                if (response) {
                    expect(response.status()).toBeLessThan(500);
                }
                const body = page.locator('body');
                await expect(body).toBeVisible();
                // Não deve exibir overlay de erro do Next.
                await expect(page.locator('text=/Application error|Server Error/i')).toHaveCount(0);
            });
        }
    });

    test.describe('rotas protegidas redirecionam para /login', () => {
        const protectedRoutes = [
            '/dashboard',
            '/admin',
            '/categories',
            '/transactions',
            '/cards',
            '/goals',
            '/investments',
            '/invoices',
            '/reports',
            '/settings',
        ];

        for (const route of protectedRoutes) {
            test(`${route} sem auth → /login`, async ({ page }) => {
                await page.goto(route);
                // Espera a navegação estabilizar em /login (ou variação como /login?next=...).
                await page.waitForURL(/\/login/, { timeout: 10_000 });
                expect(page.url()).toContain('/login');
            });
        }
    });
});
