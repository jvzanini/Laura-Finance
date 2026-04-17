# Fase 18 — Plan v1 (implementação granular)

Base: `docs/superpowers/specs/2026-04-17-fase-18-landing-assinatura-otp-v3.md`.

Granularidade alta, cada task auto-contida. Agrupamento por sub-fase. **Ordem de execução respeita dependências** (backend antes de frontend).

---

## Sub-fase 18A — Backend Go + Migrations + Webhook

### 18A.1 — Migrations

- [ ] **T1.** Criar `laura-go/internal/migrations/000038_create_otp_codes.up.sql` e `.down.sql`.
- [ ] **T2.** Criar `000039_create_pending_signups.up.sql` e `.down.sql`.
- [ ] **T3.** Criar `000040_add_subscription_state.up.sql` e `.down.sql` (colunas subscription_status + campos trial/ciclo/cartão + stripe_events + unique phone).
- [ ] **T4.** Criar `000041_seed_billing_otp_templates.up.sql` e `.down.sql` (8 templates).
- [ ] **T5.** Criar `000042_add_yearly_price_to_plans.up.sql` e `.down.sql`.
- [ ] **T6.** Rodar `migrate up` local + validar via `psql` + rodar `migrate down → up` para testar reversibilidade.

### 18A.2 — Env vars + config

- [ ] **T7.** Adicionar `OTP_SECRET`, `TRIAL_DAYS`, `PAST_DUE_GRACE_DAYS`, `WHATSAPP_OTP_INSTANCE_ID`, `STRIPE_BILLING_PORTAL_RETURN_URL` em `laura-go/.env.example` e `laura-pwa/.env.example`.
- [ ] **T8.** Gerar `OTP_SECRET` localmente (`openssl rand -hex 32`) e colocar em `laura-go/.env` e `laura-pwa/.env.local`.
- [ ] **T9.** Adicionar leitura em `laura-go/internal/config/config.go` (ou equivalente) dessas vars.

### 18A.3 — Service `otp`

- [ ] **T10.** Criar `laura-go/internal/services/otp.go` com `GenerateOTP`, `VerifyOTP`, `CanResendOTP`. HMAC-SHA256 helper. Testar deterministically via teste unitário com clock injetável.
- [ ] **T11.** Criar `laura-go/internal/services/otp_test.go` com casos: gen+verify, expired, max_attempts, wrong code, resend rate limit 3/h.

### 18A.4 — Service `whatsapp_sender`

- [ ] **T12.** Criar `laura-go/internal/services/whatsapp_sender.go`: `SendText`, `NormalizeE164` (usar `github.com/nyaruka/phonenumbers` ou similar; default BR). Lookup de instância em `whatsapp_instances WHERE status='connected' ORDER BY last_connected_at DESC LIMIT 1` ou via `WHATSAPP_OTP_INSTANCE_ID`. Integra com `whatsapp.Manager` existente.
- [ ] **T13.** Criar `laura-go/internal/services/whatsapp_sender_test.go`: `DISABLE_WHATSAPP=true`, sem instância, E.164 parser.

### 18A.5 — Service `email` (Go)

- [ ] **T14.** Adicionar `github.com/resend/resend-go/v2` em `go.mod`.
- [ ] **T15.** Criar `laura-go/internal/services/email.go` com client Resend + helpers por tipo. Lookup de templates em `email_templates`.
- [ ] **T16.** Criar `laura-go/internal/services/email_test.go` (template lookup + fallback HTML inline).

### 18A.6 — Service `subscription` (state machine)

- [ ] **T17.** Criar `laura-go/internal/services/subscription.go`: `type SubscriptionState`, `ComputeState(ws, now)`, `IsBlocked`, `DaysRemaining`. Função pura.
- [ ] **T18.** Criar `laura-go/internal/services/subscription_test.go`: 10 cenários de transição/estado.

### 18A.7 — Handler `public_plans`

- [ ] **T19.** Criar `laura-go/internal/handlers/public_plans.go`: `GET /api/v1/public/plans` com filtro de campos seguros + cálculo `is_most_popular`.
- [ ] **T20.** Registrar rota em `laura-go/cmd/server/main.go` (ou onde rotas são definidas) sob `/api/v1/public` SEM `RequireSession`.
- [ ] **T21.** Criar `handlers/public_plans_test.go`: sem auth, shape correto, filtro de campos internos.

### 18A.8 — Handler `signup`

- [ ] **T22.** Criar `laura-go/internal/handlers/signup.go` com os 6 endpoints (`start`, `verify-email`, `verify-whatsapp`, `finalize`, `resend-email`, `resend-whatsapp`).
- [ ] **T23.** Adicionar middleware `fiber/v2/middleware/limiter` por IP 10/min nos endpoints.
- [ ] **T24.** Transação `finalize` reusa helper `SeedDefaultCategories` existente.
- [ ] **T25.** Criar `handlers/signup_test.go`: happy path, duplicate email 409, OTP inválido, pending expirado, rate limit resend.

