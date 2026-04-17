# Fase 18 — Plan v3 (final)

> v3 incorpora review #2 do plan v2:
> - Rota interna padronizada como `/subscription` (consistente com `/settings`, `/dashboard`, etc). Textos continuam PT-BR "Assinatura".
> - Adicionado helper `applyVars` no email.go do Go (Resend SDK não substitui templates).
> - Adicionado proxy header no rate limiter Fiber (Traefik em prod).
> - Detalhado fluxo `stripe_customer_id` reuso no webhook.
> - Adicionado user fixture no seed de paywall (email/senha conhecidos).
> - Cada bloco grande ganhou "critério de feito".

Base: `docs/superpowers/specs/2026-04-17-fase-18-landing-assinatura-otp-v3.md`.

---

## Pré-requisitos

- Branch: trabalhar direto em `master` (projeto segue trunk-based).
- Working tree limpo.
- Postgres local up com migrations `000001–000037` aplicadas.
- `lefthook install` executado.
- Env vars criadas (T8).

## Paralelismo estratégico

Depois de **T6** (migrations aplicadas):

- Bloco A (Go services independentes): T10→T18 podem rodar em 4 subagents paralelos (otp / whatsapp / email / subscription).
- Bloco B (PWA root): T39→T41.
- Bloco C (Webhook Stripe): T32→T33.

Depois de A+B+C prontos:
- Bloco D (Handlers Go): T19–T31.
- Bloco E (Marketing components): T42–T52 em subagents por lote.
- Bloco F (Auth redesign): T54–T65.

Depois: bloco G (paywall + /subscription): T66–T77 sequencial pois depende dos handlers.

Por fim: bloco H (docs + verification + deploy): T78–T91.

---

## Sub-fase 18A — Backend Go + Migrations + Webhook PWA

### 18A.1 — Migrations

- **T1.** `laura-go/internal/migrations/000038_create_otp_codes.up.sql` + `.down.sql`.
- **T2.** `000039_create_pending_signups.up.sql` + `.down.sql` (inclui `desired_plan_slug`).
- **T3.** `000040_add_subscription_state.up.sql` + `.down.sql` (colunas + `stripe_events` + `UNIQUE users.phone_number WHERE NOT NULL` + backfill).
- **T4.** `000041_seed_billing_otp_templates.up.sql` + `.down.sql` — 8 templates (`codigo_verificacao_email`, `trial_iniciado`, `trial_terminando_d3`, `trial_terminando_d1`, `trial_expirado`, `pagamento_falhou`, `pagamento_retomado`, `assinatura_cancelada`). Cada um com `subject` e `html_body` contendo vars `{{code}}`, `{{nome}}`, `{{plano}}`, `{{valor}}`, `{{data_limite}}`, `{{app_url}}`.
- **T5.** `000042_add_yearly_price_to_plans.{up,down}.sql` (2 colunas nullable).
- **T6.** Rodar `migrate up` local + `down → up` para verificar reversibilidade. `psql -c "\d otp_codes" "\d pending_signups" "\d workspaces" "\d stripe_events" "\d subscription_plans" "\d email_templates"` conferir schema.

**Critério de feito:** script `docker-compose up -d` do dev sobe sem erro + `psql` mostra as 8 tabelas/colunas novas.

### 18A.2 — Env vars + config

- **T7.** Adicionar em `laura-go/.env.example`, `laura-pwa/.env.example`, `docker-compose.ci.yml` (CI fixa `OTP_TEST_MODE=true`):
  - `OTP_SECRET`
  - `TRIAL_DAYS=7`
  - `PAST_DUE_GRACE_DAYS=3`
  - `WHATSAPP_OTP_INSTANCE_ID` (vazio)
  - `STRIPE_BILLING_PORTAL_RETURN_URL`
  - `OTP_TEST_MODE=false`
- **T8.** `openssl rand -hex 32` → preencher `OTP_SECRET` em `laura-go/.env` e `laura-pwa/.env.local`.
- **T9.** Ler vars no `laura-go/main.go` (ou arquivo de config existente) com fallback `slog.Warn` se `OTP_SECRET` vazio e não estiver em test mode.

