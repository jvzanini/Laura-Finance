# Fase 18 — Landing Page + Assinatura + Auth Redesign + OTP (Spec v1)

## 1. Objetivo

Entregar, em uma única fase, a evolução comercial do Laura Finance:

1. **Landing page pública** (`/`) imersiva, premium e sincronizada com o super admin para apresentar a proposta de valor e converter leads.
2. **Trial de 7 dias sem cartão de crédito**, ativado no signup.
3. **Redesign completo do fluxo de autenticação** (login, signup multi-step, forgot/reset password) coletando nome, email e WhatsApp com verificação OTP em ambos canais.
4. **Seção interna de assinatura** (`/assinatura`) para assinar após trial, atualizar cartão, trocar de plano e cancelar.
5. **Paywall pós-trial** que mantém o usuário logado mas limita a navegação à tela de assinatura até a regularização.

A identidade visual atual (dark mode `#0A0A0F`, primária `#7C3AED`, secundária `#10B981`, Tailwind v4, shadcn/ui, Framer Motion restrito, lucide-react, PT-BR) é **lei inegociável** — tudo novo segue o sistema existente.

## 2. Contexto recebido do projeto

- Auth atual: server actions Next.js (`laura-pwa/src/lib/actions/auth.ts`, `passwordReset.ts`) + middleware Go (`laura-go/internal/handlers/session.go`). Signup atual coleta apenas nome/email/senha.
- Planos já modelados em `subscription_plans` (migration 000026) e editáveis pelo super admin (`/admin/plans`) via endpoints `/api/v1/admin/plans*`.
- Stripe parcial: `POST /api/stripe/checkout` + webhook `checkout.session.completed` em `laura-pwa/src/app/api/stripe/webhook/route.ts`. Faltam os eventos de ciclo (invoice.paid, invoice.payment_failed, customer.subscription.deleted/updated).
- Workspaces têm `stripe_customer_id`, `stripe_subscription_id`, `plan_status` (free/active/trial/canceled) — mas não há `trial_ends_at`, `current_period_end`, `past_due_grace_until`, nem máquina de estado estrita.
- WhatsApp via whatsmeow (`laura-go/internal/whatsapp/`) com instâncias multi-cliente (migration 000030). Não há helper atual para enviar texto a número arbitrário no escopo OTP.
- Email via Resend + templates configuráveis (`laura-pwa/src/lib/email.ts`, `email_templates` table). Templates atuais: `verificacao_email`, `reset_senha`, `comprovante_pagamento`, `convite_membro`.
- Middleware PWA atual (`middleware.ts`) só redireciona não logado → `/login`. Não entende status de assinatura.
- `/` atual redireciona para `/dashboard` ou `/register` — precisa virar LP pública.
- Última migration é `000037_bank_webhook_events`. Próximos slots: 000038+.

## 3. Escopo da fase

### 3.1. Sub-fase 18A — Backend Go + Migrations

**Migrations novas:**

- `000038_create_otp_codes.{up,down}.sql` — tabela de códigos OTP (hash sha256, target_type `email`/`whatsapp`, purpose, expires_at, attempts/max_attempts, context_id).
- `000039_create_pending_signups.{up,down}.sql` — buffer do signup multi-step (nome/email/whatsapp/password_hash + flags email_verified_at/whatsapp_verified_at + expires_at 1h).
- `000040_add_subscription_state_to_workspaces.{up,down}.sql` — colunas `subscription_status` (trial/active/past_due/canceled/expired), `current_plan_slug`, `trial_ends_at`, `current_period_end`, `past_due_grace_until`, `canceled_at`. Backfill a partir de `plan_status`.
- `000041_seed_otp_and_billing_email_templates.{up,down}.sql` — templates `codigo_verificacao_email`, `trial_iniciado`, `trial_terminando`, `pagamento_falhou`, `assinatura_cancelada`.
- Opcional (stretch): `000042_add_yearly_price_to_plans.{up,down}.sql` — `price_cents_yearly`, `stripe_price_id_yearly` para toggle mensal/anual. **Decisão:** implementar, LP mostra toggle apenas se qualquer plano tiver yearly preenchido.

**Services Go novos:**