### 18A.9 — Handler `subscription`

- [ ] **T26.** Criar `laura-go/internal/handlers/subscription.go`: `GET /me/subscription`, `POST /me/subscription/{checkout,portal,cancel,reactivate}`.
- [ ] **T27.** Integrar `github.com/stripe/stripe-go/v82` (adicionar ao `go.mod`). Config `stripe.Key = STRIPE_SECRET_KEY`.
- [ ] **T28.** Criar `handlers/subscription_test.go` com Stripe mock (testmode OK).

### 18A.10 — Paywall middleware

- [ ] **T29.** Estender `laura-go/internal/handlers/middleware.go` com `RequireActiveSubscription`. Chain após `RequireSession`.
- [ ] **T30.** Aplicar middleware nos grupos de rotas feature. Atualizar `cmd/server/main.go`.
- [ ] **T31.** Criar `handlers/paywall_test.go`: 402 bloqueado, 200 ativo, superadmin passa, whitelist.

### 18A.11 — Super admin planos yearly

- [ ] **T32.** Atualizar `laura-go/internal/handlers/admin_config.go` ou `admin_plans.go` para aceitar `price_cents_yearly` e `stripe_price_id_yearly` no `PUT /admin/plans/:slug`.
- [ ] **T33.** Estender `SubscriptionPlanRow` no TypeScript (`laura-pwa/src/lib/types.ts` ou `admin-plans.ts`) com os 2 campos opcionais.

### 18A.12 — Webhook Stripe PWA expandido

