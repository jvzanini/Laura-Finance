import { chromium, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.API_URL || 'http://localhost:8080';
const PWA = process.env.BASE_URL || 'http://localhost:3100';
const AUTH_DIR = path.resolve(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

async function waitHealthy() {
  const ctx = await request.newContext();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await ctx.get(`${API}/health`);
      if (r.ok()) return;
    } catch {
      // keep trying
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API ${API}/health nao ficou healthy em 30s`);
}

export default async function globalSetup() {
  if (process.env.SKIP_E2E_AUTH === '1') return;

  await waitHealthy();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Login real via UI — seed E2E cria e2e@laura.test / e2epass123! no
  // docker-compose.ci.yml (profile "seed" via `docker compose run --rm`).
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${PWA}/login`);
    await page.getByTestId('input-email').fill('e2e@laura.test');
    await page.getByTestId('input-password').fill('e2epass123!');
    await page.getByTestId('btn-login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await ctx.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