**Critério de feito:** `laura-go` compila e levanta sem erro com vars preenchidas.

### 18A.3 — Services Go (paralelo após T6)

**Bloco A1 — OTP:**
- **T10.** `laura-go/internal/services/otp.go`:
  - Função `hmacCode(secret, code string) string` → hex(HMAC-SHA256).
  - `GenerateOTP(ctx, targetType, targetValue, purpose, contextID)`:
    - Se `OTP_TEST_MODE=true`, retorna `123456` sem persistir.
    - Senão, gera 6 dígitos via `crypto/rand`, persiste hash + expiry 10min + max_attempts 5.
  - `VerifyOTP(ctx, targetType, targetValue, purpose, code)`:
    - Se `OTP_TEST_MODE=true` E `code=="123456"`, retorna contextID do pending active (lookup por target).
    - Senão, lookup row ativa, incrementa attempts; se hash bate, marca `used_at`.
    - Erros tipados.
  - `CanResendOTP` — contagem `SELECT count(*) FROM otp_codes WHERE target_type=$1 AND target_value=$2 AND purpose=$3 AND created_at > now() - interval '1 hour'`.
- **T11.** `otp_test.go`.

**Bloco A2 — WhatsApp sender:**
- **T12.** `services/whatsapp_sender.go` com `SendText` e `NormalizeE164`. Dep `github.com/nyaruka/phonenumbers`.
- **T13.** `whatsapp_sender_test.go`.

**Bloco A3 — Email Go:**
- **T14.** `go get github.com/resend/resend-go/v2`.
- **T15.** `services/email.go`:
  - `applyVars(template, vars map[string]string) string` (replace `{{k}}` → v).
  - `getTemplate(ctx, type) (subject, html, error)` — query `email_templates WHERE type=$1 AND active=true`.
  - `sendTemplated(ctx, to, type, vars)`.
  - Wrappers: `SendOTPEmail(ctx, email, nome, code)`, `SendTrialStartedEmail(ctx, email, nome, plano)`, `SendTrialEndingEmail(ctx, email, nome, dias)`, `SendPaymentFailedEmail`, `SendCanceledEmail`, `SendPaymentResumedEmail`.
- **T16.** `email_test.go`.

**Bloco A4 — Subscription state:**
- **T17.** `services/subscription.go`: `SubscriptionState`, `ComputeState`, `IsBlocked`, `DaysRemaining`. Função pura, sem IO.
- **T18.** `subscription_test.go` 10+ cenários.

**Critério de feito:** `go test ./internal/services/... -run TestOTP|TestWhatsapp|TestEmail|TestSubscription` passa.

### 18A.4 — Handlers Go

- **T19.** `handlers/public_plans.go` — `GET /api/v1/public/plans` (sem auth). `ORDER BY sort_order ASC`. Calcula `is_most_popular` (maior price_cents ativo).
- **T20.** Registrar rota em `laura-go/main.go` em grupo `/api/v1/public` SEM `RequireSession`.
- **T21.** `public_plans_test.go`: sem auth, shape, campos filtrados.
- **T22.** `handlers/signup.go` com 6 endpoints (spec v3 sec.2.1). Rate limit por IP 10/min via `limiter.New(limiter.Config{Max: 10, Expiration: 1*time.Minute, KeyGenerator: func(c) string { return c.IP() }})`. Fiber com `ProxyHeader: "X-Forwarded-For"` (já configurado no app).
- **T23.** Garantir que `SeedDefaultCategories(ctx, tx, workspaceID)` é exportado (ou exportar) e chamado em `finalize`.
- **T24.** `signup_test.go`.
- **T25.** `handlers/subscription.go`: apenas `GET /me/subscription`. Compõe `SubscriptionState` + dados do plano (JOIN `subscription_plans`) + card info. Retorna JSON.
- **T26.** `subscription_handler_test.go`.

**Critério de feito:** `go test ./internal/handlers/...` passa.

### 18A.5 — Paywall middleware

