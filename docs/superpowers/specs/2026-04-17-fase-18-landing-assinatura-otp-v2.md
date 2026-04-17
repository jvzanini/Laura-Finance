# Fase 18 — Landing Page + Assinatura + Auth Redesign + OTP (Spec v2)

> v2 incorpora review #1 de v1. Mudanças principais: (a) webhook Stripe fica no PWA existente, apenas expandido; (b) página `/assinatura` whitelisted no PaywallGate; (c) sessão pós-signup criada pelo server action do PWA, não pelo Go; (d) fonte de verdade do paywall 100% server-side (sem cookie flag); (e) OTP via HMAC-SHA256 com `OTP_SECRET`; (f) cron de trial adicionado; (g) client Resend duplicado no Go; (h) mais campos de cartão/billing.

## 1. Objetivo

Entregar a evolução comercial do Laura Finance:

1. **Landing page pública** (`/`) imersiva, premium, sincronizada com o super admin.
2. **Trial de 7 dias sem cartão**, ativado no signup.
3. **Redesign do fluxo de autenticação** (login, signup multi-step, forgot/reset password) coletando nome, email e WhatsApp com verificação OTP em ambos canais.
4. **Seção interna de assinatura** (`/assinatura`) para assinar após trial, atualizar cartão, trocar de plano, cancelar.
5. **Paywall pós-trial** que mantém o usuário logado mas restringe a navegação à tela de assinatura até a regularização.

Identidade visual atual (dark `#0A0A0F`, primária `#7C3AED`, secundária `#10B981`, Tailwind v4, shadcn/ui, Framer Motion restrito, lucide-react, PT-BR) é lei inegociável.

## 2. Contexto já existente

- Auth: server actions Next.js (`laura-pwa/src/lib/actions/auth.ts`, `passwordReset.ts`) + middleware Go (`laura-go/internal/handlers/session.go`). Signup atual coleta só nome/email/senha.
- Planos: tabela `subscription_plans` (migration 000026), editáveis via `/admin/plans` com `/api/v1/admin/plans*`.
- Stripe parcial: PWA `POST /api/stripe/checkout` + webhook `POST /api/stripe/webhook` tratando apenas `checkout.session.completed`.
- Workspaces têm `stripe_customer_id`, `stripe_subscription_id`, `plan_status`. Faltam campos de ciclo/trial.
- WhatsApp: whatsmeow multi-instância (`laura-go/internal/whatsapp/`, migration 000030). Sem helper atual para OTP.
- Email: Resend no PWA (`laura-pwa/src/lib/email.ts`) com templates em `email_templates`.
- Middleware PWA (`middleware.ts`) só redireciona sem sessão → `/login`.
- `/` hoje redireciona `→ /dashboard` ou `→ /register`.
- Última migration: `000037_bank_webhook_events`.

## 3. Escopo

### 3.1. Sub-fase 18A — Backend Go + Migrations + Webhook Stripe

#### Migrations

- `000038_create_otp_codes.{up,down}.sql`
  ```sql
  CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('email','whatsapp')),
    target_value VARCHAR(255) NOT NULL,
    code_hmac VARCHAR(64) NOT NULL,              -- hex HMAC-SHA256(OTP_SECRET, code)
    purpose VARCHAR(50) NOT NULL,                -- 'signup_email', 'signup_whatsapp'
    context_id UUID,                             -- ref pending_signups.id
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
    whatsapp VARCHAR(30) NOT NULL,               -- E.164 normalizado
    password_hash VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMPTZ,
    whatsapp_verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,             -- now() + 1h
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

  -- Backfill a partir do plan_status legado
  UPDATE workspaces SET
    subscription_status = CASE plan_status
      WHEN 'active' THEN 'active'
      WHEN 'trial'  THEN 'trial'
      WHEN 'canceled' THEN 'canceled'
      ELSE 'active'                              -- free existente vira active sem plano pago (grandfathered)
    END,
    current_plan_slug = COALESCE(current_plan_slug, 'vip'),
    trial_ends_at = CASE WHEN plan_status='trial' THEN CURRENT_TIMESTAMP + INTERVAL '7 days' ELSE NULL END;

  -- Unique phone_number por user ativo
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
    ON users(phone_number) WHERE phone_number IS NOT NULL;

  -- Idempotência webhooks Stripe
  CREATE TABLE stripe_events (
    id VARCHAR(255) PRIMARY KEY,                 -- evt_...
    type VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    payload JSONB
  );
  ```

