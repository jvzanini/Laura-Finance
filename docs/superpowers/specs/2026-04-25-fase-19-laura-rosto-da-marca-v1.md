# Fase 19 — Laura como rosto da marca (Spec v1)

## Contexto

Hoje a marca usa um quadrado gradiente violet→fuchsia com as letras "LF" como
brand mark, em 4 lugares (`MarketingNavbar`, `MarketingFooter`, `AppSidebar`,
`AuthLayout`). A "Laura" é apenas uma palavra; não tem rosto, não tem
personalidade visual. O usuário quer que a personagem ganhe vida: a foto
fornecida (`/Users/joaovitorzanini/Downloads/Modelo Laura (Laura Finance).png`,
1254×1254 PNG transparente, busto profissional, blazer violeta + blusa rosada
— já casa com a paleta primária `#7C3AED`/violet→fuchsia) deve aparecer na
landing page e na plataforma interna como assinatura visual contínua,
substituindo o "LF" e ganhando destaque adicional em pontos onde a Laura é
"a voz" do produto.

## Não negociáveis (restrições do usuário)

- **NÃO mudar** cores, componentes existentes, tipografia, espaçamento
  estrutural, layout de seções, copy. Apenas adicionar a foto + efeitos.
- **A foto NÃO entra crua.** Sempre acompanhada de tratamento visual (halo,
  ring, glow, blur radial atrás) que case com o design system: paleta
  violet→fuchsia→rose, dark mode, glassmorphism leve.
- Variar tamanhos conforme contexto — pequena no brand mark, grande nos
  pontos de destaque.
- PT-BR em todos `alt` e legendas.

## Objetivo

Tornar a Laura uma presença visual reconhecível e contínua, integrando o
produto a uma personagem-assinatura. O usuário deve associar a foto à marca
em qualquer ponto do funil (LP → signup → plataforma interna).

## Inventário de aplicações

### Brand mark (substitui "LF") — 4 pontos

| Local | Tamanho atual | Tratamento novo |
|---|---|---|
| `MarketingNavbar.tsx:27-44` (`LauraLogo` interno) | size-8 (32px) | Avatar circular 32px + halo gradient violet→fuchsia atrás (ring 1px violeta) |
| `MarketingFooter.tsx:18-29` | size-8 (32px) | Idêntico ao navbar |
| `AppSidebar.tsx:78-80` | size-9 (36px) | Avatar circular 36px + halo gradient + ring primary/30 |
| `AuthLayout.tsx:24-26` | 72×72px (XL) | Avatar circular 80px + halo violet→fuchsia mais intenso + ring 2px white/20 |

### Pontos de destaque (Laura ganha presença grande/média)

1. **`Hero.tsx` — card flutuante WhatsApp** (linha 116-150).
   O ícone `MessageCircle` num círculo gradient (linha 127-132) vira o avatar
   real da Laura (32px, redondo, ring violeta). Mantém o nome "Laura Finance"
   e o "agora mesmo" — agora soa como mensagem dela mesma.

2. **`PilarAssistente.tsx` — header da plataforma mockada** (linha 343-374).
   No card escuro à direita, antes do título "Relatório por categoria",
   adicionar mini avatar (28px) ao lado do label "Laura Finance" para reforçar
   que ela é a interface.

3. **`CTAFinal.tsx`** (linha 37-74).
   Bloco final de conversão. Adicionar Laura grande (200×200px desktop /
   140×140 mobile) à esquerda do bloco de texto, com halo intenso violet→fuchsia
   e ring violeta. Em mobile, vira topo centralizado. Headline "Pronto para
   assumir o controle?" passa a ter rosto que olha pra você.

4. **`AppSidebar.tsx` — atalho "Falar com Laura"** (linha 197-202).
   Substituir `MessageCircle` (verde) por avatar circular 18px da Laura
   (mesma cor de status verde mantida via ring/dot indicator). Reforça que
   "Laura" não é genérico — é ela.

