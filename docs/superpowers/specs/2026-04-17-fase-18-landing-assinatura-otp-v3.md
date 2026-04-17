# Fase 18 — Landing Page + Assinatura + Auth Redesign + OTP (Spec v3 — final)

> v3 incorpora review #2 de v2. Mudanças principais:
> - Super admin `/admin/plans` ganha edição dos 2 campos novos (price_cents_yearly, stripe_price_id_yearly).
> - Superadmin isento do paywall (tanto Go quanto PWA).
> - Handler `/public/signup/finalize` retorna apenas `{user_id, email}` — PWA cria a sessão HMAC localmente.
> - Whatsapp E.164 default BR (+55) se input só numérico.
> - Cron usa `robfig/cron` integrando ao `cron_service.go` existente.
> - LP PricingCards tem fallback estático em erro.
> - Rota whitelist do paywall usa `/settings` (rota atual).
> - Password signup mínimo 8 chars (login legado não é afetado).
> - Mantém LEI #3: lucide-only, tap target ≥ 44px, PT-BR acentuado.

---

## 1. Objetivo

Entregar a evolução comercial do Laura Finance em uma fase:

1. **Landing page pública** (`/`) imersiva, premium, sincronizada com super admin.
2. **Trial de 7 dias sem cartão**, ativado no signup.
3. **Redesign do fluxo de autenticação** (login, signup multi-step, forgot/reset password) coletando nome, email e WhatsApp com verificação OTP em ambos canais.
4. **Seção interna de assinatura** (`/assinatura`) para assinar após trial, atualizar cartão, trocar de plano, cancelar.
5. **Paywall pós-trial** que mantém o usuário logado mas restringe a navegação à tela de assinatura até regularização.

Identidade visual atual (dark `#0A0A0F`, primária `#7C3AED`, secundária `#10B981`, Tailwind v4, shadcn/ui, Framer Motion restrito, lucide-react, PT-BR) é lei inegociável.

## 2. Escopo

### 2.1. Sub-fase 18A — Backend Go + Migrations + Webhook Stripe

#### Migrations

- `000038_create_otp_codes.{up,down}.sql`
  ```sql
  CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('email','whatsapp')),
    target_value VARCHAR(255) NOT NULL,
    code_hmac VARCHAR(64) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    context_id UUID,
    attempts SMALLINT NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_otp_lookup ON otp_codes(target_type, target_value, purpose) WHERE used_at IS NULL;
  CREATE INDEX idx_otp_context ON otp_codes(context_id) WHERE used_at IS NULL;
  CREATE INDEX idx_otp_rate ON otp_codes(target_type, target_value, created_at);
  ```

- `000039_create_pending_signups.{up,down}.sql`
  ```sql
  CREATE TABLE pending_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    desired_plan_slug VARCHAR(50),
    email_verified_at TIMESTAMPTZ,
    whatsapp_verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_pending_email_active ON pending_signups(email) WHERE consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP;
  CREATE INDEX idx_pending_whatsapp_active ON pending_signups(whatsapp) WHERE consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP;
  ```

- `000040_add_subscription_state.{up,down}.sql`
  ```sql
  ALTER TABLE workspaces
    ADD COLUMN subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial'
      CHECK (subscription_status IN ('trial','active','past_due','canceled','expired')),
    ADD COLUMN current_plan_slug VARCHAR(50),
    ADD COLUMN trial_ends_at TIMESTAMPTZ,
    ADD COLUMN current_period_end TIMESTAMPTZ,
    ADD COLUMN past_due_grace_until TIMESTAMPTZ,
    ADD COLUMN canceled_at TIMESTAMPTZ,
    ADD COLUMN card_brand VARCHAR(20),
    ADD COLUMN card_last4 VARCHAR(4),
    ADD COLUMN card_exp_month SMALLINT,
    ADD COLUMN card_exp_year SMALLINT;

  UPDATE workspaces SET
    subscription_status = CASE plan_status
      WHEN 'active' THEN 'active'
      WHEN 'trial'  THEN 'trial'
      WHEN 'canceled' THEN 'canceled'
      ELSE 'active'
    END,
    current_plan_slug = COALESCE(current_plan_slug, 'vip'),
    trial_ends_at = CASE WHEN plan_status='trial' THEN CURRENT_TIMESTAMP + INTERVAL '7 days' ELSE NULL END;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
    ON users(phone_number) WHERE phone_number IS NOT NULL;

  CREATE TABLE stripe_events (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    payload JSONB
  );
  ```

