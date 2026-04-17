import { test, expect } from './fixtures/auth';

// Nota: a UI atual de transações é read-only (filtros + listagem).
// Criação/edição de transação acontece via WhatsApp NLP. Este spec
// valida smoke da página. Fluxos de create/edit via UI ficam para
// quando essa feature for construída (roadmap Fase 18+).

test('transactions: página carrega com filtros', async ({ authedPage: page }) => {
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: /transa[çc][õo]es/i })).toBeVisible();
  // Filtros: mês + categoria + tipo
  await expect(page.locator('input[type="month"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /exportar/i })).toBeVisible();
});
