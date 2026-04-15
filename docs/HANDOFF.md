# Laura Finance — Handoff

> ⚡ **Documento de continuidade do desenvolvimento autônomo.**
> Sempre que abrir nova sessão, leia primeiro `CLAUDE.md` na raiz e
> depois este arquivo. Atualizar a cada fase concluída.

## Histórico de atualizações

### 2026-04-15 — Fase 10 preparada

- CI/CD Go + PWA scaffolds (go-ci, pwa-ci, playwright, security).
- Dockerfile distroless + `-tags timetzdata` + embed migrations.
- fly.toml single-machine + healthchecks /health + /ready.
- Patches Go: DISABLE_WHATSAPP guard, requestid middleware, logger JSON, /ready handler. Teste regressão whatsmeow auto-upgrade.
- lefthook canônico + `.githooks/` removido.
- Migration 000035 validada local (já aplicada); procedimento prod em `docs/ops/migrations.md`.
- STANDBYs ativos: GROQ-REVOKE, FORCE-PUSH, VERCEL-AUTH, VERCEL-ENV, FLY-AUTH, FLY-CARD, FLY-SECRETS, FLY-PG-CREATE, STRIPE-LIVE, RESEND-DOMAIN, DNS.

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

Fase 10 preparada — todos os artefatos internos estão prontos. A execução
do deploy real depende das STANDBYs externas. Ordem sugerida:

1. **STANDBY [GROQ-REVOKE]** — usuário revoga a chave `gsk_Vk3IAz4n...`
   no console Groq + gera nova chave.
2. Agente executa `scripts/sanitize-history.sh` (playbook em
   `docs/ops/security.md` §"Playbook: chave vazada no histórico git").
3. **STANDBY [FORCE-PUSH]** — agente force-push em `master`.
4. **STANDBY [VERCEL-AUTH]** — usuário adiciona `VERCEL_TOKEN` nos GH
   Secrets.
5. **STANDBY [FLY-AUTH]** + `[FLY-CARD]` — usuário adiciona
   `FLY_API_TOKEN` + cartão na Fly.
6. **STANDBY [FLY-PG-CREATE]** — provisionar Fly Postgres (gru) + attach
   em `laura-finance-api`.
7. **STANDBY [FLY-SECRETS]** — `fly secrets set` para GROQ, OPENAI,
   GOOGLE, STRIPE, RESEND, SESSION_SECRET.
8. Triggers `deploy-api.yml` + `deploy-pwa.yml`.
9. Aplicar migration 000035 em prod (ver `docs/ops/migrations.md`).
10. Smoke prod (`/health`, `/ready`, login).
11. Tag `phase-10-deployed` + próxima fase.