- `000041_seed_billing_otp_templates.{up,down}.sql` — seed em `email_templates` com tipos: `codigo_verificacao_email`, `trial_iniciado`, `trial_terminando_d3`, `trial_terminando_d1`, `trial_expirado`, `pagamento_falhou`, `pagamento_retomado`, `assinatura_cancelada`.

- `000042_add_yearly_price_to_plans.{up,down}.sql`
  ```sql
  ALTER TABLE subscription_plans
    ADD COLUMN price_cents_yearly INTEGER,
    ADD COLUMN stripe_price_id_yearly VARCHAR(200);
  ```

#### Services Go

- `internal/services/otp.go`
  - `GenerateOTP(ctx, targetType, targetValue, purpose, contextID) (code string, err error)` — 6 dígitos numéricos, armazena `hex(HMAC-SHA256(OTP_SECRET, code))`, expira em 10 min, `max_attempts=5`.
  - `VerifyOTP(ctx, targetType, targetValue, purpose, code) (contextID uuid.UUID, err error)` — incrementa `attempts`, marca `used_at` se ok. Erros tipados: `ErrOTPNotFound`, `ErrOTPExpired`, `ErrOTPMaxAttempts`, `ErrOTPInvalid`.
  - `CanResendOTP(ctx, targetType, targetValue, purpose) (bool, retryAfter time.Duration)` — rate limit 3/hora.

- `internal/services/whatsapp_sender.go`
  - `SendText(ctx, phone E164, text string) error` — escolhe instância por `WHATSAPP_OTP_INSTANCE_ID` ou primeira `status=connected`. `whatsmeow.Client.SendMessage` com `types.JID{User: phone[1:], Server: "s.whatsapp.net"}` e `waE2E.Message{Conversation: proto.String(text)}`. `DISABLE_WHATSAPP=true` → `log.Printf("[dev] whatsapp to %s: %s"...)`, retorna nil. Timeout ctx 30s. Erro se nenhuma instância conectada: `ErrNoWhatsappInstance`.
  - `NormalizeE164(raw) (string, error)` — tenta parse com `libphonenumber-go`; se só dígitos sem `+`, prefixa `+55` (Brasil default).

- `internal/services/email.go` — client Resend (Go). `SendOTPEmail`, `SendTrialStartedEmail`, `SendTrialEndingEmail(day int)`, `SendPaymentFailedEmail`, `SendCanceledEmail`, `SendPaymentResumedEmail`. Busca templates em `email_templates`, fallback HTML inline. `APP_URL` via env.

- `internal/services/subscription.go`
  - `type SubscriptionState string` (`trial_active`, `trial_ended`, `active`, `past_due_grace`, `past_due_blocked`, `canceled_grace`, `expired`).
  - `ComputeState(ws Workspace, now time.Time) SubscriptionState` — pura.
  - `IsBlocked(s SubscriptionState) bool` — true para `trial_ended`, `past_due_blocked`, `expired`.
  - `DaysRemaining(ws Workspace, now time.Time) int`.

- `internal/services/cron_trial.go` — integra em `cron_service.go` existente. Schedule `0 4 * * *` UTC:
  - `trial → expired` onde `trial_ends_at < now()` E email `trial_expirado`.
  - Email `trial_terminando_d3` onde `trial_ends_at ∈ [now+2d22h, now+3d2h]`.
  - Email `trial_terminando_d1` onde `trial_ends_at ∈ [now+22h, now+26h]`.
  - `past_due → expired` onde `past_due_grace_until < now()`.

