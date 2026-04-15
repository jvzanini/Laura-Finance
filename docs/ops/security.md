# Segurança — Laura Finance

Documento operacional (stub preenchido da Fase 10). Mantém as diretrizes de
secrets, headers, criptografia e as runbooks de rotação.

---

## 1. Política de secrets

- **Nunca** commitar `.env`, `.env.local` ou qualquer arquivo derivado.
  Somente `.env.example` com placeholders vai pro repositório.
- Todos os valores sensíveis ficam em:
  - **Produção backend (Fly):** `fly secrets set KEY=value`
  - **Produção frontend (Vercel):** Environment Variables no dashboard.
  - **Local dev:** `.env` / `.env.local` (nunca tracked).
- Placeholders nos `.env.example` devem usar o padrão `YOUR_*` para bater
  com a allowlist do `.gitleaks.toml` (e evitar falsos positivos no CI).

### Inventário de secrets

| Chave | Onde vive | Rotação |
|-------|-----------|---------|
| `SESSION_SECRET` | Fly secrets | Trimestral ou a cada incidente |
| `GROQ_API_KEY` | Fly secrets | Semestral / comprometimento |
| `OPENAI_API_KEY` | Fly secrets (fallback) | Semestral |
| `GOOGLE_API_KEY` | Fly secrets (fallback) | Semestral |
| `STRIPE_SECRET_KEY` | Fly secrets + Vercel | Sob demanda (suspeita de vaz.) |
| `STRIPE_WEBHOOK_SECRET` | Fly secrets | Ao rotacionar endpoint |
| `RESEND_API_KEY` | Fly secrets | Semestral |
| `DATABASE_URL` | Fly secrets (conectado ao Fly Postgres) | Ao rotacionar cluster |

---

## 2. Runbooks de rotação

### 2.1 Rotacionar `SESSION_SECRET`

> ⚠ Ao trocar, **todas as sessões ativas são invalidadas** (HMAC falha).
> Comunicar usuários ou agendar em janela de baixo tráfego.

```bash
NEW=$(openssl rand -base64 32)
fly secrets set SESSION_SECRET="$NEW" --app laura-finance
# Deploy automático ocorre; confirmar saúde:
fly status --app laura-finance
```

### 2.2 Rotacionar `GROQ_API_KEY`

1. Gerar nova key em https://console.groq.com/keys.
2. `fly secrets set GROQ_API_KEY=gsk_xxx --app laura-finance`.
3. Revogar a antiga no painel Groq.
4. Validar envio de mensagem WhatsApp no ambiente de produção.

### 2.3 Rotacionar Stripe (`STRIPE_SECRET_KEY` + webhook secret)

1. Dashboard Stripe → Developers → API keys → Roll key.
2. `fly secrets set STRIPE_SECRET_KEY=sk_live_xxx`.
3. Para webhook: Developers → Webhooks → Signing secret → Roll.
4. `fly secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`.
5. Smoke test: disparar evento de teste via `stripe trigger`.

### 2.4 Rotacionar `RESEND_API_KEY`

1. Dashboard Resend → API Keys → Create new → Revoke old.
2. `fly secrets set RESEND_API_KEY=re_xxx`.
3. Disparar email de teste (forgot-password).

---

## 3. Detecção de vazamentos — gitleaks

- **CI:** workflow `.github/workflows/security.yml` roda em push/PR.
  Config em `.gitleaks.toml` (herda defaults + allowlist de placeholders).
- **Local:** pre-commit hook em `.githooks/pre-commit`.

```bash
# Ativar hooks locais (uma vez por clone)
git config core.hooksPath .githooks
brew install gitleaks   # macOS
```

Em caso de falso positivo real, ampliar `allowlist.regexes` em
`.gitleaks.toml` com justificativa no commit.

---

## 4. Headers de segurança (PWA)

Config em `laura-pwa/vercel.json`:

- `Content-Security-Policy` — fontes self + inline controlado.
- `X-Frame-Options: DENY` — clickjacking.
- `X-Content-Type-Options: nosniff` — MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` — desabilita APIs sensíveis (camera, mic, geo).
- `Strict-Transport-Security` — HSTS 1 ano + preload.

---

## 5. HMAC de sessão

- Sessão é JWT-like assinado com HMAC-SHA256 usando `SESSION_SECRET`.
- Em produção, ausência/tamanho insuficiente de `SESSION_SECRET` deve
  fazer o binário **crashar no boot** (fail-fast).
- Verificação sempre via `crypto/hmac.Equal` (constant-time).

---

## 6. Whitelist SQL (pgx)

- Toda query usa **placeholders `$1, $2, ...`** — nunca string concatenation.
- Identificadores dinâmicos (ex: ORDER BY por coluna user-supplied) passam
  por **allowlist explícita** de colunas permitidas.
- Migrations ficam em `infrastructure/migrations/*.sql` e são aplicadas
  em ordem via `psql`.

---

## 7. Context timeout

- Todo handler HTTP cria `context.WithTimeout(r.Context(), N*time.Second)`.
- Padrão atual: 10s para handlers síncronos, 30s para jobs NLP.
- Qualquer chamada a LLM externa respeita o deadline do ctx.

---

## 8. Checklist de incidente

1. **Suspeita de vazamento:** rotacionar imediatamente a secret afetada.
2. **Commit com secret real:** rotacionar + `git filter-repo` em coordenação
   com todos os colaboradores + force-push (decisão explícita do owner).
3. **Abuse de API:** revisar rate limiting e logs de acesso; bloquear IP
   via Fly Edge se necessário.
4. Documentar post-mortem em `docs/ops/incidents/YYYY-MM-DD-<slug>.md`.

## Playbook: chave vazada no histórico git

> Use quando uma chave foi commitada e precisa ser purgada do histórico.
> STANDBY [GROQ-REVOKE] + STANDBY [FORCE-PUSH] aguardam usuário.

1. **Usuário revoga a chave antiga** no console do provedor (Groq, OpenAI, Google, Stripe, Resend etc.).
2. **Usuário gera nova chave** + guarda local de forma segura.
3. **Atualizar GH Secrets:** `gh secret set <NAME>` para CI.
4. **Atualizar Fly Secrets:** `fly secrets set <NAME>=<NEW_VALUE> -a laura-finance-api`.
5. **Backup do repo:** `cp -R "$(pwd)" "../$(basename $(pwd))-bak-$(date +%Y%m%d)"`.
6. **Listar secrets a expurgar:** criar `.git-secrets-to-purge.txt` na raiz com a string EXATA da chave vazada (uma por linha):
   ```
   gsk_VkXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
7. **Executar sanitize:** `scripts/sanitize-history.sh`.
8. **Force push:** `git push --force --all && git push --force --tags`.
9. **Validar histórico limpo:** `git log -p -Sgsk_ --all` deve retornar vazio. Documentar resultado em "## Histórico de incidentes" abaixo.

## Histórico de incidentes

### 2026-04-15 — Sanitização para repo público

- **Causa:** GitHub billing bloqueou Actions em repo privado ("recent account payments have failed or your spending limit needs to be increased"). LEI #1.2 do CLAUDE.md ativada — tornar repo público após audit 3-pass.
- **Achados Pass 1 (gitleaks):** 1 leak — `generic-api-key` em `laura-go/.env:2` commit `a13a47f7` (já removido do working tree em `bd88cfe`, mas presente no histórico git).
- **Achados Pass 2 (grep manual):** apenas placeholders em `.env.example` (gsk_YOUR_KEY_HERE, sk-YOUR_KEY_HERE, AIza_YOUR_KEY_HERE, whsec_YOUR_SECRET, re_1234MockResendKey). Workflows sem secrets hardcoded (só `${{ secrets.* }}`).
- **Ação:**
  - Backup bundle criado em `../laura-finance-pre-sanitize-20260415-032841.bundle`.
  - `git filter-repo --replace-text .git-secrets-to-purge.txt --force` purgou a string GROQ completa.
  - Remote re-adicionado (filter-repo remove por design).
  - `git push --force --all origin` + `--force --tags origin` — sucesso.
  - `.git-secrets-to-purge.txt` removido.
- **Validação pós:** `gitleaks detect` retornou `no leaks found`. `git log -p -S <key-completa>` retorna vazio.
- **STANDBY [GROQ-REVOKE] continua ativo:** usuário precisa revogar a key no console Groq mesmo após sanitização — a key ainda é tecnicamente válida; filter-repo só removeu a exposição visual no histórico público.
- **Repo tornado PÚBLICO** via `gh repo edit jvzanini/Laura-Finance --visibility public --accept-visibility-change-consequences`.
