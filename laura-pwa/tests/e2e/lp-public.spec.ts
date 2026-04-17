import { expect, test } from "@playwright/test";

test("landing page pública renderiza hero e planos (ou fallback)", async ({
    page,
}) => {
    await page.goto("/");

    // Hero headline deve estar visível em PT-BR
    await expect(
        page.getByRole("heading", {
            name: /Sua família no controle das finanças/i,
        })
    ).toBeVisible();

    // Pelo menos um card de plano OU o fallback "Ver planos" visível.
    const ctaPlan = page.getByRole("link", {
        name: /Começar 7 dias grátis/i,
    });
    const fallbackBtn = page.getByRole("button", { name: /Ver planos/i });

    await expect(ctaPlan.first().or(fallbackBtn)).toBeVisible();
});
