# Fase 19 — Plan v1

Baseado em `specs/2026-04-25-fase-19-laura-rosto-da-marca-v3.md`.

## T1 — Asset
- Copiar `Modelo Laura (Laura Finance).png` → `laura-pwa/public/brand/
  laura-portrait.png`.

## T2 — Componente LauraAvatar
- Criar `laura-pwa/src/components/brand/LauraAvatar.tsx`.
- Implementar conforme spec (sizes, halo, ring, status dot, animate).

## T3 — Componente LauraBrandMark
- Criar `laura-pwa/src/components/brand/LauraBrandMark.tsx`.
- Implementar 4 variants (navbar/footer/sidebar/auth).

## T4 — Substituir LFs
- MarketingNavbar.tsx
- MarketingFooter.tsx
- AppSidebar.tsx
- AuthLayout.tsx

## T5 — Aplicações LP
- Hero.tsx (card WhatsApp)
- PilarAssistente.tsx (header mockup)
- PilarFamilia.tsx (header painel)
- PilarViagens.tsx (header mockup)
- CTAFinal.tsx (avatar 160/120 acima do badge)

## T6 — Aplicações plataforma interna
- (dashboard)/layout.tsx (mini avatar header)
- AppSidebar.tsx (Falar com Laura)

## T7 — Verification
- pnpm typecheck
- pnpm lint
- pnpm dev visual

## T8 — Commit + tag
- conventional commit PT-BR
- tag phase-19-laura-rosto