- [ ] **T34.** Expandir `laura-pwa/src/app/api/stripe/webhook/route.ts` para tratar os 5 eventos (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`). Idempotência via `stripe_events`.
- [ ] **T35.** Integrar envio de emails (`pagamento_falhou`, `pagamento_retomado`) via `lib/email.ts`.

### 18A.13 — Cron trial

- [ ] **T36.** Integrar `checkTrialExpirations` em `laura-go/internal/services/cron_service.go` (ou arquivo existente de cron). Schedule diário 04:00 UTC.
- [ ] **T37.** Criar `services/cron_trial_test.go` simulando dias e confirmando emails/status.

---

## Sub-fase 18B — Landing Page

### 18B.1 — Root page + metadata

- [ ] **T38.** Alterar `laura-pwa/src/app/page.tsx` para server component que faz `getSession()`: redirect `/dashboard` se logado, senão renderiza `<LandingPage />`.
- [ ] **T39.** Adicionar `metadata` em `laura-pwa/src/app/layout.tsx` (title, description, og, canonical). Ou criar `metadata` no `page.tsx` se couber escopar.

### 18B.2 — Componentes marketing

- [ ] **T40.** Criar `laura-pwa/src/components/marketing/MarketingNavbar.tsx`. Usar skill `ui-ux-pro-max` para garantir estética premium + respeitar design system.
- [ ] **T41.** Criar `marketing/Hero.tsx` com mock chat WhatsApp + orbs animados (Framer Motion restrito).
- [ ] **T42.** Criar `marketing/TrustBar.tsx`.
- [ ] **T43.** Criar `marketing/FeatureGrid.tsx` (6 cards).
- [ ] **T44.** Criar `marketing/HowItWorks.tsx` com conector animado.
- [ ] **T45.** Criar `marketing/PricingCards.tsx` com fetch server-side + fallback estático + client boundary para toggle.
- [ ] **T46.** Criar `marketing/Testimonials.tsx`.
- [ ] **T47.** Criar `marketing/FAQ.tsx` (accordion shadcn).
- [ ] **T48.** Criar `marketing/CTAFinal.tsx`.
- [ ] **T49.** Criar `marketing/MarketingFooter.tsx`.
- [ ] **T50.** Criar `marketing/LandingPage.tsx` que compõe todos.

### 18B.3 — Playwright LP

- [ ] **T51.** Criar `laura-pwa/tests/e2e/lp-public.spec.ts` (LP carrega + pricing ≥ 1).

---

## Sub-fase 18C — Auth redesign + OTP

### 18C.1 — Server actions

- [ ] **T52.** Criar `laura-pwa/src/lib/actions/signup.ts` com as 6 actions.
- [ ] **T53.** Implementar `createSession(userId)` helper se não existir no `lib/session.ts`; reusar HMAC existente.

### 18C.2 — OTPCodeInput

- [ ] **T54.** Criar `laura-pwa/src/components/features/OTPCodeInput.tsx` (6 inputs + auto-avanço + paste + shake animation).
- [ ] **T55.** Criar `OTPCodeInput.test.tsx` (Vitest).

### 18C.3 — SignupWizard

- [ ] **T56.** Criar `laura-pwa/src/components/features/SignupWizard.tsx` (3 passos, react-hook-form + zod, persist sessionStorage).
- [ ] **T57.** Atualizar `laura-pwa/src/app/(auth)/register/page.tsx` para renderizar `<SignupWizard />`.
- [ ] **T58.** Criar `SignupWizard.test.tsx` minimal (render passo 1).

### 18C.4 — Redesign login/forgot/reset

- [ ] **T59.** Redesign `laura-pwa/src/app/(auth)/login/page.tsx` mantendo funcionalidade, novo visual premium. Skill `ui-ux-pro-max`.
- [ ] **T60.** Redesign `(auth)/forgot-password/page.tsx`.
- [ ] **T61.** Redesign `(auth)/reset-password/[token]/page.tsx`.

### 18C.5 — Playwright signup

- [ ] **T62.** Criar `laura-pwa/tests/e2e/signup-wizard.spec.ts` (fluxo completo com `OTP_TEST_MODE=true` fixando 123456).
- [ ] **T63.** Adicionar lógica em `handlers/signup.go` para, se env `OTP_TEST_MODE=true`, bypassa verificação aceitando `123456`. Flag só ativada em dev/CI.

---

## Sub-fase 18D — Assinatura interna + banners + paywall

### 18D.1 — Layout paywall server-side

- [ ] **T64.** Estender `laura-pwa/src/app/(dashboard)/layout.tsx` com fetch `/api/v1/me/subscription`, `SubscriptionProvider` context, redirect para `/assinatura` quando bloqueado (whitelist `/assinatura`, `/settings`).
- [ ] **T65.** Criar `laura-pwa/src/lib/contexts/subscription.tsx` (context + hook `useSubscription`).

### 18D.2 — Página /assinatura

- [ ] **T66.** Criar `laura-pwa/src/app/(dashboard)/assinatura/page.tsx` que renderiza `<SubscriptionManager />`.

### 18D.3 — SubscriptionManager

- [ ] **T67.** Criar `laura-pwa/src/components/features/SubscriptionManager.tsx` (dispatches por state).
- [ ] **T68.** Criar `PlanSelector.tsx`.
- [ ] **T69.** Criar `CancelDialog.tsx`.

### 18D.4 — Banners

- [ ] **T70.** Criar `laura-pwa/src/components/features/TrialBanner.tsx`.
- [ ] **T71.** Criar `laura-pwa/src/components/features/PastDueBanner.tsx`.
- [ ] **T72.** Renderizar banners condicionalmente no layout `(dashboard)/layout.tsx`.

### 18D.5 — Super admin PlansEditor

- [ ] **T73.** Atualizar `laura-pwa/src/components/features/PlansEditor.tsx` (ou equivalente em `(admin)/admin/plans/`) para incluir campos `price_cents_yearly` e `stripe_price_id_yearly`.

### 18D.6 — Playwright paywall

- [ ] **T74.** Criar `laura-pwa/tests/e2e/paywall.spec.ts`. Usar seed `test_paywall.sql`.
- [ ] **T75.** Criar `infrastructure/seeds/test_paywall.sql`.

---

## Sub-fase 18E — Docs + verification + deploy

### 18E.1 — Documentação

- [ ] **T76.** Criar `docs/ops/subscription-state-machine.md` com diagrama + transições.
- [ ] **T77.** Criar `docs/adr/007-billing-resend-stripe-duplicacao.md`.
- [ ] **T78.** Atualizar `CLAUDE.md` status.

### 18E.2 — Verification

- [ ] **T79.** Rodar `go test ./...` e anexar output ao commit final.
- [ ] **T80.** Rodar `pnpm test` (Vitest) e anexar output.
- [ ] **T81.** Rodar `pnpm test:e2e` (Playwright) e anexar output.
- [ ] **T82.** Rodar lint `pnpm lint` + `go vet ./...` + `golangci-lint run`.

### 18E.3 — Commit + deploy

- [ ] **T83.** Commits conventional em PT-BR por área:
  - `feat(db): fase 18 migrations 000038-000042`
  - `feat(go): services otp/whatsapp_sender/email/subscription`
  - `feat(go): handlers public_plans/signup/subscription + paywall`
  - `feat(pwa): landing page imersiva`
  - `feat(pwa): signup wizard multi-step + OTP`
  - `feat(pwa): /assinatura + banners trial + paywall`
  - `feat(stripe): webhook expandido + stripe_events`
  - `docs(fase-18): state machine + ADR 007 + CLAUDE.md`
- [ ] **T84.** Push + monitorar CI até verde.
- [ ] **T85.** Deploy prod via stack Portainer (ou CI auto-deploy quando merged).
- [ ] **T86.** Smoke test prod (LP 200, /api/v1/public/plans, signup até step 2, checkout test).
- [ ] **T87.** Aplicar tag `phase-18-deployed` após smoke.
- [ ] **T88.** Atualizar memory (`session_state_2026-04-17.md`).
