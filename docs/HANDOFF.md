# Laura Finance — Handoff

> ⚡ **Documento de continuidade do desenvolvimento autônomo.**
> Sempre que abrir nova sessão, leia primeiro `CLAUDE.md` na raiz e
> depois este arquivo. Atualizar a cada fase concluída.

## Estado atual — 2026-04-15

**Modo:** desenvolvimento autônomo iniciado em 2026-04-15.
**Fase atual:** Fase 10 — Security closeout + infraestrutura mínima de produção (em andamento, spec v1 em geração).

## Pendências bloqueadas (STANDBY — aguardando input do usuário)

> Estas tarefas estão preparadas até onde dá; o usuário precisa fornecer
> credencial / executar ação manual para liberar. Estão anotadas em
> `.claude/projects/.../memory/standby_*.md` para retomada futura.

### 1. Revogação da chave GROQ_API_KEY exposta

- **Status:** Chave `gsk_Vk3IAz4n...` foi removida do HEAD em commit
  bd88cfe (2026-04-12) mas continua no histórico git.
- **Ação do usuário:** revogar a chave no console Groq
  (https://console.groq.com/keys) e gerar nova chave.
- **Ação do agente após revogação:** rodar `git filter-repo` para
  expurgar a chave do histórico, force push em `main`, atualizar
  `.env.example` com placeholder e novo template.
- **Standby memory:** `standby_groq_key_rotation.md`.

### 2. Deploy produção — credenciais externas

- **Status:** todos os artefatos (Dockerfile multi-stage, fly.toml,
  vercel.json, workflow CI/CD) serão preparados pelo agente.
- **Ação do usuário:** criar contas e fornecer tokens via secrets:
  - Vercel: `VERCEL_TOKEN`
  - Fly.io: `FLY_API_TOKEN`
  - Groq nova: `GROQ_API_KEY`
  - Stripe live (se for produção real): `STRIPE_SECRET_KEY`,
    `STRIPE_WEBHOOK_SECRET`
  - Resend: `RESEND_API_KEY`
- **Ação do agente após tokens:** `vercel link` + `fly deploy`,
  rodar primeiros deploys e tag `phase-10-deployed`.
- **Standby memory:** `standby_deploy_credentials.md`.

### 3. Migration 000035 em ambientes não-locais

- **Status:** será aplicada no Postgres local via docker compose pelo
  agente nesta fase. Em prod fica pendente até deploy existir.
- **Ação após deploy ativo:** rodar `psql -f
  infrastructure/migrations/000035_security_hardening.sql` no Postgres
  de produção.

## Histórico de fases

### Epics 1–9 + Super Admin (BMAD legado, 2026-03 → 2026-04)
✅ Done — ver `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### Security hardening parcial (2026-04-12)
✅ Done — HMAC sessão, rate limit, headers, whitelist SQL, context
timeout, migration 035 escrita. Pendências viraram Fase 10.

### Fase 10 — Security closeout + infra mínima (2026-04-15, em andamento)
🟡 Em execução. Spec v1 sendo gerada.

## Próximos passos imediatos do agente

1. Aguardar conclusão da spec v1.
2. Review #1 da spec (checklist LEI #1).
3. Spec v2 → review #2 → spec v3 final.
4. Plan v1 → v2 → v3.
5. Implementação em paralelo de tudo que não depende de credencial:
   - Sanitização do `.env.example`
   - Aplicar migration 035 local
   - Workflows CI Go + PWA expandidos
   - E2E Playwright expandido
   - Dockerfile Go multi-stage
   - fly.toml + vercel.json com placeholders
   - docs/ops/security.md + deployment.md
6. Commit + push (mesmo sem deploy ativo).
7. Próxima fase identificada após Fase 10 entregar.