- `internal/services/otp.go` — `GenerateOTP(ctx, target, purpose, contextID)`, `VerifyOTP(ctx, target, purpose, code)`, `ConsumeOTP(ctx, id)`. Códigos 6 dígitos numéricos, armazenados como `sha256(code)`. Rate limit: ≤ 3 envios por target por hora (consultar por `target_value + purpose + created_at > now() - 1h`). Expiração 10 min, 5 tentativas por código.
- `internal/services/whatsapp_sender.go` — `SendOTP(ctx, phone, code)`. Usa `whatsapp.Manager` + instância escolhida por `WHATSAPP_OTP_INSTANCE_ID` (env var) ou primeira com `status=connected`. Se `DISABLE_WHATSAPP=true`, faz `log.Printf("[dev] whatsapp OTP to %s: %s", phone, code)` e retorna nil.
- `internal/services/subscription.go` — state machine pura + helpers `ComputeState(ws Workspace) SubscriptionState`. Estados: `trial_active`, `trial_ended` (`trial_ends_at < now()` e status ainda `trial`), `active`, `past_due_grace` (past_due + grace vigente), `past_due_blocked`, `canceled_grace` (canceled + period_end futuro), `expired`. `IsBlocked(state)` → true para `trial_ended`, `past_due_blocked`, `expired`.

**Handlers Go novos:**

- `handlers/public_plans.go` — `GET /api/v1/public/plans` (sem auth): retorna planos `active=true` ordenados por `sort_order` expondo apenas `{slug, name, price_cents, price_cents_yearly?, features_description, limits_display}` (filtra `ai_model_config`, `stripe_price_id*`, `capabilities` internas).
- `handlers/signup.go` — 4 endpoints públicos:
  - `POST /api/v1/public/signup/start` — body `{name, email, whatsapp, password}`. Valida (email único em `users` e `pending_signups` ativo, whatsapp E.164, senha ≥ 8). Cria row em `pending_signups`, gera 2 OTPs, envia email + whatsapp, retorna `{pending_id}`.
  - `POST /api/v1/public/signup/verify-email` — `{pending_id, code}`. Valida OTP, marca `email_verified_at`.
  - `POST /api/v1/public/signup/verify-whatsapp` — `{pending_id, code}`. Valida OTP, marca `whatsapp_verified_at`.
  - `POST /api/v1/public/signup/finalize` — `{pending_id}`. Só se ambos verified. Transação: INSERT workspace (trial_ends_at = now() + 7 days, subscription_status='trial', current_plan_slug='vip'), INSERT user (email_verified=TRUE, phone_number=whatsapp), seed categories, marca pending consumed. Retorna cookie de sessão. Envia email `trial_iniciado`.
  - `POST /api/v1/public/signup/resend-email` e `/resend-whatsapp` — rate-limited regen OTP.
- `handlers/subscription.go` — protegido por `RequireSession`:
  - `GET /api/v1/me/subscription` → `{status, plan, trial_ends_at, current_period_end, past_due_grace_until, canceled_at, card_last4, card_brand}`.
  - `POST /api/v1/me/subscription/checkout` → `{plan_slug, billing_cycle: 'monthly'|'yearly'}` → cria Stripe Checkout (mode=subscription, client_reference_id=userID, metadata workspace/plan), retorna `{url}`.
  - `POST /api/v1/me/subscription/portal` → Stripe Billing Portal session, retorna `{url}`.
  - `POST /api/v1/me/subscription/cancel` → `stripe.subscriptions.update(..., {cancel_at_period_end: true})`, status passa a `canceled`, mantém acesso até period_end.
  - `POST /api/v1/me/subscription/reactivate` → reverte cancel_at_period_end.
- Webhook Stripe **movido para o PWA existente** (`laura-pwa/src/app/api/stripe/webhook/route.ts`) e expandido para: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Cada evento atualiza `subscription_status`, `current_plan_slug`, `current_period_end`, `past_due_grace_until` (now + 3 dias), `canceled_at`, `card_last4/brand`. Idempotência via `stripe_event_id` armazenado em `stripe_events` (tabela nova dentro da migration 000040).

**Paywall (Go):** handler novo `RequireActiveSubscription` (chain após `RequireSession`). Lê workspace, calcula `ComputeState`. Se bloqueado, retorna 402 com `{blocked: true, redirect: '/assinatura'}`. Aplicado em `/api/v1/transactions*`, `/api/v1/cards*`, `/api/v1/categories*`, `/api/v1/reports*`, `/api/v1/llm*` (todas as features que não sejam `/me`, `/me/subscription*`, `/public/*`, `/admin/*`).

