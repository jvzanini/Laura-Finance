# Runbook — Rotação de secrets

> Procedimentos de rotação por secret, com pré-requisitos, passos,
> validação e fallback. **Cadência padrão:** 90 dias routine.
> **Cadência emergencial:** imediato em suspeita de leak (ver
> `docs/ops/security.md` §"Playbook: chave vazada no histórico git").

---

## 1. GROQ_API_KEY

### Quando usar

- Rotação routine (90d) ou suspeita de exposição (commit acidental, log
  de terceiro, etc.).

### Pré-requisitos

- Acesso ao console https://console.groq.com/keys.
- `STANDBY [FLY-AUTH]` + `STANDBY [FLY-SECRETS]` habilitados.

### Procedimento

```sh
# 1. Console Groq: revogar chave antiga + gerar nova (copiar para clipboard).
# 2. GH Secrets:
gh secret set GROQ_API_KEY --body "<nova-chave>"
# 3. Fly secrets:
fly secrets set GROQ_API_KEY="<nova-chave>" -a laura-finance-api
# 4. Fly redeploy automático (Fly faz restart após secrets set).
```
Expected: `✓ Secrets set` + `Release vN` em `fly status`.

### Validação

```sh
curl -fsS https://api.laura.finance/health && echo OK
# Smoke NLP:
curl -X POST https://api.laura.finance/api/v1/nlp/parse \
  -H "Cookie: session=..." \
  -d '{"text":"gastei 50 reais no mercado"}'
```
Expected: resposta JSON com categorização válida (NLP funcional).

### Rollback do rollback

Se a nova chave quebrar, restaurar a anterior (se ainda não revogada)
repetindo os passos 2-3. Se revogada, gerar nova terceira chave.

---

## 2. SESSION_SECRET (HMAC-SHA256)

### Quando usar

- Rotação routine (90d) ou suspeita de leak do secret de assinatura de
  sessão.

### Pré-requisitos

- **Aviso ao usuário:** rotação invalida TODAS as sessões ativas — todos
  os usuários precisarão logar de novo. Comunicar via email antes, se
  houver janela.

### Procedimento

```sh
NEW=$(openssl rand -hex 32)
fly secrets set SESSION_SECRET="$NEW" -a laura-finance-api
# Fly faz redeploy automático.
```
Expected: `✓ Secrets set`, release publicado, app saudável em < 60s.

### Validação

```sh
curl -fsS https://api.laura.finance/ready && echo OK
# Smoke login: abrir /login, entrar com credenciais → esperado funcionar.
```
Expected: login novo funciona; sessão antiga retorna 401.

### Rollback do rollback

Restaurar o SESSION_SECRET anterior também invalida sessões criadas com
a nova chave. Não há rollback "limpo" — usuários precisam relogar em
ambos os cenários.

---

## 3. STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET

### Quando usar

- Rotação routine ou suspeita de leak de chaves Stripe (risco financeiro).

### Pré-requisitos

- Dashboard Stripe (Developers → API keys + Developers → Webhooks).
- Modo coerente: test vs live (`STANDBY [STRIPE-LIVE]` se live).

### Procedimento

```sh
# 1. Stripe dashboard: "Roll key" em STRIPE_SECRET_KEY (grace period 24h).
# 2. Stripe dashboard: gerar novo signing secret em Webhooks → endpoint ativo.
# 3. Atualizar GH Secrets:
gh secret set STRIPE_SECRET_KEY --body "sk_..."
gh secret set STRIPE_WEBHOOK_SECRET --body "whsec_..."
# 4. Atualizar Fly:
fly secrets set STRIPE_SECRET_KEY="sk_..." STRIPE_WEBHOOK_SECRET="whsec_..." -a laura-finance-api
```
Expected: release Fly publicado.

### Validação

```sh
# Smoke webhook via Stripe CLI (modo test):
stripe trigger payment_intent.succeeded
# Logs Fly devem mostrar webhook recebido + assinatura válida.
fly logs -a laura-finance-api | grep -i stripe
```
Expected: `webhook signature verified: ok`.

### Rollback do rollback

Durante a janela de grace (24h), a chave antiga ainda funciona — basta
restaurar no Fly. Após a grace, precisa rollar novamente e atualizar.

---

## 4. RESEND_API_KEY

### Quando usar

- Rotação routine ou suspeita de leak; abuse de envio detectado.

### Pré-requisitos

- Dashboard https://resend.com/api-keys.
- `STANDBY [RESEND-DOMAIN]` (domínio verificado).

### Procedimento

```sh
# 1. Resend dashboard: revogar key antiga + criar nova.
# 2. GH + Fly:
gh secret set RESEND_API_KEY --body "re_..."
fly secrets set RESEND_API_KEY="re_..." -a laura-finance-api
```
Expected: release Fly.

### Validação

```sh
# Enviar email de teste via endpoint interno:
curl -X POST https://api.laura.finance/api/v1/admin/email/test \
  -H "Cookie: session=..." \
  -d '{"to":"test@laura.finance","template":"welcome"}'
# Checar Resend dashboard → Logs.
```
Expected: email entregue (status `delivered` no Resend).

### Rollback do rollback

Reverter para chave anterior (se ainda não revogada). Se revogada, criar
nova e repetir.

---

## 5. DATABASE_URL

### Quando usar

- Rotação routine de credencial Postgres ou suspeita de leak.

### Pré-requisitos

- `STANDBY [FLY-PG-CREATE]`: cluster Postgres existente.
- **Aviso crítico:** rotação envolve reattach — requer migração de sessão
  Whatsmeow (cada instância precisa novo QR scan). Ver
  `docs/ops/deployment.md` §"Whatsmeow sessions" antes.

### Procedimento

```sh
# 1. Gerar novas credenciais no cluster (via fly pg detach + fly pg attach
#    com novo role), OU rotacionar a senha do role existente:
fly postgres connect -a laura-finance-db
# dentro do psql:
#   ALTER ROLE laura_finance WITH PASSWORD '<nova-senha>';
# 2. Atualizar DATABASE_URL no app:
fly secrets set DATABASE_URL="postgres://laura_finance:<nova-senha>@<host>/laura_finance?sslmode=require" -a laura-finance-api
```
Expected: release Fly, app reconecta ao DB.

### Validação

```sh
curl -fsS https://api.laura.finance/ready && echo OK
fly logs -a laura-finance-api | grep -i "database"
```
Expected: `/ready` retorna 200 (inclui check de DB); logs mostram
conexões estabelecidas sem erro de auth.

### Rollback do rollback

Se a nova senha quebrar: `ALTER ROLE ... PASSWORD '<senha-antiga>'` no
psql + `fly secrets set DATABASE_URL=<url-antiga>`. Whatsmeow sessions
provavelmente precisarão de novo QR scan de qualquer forma (ver
deployment.md).

---

## Cadência

| Secret | Routine | Emergencial |
|--------|---------|-------------|
| GROQ_API_KEY | 90d | leak detectado |
| SESSION_SECRET | 90d | leak detectado |
| STRIPE_SECRET_KEY | 180d | leak ou roll recomendado pela Stripe |
| STRIPE_WEBHOOK_SECRET | 180d | endpoint comprometido |
| RESEND_API_KEY | 90d | abuse detectado |
| DATABASE_URL | 180d | leak ou compromise do cluster |

Alertas de rotação devem estar no calendário do owner + dashboard
admin (Fase 11+).