- `000041_seed_billing_otp_templates.{up,down}.sql` — seed em `email_templates`:
  - `codigo_verificacao_email`
  - `trial_iniciado`
  - `trial_terminando_d3`
  - `trial_terminando_d1`
  - `trial_expirado`
  - `pagamento_falhou`
  - `assinatura_cancelada`
  - `pagamento_retomado`

- `000042_add_yearly_price_to_plans.{up,down}.sql`
  ```sql
  ALTER TABLE subscription_plans
    ADD COLUMN price_cents_yearly INTEGER,
    ADD COLUMN stripe_price_id_yearly VARCHAR(200);
  ```
  LP exibe toggle anual/mensal apenas se qualquer plano ativo tiver `price_cents_yearly NOT NULL`. Super admin `/admin/plans` ganha os 2 campos opcionais.

#### Services Go

- `internal/services/otp.go`
  - `GenerateOTP(ctx, targetType, targetValue, purpose, contextID) (code string, err error)` — gera 6 dígitos numéricos, armazena `HMAC-SHA256(OTP_SECRET, code)` em hex, expira em 10 min, max 5 tentativas.
  - `VerifyOTP(ctx, targetType, targetValue, purpose, code) (contextID uuid.UUID, err error)` — incrementa `attempts`, retorna ok e marca `used_at`. Erros específicos: `ErrOTPNotFound`, `ErrOTPExpired`, `ErrOTPMaxAttempts`, `ErrOTPInvalid`.
  - `CanResendOTP(ctx, targetType, targetValue, purpose) (bool, retryAfter time.Duration)` — rate limit 3 por hora, retorna próximo horário permitido.
- `internal/services/whatsapp_sender.go`
  - `SendText(ctx, phone E164, text string) error` — escolhe instância via `WHATSAPP_OTP_INSTANCE_ID` ou primeira `status=connected` do DB. Usa `whatsmeow.Client.SendMessage` com `types.JID{User: phone, Server: "s.whatsapp.net"}` e `waE2E.Message{Conversation: proto.String(text)}`. Se `DISABLE_WHATSAPP=true`, log `[dev] whatsapp to %s: %s` e retorna nil. Timeout ctx 30s.
- `internal/services/email.go` (novo — Go) — client Resend usando `github.com/resendlabs/resend-go/v2`. Funções `SendOTPEmail(ctx, email, code)`, `SendTrialStartedEmail`, `SendTrialEndingEmail(day)`, `SendPaymentFailedEmail`, `SendCanceledEmail`. Busca templates em `email_templates` table (mesmo schema do PWA). Fallback inline HTML se template ausente.
- `internal/services/subscription.go`
  - `type SubscriptionState string` (`trial_active`, `trial_ended`, `active`, `past_due_grace`, `past_due_blocked`, `canceled_grace`, `expired`).
  - `ComputeState(ws Workspace, now time.Time) SubscriptionState` — pura, sem IO.
  - `IsBlocked(s SubscriptionState) bool` — true para `trial_ended`, `past_due_blocked`, `expired`.
  - `DaysRemaining(ws Workspace, now time.Time) int`.

#### Cron novo

- `internal/services/cron_trial.go` — job diário 04:00 UTC (alinhado com `cron_service.go` existente):
  - Marca `subscription_status='expired'` onde `status='trial' AND trial_ends_at < now()` E manda email `trial_expirado`.
  - Manda email `trial_terminando_d3` para `status='trial' AND trial_ends_at - now() BETWEEN 3d±1h`.
  - Manda email `trial_terminando_d1` para `status='trial' AND trial_ends_at - now() BETWEEN 1d±1h`.
  - Marca `past_due → expired` onde `past_due_grace_until < now()`.

