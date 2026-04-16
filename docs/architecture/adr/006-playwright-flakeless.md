# ADR 006 — Playwright E2E flakeless infra

**Data:** 2026-04-16
**Status:** ACEITO (Fase 17B).

## Contexto

Fase 17B ativa Playwright E2E real em CI push/PR (substitui
validação apenas `--list`). Stack full com Postgres + Redis + Go
API + Next.js PWA + seed introduz pontos de flake: timing de
schema compartilhado, network containers, SSR carregando async.

## Decisão

- `retries: 2` em CI (não em local dev).
- `workers: 1` em CI (evita race em schema single-tenant).
- `trace: 'retain-on-failure'` + `video: 'retain-on-failure'`.
- Reporter composto: `['list']` + `['html', { open: 'never' }]` +
  `['junit', { outputFile: 'results.xml' }]`.
- Artifacts upload: `playwright-report/` + `results.xml` +
  `test-results/` (traces/videos), retenção 14 dias.
- Seed one-shot via profile `seed` no compose: rodado por
  `docker compose --profile seed run --rm seed-e2e` após stack healthy.

## Consequências

- Runs ~20% mais lentos worst case (3× rodadas em flakes).
- Artifacts ~30-50MB por run.
- Debug rápido — first failure já vem com trace + vídeo.

## Alternativas consideradas

- `retries: 0`. Rejeitado — flakes reais bloqueiam deploys.
- Mock agressivo backend/DB. Rejeitado — perde confiança E2E.
- `workers > 1`. Rejeitado — schema único causa race.
- `docker compose up --wait` incluindo seed-e2e. Rejeitado — seed
  é one-shot sem healthcheck, `--wait` sinaliza erro.
