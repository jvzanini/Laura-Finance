import { request } from '@playwright/test';
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
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API ${API}/health nao ficou healthy em 30s`);
}

export default async function globalSetup() {
  if (process.env.SKIP_E2E_AUTH === '1') return;
  await waitHealthy();
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const ctx = await request.newContext({ baseURL: PWA });
  const resp = await ctx.post(`${API}/api/v1/auth/login`, {
    data: { email: 'e2e@laura.test', password: 'e2epass123!' },
  });
  if (!resp.ok()) {
    throw new Error(`login E2E falhou: ${resp.status()} ${await resp.text()}`);
  }
  await ctx.storageState({ path: AUTH_FILE });
}