#### Handlers Go

- `handlers/public_plans.go` — `GET /api/v1/public/plans` (sem auth). Filtra: retorna só `{slug, name, price_cents, price_cents_yearly, features_description, sort_order, is_most_popular}` (este último calculado como o maior `price_cents` ativo).
- `handlers/signup.go` — rate limit `/api/v1/public/signup/*` por IP (10 req/min) usando middleware Fiber `fiber/v2/middleware/limiter`:
  - `POST /start` — `{name, email, whatsapp, password}`. Valida campos, hash senha (bcrypt 10), normaliza whatsapp E.164 (libphonenumber-go), checa unicidade em `users` + `pending_signups` ativos. Cria `pending_signups`, gera 2 OTPs, envia email + whatsapp (goroutine com timeout), retorna `{pending_id}` (JSON).
  - `POST /verify-email` — `{pending_id, code}`. Valida OTP via `VerifyOTP`, marca `email_verified_at`.
  - `POST /verify-whatsapp` — `{pending_id, code}`. Igual.
  - `POST /finalize` — `{pending_id}`. Exige `email_verified_at IS NOT NULL AND whatsapp_verified_at IS NOT NULL`. Transação: INSERT workspaces (trial_ends_at=now()+TRIAL_DAYS, subscription_status='trial', current_plan_slug=COALESCE(body.desired_plan, 'vip')), INSERT users (email_verified=TRUE, phone_number=whatsapp, role='proprietário'), seed categories via `SeedDefaultCategories`. Marca pending `consumed_at=now()`. Retorna `{user_id, workspace_id, email}` — a criação de sessão fica no PWA (não expomos HMAC do Go como API).
  - `POST /resend-email` e `POST /resend-whatsapp` — `{pending_id}`, rate limited. 429 com `Retry-After`.
- `handlers/subscription.go` (`RequireSession` aplicado):
  - `GET /api/v1/me/subscription` → `{status, plan: {slug, name, price_cents}, trial_ends_at, current_period_end, past_due_grace_until, canceled_at, card: {brand, last4, exp_month, exp_year}, is_blocked, days_remaining}`.
  - `POST /api/v1/me/subscription/checkout` → `{plan_slug, billing_cycle: 'monthly'|'yearly'}`. Resolve `stripe_price_id` do plano e cycle, cria `stripe.checkout.Session` com `mode=subscription`, `client_reference_id=userID`, `customer` (reusa se existe), `metadata{workspace_id, plan_slug, cycle}`, `subscription_data.trial_end` (se ainda em trial), retorna `{url}`.
  - `POST /api/v1/me/subscription/portal` → `stripe.billingportal.Session` com `return_url=STRIPE_BILLING_PORTAL_RETURN_URL`, retorna `{url}`. Erro 409 se `stripe_customer_id` null.
  - `POST /api/v1/me/subscription/cancel` → `stripe.Subscription.Update(stripe_subscription_id, {cancel_at_period_end: true})`. DB: `subscription_status='canceled'`, `canceled_at=now()`. Mantém `current_period_end` (acesso até lá).
  - `POST /api/v1/me/subscription/reactivate` → `stripe.Subscription.Update(..., {cancel_at_period_end: false})`. DB: `status='active'`, `canceled_at=null`.

#### Paywall (Go)

- `handlers/middleware.go` ganha `RequireActiveSubscription`. Após `RequireSession`, faz `SELECT` workspace, `ComputeState`. Se `IsBlocked`, responde `402 Payment Required` JSON `{error: 'subscription_blocked', redirect: '/assinatura'}`. Aplicado nos grupos `/api/v1/transactions`, `/cards`, `/categories`, `/reports`, `/llm`, `/invoices`, `/goals`, `/investments`, `/members`. NÃO aplicado em `/me*`, `/me/subscription*`, `/admin*`, `/public/*`.

