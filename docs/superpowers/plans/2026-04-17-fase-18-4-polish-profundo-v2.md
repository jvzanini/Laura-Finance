# Fase 18.4 — Plan v2 (implementação granular — final)

> v2 incorpora review do v1: (a) link do Trial vai com `cycle=monthly` (validator no backend aceita só monthly/yearly); (b) carrossel Testimonials usa só overflow-x + snap (drag opcional); (c) remoção de losangulo é condicional ("se existir, remover"); (d) slogan novo aplicado na tela login E no layout auth (o que estiver visível).

Base: `docs/superpowers/specs/2026-04-17-fase-18-4-polish-profundo-v2.md`.

## Bloco A — DB update prod

- **A1** Criar `infrastructure/scripts/update-plans-fase18-4.sql`:
  ```sql
  UPDATE subscription_plans SET
    name='Trial',
    price_cents=0,
    price_cents_yearly=NULL,
    price_cents_yearly_discount=NULL,
    monthly_enabled=TRUE,
    yearly_enabled=FALSE,
    features_description='[
      "Tudo do VIP por 7 dias",
      "WhatsApp + app + dashboard",
      "Modo viagem + Open Finance",
      "Sem cobrança ao final"
    ]'::jsonb
  WHERE slug='standard';

  UPDATE subscription_plans SET
    price_cents=2990,
    price_cents_yearly=19990,
    price_cents_yearly_discount=19990,
    monthly_enabled=TRUE,
    yearly_enabled=TRUE
  WHERE slug='vip';
  ```
- **A2** Commit script + push.
- **A3** `gh workflow run prod-db-exec.yml -f confirm=CONFIRMO -f sql_file=infrastructure/scripts/update-plans-fase18-4.sql`.
- **A4** `curl /api/v1/public/plans` verifica novos valores.

## Bloco B — TrustBar

- **B1** Editar `src/components/marketing/TrustBar.tsx`:
  - Import: remover `Brain`, adicionar `Sparkles`.
  - Item 4: `{ icon: Sparkles, text: "IA que te entende" }`.

## Bloco C — PilarAssistente (5 tasks)

- **C1** Envelopar section com motion + `whileInView` scale/opacity.
- **C2** Adicionar chip pulsante com `MousePointerClick` lucide + texto "Experimente os filtros".
- **C3** Pizza SVG: aumentar raio ~30%, ajustar texto central.
- **C4** Implementar lista de transações descritivas por categoria com `AnimatePresence mode="wait"`. Data seed conforme spec.
- **C5** Planilha: coluna `Mês` → `Data`, substituir 8 linhas com datas abril/2026.

## Bloco D — PilarFamilia (6 tasks)

- **D1** Título: remover "de verdade".
- **D2** Subcopy 1 linha desktop: `md:whitespace-nowrap` + ajuste max-w.
- **D3** Remover losangulo no header balões (se existir) — inspecionar atual.
- **D4** Ajustar valores: Clara cinema R$ 150 → R$ 70; João mercado R$ 85 → R$ 150.
- **D5** Substituir lista filtrada por gráfico de barras horizontais por categoria (valores seed spec).
- **D6** `AnimatePresence mode="wait"` + duration 280ms + easing suave `[0.2,0.8,0.2,1]`.

## Bloco E — PilarViagens (4 tasks)

- **E1** Scroll-triggered grow igual C1.
- **E2** Chip pulsante "Navegue pelos relatórios".
- **E3** Aplicar classes dos tabs do PilarAssistente no sidebar (consistência visual).
- **E4** `AnimatePresence mode="wait"` duration 280ms.

## Bloco F — PricingClient (6 tasks)

- **F1** Subcopy: "7 dias grátis em todos os planos. Sem cartão, sem pegadinha." + 3 tags `CreditCardOff` "Sem cartão" / `Zap` "Acesso imediato" / `XCircle` "Cancele quando quiser".
- **F2** `defaultBilling = "yearly"`.
- **F3** Grid sempre 2 cards (`grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-6`). Trial nunca some com toggle.
- **F4** Card Trial: copy nova, preço "Grátis por 7 dias", 4 bullets, CTA "Comece grátis agora" → `/register?plan=standard&cycle=monthly` (backend cria trial automaticamente via trial_ends_at).
- **F5** VIP anual display: "12× R$ 19,90" grande + "R$ 199,90 no Pix à vista" sublegenda.
- **F6** VIP mensal display: "R$ 29,90/mês".

## Bloco G — Testimonials (3 tasks)

- **G1** Adicionar 3 depoimentos novos (Pedro/Camila/Rafael) com foco em família, viagem, IA/foto.
- **G2** Container horizontal scrollable (`overflow-x-auto snap-x snap-mandatory scroll-smooth`) + cards `flex-none w-[85%] sm:w-[46%] lg:w-[32%] snap-start`.
- **G3** `<section id="depoimentos">` para âncora.

## Bloco H — Navbar + Footer (3 tasks)

- **H1** Link "Recursos" → "Pilares" (texto apenas; href mantém `#pilar-assistente`).
- **H2** Adicionar link "Depoimentos" → `href="#depoimentos"` entre Planos e FAQ.
- **H3** Botão "Entrar": `border border-violet-400/60 bg-transparent hover:bg-violet-500/15 hover:border-violet-300` — outline.

## Bloco I — Login + SignupWizard responsivo (5 tasks)

- **I1** Logo LF 2× no login page (quadrado ~72×72 + `text-lg` dentro).
- **I2** Slogan na login page (ou layout auth — localizar e mudar): novo = "Sua plataforma financeira completa.".
- **I3** Login card responsivo: `w-full max-w-md px-4 sm:px-6 md:px-8 py-8 sm:py-12`.
- **I4** SignupWizard: OTPCodeInput boxes `w-10 h-12 sm:w-12 sm:h-14`, card padding `p-5 sm:p-8`, progress bar cabe 320px.
- **I5** `(auth)/layout.tsx`: paddings responsivos gerais.

## Bloco J — CTAFinal travessão cleanup

- **J1** Inspecionar CTAFinal atual; remover qualquer "—" residual.

## Bloco K — Verificação + Deploy

- **K1** `pnpm typecheck` → exit 0.
- **K2** `pnpm lint` → 0 erros.
- **K3** `pnpm build` → exit 0.
- **K4** `git commit` descritivo + `git push origin master`.
- **K5** Monitor workflow "Deploy Prod".
- **K6** Smoke prod: `curl` HTTP 200 em /, /login, /register; grep HTML por "Trial", "R$ 199,90", "Pilares", "Depoimentos", "Experimente os filtros".
- **K7** `git tag phase-18-4-deployed` + push.

## Paralelismo

- **Executar diretamente pelo main Claude**: Blocos A (SQL) + B (TrustBar — 1 linha) + K (verificação/deploy). Isso libera contexto para outras tarefas.
- **Delegar para 1 subagent** Blocos C + D + E + F + G + H + I + J em prompt único, com todas as specs e seeds já preparadas.

## Critérios de "pronto"

- Todos os 10 áreas de feedback refletidas no código.
- Build verde + deploy OK + smoke OK.
- Tag aplicada.
- Nenhum regressão nos fluxos principais (LP carrega, /login renderiza, /register wizard avança).
