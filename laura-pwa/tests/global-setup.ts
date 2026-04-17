import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.API_URL || 'http://localhost:8080';
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

  // storageState placeholder vazio — Fase 17B.2 vai popular via login
  // real quando testids existirem no PWA. Por enquanto os specs que
  // usam authedPage fixture estão com test.fixme (ver spec).
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  if (!fs.existsSync(AUTH_FILE)) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
  }
}
