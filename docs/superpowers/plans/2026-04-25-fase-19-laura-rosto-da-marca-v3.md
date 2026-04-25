# Fase 19 — Plan v3 (final)

Baseado em `specs/2026-04-25-fase-19-laura-rosto-da-marca-v3.md`.

---

## T1 — Asset image (1 passo)
- T1.1: copiar `/Users/joaovitorzanini/Downloads/Modelo Laura (Laura
  Finance).png` para `laura-pwa/public/brand/laura-portrait.png`. (mkdir
  -p public/brand antes.)

## T2 — Componente `LauraAvatar`
- T2.1: criar `laura-pwa/src/components/brand/LauraAvatar.tsx`
- T2.2: definir tipos `LauraAvatarSize` (xs/sm/md/lg/xl/hero), `HaloIntensity`
  (none/soft/intense), `RingStyle` (none/violet/subtle/primary), props
- T2.3: mapa de tamanho px:
  - xs=20, sm=28, md=36, lg=56, xl=96 (resp 80 mobile via responsive class
    `size-20 sm:size-24` ajustado para 80→96), hero=160 desktop / 120
    mobile (`size-[120px] md:size-40`)
- T2.4: mapa halo (className gerado por intensity × size):
  - soft: `-inset-2 blur-md opacity-70`
  - intense: `-inset-6 blur-3xl opacity-90`
  - none: ausente
- T2.5: mapa ring:
  - violet: `ring-2 ring-violet-500/40`
  - subtle: `ring-1 ring-white/15`
  - primary: `ring-1 ring-primary/30`
  - none: ausente
- T2.6: `sizes` map p/ next/image:
  - xs/sm: `40px`
  - md: `56px`
  - lg: `96px`
  - xl: `128px`
  - hero: `(min-width: 768px) 224px, 168px`
- T2.7: render JSX:
  - root: `relative inline-flex shrink-0 ${sizeClass}`
  - halo div aria-hidden absolute (se halo!=none)
  - inner: `relative overflow-hidden rounded-full ${ringClass} ${sizeClass}`
  - `next/image` src=`/brand/laura-portrait.png` alt=`{alt ?? default}`
    fill sizes={sizesClass} priority={priority} className="object-cover
    object-top"
  - status dot (se withStatusDot): `absolute bottom-0 right-0 size-1.5
    rounded-full bg-emerald-400 ring-1 ring-[#0A0A0F]`
- T2.8: animação opcional via `motion.div` envolvendo o root (apenas se
  animate=true). Fallback CSS-only: nada (o usuário pediu motion sutil
  apenas em hero). Importar `motion/react` somente se `animate=true`
  (lazy via condicional já basta — Next 16 tree-shake).
- T2.9: export `LauraAvatar` named

## T3 — Componente `LauraBrandMark`
- T3.1: criar `laura-pwa/src/components/brand/LauraBrandMark.tsx`
- T3.2: import `LauraAvatar`
- T3.3: definir `LauraBrandMarkVariant` (navbar/footer/sidebar/auth) + props
- T3.4: mapa de configuração por variant:
  - navbar: `{ avatarSize: "sm", halo: "soft", ring: "subtle",
    wordmarkClass: "text-xl font-bold tracking-tight text-white",
    showSubtitle: false }`
  - footer: idêntico mas `wordmarkClass: "text-lg font-bold tracking-
    tight text-white"`
  - sidebar: `{ avatarSize: "md", halo: "soft", ring: "primary",
    wordmarkClass: "text-base font-bold tracking-tight",
    showSubtitle: true (Gestão Inteligente) }`
  - auth: `{ avatarSize: "xl", halo: "intense", ring: "subtle",
    wordmarkClass: "text-lg font-semibold tracking-tight text-white sm:
    text-xl", showSubtitle: false, layout: "stacked", priority: true }`
- T3.5: render:
  - container span inline-flex items-center gap-2 (auth: flex-col gap-3)
  - LauraAvatar com props da variant
  - wordmark "Laura {Finance gradient}" idêntico ao código atual
  - subtitle se variant=sidebar (envolvido em div flex-col com
    `group-data-[collapsible=icon]:hidden` mantido)
- T3.6: export `LauraBrandMark` named

## T4 — Substituir os 4 LFs

### T4.1 — `MarketingNavbar.tsx`
- T4.1.1: importar `LauraBrandMark` de `@/components/brand/LauraBrandMark`
- T4.1.2: remover função local `LauraLogo` (linhas 27-44)
- T4.1.3: trocar `<LauraLogo />` (linha 73) por `<LauraBrandMark variant="navbar" />`
- T4.1.4: trocar `<LauraLogo />` (linha 123, dentro do `SheetTitle`) por idem

### T4.2 — `MarketingFooter.tsx`
- T4.2.1: importar `LauraBrandMark`
- T4.2.2: dentro do `<Link href="/">`, substituir `<span aria-hidden ...
  LF</span>` + wordmark (linhas 18-29) por `<LauraBrandMark variant="footer" />`

### T4.3 — `AppSidebar.tsx`
- T4.3.1: importar `LauraBrandMark`
- T4.3.2: dentro de `<SidebarHeader>`, substituir o div pai contendo o
  quadrado "LF" + flex de textos (linhas 77-85) por
  `<LauraBrandMark variant="sidebar" />`
- T4.3.3: confirmar visualmente que `group-data-[collapsible=icon]:hidden`
  continua escondendo wordmark+subtitle ao colapsar (deve manter só o
  avatar)

### T4.4 — `AuthLayout.tsx`
- T4.4.1: importar `LauraBrandMark`
- T4.4.2: dentro do `<Link href="/">`, substituir o span 72×72 (linhas
  23-29) por `<LauraBrandMark variant="auth" />` (que já renderiza
  avatar 96px + wordmark "Laura Finance" abaixo)

