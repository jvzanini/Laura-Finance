# Fase 18.4 — Plan v1 (implementação granular)

Baseado em `docs/superpowers/specs/2026-04-17-fase-18-4-polish-profundo-v2.md`.

Ordem lógica: DB update primeiro (dados) → código (depende de dados) → smoke+tag.

## Bloco A — DB update prod

- **A1** Criar `infrastructure/scripts/update-plans-fase18-4.sql` com:
  - UPDATE plano slug=`standard`: name='Trial', price_cents=0, price_cents_yearly=NULL, monthly_enabled=TRUE, yearly_enabled=FALSE, features_description novo (array curto trial-focus).
  - UPDATE plano slug=`vip`: price_cents=2990 (mantém), price_cents_yearly=19990, price_cents_yearly_discount=19990, monthly_enabled=TRUE, yearly_enabled=TRUE.
- **A2** Commit + push.
- **A3** Trigger workflow `Prod DB Exec` com sql_file apontando para esse script, confirm=CONFIRMO.
- **A4** Verificar `/api/v1/public/plans` prod reflete novos valores.

## Bloco B — Hero / TrustBar

- **B1** Editar `TrustBar.tsx`: item 4 `icon: Brain` → `icon: Sparkles`, text mantém "IA que te entende". Atualizar import.

## Bloco C — PilarAssistente

- **C1** Scroll-triggered grow: envolver section em `motion.section` com `whileInView` scale 0.96→1 + opacity 0.85→1, `viewport={{ once: true, margin: "-120px" }}`.
- **C2** Chip pulsante "Experimente os filtros" com `MousePointerClick` lucide — animate scale/opacity loop.
- **C3** Pizza SVG: aumentar radius ~30%, reduzir buraco proporcionalmente, texto centralizado com fontSize adequado.
- **C4** Tab-click renderiza `<AnimatePresence>` com `<motion.ul>` listando transações da categoria (dados seed conforme spec).
- **C5** Planilha "antiga": header `Mês` → `Data`, substituir 8 linhas com datas abril/2026 + gastos coerentes.

## Bloco D — PilarFamilia

- **D1** Título: remover "de verdade".
- **D2** Subcopy 1 linha: adicionar `md:whitespace-nowrap` + ajustar max-width.
- **D3** Remover losangulo dos 4 balões (localizar SVG/span decorativo).
- **D4** Ajustar valores: Clara cinema R$70; João mercado R$150.
- **D5** Substituir lista filtrada por gráfico de barras horizontais por categoria (valores seed conforme spec). Painel "Todos" permanece.
- **D6** Transições com `AnimatePresence mode="wait"` + duration 280ms + easing suave.

## Bloco E — PilarViagens

- **E1** Scroll-triggered grow idêntico ao C1.
- **E2** Chip pulsante "Navegue pelos relatórios".
- **E3** Extrair classes dos tabs do PilarAssistente e aplicar no sidebar de Viagens (consistência visual).
- **E4** `AnimatePresence mode="wait"` + duration 280ms nas trocas de view.

## Bloco F — PricingClient

- **F1** Subcopy sem travessão + 3 tags (`CreditCardOff`, `Zap`, `XCircle`).
- **F2** Default billing = "yearly".
- **F3** Sempre renderizar 2 cards (Trial + VIP) — Trial nunca some. Grid `sm:grid-cols-2` + `auto-rows-fr` + `w-full`.
- **F4** Card Trial: copy nova, preço "Grátis por 7 dias", 4 bullets resumidos, CTA "Comece grátis agora" → `/register?plan=standard&cycle=trial`.
- **F5** Card VIP anual display: "12× R$ 19,90" + "R$ 199,90 no Pix à vista".
- **F6** Card VIP mensal display: "R$ 29,90/mês".

## Bloco G — Testimonials

- **G1** Adicionar 3 depoimentos novos.
- **G2** Container horizontal scrollable com `snap-x snap-mandatory` + `overflow-x-auto` + cards `flex-none w-[85%] sm:w-[46%] lg:w-[32%]`.
- **G3** `id="depoimentos"` na section (para âncora Navbar).

## Bloco H — Navbar + Footer

- **H1** Link "Recursos" → "Pilares".
- **H2** Adicionar link "Depoimentos" entre "Planos" e "FAQ" com `href="#depoimentos"`.
- **H3** Botão "Entrar" outline (border violet + bg transparent + hover bg-violet-500/15).

## Bloco I — Login + SignupWizard responsivo + slogan

- **I1** Login: logo LF 2× (quadrado ~72px + text-lg dentro).
- **I2** Login: novo slogan "Sua plataforma financeira completa.".
- **I3** Login: responsividade mobile (px-4, max-w-md, space-y-4).
- **I4** SignupWizard: padding responsivo p-5 sm:p-8, OTPCodeInput boxes menores mobile, progress bar cabe 320px.
- **I5** `(auth)/layout.tsx`: ajustar padding responsivo geral.

## Bloco J — CTAFinal cleanup

- **J1** Remover qualquer travessão residual. Confirmar copy final.

## Bloco K — Verificação + Deploy

- **K1** `pnpm typecheck` verde.
- **K2** `pnpm lint` 0 erros.
- **K3** `pnpm build` exit 0.
- **K4** Commit + push.
- **K5** Monitor deploy prod.
- **K6** Smoke prod: HTTP 200 em /, /login, /register, /api/v1/public/plans; grep confirma copy nova.
- **K7** Tag `phase-18-4-deployed`.

## Paralelismo

Bloco A (SQL) e Blocos B–J (código) são independentes. Pode rodar A em paralelo com primeiro commit de B–J. Mas em prod o SQL precisa rodar antes do deploy do código para não renderizar valores antigos. Ordem sugerida:
1. A (SQL) + B (TrustBar — trivial) — mesmo commit ou sequencial.
2. C, D, E, F (grandes mudanças de componentes).
3. G, H, I, J (menores).
4. K (verificar + deploy).

Para ganho de contexto, pode-se despachar **1 subagent único** com prompt contendo todos os blocos B–J + J, e eu executo bloco A (SQL) diretamente.