### 3.2. Sub-fase 18B — Landing Page pública

**Rota:** `/` vira LP. Logado: navbar mostra "Acessar dashboard"; não logado: "Entrar" + "Começar grátis".

**Componentes (todos em `laura-pwa/src/components/marketing/`):**

- `MarketingNavbar.tsx` — sticky, blur backdrop, transparente no topo e sólido após scroll. Logo Laura + links seções (âncoras) + CTAs.
- `Hero.tsx` — headline "Sua família no controle das finanças, sem planilhas.", subcopy 1 linha, 2 CTAs ("Começar 7 dias grátis" / "Já tenho conta"), mockup central (card animado simulando conversa WhatsApp com Laura + chips de métricas orbitando). Orbs gradient violet/emerald em blur-3xl como fundo, 2 camadas com `motion` scale/opacity loop suave (12s+), respeitando `prefers-reduced-motion`.
- `TrustBar.tsx` — 4 chips "Sem cartão", "Cancele quando quiser", "LGPD", "Dados criptografados".
- `FeatureGrid.tsx` — grid 3x2 com cards `features` (ícone lucide + título + texto curto): WhatsApp NLP, Score familiar, Categorias inteligentes, Metas compartilhadas, Open Finance, Relatórios IA.
- `HowItWorks.tsx` — 3 passos horizontais com conector animado: "Assine", "Converse no WhatsApp", "Veja tudo organizado". Mock animado de mensagens trocando.
- `PricingCards.tsx` — fetch `/api/v1/public/plans`, renderiza 1 card por plano ordenado. Toggle mensal/anual (só aparece se algum plano tem yearly). Badge "Mais popular" no maior `sort_order`. CTA "Começar 7 dias grátis" em cada card.
- `Testimonials.tsx` — 3 depoimentos estáticos (texto + nome + cargo) em cards, carrossel horizontal auto-scroll.
- `FAQ.tsx` — accordion shadcn, 8 perguntas (trial, cartão, cancelamento, privacidade, multi-família, Open Finance, suporte, segurança).
- `CTAFinal.tsx` — full-bleed, background gradient, botão grande "Começar agora".
- `MarketingFooter.tsx` — logo + links legais + contato + redes.