#### Webhook Stripe (PWA, expandido em `laura-pwa/src/app/api/stripe/webhook/route.ts`)

Mantém arquivo atual; expande para tratar:

1. `checkout.session.completed` — workspace `subscription_status='active'`, grava `stripe_subscription_id`, `stripe_customer_id`, `current_plan_slug` (via metadata), `current_period_end` (do subscription), card info. Envia receipt (já faz).
2. `invoice.paid` — `status='active'`, atualiza `current_period_end`.
3. `invoice.payment_failed` — `status='past_due'`, `past_due_grace_until=now()+PAST_DUE_GRACE_DAYS`. Dispara email `pagamento_falhou` via lib/email.ts.
4. `customer.subscription.updated` — atualiza `current_plan_slug` (via price→plan lookup), `current_period_end`, `cancel_at_period_end` (→ status `canceled`).
5. `customer.subscription.deleted` — `status='expired'`.

Idempotência: `INSERT INTO stripe_events(id,type,payload) VALUES (...) ON CONFLICT (id) DO NOTHING RETURNING id`. Se 0 linhas, ignora.

### 3.2. Sub-fase 18B — Landing Page

**Rota:** `src/app/page.tsx` vira LP. Server component que faz `getSession()`:
- Se sessão válida: redireciona `/dashboard` (preserva comportamento PWA install).
- Se sem sessão: renderiza `<LandingPage />`.

**Componentes (em `src/components/marketing/`):**

- `MarketingNavbar.tsx` — sticky, blur backdrop, transparente no topo, sólido após scroll (100px). Logo + links âncora (Recursos, Planos, FAQ) + botão ghost "Entrar" + botão primary "Começar grátis". Responsivo com menu hamburger mobile (Sheet).
- `Hero.tsx`
  - Background: 2 orbs radial gradient (`bg-[radial-gradient(...)]`) em `blur-3xl` com `motion` scale/opacity loop 12s+, respeita `prefers-reduced-motion`.
  - Headline h1 3xl→6xl, subcopy text-lg, 2 CTAs botão.
  - Mock central: card glassmorphism simulando conversa WhatsApp (3 mensagens alternando + chips de métricas orbitando — Framer Motion infinite loop suave).
- `TrustBar.tsx` — 4 chips com ícones lucide (ShieldCheck, CreditCardOff, XCircleOff, Lock): "Sem cartão", "Cancele quando quiser", "Dados criptografados", "LGPD compliant".
- `FeatureGrid.tsx` — grid 3×2, cards glassmorphism, hover lift (transform+shadow). Features:
  1. WhatsApp NLP (MessageSquare)
  2. Score financeiro familiar (Gauge)
  3. Categorias inteligentes (Tags)
  4. Metas compartilhadas (Target)
  5. Open Finance / bancos (Banknote)
  6. Relatórios IA (Sparkles)
- `HowItWorks.tsx` — 3 steps horizontais com conector animado (linha gradient que preenche ao entrar em viewport via `useInView`). Steps: "1. Assine grátis por 7 dias", "2. Converse no WhatsApp", "3. Acompanhe tudo organizado". Cada step com ícone + título + 1-linha descrição.
- `PricingCards.tsx` — server component: faz `fetch('/api/v1/public/plans', { cache: 'no-store' })`. Renderiza 1 card por plano. Toggle mensal/anual (client boundary) só aparece se algum plano tem yearly. Card "mais popular" com glow border. CTA "Começar 7 dias grátis" → `/register?plan=<slug>`.
- `Testimonials.tsx` — 3 depoimentos estáticos (por ora, texto + nome + cargo). Cards em carrossel auto-scroll desktop, empilha mobile.
- `FAQ.tsx` — `@radix-ui/react-accordion` (shadcn). 8 perguntas: trial; cartão; cancelamento; segurança dados; multi-família; Open Finance; suporte; compliance.
- `CTAFinal.tsx` — full-bleed gradient violet/emerald, headline "Pronto para entender suas finanças?", CTA único grande.
- `MarketingFooter.tsx` — logo + colunas (Produto, Empresa, Legal) + redes sociais + copyright.

