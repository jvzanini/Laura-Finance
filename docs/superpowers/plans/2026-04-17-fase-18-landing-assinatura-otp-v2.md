# Fase 18 — Plan v2

> v2 incorpora review #1 do plan v1. Principais mudanças:
> - **Stripe SDK fica só no PWA** (server actions). Go não ganha stripe-go. Corta T27, simplifica T26/T28.
> - Checkout/portal/cancel/reactivate ficam como server actions PWA em `lib/actions/subscription.ts`.
> - Go mantém apenas `GET /me/subscription` (composição read-only) + paywall middleware.
> - Ajustes de pontos de integração: `main.go` é na raiz `laura-go/main.go`, cron existente usa `robfig/cron/v3` (em `services/cron.go`), integrar lá.
> - Adicionada seção CSS (shake/animações) e A11y helper.
> - Reorganizadas dependências para paralelismo.

Base: `docs/superpowers/specs/2026-04-17-fase-18-landing-assinatura-otp-v3.md`.

---

## Sub-fase 18A — Backend Go + Migrations + Webhook PWA

### 18A.1 — Migrations (blocker)

- **T1.** Criar `laura-go/internal/migrations/000038_create_otp_codes.{up,down}.sql` (schema v3 sec.2.1).
- **T2.** Criar `000039_create_pending_signups.{up,down}.sql`.
- **T3.** Criar `000040_add_subscription_state.{up,down}.sql` (subscription_status + trial/ciclo/cartão + `stripe_events` table + unique phone_number).
- **T4.** Criar `000041_seed_billing_otp_templates.{up,down}.sql` (templates com `{{code}}`, `{{nome}}`, `{{plano}}`, `{{valor}}`, `{{data_limite}}`).
- **T5.** Criar `000042_add_yearly_price_to_plans.{up,down}.sql`.
- **T6.** Rodar `migrate up` local + `migrate down → up` para verificar reversibilidade. Conferir via `psql` que tabelas/colunas estão criadas.

### 18A.2 — Env vars + config

- **T7.** Adicionar `OTP_SECRET`, `TRIAL_DAYS`, `PAST_DUE_GRACE_DAYS`, `WHATSAPP_OTP_INSTANCE_ID`, `STRIPE_BILLING_PORTAL_RETURN_URL`, `OTP_TEST_MODE` em `laura-go/.env.example`, `laura-pwa/.env.example`, `docker-compose.ci.yml` (CI fixa `OTP_TEST_MODE=true`).
- **T8.** Gerar `OTP_SECRET` local (`openssl rand -hex 32`) e inserir em `laura-go/.env` e `laura-pwa/.env.local`.
- **T9.** Adicionar leitura dessas vars em `laura-go/internal/config/config.go` (verificar arquivo existente; se não houver, incluir inline em `main.go`).

### 18A.3 — Services Go (paralelizáveis após migrations)

- **T10.** Criar `laura-go/internal/services/otp.go`: `GenerateOTP`, `VerifyOTP`, `CanResendOTP`. HMAC helper. Honrar `OTP_TEST_MODE=true` → `VerifyOTP` aceita código fixo `123456`.
- **T11.** Criar `otp_test.go`: gen+verify, expired, max_attempts, wrong code, resend rate limit.
- **T12.** Criar `whatsapp_sender.go`: `SendText`, `NormalizeE164`. Lookup instância via env ou DB. Integra com `whatsapp.Manager`. `DISABLE_WHATSAPP=true` → log + nil.
  - Dependência: `go get github.com/nyaruka/phonenumbers` (ou similar stable).
- **T13.** Criar `whatsapp_sender_test.go` (dev-mode, E.164 parse).
- **T14.** Adicionar `github.com/resend/resend-go/v2` em `go.mod`.
- **T15.** Criar `email.go` (Go): `SendOTPEmail`, `SendTrialStartedEmail`, `SendTrialEndingEmail(day)`, `SendPaymentFailedEmail`, `SendCanceledEmail`, `SendPaymentResumedEmail`. Template lookup `email_templates`, fallback inline.
- **T16.** Criar `email_test.go` (template lookup + fallback).
- **T17.** Criar `subscription.go`: `SubscriptionState`, `ComputeState`, `IsBlocked`, `DaysRemaining`.
- **T18.** Criar `subscription_test.go`: 10 cenários.

### 18A.4 — Handlers Go

- **T19.** Criar `handlers/public_plans.go`: `GET /api/v1/public/plans` filtrando campos.
- **T20.** Registrar rota em `laura-go/main.go` sob prefixo `/api/v1/public` sem `RequireSession`.
- **T21.** Criar `public_plans_test.go`.
- **T22.** Criar `handlers/signup.go` com 6 endpoints. Rate limit via `fiber/v2/middleware/limiter` (10/min por IP).
- **T23.** `finalize` usa `SeedDefaultCategories` existente. Confirmar que função é exportável; se não, refatorar.
- **T24.** Criar `signup_test.go`: happy path, duplicate email 409, OTP inválido, pending expirado, rate limit resend.
- **T25.** Criar `handlers/subscription.go` com APENAS `GET /me/subscription` (composição + compute state). Stripe-related actions ficam no PWA.
- **T26.** Criar `subscription_handler_test.go` cobrindo os estados.