#### Handlers Go

- `handlers/public_plans.go` — `GET /api/v1/public/plans` (sem auth). Retorna `[{slug, name, price_cents, price_cents_yearly, features_description, sort_order, is_most_popular}]`. Filtra: `active=true`, `ORDER BY sort_order`. `is_most_popular` = true para o plano com maior `price_cents` entre ativos.

- `handlers/signup.go` — rate limit por IP 10/min:
  - `POST /api/v1/public/signup/start` — `{name, email, whatsapp, password, desired_plan_slug?}`. Valida campos (password min 8, 1 letra, 1 número), normaliza E.164 (`NormalizeE164`), lower email, hash bcrypt(10), checa unicidade em `users.email`, `users.phone_number`, `pending_signups` ativo (mesmo email/whatsapp). Cria `pending_signups`, gera 2 OTPs, envia email + whatsapp (goroutine com `context.WithTimeout` 20s, best-effort, erro não aborta). Retorna `{pending_id, email_masked, whatsapp_masked}`.
  - `POST /api/v1/public/signup/verify-email` — `{pending_id, code}`. Valida OTP via `VerifyOTP`, marca `email_verified_at`.
  - `POST /api/v1/public/signup/verify-whatsapp` — `{pending_id, code}`. Igual.
  - `POST /api/v1/public/signup/finalize` — `{pending_id}`. Exige ambos verified. Transação: INSERT workspaces (trial_ends_at=now()+TRIAL_DAYS, subscription_status='trial', current_plan_slug=desired_plan_slug ?? 'vip'), INSERT users (email_verified=TRUE, phone_number=whatsapp, role='proprietário'), seed categories. Marca pending `consumed_at=now()`. Retorna `{user_id, email, workspace_id}`. **Não cria sessão — o PWA faz isso.**
  - `POST /api/v1/public/signup/resend-email` — `{pending_id}`. 429 + `Retry-After` se rate limited.
  - `POST /api/v1/public/signup/resend-whatsapp` — igual.

- `handlers/subscription.go` (com `RequireSession`):
  - `GET /api/v1/me/subscription` → `{status, state, plan:{slug, name, price_cents}, trial_ends_at, current_period_end, past_due_grace_until, canceled_at, card:{brand, last4, exp_month, exp_year}, is_blocked, days_remaining}`.
  - `POST /api/v1/me/subscription/checkout` → `{plan_slug, billing_cycle}`. Resolve `stripe_price_id` ou `stripe_price_id_yearly`, cria `stripe.checkout.Session` (mode=subscription, client_reference_id=userID, customer reusa, metadata `{workspace_id, plan_slug, cycle}`, `subscription_data.trial_end` se ainda em trial), retorna `{url}`.
  - `POST /api/v1/me/subscription/portal` → `stripe.billingportal.Session` com `return_url=STRIPE_BILLING_PORTAL_RETURN_URL`, retorna `{url}`. 409 se `stripe_customer_id` null.
  - `POST /api/v1/me/subscription/cancel` → `stripe.Subscription.Update(..., {cancel_at_period_end: true})`. DB: `status='canceled'`, `canceled_at=now()`.
  - `POST /api/v1/me/subscription/reactivate` → inverte cancel. DB: `status='active'`, `canceled_at=null`.

- `handlers/admin_plans.go` (existente) — expandir validação/aceitação dos campos `price_cents_yearly`, `stripe_price_id_yearly`.

#### Paywall Go

- `handlers/middleware.go` ganha `RequireActiveSubscription`. Após `RequireSession`:
  - Se `SessionContext.IsSuperAdmin`: passa.
  - SELECT workspace → `ComputeState` → se `IsBlocked`, responde `402 {error:'subscription_blocked', redirect:'/assinatura'}`.
  - Aplicado em `/api/v1/transactions`, `/cards`, `/categories`, `/reports`, `/llm`, `/invoices`, `/goals`, `/investments`, `/members`.
  - NÃO aplicado em `/me*`, `/me/subscription*`, `/admin*`, `/public/*`.