**Glassmorphism moderado** (`bg-white/5 backdrop-blur-sm border border-white/10`), gradientes restritos a orbs/CTA, shadow-2xl em cards premium. **Tap targets ≥ 44×44px** inclusive nos links do footer mobile. **Sem emoji estrutural**. **Framer Motion** só em Hero orbs/mock, HowItWorks conector, PricingCards hover popular.

**SEO:** `metadata` em `app/layout.tsx` (title: "Laura — Sua família no controle das finanças", description 155ch, OG image, canonical).

### 3.3. Sub-fase 18C — Auth redesign + OTP

**Rotas:**
- `/login` — redesign visual, mesmo fluxo.
- `/register` — passa a ser wizard 3 steps (usa `SignupWizard`). Query param `?plan=<slug>` preserva intent vindo da LP.
- `/forgot-password` e `/reset-password/[token]` — redesign visual.

**Server actions novas** (`src/lib/actions/signup.ts`):

- `signupStartAction(formData)` → calls Go `/public/signup/start`, retorna `{pendingId}` ou erros de campo.
- `signupVerifyEmailAction({pendingId, code})` → calls `/verify-email`.
- `signupVerifyWhatsappAction({pendingId, code})` → calls `/verify-whatsapp`.
- `signupFinalizeAction({pendingId, desiredPlan})` → calls `/finalize`, pega `{user_id}` retornado, **cria sessão localmente** (reusando `createSession(userId)` em `lib/session.ts`), define cookie, redireciona `/dashboard`.
- `signupResendEmailAction({pendingId})` e `signupResendWhatsappAction` → 429 caso rate limit.

**Componentes novos:**

- `SignupWizard.tsx` (client) — 3 passos + botão "voltar" exceto no step 1. Mantém state `{pendingId, desiredPlan, currentStep, emailMasked, whatsappMasked}`. Progress bar topo. Validação inline com zod + react-hook-form.
  - Step 1 (dados): inputs nome (min 3 chars), email (regex + lower), whatsapp (mask `+55 (XX) XXXXX-XXXX`), senha (min 8, 1 num, 1 letra), confirmar senha. `PasswordStrengthMeter` opcional. Submit → `signupStartAction`.
  - Step 2 (email): exibe email parcialmente mascarado. `OTPCodeInput`. Countdown 60s "Reenviar código". Link "Trocar email" (volta step 1, limpa pending).
  - Step 3 (whatsapp): mesma estrutura. Após sucesso, chama `signupFinalizeAction` automaticamente → redirect `/dashboard`.
- `OTPCodeInput.tsx` — 6 inputs numéricos em row. Auto-avanço no dígito. Backspace recua. Paste distribui. Shake animation CSS em erro. Auto-submit ao preencher todos.
- Redesign `LoginForm.tsx` — card glass, inputs com glow em focus `ring-violet-500/40`, botão primary width-full, links "Esqueci senha" (right) e "Criar conta" (bottom center). Mantém banner dev-login existente. Background orb sutil.
- Redesign `ForgotPasswordForm.tsx` + `ResetPasswordForm.tsx` — mesma linguagem visual.

**UX:**
- A11y: foco teclado, `aria-live="polite"` em errors, tap targets 44×44.
- Mensagens de erro em PT-BR genéricas (sem vazar "email não existe"), exceto em campos com validação óbvia (email inválido, senha curta).
- Wizard tempo médio ≤ 90s. Persistência local em `sessionStorage` para não perder em refresh (limpa após sucesso).

### 3.4. Sub-fase 18D — Seção interna /assinatura + banners + paywall