**Assets/direcionamento visual:** glassmorphism moderado (cards com `backdrop-blur-sm bg-white/5 border-white/10`), gradientes restritos a orbs de fundo e divisores, shadow-2xl em cards premium. Ícones sempre lucide. Sem emoji decorativo (mantém A11y LEI #3).

**Animações:** Framer Motion apenas em Hero (orbs + mock conversa), HowItWorks (mensagens), PricingCards (hover lift + glow no card popular). Demais = transições CSS (`transition-colors`, `transition-transform`). `prefers-reduced-motion` respeitado.

**Internacionalização:** PT-BR com acentos. `html lang="pt-BR"` (já existe).

**SEO:** `metadata` no layout da LP com title, description, OG image, canonical.

### 3.3. Sub-fase 18C — Auth redesign + OTP

**Rotas:** `/login`, `/register` (wizard), `/forgot-password`, `/reset-password/[token]`. Server actions atuais permanecem mas apontam para novos handlers; `register` substitui por call aos endpoints `/api/v1/public/signup/*`.

**Componentes novos:**

- `features/SignupWizard.tsx` — 3 passos:
  1. Dados pessoais (`nome`, `email`, `whatsapp` com mask BR `+55 (XX) XXXXX-XXXX`, `senha`, `confirmarSenha`). Submit → `POST /public/signup/start` → guarda `pendingId` em state → avança.
  2. Verificar email: mostra email mascarado, `OTPCodeInput` (6 dígitos), timer countdown 60s, "Reenviar código", "Trocar email" (volta passo 1). Submit → `POST /public/signup/verify-email`.
  3. Verificar WhatsApp: igual, mas whatsapp mascarado. Submit → `POST /public/signup/verify-whatsapp` e, sucesso, chama `finalize` imediatamente → redirect `/dashboard`.
- `features/OTPCodeInput.tsx` — 6 inputs autoavanço, paste support, shake em erro, auto-submit ao preencher.
- Redesign `login` — mantém funcionalidade (email + senha) mas aplica novo visual premium: card central com glow, input shadcn com border `violet-500/40` em focus, links "Esqueci minha senha" e "Criar conta". Mantém banner dev-login existente.
- Redesign `forgot-password` e `reset-password` — mesmo padrão visual.

**UX:**

- Wizard mantém estado local (client component) com `pendingId` + passo atual. `prompt` sempre retornável. Tempo total ≤ 90s.
- Mensagens de erro em pt-BR, não vazar detalhes internos.
- A11y: tap targets 44×44, foco teclado, `aria-live` em erros.

### 3.4. Sub-fase 18D — Seção interna /assinatura + banners + paywall

**Rota nova:** `laura-pwa/src/app/(dashboard)/assinatura/page.tsx` — dentro do route group dashboard porque requer login, MAS o layout precisa pular o middleware de paywall (ver abaixo).

**Componentes novos:**

- `features/SubscriptionManager.tsx` — fetch `GET /api/v1/me/subscription`. Renderiza:
  - Card "Seu plano" com status (chip colorido) + plano atual + próximo ciclo + cartão mascarado.
  - Se `status=trial`: countdown "faltam X dias para fim do trial" + CTA "Assinar agora" (abre `PlanSelector`).
  - Se `status=active`: botões "Mudar de plano", "Atualizar cartão" (→ Stripe portal), "Cancelar assinatura" (dialog confirm).
  - Se `status=past_due`: card vermelho "Pagamento em atraso" + botão "Atualizar forma de pagamento".
  - Se `status=canceled` e ainda em período: info "Acesso até DD/MM/YYYY" + botão "Reativar".
  - Se `status=expired`/`past_due_blocked`: mesmo card de seleção de plano + CTA único "Reativar agora".
- `features/PlanSelector.tsx` — grid de planos (mesmo componente pricing, mas com estado "seu plano atual" e CTA "Selecionar"). Ao selecionar, chama `POST /me/subscription/checkout` → redirect Stripe.
- `features/TrialBanner.tsx` — renderizado no `(dashboard)/layout.tsx` se `status=trial`. "Você tem X dias restantes do trial." + link "Assinar". Dismissable (localStorage flag por dia).
- `features/PastDueBanner.tsx` — se `status=past_due`: "Seu pagamento falhou. Atualize sua forma de pagamento antes de DD/MM/YYYY." Não dismissable.
- `features/PaywallGate.tsx` — HOC/componente que wrappa o layout `(dashboard)`. Se `IsBlocked(state)`:
  - Permite: `/assinatura`, `/logout`, `/configuracoes/perfil`, `/api/*`.
  - Para o resto: redirect server-side (RSC) para `/assinatura?blocked=1`.

**Middleware PWA (`middleware.ts`):**

- Adicionar checagem leve: se tiver cookie de sessão E cookie flag `laura_sub_blocked=1` (setado via server action após status check), redirecionar tudo que não seja whitelist para `/assinatura`. Fonte de verdade continua sendo server-side (layout.tsx do dashboard valida via `GET /me/subscription` + `IsBlocked`). Cookie é apenas otimização.

**UX banner countdown trial:**

- Dias 7–4: tom violeta neutro.
- Dias 3–2: tom âmbar ("warning").
- Dia 1/último: vermelho ("danger") com CTA enfatizado.

**Copy banners/paywall:**

- PT-BR empático, não agressivo. Ex.: "Seu trial termina em 2 dias. Assine para manter tudo funcionando."

## 4. Plano de dados e state machine

### Estados `subscription_status`

```
trial       → trial_ends_at futuro, acesso total
active      → paga, acesso total
past_due    → pagamento falhou, past_due_grace_until = now+3d, após isso vira bloqueado
canceled    → cancel_at_period_end true, mantém acesso até current_period_end
expired     → trial acabou sem pagar OU past_due após grace OU canceled após period_end
```

Transições:
- `trial → active` quando webhook `invoice.paid`.
- `trial → expired` quando `trial_ends_at < now()` (detectado pelo `ComputeState`).
- `active → past_due` quando `invoice.payment_failed`.
- `past_due → active` quando `invoice.paid`.
- `past_due → expired` quando `past_due_grace_until < now()`.
- `active → canceled` quando user clica cancelar.
- `canceled → expired` quando `current_period_end < now()`.
- `expired → active` após novo checkout.

### Idempotência webhooks

Tabela nova `stripe_events(id VARCHAR PRIMARY KEY, type VARCHAR, received_at TIMESTAMPTZ, processed_at TIMESTAMPTZ)` dentro da migration 000040. Antes de processar, `INSERT ... ON CONFLICT DO NOTHING`; se conflict, ignora.

## 5. Variáveis de ambiente novas

- `WHATSAPP_OTP_INSTANCE_ID` — opcional, ID da instância para OTP. Default: primeira conectada.
- `STRIPE_BILLING_PORTAL_RETURN_URL` — default `${APP_URL}/assinatura`.
- `TRIAL_DAYS` — default `7`.
- `PAST_DUE_GRACE_DAYS` — default `3`.

Todas documentadas em `laura-go/.env.example` e `laura-pwa/.env.example`.

## 6. Testes

- **Go unit:** `services/otp_test.go` (gen/verify/expire/attempts), `services/subscription_test.go` (state machine 10+ casos). `handlers/signup_test.go` integration (httptest + testdb) cobrindo happy path + duplicate email + expired pending.
- **Vitest:** `OTPCodeInput.test.tsx`, `PricingCards.test.tsx` (fetch mock), `TrialBanner.test.tsx`.
- **Playwright E2E novos (test-mode OTP fixo 123456 via env `OTP_TEST_MODE=true`):**
  1. LP loads + pricing fetched.
  2. Signup wizard completo até dashboard.
  3. Login existente.
  4. Forgot password flow.
  5. Trial banner aparece após signup.
  6. Paywall bloqueia quando workspace marcada `expired` via seed.

## 7. Deploy

- Adicionar migrations 000038–000042 no passo de migrate do Portainer stack.
- Env vars novas configuradas em produção antes do deploy.
- Smoke test pós-deploy: LP 200, signup wizard até step 3 usando conta descartável + número real do usuário, checkout Stripe em modo test.

## 8. Riscos e mitigações

- **Envio WhatsApp OTP depende de instância conectada.** Fallback: se nenhuma instância disponível, retornar 503 `otp_channel_unavailable` e wizard orienta "Tente novamente em instantes". Em dev, log no console.
- **Sessão sendo criada sem cartão** pode virar abuso (múltiplos trials por email/whatsapp). Mitigação: `UNIQUE` em `users.email` já existe, + validação `users.phone_number` duplicada retorna 409. Fraude avançada fica para fase futura.
- **Stripe webhook race** com state machine: usar tabela de idempotência + UPDATE condicional (`WHERE stripe_event_id NOT EXISTS` + reconciliação pela ordem do `received_at`).
- **Migration 000040 requer backfill** de `subscription_status` a partir de `plan_status`. Mapping: `free→trial` (com `trial_ends_at=now()+7d`), `trial→trial`, `active→active`, `canceled→canceled`. Validar manualmente contagem antes/depois.
- **LP nova em `/` muda comportamento** de usuários antigos que acessam direto. Mantemos redirect antigo como fallback opcional via querystring `?forceLanding=0` → `/dashboard`. Mas por default LP substitui.

## 9. Entregáveis

1. Migrations 000038–000042.
2. Serviços Go: otp.go, whatsapp_sender.go, subscription.go.
3. Handlers Go: public_plans.go, signup.go, subscription.go.
4. Webhook Stripe expandido + tabela stripe_events.
5. Rotas e componentes PWA novos (LP, signup wizard, /assinatura, paywall).
6. Middleware paywall.
7. Templates de email novos + seed.
8. Testes Go, Vitest e Playwright passando.
9. Documentação: `docs/ops/subscription-state-machine.md`, atualização de `CLAUDE.md` para Fase 19+, ADR 007 (arquitetura billing).
10. Tag git `phase-18-deployed` após smoke prod.

## 10. Fora do escopo (fica para fase 19+)

- Planos anuais com descontos multi-tier; hoje só toggle mensal/anual.
- Cupons de desconto.
- Afiliados / referral.
- Múltiplas formas de pagamento (Pix, boleto) — fica Stripe cartão por enquanto.
- I18n (somente PT-BR).
- A/B testing na LP.