#### Webhook Stripe (PWA `laura-pwa/src/app/api/stripe/webhook/route.ts`)

Expande o arquivo atual. Antes de processar: `INSERT INTO stripe_events(id,type,payload) ON CONFLICT (id) DO NOTHING RETURNING id`; se zero linhas, ignora.

Eventos tratados:
1. `checkout.session.completed`: `status='active'`, grava `stripe_subscription_id`, `stripe_customer_id`, `current_plan_slug` (via metadata), `current_period_end`, card info (via `stripe.paymentMethods.retrieve`). Envia receipt (já faz hoje).
2. `invoice.paid`: `status='active'`, `current_period_end` atualizado. Se vinha de `past_due`, envia email `pagamento_retomado`.
3. `invoice.payment_failed`: `status='past_due'`, `past_due_grace_until=now()+PAST_DUE_GRACE_DAYS*24h`. Email `pagamento_falhou`.
4. `customer.subscription.updated`: atualiza `current_plan_slug` (price→plan lookup), `current_period_end`, `cancel_at_period_end` (se true → `status='canceled'`).
5. `customer.subscription.deleted`: `status='expired'`.

Após processar, `UPDATE stripe_events SET processed_at=now() WHERE id=$1`.

### 2.2. Sub-fase 18B — Landing Page

**Rota:** `src/app/page.tsx` vira LP. Server component com `getSession()`:
- Sessão: `redirect('/dashboard')`.
- Sem sessão: renderiza `<LandingPage />`.

**Metadata:** `export const metadata: Metadata = { title: 'Laura — Sua família no controle das finanças', description: '...', openGraph: {...}, alternates: { canonical: '...' } }`.

**Componentes (em `src/components/marketing/`):**

- `MarketingNavbar.tsx` — sticky, blur backdrop, transparente no topo, sólido após scroll (100px). Logo + âncoras (Recursos, Planos, FAQ) + "Entrar" ghost + "Começar grátis" primary. Mobile: hamburguer → Sheet.
- `Hero.tsx`
  - 2 orbs radial gradient violet/emerald `blur-3xl` com `motion.div` scale+opacity loop 12s (`prefers-reduced-motion` para estático).
  - H1 `text-3xl sm:text-5xl lg:text-6xl font-bold` "Sua família no controle das finanças, sem planilhas."
  - Subcopy `text-lg text-white/70` 1 linha.
  - 2 CTAs: primary "Começar 7 dias grátis" (→ `/register`), ghost "Já tenho conta" (→ `/login`).
  - Mock central: card glass simulando conversa WhatsApp (3 mensagens alternadas — mock estático com `motion` fade-in staggered) + 3 chips de métrica (Score 87, R$ saldos, última tx) orbitando com `motion` loop infinito (`animate={{rotate:360}}`, 30s+). 
- `TrustBar.tsx` — 4 chips com ícones lucide (ShieldCheck, CreditCardOff, Lock, FileCheck). Sem emojis.
- `FeatureGrid.tsx` — grid 3×2, cards glass `hover:-translate-y-1 hover:shadow-2xl transition`. Features: WhatsApp NLP, Score familiar, Categorias IA, Metas, Open Finance, Relatórios IA. Cada card: ícone 32px + h3 + p.
- `HowItWorks.tsx` — 3 steps horizontais (mobile empilha). Conector: linha gradient que preenche ao entrar em viewport (`useInView` + `motion.div` width transition).
- `PricingCards.tsx` — server component. `fetch('${GO_API_URL}/api/v1/public/plans', { cache: 'no-store' })`. Em erro, mostra placeholder estático com CTA único "Ver todos os planos" → `/register`. Client boundary para toggle mensal/anual (só renderiza se houver `price_cents_yearly`). Card "mais popular" com `ring-2 ring-violet-500/50 shadow-[0_0_40px_rgba(124,58,237,0.3)]`. CTA por card → `/register?plan=<slug>`.
- `Testimonials.tsx` — 3 depoimentos estáticos em cards. Auto-scroll horizontal desktop (CSS `animation` infinite), empilha mobile.
- `FAQ.tsx` — accordion shadcn/Radix. 8 perguntas (PT-BR).
- `CTAFinal.tsx` — section full-bleed, `bg-gradient-to-br from-violet-600/20 to-emerald-600/20`, headline + CTA grande.
- `MarketingFooter.tsx` — logo + 3 colunas (Produto, Empresa, Legal) + redes + copyright.