**Rota nova:** `src/app/(dashboard)/assinatura/page.tsx`. O layout `(dashboard)/layout.tsx` já faz `getSession()` — será estendido para fazer `fetch('/api/v1/me/subscription')`, calcular `isBlocked`, e:
- Se rota ≠ whitelist (`/assinatura`, `/configuracoes/perfil`, `/logout`) E `isBlocked`: `redirect('/assinatura?blocked=1')`.
- Caso contrário, passa `subscriptionInfo` via context/prop aos children.

Fonte de verdade 100% server-side. Sem cookie flag. Mais simples e consistente.

**Componentes novos:**

- `SubscriptionManager.tsx` (server component wrapper + client interações) — dispatches pelo `status`:
  - `trial_active`: card "Seu trial" com countdown + CTA "Assinar agora" (abre `PlanSelector` inline).
  - `active`: card "Seu plano ativo" com plano + próx. cobrança + cartão mascarado + 3 ações: "Mudar plano" (abre `PlanSelector` modo upgrade/downgrade), "Atualizar cartão" (→ portal Stripe), "Cancelar assinatura" (dialog confirm).
  - `past_due_grace`: card vermelho "Pagamento falhou" + CTA "Atualizar forma de pagamento" (→ portal).
  - `canceled_grace`: card "Cancelado, acesso até DD/MM/YYYY" + botão "Reativar".
  - `trial_ended`/`past_due_blocked`/`expired`: card grande "Reative sua assinatura" + `PlanSelector` direto.
- `PlanSelector.tsx` (client) — fetch `/api/v1/public/plans`, highlight plano atual (se houver), CTA "Selecionar" por card. Ao clicar: chama `POST /me/subscription/checkout` → redireciona para URL Stripe.
- `TrialBanner.tsx` — renderizado no `(dashboard)/layout.tsx` se `status='trial'`. Conteúdo conforme dias restantes:
  - 7–4 dias: violeta neutro "Você tem X dias de trial."
  - 3–2 dias: âmbar "Faltam só X dias. Assine agora para não perder acesso."
  - 1 dia: vermelho "Último dia do trial!"
  - Dismissable por dia via `localStorage.laura_trial_banner_dismissed_YYYYMMDD`.
- `PastDueBanner.tsx` — se `status='past_due'`: vermelho "Pagamento em atraso. Atualize até DD/MM/YYYY." Não dismissable.
- `CancelDialog.tsx` — confirm com 2 opções: "Manter assinatura" e "Cancelar mesmo assim". Avisa sobre acesso até fim do período.
- `PaywallGate.tsx` **não é necessário** (fica apenas o check server-side no layout).

**Middleware PWA:** sem alteração (continua só validando presença de cookie).

### 3.5. Env vars novas

- `OTP_SECRET` — obrigatório em prod, sem fallback. Usado pelo HMAC do OTP.
- `TRIAL_DAYS` — default `7`.
- `PAST_DUE_GRACE_DAYS` — default `3`.
- `WHATSAPP_OTP_INSTANCE_ID` — opcional.
- `STRIPE_BILLING_PORTAL_RETURN_URL` — default `${NEXT_PUBLIC_APP_URL}/assinatura`.
- `RESEND_API_KEY_GO` — reutiliza `RESEND_API_KEY` se só houver um.

Documentar em `laura-go/.env.example` e `laura-pwa/.env.example`.

### 3.6. Testes

- **Go unit**
  - `services/otp_test.go`: gen+verify happy, expired, max_attempts, wrong code, resend rate limit.
  - `services/subscription_test.go`: state machine (10 cenários), `IsBlocked`, `DaysRemaining` em fusos.
  - `services/whatsapp_sender_test.go`: dev-mode (DISABLE_WHATSAPP) e seleção de instância.
- **Go integration**
  - `handlers/signup_test.go`: happy path (start→verifyEmail→verifyWa→finalize), duplicate email (409), OTP inválido, pending expirado.
  - `handlers/subscription_test.go`: GET, checkout mock (stripe-go test mode), cancel, reactivate, portal sem customer (409).
  - `handlers/paywall_test.go`: 402 quando bloqueado, 200 quando ativo, endpoints whitelist sempre 200.