- **T27.** `handlers/middleware.go` ganha `RequireActiveSubscription`. Chain após `RequireSession`. Super admin passa. Responde 402 JSON `{error:"subscription_blocked", redirect:"/subscription"}`.
- **T28.** Aplicar nos grupos de rotas feature em `main.go`. Whitelist automático: `/api/v1/me*`, `/api/v1/admin*`, `/api/v1/public*`.
- **T29.** `paywall_test.go`.

### 18A.6 — Super admin yearly

- **T30.** Atualizar `handlers/admin_config.go` (ou `admin_plans.go`) `PUT /admin/plans/:slug` para aceitar os 2 campos novos + retornar eles no GET.
- **T31.** Atualizar tipos TS em `laura-pwa/src/lib/admin-plans.ts` (ou similar) com os 2 campos opcionais.

### 18A.7 — Webhook Stripe PWA

- **T32.** Expandir `laura-pwa/src/app/api/stripe/webhook/route.ts`:
  - Idempotência: `INSERT INTO stripe_events(id, type, payload) ON CONFLICT (id) DO NOTHING RETURNING id`; se zero linhas, retorna 200 cedo.
  - `checkout.session.completed`: workspace `subscription_status='active'`, grava `stripe_subscription_id`, `stripe_customer_id` (se null), `current_plan_slug` (metadata), `current_period_end`, card info via `stripe.paymentMethods.retrieve`. Mantém envio de receipt atual.
  - `invoice.paid`: `status='active'`, atualiza `current_period_end`. Se status anterior era `past_due`, enviar `pagamento_retomado`.
  - `invoice.payment_failed`: `status='past_due'`, `past_due_grace_until=now()+PAST_DUE_GRACE_DAYS*24h`. Enviar `pagamento_falhou`.
  - `customer.subscription.updated`: atualiza `current_plan_slug` (lookup price→plan), `current_period_end`, `cancel_at_period_end` (true → status `canceled`).
  - `customer.subscription.deleted`: status `expired`.
  - `UPDATE stripe_events SET processed_at=now() WHERE id=$1`.
- **T33.** Adicionar wrappers `sendPaymentFailedEmail` e `sendPaymentResumedEmail` em `laura-pwa/src/lib/email.ts`.

**Critério de feito:** `stripe trigger invoice.payment_failed` + `stripe trigger invoice.paid` atualizam DB corretamente (teste local com stripe CLI).

### 18A.8 — Cron trial

- **T34.** Em `laura-go/internal/services/cron.go`, adicionar `StartTrialLifecycleCron(logger)` que agenda `0 4 * * *` UTC:
  1. `UPDATE workspaces SET subscription_status='expired' WHERE subscription_status='trial' AND trial_ends_at < now() RETURNING id, email` → enviar `trial_expirado` email.
  2. `SELECT ... WHERE subscription_status='trial' AND trial_ends_at BETWEEN now()+INTERVAL '2 days 22 hours' AND now()+INTERVAL '3 days 2 hours'` → `trial_terminando_d3`.
  3. Idem para D1.
  4. `UPDATE workspaces SET subscription_status='expired' WHERE subscription_status='past_due' AND past_due_grace_until < now()`.
- **T35.** Invocar `StartTrialLifecycleCron` no boot do `main.go` junto com `StartBudgetAlertCron` etc.
- **T36.** `cron_trial_test.go` com clock mock.

### 18A.9 — Server actions PWA (Stripe)

- **T37.** `laura-pwa/src/lib/actions/subscription.ts` com 4 actions:
  - `subscriptionCheckoutAction({planSlug, cycle})` — lookup plano no DB, resolve `stripe_price_id[_yearly]`, cria `stripe.checkout.sessions.create`. Metadata `{workspace_id, plan_slug, cycle}`. `subscription_data.trial_end = Math.floor(trial_ends_at/1000)` se ainda em trial.
  - `subscriptionPortalAction()` — `stripe.billingportal.sessions.create({customer, return_url})`. 409 se `stripe_customer_id` null.
  - `subscriptionCancelAction()` — `stripe.subscriptions.update(id, {cancel_at_period_end: true})`. Atualiza DB.
  - `subscriptionReactivateAction()` — inverso.
