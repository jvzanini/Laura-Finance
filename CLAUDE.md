# Laura Finance

> ⚡ **AO ABRIR PROJETO EM NOVO TERMINAL / NOVA SESSÃO:** primeira leitura
> obrigatória é este arquivo. As LEIS ABSOLUTAS abaixo determinam como
> conduzir todo o desenvolvimento.

**Repositório:** https://github.com/jvzanini/Laura-Finance
**Stack:** Go (Fiber v2) + Next.js 16 PWA + PostgreSQL 16 + pgvector
**Tipo:** SaaS de gestão financeira familiar com assistente WhatsApp NLP
**Status:** Epics 1–9 + super admin done; pendências críticas de
infraestrutura (CI/CD, deploy, secrets, E2E) — ver Fase 10 em diante.

---

## LEIS ABSOLUTAS

### LEI #1 — Modo autônomo total: metodologia obrigatória de fase a fase

**Sessões de desenvolvimento longo são autônomas. Não pedir aprovação,
não esperar confirmação — seguir a metodologia abaixo do início ao fim
do projeto, fase após fase, até concluir todas as opções actionable.**
O usuário só interrompe se quiser mudar rumo.

#### 1.1. Ciclo obrigatório por fase

```
Brainstorm (skill superpowers:brainstorming) — entender escopo da fase
  ↓
Spec v1  (writing-plans escreve spec primeiro)
  ↓
Review #1 da spec → checklist:
  • não estou esquecendo nada?
  • não estou repetindo trabalho já feito?
  • respeita identidade visual + componentes existentes (LEI #3)?
  • cobertura completa do escopo?
  ↓
Spec v2 (incorpora review #1)
  ↓
Review #2 da spec → pente fino mais profundo
  ↓
Spec v3 final (versão definitiva)
  ↓
Plan v1 (writing-plans em cima da spec v3) — TASKS BEM DETALHADAS,
  granularidade ALTA, sem economia em detalhes
  ↓
Review #1 do plan → granularidade, segmentação, sem dúvidas
  ↓
Plan v2 (mais detalhado)
  ↓
Review #2 do plan → pente fino criterioso
  ↓
Plan v3 final
  ↓
Implementação (skill superpowers:executing-plans /
  subagent-driven-development) — task a task
  ↓
Testes (mesma stack: Go test + Vitest + Playwright)
  ↓
verification-before-completion (skill obrigatória)
  ↓
Atualizar docs (HANDOFF, specs/plans, _bmad-output/project-context.md
  se aplicável)
  ↓
Atualizar memory (.claude/.../memory)
  ↓
Commits (português, conventional commits)
  ↓
Deploy (push main → CI → produção quando deploy estiver configurado)
  ↓
Monitorar CI + smoke prod
  ↓
PRÓXIMA FASE — sem pedir confirmação
```

**Detalhes não negociáveis:**

- **Specs e plans em `docs/superpowers/specs/` e `docs/superpowers/plans/`**
  com sufixos `-v1.md`, `-v2.md`, `-v3.md` (manter histórico das versões).
