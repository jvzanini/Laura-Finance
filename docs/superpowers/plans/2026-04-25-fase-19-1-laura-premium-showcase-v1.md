# Fase 19.1 — Plan

Spec: `specs/2026-04-25-fase-19-1-laura-premium-showcase-v1.md`.

## T1 — Asset
- T1.1: copiar `Modelo Laura (Laura Finance).png` (RGBA limpo) → `laura-pwa/public/brand/laura-portrait.png` (substitui o tratado anterior)
- T1.2: regenerar `laura-face.png` 800×800 a partir do novo PNG (Pillow crop, mas SEM chroma key — o PNG já tem alpha)

## T2 — globals.css animations
- T2.1: ler `laura-pwa/src/app/globals.css`
- T2.2: adicionar @keyframes (breathe/halo-pulse/aura-rotate/float) + utilities Tailwind v4 (@theme tokens ou @utility direto)
- T2.3: adicionar `@media (prefers-reduced-motion: reduce)` desligando todas

## T3 — Atualizar LauraAvatar
- T3.1: remover `bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20` do inner wrapper
- T3.2: adicionar prop `pulse?: boolean` que aplica `animate-laura-halo-pulse` no halo
- T3.3: aplicar pulse no Sidebar "Falar com Laura"

## T4 — Criar LauraShowcase
- T4.1: criar `src/components/brand/LauraShowcase.tsx`
- T4.2: tipos: size (md/lg/xl/hero), parallax?, priority?, className
- T4.3: render:
  - container relative (perspective opcional)
  - 3 camadas de halo (radial pulse + conic aura rotate + lightspot)
  - next/image PNG transparente full-bust com animate-laura-breathe + animate-laura-float
- T4.4: hook useParallax (mousemove desktop only, pointer:fine, rAF throttled)

## T5 — AuthLayout
- T5.1: substituir `<LauraBrandMark variant="auth" />` por:
  - container relative com overflow visible
  - `<LauraShowcase size="lg" priority parallax />` no topo, posicionado para emergir acima do card
  - manter wordmark "Laura Finance" e tagline abaixo
- T5.2: ajustar spacing pra Laura "encostar" no card visualmente

## T6 — Hero LP (layered)
- T6.1: no grid `lg:grid-cols-[1.1fr_1fr]`, dentro do container do mockup, adicionar Laura full-bust ATRÁS do mockup com z-index inferior
- T6.2: posicionamento: absolute right top, scale grande, opacity sutil para harmonizar com mockup
- T6.3: garantir que mockup continua visível na frente (z-index)
- T6.4: respeitar overflow (Hero já tem `[contain:paint]` — talvez precise ajustar)

## T7 — CTA Final
- T7.1: substituir `<LauraAvatar size="hero" ...>` por `<LauraShowcase size="hero" parallax />`
- T7.2: posicionar Laura quebrando a borda superior do card (translateY -45% via wrapper)
- T7.3: card precisa `overflow-visible` (atualmente é `overflow-hidden` no bloco interno — alterar para isso ou criar wrapper externo com Laura)

## T8 — Verification
- T8.1: pnpm typecheck
- T8.2: pnpm lint
- T8.3: pnpm dev — smoke /, /login, /register, /dashboard
- T8.4: confirmar zero xadrez residual em fundos escuros

## T9 — Memory + docs
- T9.1: atualizar `phase_19_laura_rosto.md` para refletir 19.1 ou criar `phase_19_1_premium.md`
- T9.2: atualizar MEMORY.md
- T9.3: atualizar HANDOFF.md com parágrafo 19.1
- T9.4: atualizar CLAUDE.md (status Fase 19.1)

## T10 — Commit + deploy + tag
- T10.1: commit conventional `feat(brand): fase 19.1 — Laura premium showcase + fix xadrez`
- T10.2: tag `phase-19-1-laura-premium`
- T10.3: push origin master + tag
- T10.4: monitorar CI
- T10.5: smoke prod
- T10.6: tag `phase-19-1-deployed` + push
