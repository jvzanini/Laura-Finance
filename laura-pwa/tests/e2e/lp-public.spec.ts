import { expect, test } from "@playwright/test";

test("landing page pública renderiza hero e planos (ou fallback)", async ({
    page,
}) => {
    await page.goto("/");

    // Hero headline deve estar visível em PT-BR (fase 18+ copy).
    await expect(
        page.getByRole("heading", {
            name: /Pare de viver no caos financeiro/i,
        })
    ).toBeVisible();

    // Pelo menos um card de plano (fase 18.4: CTAs "Comece grátis agora"
    // ou "Assinar agora") OU o fallback "Ver planos" visível.
    const ctaPlan = page.getByRole("link", {
        name: /Comece grátis agora|Assinar agora|Começar 7 dias grátis/i,
    });
    const fallbackBtn = page.getByRole("button", { name: /Ver planos/i });

    await expect(ctaPlan.first().or(fallbackBtn)).toBeVisible();
});
