import { expect, test } from "@playwright/test";

/**
 * Fluxo E2E do novo SignupWizard (3 passos).
 *
 * Pré-requisito: backend Go rodando com OTP_TEST_MODE=true (código "123456"
 * é aceito para e-mail e WhatsApp). O teste é pulado quando rodando contra
 * uma API que não está em modo teste — para não gerar falsos negativos
 * localmente.
 */

const OTP = "123456";

test("signup wizard — happy path 3 passos", async ({ page }) => {
    test.skip(
        process.env.OTP_TEST_MODE !== "true" && process.env.CI !== "true",
        "OTP_TEST_MODE=true é necessário — define no backend/teste local"
    );

    const stamp = Date.now();
    const email = `wizard${stamp}@laura.test`;
    const whatsappDigits = `55119${String(stamp).slice(-8)}`; // 13 dígitos

    await page.goto("/register");

    // ── Step 1: dados pessoais ────────────────────────────────────
    await expect(page.getByTestId("signup-step1")).toBeVisible();

    await page.getByTestId("input-name").fill("Usuária E2E Wizard");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-whatsapp").fill(whatsappDigits);
    await page.getByTestId("input-password").fill("Senha123!");
    await page.getByTestId("input-confirm-password").fill("Senha123!");
    await page.getByTestId("btn-signup-next").click();

    // ── Step 2: verificar e-mail ──────────────────────────────────
    await expect(page.getByTestId("signup-step-email")).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 6; i++) {
        await page.getByTestId(`otp-input-${i}`).fill(OTP[i]);
    }

    // ── Step 3: verificar WhatsApp ────────────────────────────────
    await expect(page.getByTestId("signup-step-whatsapp")).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 6; i++) {
        await page.getByTestId(`otp-input-${i}`).fill(OTP[i]);
    }

    // Após finalize: redireciona para /dashboard.
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    expect(page.url()).toContain("/dashboard");
});