## T5 — Aplicações na LP

### T5.1 — `Hero.tsx` — card flutuante WhatsApp
- T5.1.1: importar `LauraAvatar`
- T5.1.2: substituir `<div className="flex size-8 items-center justify-
  center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
  <MessageCircle .../></div>` (linhas 127-132) por `<LauraAvatar size="sm"
  ring="violet" priority />`
- T5.1.3: remover import `MessageCircle` se não usado em outro lugar do
  arquivo

### T5.2 — `PilarAssistente.tsx` — header mockup
- T5.2.1: importar `LauraAvatar`
- T5.2.2: localizar `<div className="flex items-start justify-between gap-3">`
  (linha 343)
- T5.2.3: dentro do primeiro `<div className="flex flex-col leading-tight">`,
  envolver o conteúdo (Laura Finance label + h3 + span) deixando o
  `LauraAvatar size="sm" ring="subtle"` à esquerda via flex-row wrapping —
  alternativa cirúrgica: adicionar `<LauraAvatar size="sm" ring="subtle"
  className="mt-0.5" />` antes do flex-col, e ajustar o pai para
  `flex items-start gap-3`

### T5.3 — `PilarFamilia.tsx` — header painel
- T5.3.1: importar `LauraAvatar`
- T5.3.2: localizar `<div className="flex items-center justify-between">`
  (linha 364)
- T5.3.3: dentro do primeiro `<div>` (linha 365-372), adicionar
  `<LauraAvatar size="sm" ring="subtle" />` à esquerda do bloco, ajustando
  o pai para `flex items-center gap-3`

### T5.4 — `PilarViagens.tsx` — header mockup
- T5.4.1: importar `LauraAvatar`
- T5.4.2: localizar `<div className="flex items-start justify-between gap-3 border-b border-white/10 p-5 sm:p-6">` (linha 359)
- T5.4.3: adicionar `<LauraAvatar size="sm" ring="subtle" />` à esquerda
  do `<div className="flex flex-col leading-tight">` ajustando pai para
  `flex items-center gap-3 border-b ...`

### T5.5 — `CTAFinal.tsx` — Laura grande
- T5.5.1: importar `LauraAvatar`
- T5.5.2: dentro de `<div className="relative">` (linha 37), antes do
  `<div className="inline-flex items-center gap-2 ... badge>`, adicionar:
  ```tsx
  <div className="mb-8 flex justify-center">
    <LauraAvatar size="hero" halo="intense" ring="violet" animate />
  </div>
  ```
- T5.5.3: validar que o spacing total mantém o balance visual original
  (ajustar `mb-8` para `mb-6` se ficar excessivo)

## T6 — Aplicações plataforma interna

### T6.1 — Dashboard header
- T6.1.1: editar `(dashboard)/layout.tsx`
- T6.1.2: importar `LauraAvatar`
- T6.1.3: localizar bloco linha 56-58:
  ```tsx
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-muted-foreground">Laura Finance</span>
  </div>
  ```
  e adicionar `<LauraAvatar size="xs" ring="subtle" />` antes do `<span>`

### T6.2 — `AppSidebar.tsx` — "Falar com Laura"
- T6.2.1: garantir `LauraAvatar` importado (provavelmente já via brand mark
  ou importar agora)
- T6.2.2: substituir `<MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />`
  (linha 199) por `<LauraAvatar size="xs" ring="subtle" withStatusDot />`
- T6.2.3: confirmar que xs (20px) ≈ h-4 w-4 (16px) — visualmente OK; se
  ficar grande demais, criar size "tiny=16" no LauraAvatar
- T6.2.4: remover `MessageCircle` do import lucide-react SE não usado em
  outro lugar do AppSidebar (verificar)

## T7 — Verification (LEI #2: skill verification-before-completion)
- T7.1: `cd laura-pwa && pnpm typecheck`
- T7.2: `pnpm lint`
- T7.3: `pnpm dev` em background; validar manualmente com browser:
  - `/` (LP) — Laura aparece em navbar, hero (mensagem WhatsApp), pilares
    1/2/3, CTAFinal (grande), footer
  - `/login` e `/register` — Laura grande no topo
  - `/dashboard` — mini avatar no header + avatar no atalho "Falar com
    Laura" no sidebar (com dot verde)
  - confirmar 0 halo branco residual, 0 CLS, 0 quebra mobile (testar
    viewport 360px)
- T7.4: anexar evidência (descrição textual do que foi visto)

## T8 — Memory + docs
- T8.1: criar `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-
  Code-Laura-Finance--Vibe-Coding-/memory/phase_19_laura_rosto.md`
- T8.2: atualizar `MEMORY.md` index com entrada Fase 19
- T8.3: (opcional) atualizar `docs/HANDOFF.md` se relevante

## T9 — Commit + tag
- T9.1: `git status` + `git diff --stat` para revisar
- T9.2: `git add` (lista explícita: docs/superpowers/{specs,plans}/2026-04-25*,
  laura-pwa/public/brand/, laura-pwa/src/components/brand/, arquivos
  modificados em laura-pwa/src/{components,app})
- T9.3: commit conventional PT-BR:
  `feat(brand): fase 19 — Laura como rosto da marca em LP + plataforma`
  + corpo descrevendo 9 pontos de aplicação
- T9.4: `git tag phase-19-laura-rosto`
- T9.5: NÃO push automático — usuário valida visual e instrui push (regra
  cautelar; LEI #1 autoriza autonomia, mas push em master = deploy via
  CI/Portainer; cautela = antes de push, dev preview e confirmação tácita
  pelo `pnpm dev` está OK)