- **T38.** `subscription.actions.test.ts` com mocks.

---

## Sub-fase 18B — Landing Page

### 18B.1 — Root page + CSS

- **T39.** `laura-pwa/src/app/page.tsx` → server component, `getSession()`: session → redirect `/dashboard`; sem session → `<LandingPage />`.
- **T40.** `laura-pwa/src/app/layout.tsx`: estender `metadata` com title/description/og/canonical. Adicionar placeholder `public/og/laura-og.svg` (ou png export).
- **T41.** `laura-pwa/src/app/globals.css` (ou novo `animations.css` importado no layout): adicionar keyframes `shake`, `orb-float`, `chat-bubble`; utilities `.animate-shake`, `.animate-orb-float`; respeitar `@media (prefers-reduced-motion)`.

### 18B.2 — Componentes marketing

Skill `ui-ux-pro-max` ANTES de cada (1 invocação por bloco de 2-3 componentes para economia):

- **T42.** `components/marketing/MarketingNavbar.tsx`.
- **T43.** `components/marketing/Hero.tsx` (orbs + mock chat + chips métrica orbitando com Framer Motion).
- **T44.** `components/marketing/TrustBar.tsx`.
- **T45.** `components/marketing/FeatureGrid.tsx`.
- **T46.** `components/marketing/HowItWorks.tsx`.
- **T47.** `components/marketing/PricingCards.tsx` (server + client toggle).
- **T48.** `components/marketing/Testimonials.tsx`.
- **T49.** `components/marketing/FAQ.tsx`.
- **T50.** `components/marketing/CTAFinal.tsx`.
- **T51.** `components/marketing/MarketingFooter.tsx`.
- **T52.** `components/marketing/LandingPage.tsx`.

### 18B.3 — Playwright LP

- **T53.** `laura-pwa/tests/e2e/lp-public.spec.ts` (visit `/`, expect hero headline + pricing ≥ 1).

---

## Sub-fase 18C — Auth redesign + OTP

### 18C.1 — Server actions signup

- **T54.** `laura-pwa/src/lib/actions/signup.ts` com 6 actions.
- **T55.** Garantir `createSession(userId)` em `lib/session.ts` (já existe em v17B; checar). Adicionar helper se necessário.

### 18C.2 — OTPCodeInput

- **T56.** `components/features/OTPCodeInput.tsx`.
- **T57.** `OTPCodeInput.test.tsx`.

### 18C.3 — SignupWizard

- **T58.** `components/features/SignupWizard.tsx` (3 passos, react-hook-form + zod, persist sessionStorage, countdown resend 60s). Skill `ui-ux-pro-max`.
- **T59.** `(auth)/register/page.tsx` renderiza `<SignupWizard />`.
- **T60.** `SignupWizard.test.tsx` (smoke, render step 1).

### 18C.4 — Redesign login/forgot/reset

- **T61.** Redesign `(auth)/login/page.tsx`. Skill `ui-ux-pro-max`.
- **T62.** Redesign `(auth)/forgot-password/page.tsx`.
- **T63.** Redesign `(auth)/reset-password/[token]/page.tsx`.
- **T64.** Criar ou atualizar `(auth)/layout.tsx` com background orbs + card centralizado + logo.

### 18C.5 — Playwright signup

- **T65.** `laura-pwa/tests/e2e/signup-wizard.spec.ts` com `OTP_TEST_MODE=true`.

---

## Sub-fase 18D — Seção interna /subscription + banners + paywall

### 18D.1 — Layout paywall server-side

- **T66.** Estender `laura-pwa/src/app/(dashboard)/layout.tsx`: `fetch('/api/v1/me/subscription')` via helper `callLauraGo`, `SubscriptionProvider`, redirect `/subscription?blocked=1` se bloqueado E path ∉ whitelist (`/subscription`, `/settings`). Superadmin passa.
- **T67.** `laura-pwa/src/lib/contexts/subscription.tsx` (createContext + hook + Provider).

