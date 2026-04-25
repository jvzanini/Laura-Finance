# Fase 19 — Plan v2 (granularidade alta)

Baseado em `specs/2026-04-25-fase-19-laura-rosto-da-marca-v3.md`.

---

## T1 — Asset image
- T1.1: criar `laura-pwa/public/brand/` (mkdir)
- T1.2: copiar `Modelo Laura (Laura Finance).png` → `public/brand/laura-portrait.png`
- T1.3: validar tamanho/formato (deve ficar 1254×1254 PNG transparente)

## T2 — Componente `LauraAvatar`
- T2.1: criar arquivo `laura-pwa/src/components/brand/LauraAvatar.tsx`
- T2.2: definir tipos `LauraAvatarSize` `HaloIntensity` `RingStyle` `LauraAvatarProps`
- T2.3: implementar mapas de tamanho (px e classNames)
- T2.4: implementar mapas de halo (inset/blur/opacity por intensity × size)
- T2.5: implementar mapa de ring (className por estilo)
- T2.6: implementar `sizes` map (xs/sm/md/lg/xl/hero)
- T2.7: implementar render JSX:
  - wrapper relative
  - halo div aria-hidden absolute
  - inner wrapper overflow-hidden rounded-full + ring
  - next/image src/alt/fill/sizes/priority/object-cover/object-top
  - status dot opcional
- T2.8: implementar animação opcional via `motion.div` (apenas se `animate=true`)
- T2.9: export `LauraAvatar` named

## T3 — Componente `LauraBrandMark`
- T3.1: criar `laura-pwa/src/components/brand/LauraBrandMark.tsx`
- T3.2: import `LauraAvatar`
- T3.3: definir `LauraBrandMarkVariant` + props
- T3.4: implementar render:
  - container span inline-flex items-center gap-2
  - LauraAvatar com props mapeadas pela variant
  - wordmark "Laura Finance" idêntico ao atual (cores e tracking iguais ao código existente)
  - variant `sidebar`: também renderiza sublinha "Gestão Inteligente" + flex-col
- T3.5: export `LauraBrandMark` named

## T4 — Substituir os 4 LFs
- T4.1: `MarketingNavbar.tsx`
  - T4.1.1: importar `LauraBrandMark`
  - T4.1.2: remover função local `LauraLogo` (linhas 27-44)
  - T4.1.3: trocar `<LauraLogo />` (linha 73 + 123) por `<LauraBrandMark variant="navbar" />`
- T4.2: `MarketingFooter.tsx`
  - T4.2.1: importar `LauraBrandMark`
  - T4.2.2: substituir bloco `<span aria-hidden ... LF</span>` + wordmark (linhas 18-29) por `<LauraBrandMark variant="footer" />`
- T4.3: `AppSidebar.tsx`
  - T4.3.1: importar `LauraBrandMark`
  - T4.3.2: substituir bloco header (linhas 76-85) — mantendo o wrapper existente, trocar div com "LF" + flex de textos por `<LauraBrandMark variant="sidebar" />`
  - T4.3.3: confirmar que `group-data-[collapsible=icon]:hidden` continua escondendo o wordmark ao colapsar (sidebar mantém só avatar)
- T4.4: `AuthLayout.tsx`
  - T4.4.1: importar `LauraBrandMark`
  - T4.4.2: substituir o bloco do span 72×72 (linhas 23-29) por `<LauraBrandMark variant="auth" />`

## T5 — Aplicações na LP

### T5.1: `Hero.tsx` — card flutuante WhatsApp
- T5.1.1: importar `LauraAvatar`
- T5.1.2: substituir `<div ...><MessageCircle ... /></div>` (linhas 127-132) por `<LauraAvatar size="sm" ring="violet" priority />`
- T5.1.3: validar que o tamanho 32px equivale visualmente ao círculo gradient anterior

### T5.2: `PilarAssistente.tsx` — header mockup
- T5.2.1: importar `LauraAvatar`
- T5.2.2: localizar bloco "flex flex-col leading-tight" (linha 344+)
- T5.2.3: envolver em flex row com `<LauraAvatar size="sm" ring="subtle" />` à esquerda do bloco existente, mantendo o `gap-2.5`

### T5.3: `PilarFamilia.tsx` — header painel
- T5.3.1: importar `LauraAvatar`
- T5.3.2: localizar bloco header do painel (linha 364+)
- T5.3.3: adicionar avatar 28px à esquerda do `<div>` que contém "Laura Finance · Família"

### T5.4: `PilarViagens.tsx` — header mockup
- T5.4.1: importar `LauraAvatar`
- T5.4.2: localizar header do mockup (label "Laura Finance · Viagens" provável — confirmar leitura)
- T5.4.3: adicionar avatar 28px à esquerda

### T5.5: `CTAFinal.tsx` — avatar grande
- T5.5.1: importar `LauraAvatar`
- T5.5.2: dentro do `<div className="relative">` (linha 37), antes do badge "Experimente sem compromisso", adicionar:
  - container `flex justify-center mb-6` ou similar (margem que case com o spacing atual)
  - `<LauraAvatar size="hero" halo="intense" ring="violet" animate />`
- T5.5.3: validar responsivo: hero=160 desktop, 120 mobile (via responsive classes no `LauraAvatar` size mapping)

## T6 — Aplicações plataforma interna

### T6.1: Dashboard header (`(dashboard)/layout.tsx`)
- T6.1.1: importar `LauraAvatar`
- T6.1.2: localizar bloco "flex items-center gap-2" com texto "Laura Finance" (linhas 56-58)
- T6.1.3: adicionar `<LauraAvatar size="xs" ring="subtle" />` antes do `<span>`

### T6.2: AppSidebar — "Falar com Laura"
- T6.2.1: importar `LauraAvatar` (já importou para brand mark se merge)
- T6.2.2: localizar `<MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />` (linha 199)
- T6.2.3: substituir por `<LauraAvatar size="xs" ring="subtle" withStatusDot />`
- T6.2.4: validar que o tamanho h-4 w-4 (16px) equivale ao xs (20px) — ajustar para `xs` ou criar novo size se quebrar visualmente

## T7 — Verification
- T7.1: `pnpm typecheck` (de dentro de `laura-pwa/`)
- T7.2: `pnpm lint`
- T7.3: `pnpm dev` e validar:
  - Homepage `/` carrega sem CLS visível, Laura aparece em navbar, hero card, pilares, CTA, footer
  - `/login` e `/register` mostram a Laura grande em vez do "LF"
  - `/dashboard` mostra mini avatar no header e em "Falar com Laura" no sidebar
  - Sem halo branco residual em volta da foto

## T8 — Atualizar memory + docs
- T8.1: criar memory `phase_19_laura_rosto.md` no diretório de memory
- T8.2: atualizar `MEMORY.md` index
- T8.3: atualizar HANDOFF.md (se existir snapshot recente da Fase 18, adicionar parágrafo Fase 19)

## T9 — Commit + tag
- T9.1: `git status` + `git diff` para revisar mudanças
- T9.2: `git add` apenas arquivos relevantes (sem .env / secrets)
- T9.3: commit conventional PT-BR: `feat(brand): fase 19 — Laura como rosto da marca em LP + plataforma`
- T9.4: `git tag phase-19-laura-rosto`
- T9.5: `git push && git push --tags` (NÃO — usuário pode preferir validar primeiro; perguntar antes de push se for o caso)