### 18A.5 — Paywall middleware

- **T27.** Estender `laura-go/internal/handlers/middleware.go` com `RequireActiveSubscription`. Super admin isento. Retorna 402 JSON.
- **T28.** Aplicar nos grupos feature em `main.go`. NÃO aplicar em `/me*`, `/admin*`, `/public/*`.
- **T29.** Criar `paywall_test.go`.

### 18A.6 — Super admin yearly

- **T30.** Atualizar `handlers/admin_config.go` (ou `admin_plans.go`) para aceitar `price_cents_yearly` e `stripe_price_id_yearly` em `PUT /admin/plans/:slug`.
- **T31.** Atualizar tipos TS em `laura-pwa/src/lib/admin-plans.ts` (ou similar) com os 2 campos opcionais.

### 18A.7 — Webhook Stripe PWA

- **T32.** Expandir `laura-pwa/src/app/api/stripe/webhook/route.ts` para os 5 eventos (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`). Idempotência `stripe_events`.
- **T33.** Integrar emails pós-evento (`pagamento_falhou`, `pagamento_retomado`) via `lib/email.ts`.

### 18A.8 — Cron trial

- **T34.** Adicionar função `StartTrialLifecycleCron` em `laura-go/internal/services/cron.go`: schedule `0 4 * * *` UTC para marcar expired + enviar D-3 / D-1 / trial_expirado + marcar past_due_blocked.
- **T35.** Invocar `StartTrialLifecycleCron` no boot (`main.go`) junto com as outras.
- **T36.** Criar `cron_trial_test.go` simulando clock.

### 18A.9 — Server actions PWA (Stripe interactions)

- **T37.** Criar `laura-pwa/src/lib/actions/subscription.ts`:
  - `subscriptionCheckoutAction({planSlug, cycle})` — cria Stripe session, retorna `{url}`.
  - `subscriptionPortalAction()` — Stripe Billing Portal.
  - `subscriptionCancelAction()` — cancel_at_period_end.
  - `subscriptionReactivateAction()` — reverte.
- **T38.** Criar `laura-pwa/src/lib/actions/subscription.test.ts` com mocks Stripe.

---

## Sub-fase 18B — Landing Page

### 18B.1 — Root page + CSS global

- **T39.** Alterar `laura-pwa/src/app/page.tsx` para server component: `getSession()` → redirect `/dashboard` se logado, senão renderiza `<LandingPage />`.
- **T40.** Atualizar `metadata` em `laura-pwa/src/app/layout.tsx` (title, description, og-image path, canonical). Adicionar `og-image.png` em `public/og/laura-og.png` (placeholder inicial gerado por script SVG→PNG).
- **T41.** Adicionar em `laura-pwa/src/app/globals.css`:
  - Keyframes `@keyframes laura-shake`, `@keyframes laura-orb-float`, `@keyframes laura-chat-bubble`.
  - Utility `.animate-shake`, `.animate-orb-float`.
  - `@media (prefers-reduced-motion: reduce) { .animate-* { animation: none !important } }`.

### 18B.2 — Componentes marketing (paralelizáveis entre si)

Usar skill `ui-ux-pro-max` ANTES de cada componente para garantir estética premium + design system:

- **T42.** `components/marketing/MarketingNavbar.tsx`.
- **T43.** `components/marketing/Hero.tsx` (orbs + mock chat WhatsApp + chips métrica orbitando).
- **T44.** `components/marketing/TrustBar.tsx`.
- **T45.** `components/marketing/FeatureGrid.tsx`.
- **T46.** `components/marketing/HowItWorks.tsx`.
- **T47.** `components/marketing/PricingCards.tsx` (fetch server-side + fallback estático + client toggle).
- **T48.** `components/marketing/Testimonials.tsx`.
- **T49.** `components/marketing/FAQ.tsx`.
- **T50.** `components/marketing/CTAFinal.tsx`.
- **T51.** `components/marketing/MarketingFooter.tsx`.
- **T52.** `components/marketing/LandingPage.tsx` compondo tudo.

### 18B.3 — Playwright LP

- **T53.** `laura-pwa/tests/e2e/lp-public.spec.ts` (LP 200 + pricing ≥ 1 card).

---

## Sub-fase 18C — Auth redesign + OTP

### 18C.1 — Server actions signup

- **T54.** Criar `laura-pwa/src/lib/actions/signup.ts` com 6 actions chamando Go.
- **T55.** Verificar `createSession(userId)` em `lib/session.ts`; se não existir, adicionar helper reusando HMAC atual.

### 18C.2 — OTPCodeInput

- **T56.** `components/features/OTPCodeInput.tsx` (6 inputs, auto-avanço, paste, shake em erro, auto-submit).
- **T57.** `OTPCodeInput.test.tsx` (Vitest).

### 18C.3 — SignupWizard

- **T58.** `components/features/SignupWizard.tsx` (3 passos, `react-hook-form` + `zod`, persist `sessionStorage`, countdown resend 60s). Skill `ui-ux-pro-max`.
- **T59.** Atualizar `laura-pwa/src/app/(auth)/register/page.tsx` para renderizar `<SignupWizard />`.
- **T60.** `SignupWizard.test.tsx` (smoke).

### 18C.4 — Redesign login/forgot/reset

- **T61.** Redesign `(auth)/login/page.tsx` — skill `ui-ux-pro-max`.
- **T62.** Redesign `(auth)/forgot-password/page.tsx`.
- **T63.** Redesign `(auth)/reset-password/[token]/page.tsx`.
- **T64.** Verificar `(auth)/layout.tsx` (se existe) ou criar — background orbs sutis + card centralizado + logo.

### 18C.5 — Playwright signup

- **T65.** `laura-pwa/tests/e2e/signup-wizard.spec.ts` com `OTP_TEST_MODE=true` (fixa `123456`).

---

## Sub-fase 18D — Assinatura interna + banners + paywall

### 18D.1 — Layout paywall server-side

- **T66.** Estender `laura-pwa/src/app/(dashboard)/layout.tsx` com fetch `/api/v1/me/subscription`, `SubscriptionProvider`, redirect paywall (whitelist `/assinatura`, `/settings`). Superadmin sempre passa.
- **T67.** Criar `laura-pwa/src/lib/contexts/subscription.tsx`.

### 18D.2 — Página /assinatura

- **T68.** `src/app/(dashboard)/assinatura/page.tsx` renderiza `<SubscriptionManager />`.

### 18D.3 — SubscriptionManager + PlanSelector + CancelDialog

- **T69.** `components/features/SubscriptionManager.tsx` (dispatches por state). Skill `ui-ux-pro-max`.
- **T70.** `components/features/PlanSelector.tsx` (fetch public plans + CTA selecionar).
- **T71.** `components/features/CancelDialog.tsx`.

### 18D.4 — Banners

- **T72.** `components/features/TrialBanner.tsx` (tons por dias + dismiss diário).
- **T73.** `components/features/PastDueBanner.tsx` (não dismissable).
- **T74.** Renderizar no layout `(dashboard)/layout.tsx` — banners só se status aplicável.

### 18D.5 — Super admin PlansEditor yearly

- **T75.** Atualizar `PlansEditor` (arquivo em `(admin)/admin/plans/`) incluindo os 2 campos opcionais.

### 18D.6 — Playwright paywall

- **T76.** `laura-pwa/tests/e2e/paywall.spec.ts`.
- **T77.** `infrastructure/seeds/test_paywall.sql` (2 workspaces: `expired` e `active`).

---

## Sub-fase 18E — Docs + verification + deploy

### 18E.1 — Documentação

- **T78.** `docs/ops/subscription-state-machine.md`.
- **T79.** `docs/adr/007-billing-resend-stripe-duplicacao.md`.
- **T80.** Atualizar `CLAUDE.md` status + pendências.

### 18E.2 — Verification

- **T81.** `cd laura-go && go test ./...` (anexar output).
- **T82.** `cd laura-pwa && pnpm test` (Vitest).
- **T83.** `cd laura-pwa && pnpm test:e2e` (Playwright).
- **T84.** `cd laura-go && go vet ./... && golangci-lint run`.
- **T85.** `cd laura-pwa && pnpm lint`.

### 18E.3 — Commit + deploy

- **T86.** Commits conventional PT-BR por área (≥ 8 commits separados).
- **T87.** Push + monitorar CI.
- **T88.** Deploy prod (Portainer ou CI auto).
- **T89.** Smoke prod (LP 200, public plans, signup step 2, checkout test).
- **T90.** Tag `phase-18-deployed`.
- **T91.** Memory `session_state_2026-04-17.md` + atualizar MEMORY.md.

---

## Paralelismo estratégico

Após **T6 (migrations)** completo, rodar em 4 paralelas:
- (A) Go services otp+subscription: T10→T11, T17→T18.
- (B) Go services whatsapp+email: T12→T13, T14→T16.
- (C) Root PWA page + CSS + metadata: T39→T41.
- (D) Webhook Stripe PWA: T32→T33.

Após (A)+(B) prontos, rodar em 3 paralelas:
- (E) Handlers Go: T19-T31.
- (F) Componentes marketing: T42-T52 (subagent-driven, um agente por lote de 3-4 componentes).
- (G) OTPCodeInput + SignupWizard: T56-T60.

Depois sequencial: T66 (layout paywall) → T68-T77 (seção /assinatura + banners + testes).