- **Vitest**
  - `OTPCodeInput.test.tsx`: paste/auto-avanço/erro.
  - `PricingCards.test.tsx`: fetch mock, toggle mensal/anual, "mais popular".
  - `TrialBanner.test.tsx`: tons por dias restantes.
  - `SubscriptionManager.test.tsx`: render por status.
- **Playwright E2E** (com env `OTP_TEST_MODE=true` que fixa código `123456`):
  1. LP pública carrega, pricing tem ≥ 1 card.
  2. Signup wizard completo → dashboard + banner trial.
  3. Login existente → dashboard.
  4. Forgot password → reset token mock.
  5. Logado com workspace em `expired` (seed): navegar `/dashboard` → redirect `/assinatura?blocked=1`; navegar `/assinatura` OK.
  6. Assinatura ativa: abrir `/assinatura`, ver card "ativo".
- **Seed de teste**: `infrastructure/seeds/test_paywall.sql` com 2 workspaces (`trial_expirado`, `ativo`).

### 3.7. Deploy

- Aplicar migrations 000038–000042 no stack Portainer (step `db-migrate`).
- Configurar env vars novas em produção ANTES do deploy.
- Smoke test pós-deploy:
  - LP pública carrega 200.
  - `/api/v1/public/plans` retorna 200 com ≥ 1 plano.
  - Signup wizard até step 2 com email descartável (verifica OTP recebido).
  - Login existente.
  - Checkout Stripe test mode.
  - Webhook stripe test (`stripe trigger invoice.paid`).
- Tag git `phase-18-deployed` após smoke prod.

## 4. Plano de dados e state machine (inalterado de v1)

```
trial       → trial_ends_at futuro, acesso total
active      → paga, acesso total
past_due    → pagamento falhou, grace N dias, depois bloqueia
canceled    → cancel_at_period_end, mantém acesso até current_period_end
expired     → trial acabou, past_due grace esgotou OU canceled após period_end
```

## 5. Riscos e mitigações

- **OTP WhatsApp depende de instância conectada** — fallback 503 + mensagem clara; dev loga no console.
- **Múltiplos trials por email/whatsapp** — `UNIQUE` em `users.email` + índice `UNIQUE` em `users.phone_number WHERE NOT NULL` (migration 000040). Abuse avançado (emails descartáveis) fica fora do escopo.
- **Webhook race** — tabela `stripe_events` + processamento idempotente.
- **Backfill `plan_status → subscription_status`** — mapping explícito na migration; free existentes viram `active` grandfathered sem Stripe (feature decision para não quebrar usuários legados — super admin pode reclassificar depois).
- **LP em `/` quebrar bookmark antigo** — usuários logados continuam redirecionados para `/dashboard` (preserva flow).
- **Resend duplicado no Go** — aceita-se a redundância para desacoplar. Documentar em ADR 007.

## 6. Entregáveis

1. Migrations 000038–000042.
2. Services Go (otp, whatsapp_sender, email, subscription).
3. Handlers Go (public_plans, signup, subscription) + middleware `RequireActiveSubscription`.
4. Webhook Stripe PWA expandido + `stripe_events`.
5. Cron `checkTrialExpirations`.
6. Rotas e componentes PWA: LP (10 componentes marketing), SignupWizard, OTPCodeInput, SubscriptionManager, PlanSelector, TrialBanner, PastDueBanner, redesign login/forgot/reset.
7. Layout `(dashboard)` com check server-side paywall.
8. Templates email + seed.
9. Testes Go + Vitest + Playwright (6 novos).
10. Docs: `docs/ops/subscription-state-machine.md`, ADR 007, atualizar `CLAUDE.md` seção status pós-deploy.
11. Tag `phase-18-deployed`.

## 7. Fora do escopo

- Planos anuais com múltiplos tiers de desconto.
- Cupons, affiliate, referral.
- Pix/boleto — só Stripe cartão.
- I18n (só PT-BR).
- A/B testing LP.
- Métricas/analytics de funil (GA/Mixpanel).