**LEI #3 reforçada:** tap targets ≥ 44×44, lucide-only (sem emoji estrutural), Framer Motion só em Hero orbs/mock, HowItWorks conector, PricingCards hover popular. `prefers-reduced-motion` respeitado. Dark mode default.

### 2.3. Sub-fase 18C — Auth redesign + OTP

**Rotas:** `/login`, `/register` (wizard), `/forgot-password`, `/reset-password/[token]`.

**Server actions em `src/lib/actions/signup.ts`:**

- `signupStartAction({name, email, whatsapp, password, desiredPlan})` → POST Go `/public/signup/start`. Retorna `{pendingId, emailMasked, whatsappMasked}` ou erros por campo.
- `signupVerifyEmailAction({pendingId, code})` → POST `/verify-email`.
- `signupVerifyWhatsappAction({pendingId, code})` → POST `/verify-whatsapp`.
- `signupFinalizeAction({pendingId})` → POST `/finalize` → pega `{user_id}` → chama `createSession(user_id)` local (reusa HMAC SESSION_SECRET) → seta cookie `laura_session_token` → retorna `{redirect: '/dashboard'}`.
- `signupResendEmailAction({pendingId})` / `signupResendWhatsappAction({pendingId})` — pass-through com 429 handling.

**Componentes:**

- `SignupWizard.tsx` (client)
  - State: `{pendingId, desiredPlan, currentStep, emailMasked, whatsappMasked}`. Persiste em `sessionStorage.laura_signup_state` (limpa no finalize).
  - Query param `?plan=<slug>` lida via `useSearchParams`, passa como `desiredPlan`.
  - Progress bar 3 passos no topo.
  - Step 1 (dados): react-hook-form + zod. Campos: nome (min 3), email (regex), whatsapp (mask `+55 (XX) XXXXX-XXXX`), senha (≥ 8, 1 letra, 1 número), confirmar senha. Submit → `signupStartAction`.
  - Step 2 (verifica email): exibe `emailMasked`. `OTPCodeInput`. Countdown 60s → botão "Reenviar código". Link "Trocar email" (volta step 1 limpando pending).
  - Step 3 (verifica whatsapp): igual step 2. Após sucesso, chama `signupFinalizeAction` automaticamente → redirect `/dashboard`.
  - Botão voltar nos steps 2 e 3.
  - Mensagens de erro em PT-BR, sem vazar detalhes internos.

- `OTPCodeInput.tsx` — 6 inputs numéricos (`inputMode="numeric"`). Auto-avanço. Backspace recua. Paste distribui. `animate-shake` CSS em erro (definido no globals.css). Auto-submit quando 6 preenchidos. `aria-label` descritivo.

- `LoginForm.tsx` redesign — card glass centralizado, orb sutil background. Inputs shadcn, `focus:ring-violet-500/40`. Botão width-full. Links "Esqueci senha" (right) e "Criar conta" (bottom center). Banner dev-login preservado.

- `ForgotPasswordForm.tsx` + `ResetPasswordForm.tsx` — mesma linguagem visual.

**A11y:** tap targets 44×44, foco teclado, `aria-live="polite"` em erros, labels.

### 2.4. Sub-fase 18D — Seção interna /assinatura + banners + paywall

**Rota nova:** `src/app/(dashboard)/assinatura/page.tsx`.