### 18D.2 — Página /subscription

- **T68.** `src/app/(dashboard)/subscription/page.tsx` renderiza `<SubscriptionManager />`.

### 18D.3 — Componentes assinatura

- **T69.** `components/features/SubscriptionManager.tsx`. Skill `ui-ux-pro-max`.
- **T70.** `components/features/PlanSelector.tsx`.
- **T71.** `components/features/CancelDialog.tsx`.

### 18D.4 — Banners

- **T72.** `components/features/TrialBanner.tsx`.
- **T73.** `components/features/PastDueBanner.tsx`.
- **T74.** Renderizar banners no layout `(dashboard)/layout.tsx`.

### 18D.5 — Super admin yearly UI

- **T75.** Atualizar `(admin)/admin/plans/page.tsx` + `PlansEditor` com campos `price_cents_yearly` e `stripe_price_id_yearly`.

### 18D.6 — Playwright paywall

- **T76.** `infrastructure/seeds/test_paywall.sql` — cria 2 workspaces (expired e active) + 2 users (`paywall-expired@laura.test`, `paywall-active@laura.test`, senha `PaywallTest123!`).
- **T77.** `laura-pwa/tests/e2e/paywall.spec.ts` — login cada user + verifica comportamento.

---

## Sub-fase 18E — Docs + verification + deploy

### 18E.1 — Documentação

- **T78.** `docs/ops/subscription-state-machine.md` com diagrama ASCII + transições + comportamento do paywall + cron cadence.
- **T79.** `docs/adr/007-billing-resend-stripe-duplicacao.md` — decisão arquitetural.
- **T80.** Atualizar `CLAUDE.md` seção "Status atual" (moved done + novas pendências) e seção "próxima fase".

### 18E.2 — Verification

- **T81.** `cd laura-go && go test ./... 2>&1 | tee /tmp/fase18-gotest.log` — anexar.
- **T82.** `cd laura-pwa && pnpm test 2>&1 | tee /tmp/fase18-vitest.log`.
- **T83.** `cd laura-pwa && pnpm test:e2e 2>&1 | tee /tmp/fase18-playwright.log`.
- **T84.** `cd laura-go && go vet ./... && golangci-lint run ./...`.
- **T85.** `cd laura-pwa && pnpm lint`.

### 18E.3 — Commit + deploy

- **T86.** Commits conventional PT-BR por área (8+ commits):
  1. `feat(db): fase 18 migrations 000038-000042 otp+pending+subscription+yearly`
  2. `feat(go): services otp/whatsapp-sender/email/subscription + cron trial`
  3. `feat(go): handlers public-plans/signup/subscription + middleware paywall`
  4. `feat(pwa): server actions subscription (stripe checkout/portal/cancel/reactivate)`
  5. `feat(stripe): webhook expandido + idempotencia stripe_events`
  6. `feat(pwa): landing page imersiva (marketing components + root page)`
  7. `feat(pwa): signup wizard multi-step com OTP email+whatsapp + OTPCodeInput`
  8. `feat(pwa): redesign login/forgot/reset com identidade premium`
  9. `feat(pwa): /subscription + TrialBanner + PastDueBanner + paywall layout`
  10. `feat(admin): plans editor com campos yearly`
  11. `docs(fase-18): state machine + ADR 007 + CLAUDE.md`
  12. `test(fase-18): playwright lp/signup/paywall + vitest novos + go tests`
- **T87.** Push + monitorar CI até verde.
- **T88.** Deploy prod via stack Portainer. Env vars novas configuradas ANTES.
- **T89.** Smoke prod: LP 200, `/api/v1/public/plans`, signup até step 2, checkout Stripe test mode.
- **T90.** Tag `phase-18-deployed`.
- **T91.** Memory: criar `session_state_2026-04-17.md` + `phase_18_deployed.md` + atualizar `MEMORY.md`.

**Critério de feito geral:** todos os testes passam em CI, deploy verde, tag aplicada, smoke OK.