5. **Dashboard header** (`(dashboard)/layout.tsx:53-58`).
   Próximo ao texto "Laura Finance", adicionar mini avatar 24px (com
   ring fino) — bate o sidebar e dá continuidade.

### Pontos descartados

- `Testimonials.tsx`: cada card é uma pessoa real diferente (Mariana, André…).
  Colocar Laura confunde. Manter avatares de iniciais.
- `TrustBar.tsx`: 4 ícones decorativos, não cabe.
- `TrialBanner.tsx`/`PastDueBanner.tsx`/`EmailVerificationBanner.tsx`: banners
  técnicos. Distrai. Manter intactos.
- PWA icons (`public/icons/icon-*.svg`, manifest): mudar afeta o ícone de
  app instalado. Manter "LF" geométrico para PWA na home screen — é mais
  legível em ícones pequenos. Decisão: avatar é o brand mark visual *na
  UI*; o ícone de app continua sendo o "LF" geométrico.

## Componentes novos

### `LauraAvatar` (`src/components/brand/LauraAvatar.tsx`)

```ts
type LauraAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
type LauraAvatarProps = {
  size?: LauraAvatarSize;     // xs=20, sm=28, md=36, lg=56, xl=80, hero=200
  halo?: boolean;             // glow radial violet→fuchsia atrás
  ring?: "none" | "violet" | "fuchsia" | "subtle";
  priority?: boolean;         // next/image priority (hero/auth)
  className?: string;
  alt?: string;               // default "Laura, sua assistente financeira"
};
```

Renderiza `next/image` recortado em círculo via `overflow-hidden rounded-full`,
com `object-cover object-top` (para não cortar o rosto). Sizes do `next/image`
mapeados por variante. Halo é uma `div` aria-hidden com gradient radial
violet→fuchsia atrás do círculo, com `blur-xl` proporcional ao tamanho.

### `LauraBrandMark` (`src/components/brand/LauraBrandMark.tsx`)

Combina `LauraAvatar size="sm"` + wordmark "Laura Finance" (mesmo gradient e
font-weight do "LauraLogo" interno atual). Recebe `variant="navbar" | "footer"
| "sidebar" | "auth"` para ajustar tamanho do wordmark e espaçamento — a
estrutura do span é exatamente a mesma do código atual, só o ícone muda.

## Assets

- Origem: `/Users/joaovitorzanini/Downloads/Modelo Laura (Laura Finance).png`
  (1254×1254, PNG, transparente, RGB).
- Destino: `laura-pwa/public/brand/laura-portrait.png` (cópia direta — Next.js
  Image otimiza no build em runtime para os tamanhos solicitados).
- Sem geração de webp/avif manual: `next/image` lida com isso via `formats`
  default + `sizes` props.
- `alt` padrão PT-BR: "Laura, sua assistente financeira da Laura Finance".

## Performance / acessibilidade

- `priority` em `Hero` (acima da dobra) e `AuthLayout` (acima da dobra
  imediato).
- `loading="lazy"` (default do `next/image`) nos demais.
- `sizes` por variante para evitar download da imagem 1254px num avatar 28px.
- Tap targets mantidos (≥44×44px envelopam o avatar quando ele é clicável).
- Iconografia `lucide-react` mantida onde já existe (LEI #3) — Laura é
  *adição*, não substituição de ícone funcional (exceto sidebar "Falar com
  Laura" cuja semântica é literalmente Laura).
- Sem violação de ratio: PNG transparente respeita a borda circular sem
  faixa branca.

## Critério de pronto

1. Os 4 "LF" foram substituídos pelo brand mark com a foto.
2. Laura aparece com destaque em Hero, PilarAssistente, CTAFinal, AppSidebar
   "Falar com Laura", Dashboard header.
3. Nenhuma cor/componente/copy do design system foi alterado fora dos pontos
   listados.
4. `pnpm typecheck` e `pnpm lint` verdes.
5. `pnpm dev` carrega Hero/auth com priority sem CLS visível.
6. Tag `phase-19-laura-rosto` aplicada após commit.
