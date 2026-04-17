import { test, expect, Page } from '@playwright/test';

// Testes do fluxo de paywall. Dependem do seed
// `infrastructure/seeds/test_paywall.sql` ter sido aplicado no DB
// do ambiente de teste (criar os usuários paywall-expired e
// paywall-active antes de rodar).

async function login(page: Page, email: string) {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill('PaywallTest123!');
    await page.getByTestId('btn-login-submit').click();
}

test.describe('paywall', () => {
    test('workspace expired redireciona /dashboard para /subscription', async ({ page }) => {
        test.fixme(
            !process.env.PAYWALL_SEED_APPLIED,
            'requer seed test_paywall.sql aplicado — setar PAYWALL_SEED_APPLIED=1 quando rodar localmente',
        );

        await login(page, 'paywall-expired@laura.test');
        // Pode ir direto para /dashboard e ser redirecionado, ou já
        // cair em /subscription — tolera ambos.
        await page.waitForURL(/\/(dashboard|subscription)/, { timeout: 15_000 });

        // Tenta forçar navegação para /dashboard. O PaywallGate deve
        // expulsar para /subscription.
        await page.goto('/dashboard');
        await page.waitForURL(/\/subscription/, { timeout: 15_000 });
        expect(page.url()).toContain('/subscription');
    });

    test('workspace ativo acessa /dashboard sem redirect', async ({ page }) => {
        test.fixme(
            !process.env.PAYWALL_SEED_APPLIED,
            'requer seed test_paywall.sql aplicado — setar PAYWALL_SEED_APPLIED=1 quando rodar localmente',
        );

        await login(page, 'paywall-active@laura.test');
        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
        await page.goto('/dashboard');
        // Dá um tempo para o PaywallGate rodar o efeito; não deve
        // redirecionar.
        await page.waitForTimeout(1_000);
        expect(page.url()).toContain('/dashboard');
        expect(page.url()).not.toContain('/subscription');
    });

    test('workspace expired acessa /subscription sem redirect', async ({ page }) => {
        test.fixme(
            !process.env.PAYWALL_SEED_APPLIED,
            'requer seed test_paywall.sql aplicado — setar PAYWALL_SEED_APPLIED=1 quando rodar localmente',
        );

        await login(page, 'paywall-expired@laura.test');
        await page.goto('/subscription');
        await page.waitForURL(/\/subscription/, { timeout: 15_000 });
        // Permanece em /subscription após settle do efeito.
        await page.waitForTimeout(1_000);
        expect(page.url()).toContain('/subscription');
    });
});