- **Quanto mais tasks no plan, melhor.** Granularidade alta evita ambiguidade.
- **UI/UX SEMPRE via skill `ui-ux-pro-max`** respeitando 100% identidade
  visual existente (ver LEI #3).
- **Todo texto visível ao usuário em PT-BR com acentos corretos.**
- Após cada deploy: aplicar tag git `phase-<n>-deployed` (quando deploy
  estiver online).
- O usuário **não** vai aprovar nada durante o ciclo. Autorização total
  já concedida nesta lei.

#### 1.2. Contingência GitHub billing — repo bloqueado/forçado a privado

Se durante o desenvolvimento o GitHub bloquear push/CI por cobrança ou
limite free (repo voltou a privado por algum motivo, erro de cartão,
rate limit), executar IMEDIATAMENTE, sem pedir autorização (já está
concedida nesta lei):

**Audit de segurança 3-pass obrigatório antes de tornar público:**

1. **Pass 1 — varredura inicial:**
   - `gitleaks detect --no-banner --redact` no histórico completo.
   - Buscar `.env*`, chaves Groq/OpenAI/Google/Stripe/Resend, tokens,
     senhas, JWT/SESSION secrets, DSNs PostgreSQL, credenciais Vercel.
   - Conferir `.gitignore` cobre `.env`, `.env.*`, `.env.local`,
     `.env.production`, `*.pem`, `*.key`, secrets ad-hoc.
   - Listar achados.
2. **Pass 2 — pente fino mais profundo:**
   - Grep manual em `laura-go/`, `laura-pwa/src/`, `infrastructure/`,
     `_bmad-output/`, `.github/` por strings suspeitas (`token`, `secret`,
     `key`, `password`, `api_key`, `dsn`, IPs internos).
   - Verificar history de commits (`git log -p -S<termo>`).
   - Conferir nenhum binário (`bin/`, `*.tgz`) tem secrets.
   - Validar workflows `.github/workflows/` só usam `${{ secrets.* }}`.
3. **Pass 3 — conclusão definitiva (só na 3ª passada):**
   - Se achados nas passes 1/2: corrigir (mover para env vars do host,
     adicionar ao `.gitignore`, sanitizar docs, expandir
     `.gitleaks.toml` allowlist se for placeholder legítimo).
   - Se há histórico contaminado: `git filter-repo` ou rotacionar
     credenciais imediatamente.
   - Repetir gitleaks até zero leaks reais.
   - Documentar resultado em `docs/ops/security.md`.
4. **Tornar público novamente** via
   `gh repo edit jvzanini/Laura-Finance --visibility public --accept-visibility-change-consequences`.
5. **Continuar fluxo de fases.** Só voltar a privado se o usuário
   solicitar explicitamente.

**Anti-padrão:** parar e pedir aprovação. A autorização para esse fluxo
de remediação + tornar público está concedida nesta LEI #1.2.

#### 1.3. Encerrar sessão autônoma

Concluir somente quando: (a) todas as fases planejadas foram entregues
com deploy e tag aplicada; (b) restantes dependem de secrets externos
não configurados pelo usuário; ou (c) usuário intervém pedindo nova
direção.

Ao encerrar: atualizar `_bmad-output/project-context.md` + criar memory
`session_state_<data>.md` + commit final com snapshot.

---

### LEI #2 — Skills superpowers + ui-ux-pro-max obrigatórias (invocadas via `Skill` tool)

**SEMPRE** invocar a skill via a tool `Skill` (não simular o trabalho via
prompt manual a subagente — a invocação direta carrega as instruções
oficiais da skill). Mapeamento por etapa:

- `superpowers:brainstorming` → antes de qualquer trabalho criativo.
- `superpowers:writing-plans` → spec v1/v2/v3 + plan v1/v2/v3.
- `superpowers:executing-plans` ou `superpowers:subagent-driven-development`
  → implementação task-a-task.
- `superpowers:test-driven-development` → red-green-refactor.
- `superpowers:dispatching-parallel-agents` → ao despachar 2+ agentes em paralelo.
- `superpowers:verification-before-completion` → antes de qualquer
  claim de "feito" (rodar comandos, anexar evidência).
- `superpowers:requesting-code-review` → após implementação relevante.
- `superpowers:systematic-debugging` → ao encontrar qualquer bug.
- `superpowers:finishing-a-development-branch` → ao fechar a fase.
- `ui-ux-pro-max` → OBRIGATÓRIO para TODO layout/UI novo, respeitando
  100% o design system existente (ver LEI #3).

---

### LEI #3 — Identidade visual + componentes existentes

**Para toda nova feature/componente UI**, primeira ação = consultar o
estado atual do design system do projeto:

- **Tema:** Dark Mode first-class (mandatório). Background `#0A0A0F`,
  primary `#7C3AED` (violeta), secondary `#10B981` (verde).
- **Stack UI:** Tailwind CSS v4 + shadcn/ui (`/components/ui`).
  Componentes de feature (com regra de negócio) ficam em
  `/components/features`.
- **Acessibilidade (A11y):** tap targets mobile mínimo **44×44px**.
  Cores de status SEMPRE acompanhadas de iconografia (✅, ❌) por
  daltonismo. WCAG AA mínimo em contrastes.
- **Animações:** Framer Motion restrito a elementos de complexidade
  alta (HealthScoreGauge, MetricCard countUp, StreakBadge). Componentes
  base usam transições CSS nativas.
- **Skeletons, não spinners:** Skeletons mimetizam a forma final.
  Spinner reservado a botão `isLoading` e pull-to-refresh.
- **Iconografia:** lucide-react. **NUNCA emoji** em UI estrutural
  (emoji só é OK em campo de dado tipo `categories.emoji`).
- **Texto PT-BR** com acentos completos sempre.

Divergir do design system só com justificativa escrita na spec da fase.

---

### LEI #4 — Debug de erro em produção/deploy: logs antes de fix

**Quando deploy estiver configurado e prod retornar 500/erro opaco:
SEMPRE puxar logs da plataforma de deploy PRIMEIRO** (Vercel logs,
Docker logs, etc.) antes de qualquer commit especulativo.

**Anti-padrão:** sequência de commits "fix tentativa N" sem ter visto
o stacktrace real. Se 2 pushes não resolveram, parar e buscar logs.

---

### LEI #5 — Banco de dados, moeda e regras técnicas críticas

Todas as regras críticas legadas continuam valendo (ver
`_bmad-output/project-context.md` para o catálogo completo). Resumo
das mais sensíveis:

- **Moeda em centavos (INTEGER), nunca FLOAT/DECIMAL** para R$.
  Exceção: percentuais/taxas (DECIMAL OK).
- **Sessão HMAC-SHA256** (PWA `session.ts` + Go `session.go`).
  `SESSION_SECRET` env var; ausência em prod = crash.
- **Whitelist obrigatória** para nomes de tabela em SQL admin
  (allowedOptionTables / ALLOWED_*_TABLES).
- **Erros internos nunca expostos ao cliente** — log via `log.Printf`,
  retornar mensagem genérica.
- **Context timeout** em todas as queries (10s handler / 30s LLM).
  Nunca `context.Background()` em handlers.
- **Migration 000035** é pré-requisito para deploy real.
- **Paridade Go ↔ PWA** no cálculo do score financeiro
  (pesos 35/25/25/15).

---

## Status atual (snapshot 2026-04-17)

### Done
- Epics 1–9 + Super Admin Panel — features completas.
- Security hardening (HMAC, rate limit, headers, whitelist SQL, context
  timeout, migration 035).
- Deploy produção em `laura.nexusai360.com` (Portainer + GHCR + Traefik).
- Fase 17A lint sweep + Fase 17B Playwright E2E real + Fase 17B.2 data-testids.
- **Fase 18 (este commit):** LP pública imersiva + trial 7d sem cartão +
  signup wizard OTP (email+WhatsApp) + redesign auth com olhinho senha +
  seção `/subscription` + banners trial/past_due + paywall server-side
  (middleware Go 402 + layout check PWA). Ver `docs/HANDOFF.md` para
  detalhe completo.

### Pendências pré-deploy Fase 18
1. Aplicar migrations 000038–000042 em prod.
2. Configurar env vars novas (`OTP_SECRET`, `TRIAL_DAYS=7`,
   `PAST_DUE_GRACE_DAYS=3`, `OTP_TEST_MODE=false`, `NEXT_PUBLIC_APP_URL`).
3. Popular `stripe_price_id` (+ opcional `stripe_price_id_yearly`) via
   super admin antes de testar checkout real.
4. Smoke pós-deploy + tag `phase-18-deployed`.

### Pendências gerais (próximas fases)
- Ativar E2E Playwright novos em CI (`test.fixme` condicionais).
- `gitleaks` + `gitignore` — já corrigidos em fases anteriores.
- Rotação de `GROQ_API_KEY` — confirmar se prod usa secret seguro.

---

## Estrutura do projeto

```
laura-go/             Backend Go 1.26 (Fiber v2) — API REST + WhatsApp
  internal/
    handlers/         21 arquivos, ~7.2k linhas
    services/         16 arquivos (NLP, LLM multi-provider, score, cron)
    whatsapp/         Whatsmeow client + instance manager
laura-pwa/            Frontend Next.js 16 PWA (React 19, Tailwind v4)
  src/app/(auth|dashboard|admin)/   Rotas
  src/components/ui/                shadcn base
  src/components/features/          Regra de negócio
  tests/                            Playwright (atual: 2 testes)
infrastructure/       Docker Compose + 35 migrations PostgreSQL
  migrations/         001–035 (035 = security hardening pendente apply)
_bmad-output/         Artefatos BMAD legados (planning + implementation)
docs/superpowers/     Specs + plans novos (LEI #1)
```

---

## Convenções

- Commits em português (conventional commits: `feat:`, `fix:`, `refactor:`).
- Código e variáveis em inglês.
- Comentários em português quando necessário.
- Server actions Next.js em `laura-pwa/src/lib/actions/`.
- Handlers Go em `laura-go/internal/handlers/`.
- Idioma de resposta ao usuário: PT-BR.

---

## Para iniciar a próxima fase

A próxima fase é a **Fase 10 — Security closeout + infraestrutura
mínima de produção**. Iniciar via skill `superpowers:brainstorming`
seguindo o ciclo da LEI #1.
