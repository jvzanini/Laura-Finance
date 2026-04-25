# Fase 19.1 — Laura premium showcase (Spec consolidada)

## Contexto e problemas a resolver

A Fase 19 entregou a Laura como brand mark, mas com 2 problemas:

1. **Bug visual no avatar circular**: o PNG original tinha fundo branco
   opaco, e meu chroma key Pillow deixou pixels semitransparentes nas
   bordas/cabelo. Como o wrapper do `LauraAvatar` tinha
   `bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20`, esse fundo
   "vazou" através das transparências, gerando um efeito de xadrez
   cinza-violeta atrás do rosto (visível na tela de login). O usuário
   refez a remoção de fundo manualmente e enviou um PNG RGBA limpo
   (1250×1250, 120dpi, alpha real, do Canva).
2. **Tratamento convencional**: Laura ficou em círculos pequenos. O
   usuário quer **algo premium, fora da caixa, layered, com animação
   sutil no rosto** — sofisticado, moderno, único.

## Objetivo

Resolver o bug do xadrez **e** elevar o tratamento da Laura para um
patamar premium em 3 pontos-chave (AuthLayout, Hero LP, CTA Final),
mantendo a coerência nos demais (mini avatares circulares).

## Não negociáveis

- Substituir o PNG por completo (`laura-portrait.png` + regenerar
  `laura-face.png`).
- Remover o gradient bg do wrapper de `LauraAvatar` que causava o
  vazamento — fundo do avatar circular agora é totalmente transparente
  (a foto cobre 100% do círculo).
- NÃO alterar cores do design system, copy ou estrutura de seções.
- Tap targets ≥44px mantidos onde clicável.

## Tratamento premium

### A. Componente novo: `LauraShowcase` (full-bust sem círculo)

Renderiza o PNG transparente **diretamente, sem clip circular**, com:

1. **Halo radial multi-camada animado** (atrás da Laura):
   - Camada 1: gradient radial violet→fuchsia→rose, blur-3xl, opacity
     pulsando 0.6→0.95→0.6 em 5s ease-in-out infinite.
   - Camada 2: aura rotativa (conic-gradient violet→fuchsia→rose→violet)
     girando 360° em 18s linear infinite, blur-2xl, opacity 0.4.
   - Camada 3: lightspot pequeno radial branco no canto superior,
     sutil, opacity 0.15, simulando luz de cima.

2. **Animação de "respiração"** no PNG: scale 1 → 1.018 → 1 em 5s
   ease-in-out infinite. Imperceptível mas dá vida.

3. **Floating glow** sutil que segue o eixo Y (transform translateY
   pequena 0 → -4px → 0 em 6s ease-in-out infinite, fora de fase com
   o breathing).

4. **Parallax opcional desktop** (mousemove): translate ±6px conforme
   posição do cursor relativo ao centro do showcase. Detecta
   `pointer: fine` para não acionar em mobile.

5. **Tamanhos**: `md` (192px altura), `lg` (288px), `xl` (384px),
   `hero` (responsive: 320px mobile / 480px desktop).

6. **`priority`** padrão `true` para AuthLayout/Hero (above the fold).

### B. Atualizar `LauraAvatar` (mini, circular)

- Remover `bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20` do
  inner wrapper. Background fica transparente — a foto cobre.
- Adicionar prop `pulse?: boolean` que aplica animação sutil no halo
  (opacity 0.7→1→0.7 em 4s) — usado em sidebar "Falar com Laura"
  reforçando "online".

### C. Aplicações novas / atualizadas

| Local | Antes (Fase 19) | Depois (19.1) |
|---|---|---|
| **AuthLayout** | Avatar circular 96px + halo intense + wordmark abaixo | `LauraShowcase size="lg"` (288px) full-bust no topo, **emergindo** acima do card de login (overflow visible). Wordmark "Laura Finance" abaixo da Laura, mantém. |
| **Hero LP** | Card flutuante WhatsApp com avatar 32px | Mantém o card. **Adiciona** Laura full-bust no `lg:grid-cols-[1.1fr_1fr]` à direita, **atrás** do mockup com z-index baixo, criando layered depth. Mockup fica na frente, Laura aparece "saindo" por trás. |
| **CTA Final** | Avatar hero 160px circular acima do badge | `LauraShowcase size="hero"` (480px desktop / 320px mobile) **quebrando o topo do card** (overflow visible, position relative com translateY -50% no avatar), criando efeito "ela sai do card". Badge + headline ficam abaixo. |
| **PilarAssistente / PilarFamilia / PilarViagens** | Mini avatar 28px no header | Mantém — tratamento premium concentrado nos 3 pontos de conversão. |
| **MarketingNavbar / Footer / Sidebar header** | Mini avatar 32-36px | Mantém — brand mark coerente. |
| **Sidebar "Falar com Laura"** | Avatar 20px + status dot | Adiciona `pulse` no halo. |
| **Dashboard header** | Mini avatar 24px | Mantém. |

### D. Animações CSS (Tailwind v4 utilities customizados via @theme)

Adicionar em `globals.css`:
```css
@theme {
  --animate-laura-breathe: laura-breathe 5s ease-in-out infinite;
  --animate-laura-halo-pulse: laura-halo-pulse 5s ease-in-out infinite;
  --animate-laura-aura-rotate: laura-aura-rotate 18s linear infinite;
  --animate-laura-float: laura-float 6s ease-in-out infinite;
}
@keyframes laura-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.018); }
}
@keyframes laura-halo-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.95; }
}
@keyframes laura-aura-rotate {
  to { transform: rotate(360deg); }
}
@keyframes laura-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

(Ajustar para o padrão Tailwind v4 se diferir — checar
`globals.css` atual antes.)

### E. Acessibilidade

- `prefers-reduced-motion: reduce` desliga **todas** as animações
  (breathing, pulse, aura-rotate, float). Aplicar via media query nas
  classes utilitárias.
- `alt` mantido: `"Laura, sua assistente financeira da Laura Finance"`.
- Sem hover/click handlers no parallax para não interferir em a11y.

### F. Performance

- Imagens via `next/image` com `priority={true}` em AuthLayout/Hero/CTA.
- `sizes` correto por variante.
- Animações CSS pure (sem motion/react para o breathing/pulse/aura)
  para não custar JS — só CSS GPU-accelerated transforms.
- Parallax usa `requestAnimationFrame` com throttle.

## Critério de pronto

1. PNG novo aplicado, xadrez cinza ZERO no avatar circular.
2. AuthLayout com Laura full-bust 288px emergindo acima do card.
3. Hero LP com Laura layered atrás do mockup.
4. CTA Final com Laura "saindo" do topo do card.
5. Halo pulsante + breathing visíveis (mas sutis) em todos os
   showcases.
6. `prefers-reduced-motion` respeitado.
7. typecheck/lint verdes, smoke local + smoke prod ok, tags
   `phase-19-1-laura-premium` + `phase-19-1-deployed` aplicadas.