**Layout `(dashboard)/layout.tsx` estendido:**
- `getSession()` + `fetch('/api/v1/me/subscription')` server-side.
- Se `isSuperAdmin`: passa (sem paywall).
- Se `isBlocked` E `pathname NÃO ∈ whitelist`: `redirect('/assinatura?blocked=1')`. Whitelist: `/assinatura`, `/settings`, `/api`.
- Passa `subscriptionInfo` via React context (`SubscriptionProvider`) aos children.

**Componentes novos:**

- `SubscriptionManager.tsx` — dispatches pelo `state`:
  - `trial_active`: "Seu trial" + countdown + CTA "Assinar agora" (inline `PlanSelector`).
  - `active`: "Plano ativo" + plano + próx cobrança + cartão mascarado + ações (`PlanSelector` modo upgrade/downgrade, "Atualizar cartão" → portal, "Cancelar assinatura" dialog).
  - `past_due_grace`: card vermelho "Pagamento falhou" + "Atualizar cartão" → portal.
  - `canceled_grace`: "Cancelado, acesso até DD/MM/YYYY" + "Reativar".
  - `trial_ended`/`past_due_blocked`/`expired`: "Reative sua assinatura" + `PlanSelector` CTA único.

- `PlanSelector.tsx` (client) — `fetch /api/v1/public/plans`. Highlight plano atual. CTA "Selecionar" por card → `POST /me/subscription/checkout` → redirect URL Stripe.

- `TrialBanner.tsx` — render no layout se `status='trial'`:
  - `daysRemaining ≥ 4`: violet "Você tem N dias de trial. Assine quando quiser."
  - `daysRemaining ∈ {2, 3}`: âmbar "Faltam só N dias. Assine agora para não perder acesso."
  - `daysRemaining ≤ 1`: vermelho "Último dia do trial!" CTA enfatizado.
  - Dismiss diário: `localStorage.laura_trial_banner_dismissed_YYYYMMDD`.

- `PastDueBanner.tsx` — `status='past_due'`: vermelho "Pagamento em atraso. Atualize até DD/MM/YYYY." Não dismissable.

- `CancelDialog.tsx` — confirm com aviso de acesso até period_end.

**Middleware PWA:** mantém (só valida cookie). Fonte de verdade do paywall é server-side no layout.

### 2.5. Super Admin

`src/app/(admin)/admin/plans/page.tsx` + `PlansEditor` atualizados para editar `price_cents_yearly` e `stripe_price_id_yearly` (campos opcionais no form). Endpoint Go `PUT /admin/plans/:slug` já existe — aceita os campos novos.

### 2.6. Env vars novas

- `OTP_SECRET` — obrigatório em prod, sem fallback.
- `TRIAL_DAYS` — default `7`.
- `PAST_DUE_GRACE_DAYS` — default `3`.
- `WHATSAPP_OTP_INSTANCE_ID` — opcional.
- `STRIPE_BILLING_PORTAL_RETURN_URL` — default `${NEXT_PUBLIC_APP_URL}/assinatura`.
- `RESEND_API_KEY` — já existe (PWA); Go reaproveita mesma var.

Documentar em `laura-go/.env.example` e `laura-pwa/.env.example`.

### 2.7. Testes

- **Go unit**
  - `services/otp_test.go`: gen+verify happy, expired, max_attempts, wrong code, resend rate limit.
  - `services/subscription_test.go`: state machine (10 cenários), `IsBlocked`, `DaysRemaining`.
  - `services/whatsapp_sender_test.go`: dev-mode (DISABLE_WHATSAPP) e seleção de instância.
  - `services/email_test.go`: template lookup + fallback.
- **Go integration**
  - `handlers/signup_test.go`: happy path, duplicate email (409), OTP inválido, pending expirado, rate limit resend.
  - `handlers/subscription_test.go`: GET, checkout (stripe mock), cancel, reactivate, portal sem customer (409).
  - `handlers/paywall_test.go`: 402 quando bloqueado, 200 quando ativo, whitelist, superadmin sempre passa.
- **Vitest**
  - `OTPCodeInput.test.tsx`, `PricingCards.test.tsx` (fetch mock + fallback), `TrialBanner.test.tsx`, `SubscriptionManager.test.tsx`.
- **Playwright E2E** (env `OTP_TEST_MODE=true` que fixa OTP `123456`):
  1. LP carrega + pricing ≥ 1 card.
  2. Signup wizard completo → dashboard + banner trial.
  3. Login existente → dashboard.
  4. Forgot password → reset via token mock.
  5. Paywall: workspace seeded `expired` → `/dashboard` redireciona `/assinatura`; `/assinatura` OK.
  6. Assinatura ativa: `/assinatura` mostra card "ativo".

- **Seed teste**: `infrastructure/seeds/test_paywall.sql`.

### 2.8. Deploy

- Migrations 000038–000042 via `db-migrate` stack.
- Env vars novas configuradas ANTES do deploy.
- Smoke test pós-deploy:
  - LP 200.
  - `/api/v1/public/plans` retorna lista.
  - Signup wizard até step 2 (verificar email recebido).
  - Login existente.
  - Checkout Stripe test mode.
  - Webhook stripe `stripe trigger invoice.paid`.
- Tag git `phase-18-deployed`.

## 3. Estados de assinatura

```
trial_active     → dentro do trial, acesso total
trial_ended      → trial_ends_at < now, bloqueado
active           → paga, acesso total
past_due_grace   → pagamento falhou, dentro do grace, acesso total + banner
past_due_blocked → grace esgotou, bloqueado
canceled_grace   → cancelado mas dentro do period_end, acesso total
expired          → period_end passou / past_due_blocked consolidado
```

Transições:
- `trial_active → active` (webhook `invoice.paid`).
- `trial_active → trial_ended` (tempo).
- `active → past_due_grace` (`invoice.payment_failed`).
- `past_due_grace → active` (`invoice.paid`).
- `past_due_grace → past_due_blocked` (tempo).
- `active → canceled_grace` (user cancel).
- `canceled_grace → expired` (tempo).
- `trial_ended/past_due_blocked/expired → active` (novo checkout).

## 4. Riscos e mitigações

- **OTP WhatsApp depende de instância conectada** → fallback 503 "canal indisponível"; dev log.
- **Trials abusivos (múltiplos por email/whatsapp)** → UNIQUE email, UNIQUE phone_number WHERE NOT NULL.
- **Webhook race** → `stripe_events` idempotência.
- **Backfill `plan_status → subscription_status`** → mapping explícito, free legado vira `active` grandfathered.
- **LP em `/` quebrar bookmark antigo** → redirect server-side quando logado.
- **Resend duplicado Go/PWA** → aceita em ADR 007.

## 5. Entregáveis

1. Migrations 000038–000042.
2. Services Go: otp, whatsapp_sender, email, subscription, cron_trial.
3. Handlers Go: public_plans, signup, subscription + middleware paywall.
4. Webhook Stripe PWA expandido + `stripe_events`.
5. Rotas + componentes PWA: LP (10 componentes marketing), SignupWizard, OTPCodeInput, SubscriptionManager, PlanSelector, TrialBanner, PastDueBanner, CancelDialog, redesign login/forgot/reset.
6. Layout `(dashboard)` com paywall server-side.
7. Templates email + seed.
8. Super admin `PlansEditor` com campos yearly.
9. Testes Go + Vitest + Playwright (6 novos).
10. Docs: `docs/ops/subscription-state-machine.md`, ADR 007, `CLAUDE.md` status atualizado.
11. Tag `phase-18-deployed`.

## 6. Fora do escopo

- Múltiplos tiers de desconto.
- Cupons, afiliados, referral.
- Pix/boleto — só Stripe cartão.
- I18n (só PT-BR).
- A/B testing LP.
- Analytics funil (GA/Mixpanel).
