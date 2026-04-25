# Fase 19 — Laura como rosto da marca (Spec v2)

## Contexto

Hoje a marca usa um quadrado gradiente violet→fuchsia com as letras "LF" como
brand mark, em 4 lugares (`MarketingNavbar`, `MarketingFooter`, `AppSidebar`,
`AuthLayout`). A "Laura" é apenas uma palavra; não tem rosto. O usuário
forneceu uma foto (`/Users/joaovitorzanini/Downloads/Modelo Laura
(Laura Finance).png`, 1254×1254 PNG transparente, busto profissional, blazer
violeta + blusa rosada — já casa com a paleta primária `#7C3AED`/violet→
fuchsia→rose) e quer que essa personagem ganhe vida tanto na LP quanto na
plataforma interna pós-login.

## Não negociáveis (restrições do usuário)

- **NÃO mudar** cores, componentes existentes, tipografia, espaçamento
  estrutural, layout de seções, copy. Apenas adicionar a foto + efeitos
  visuais.
- **A foto NÃO entra crua.** Sempre acompanhada de tratamento que case com o
  design system (halo radial violet→fuchsia, ring, glow, blur). Variação
  de tamanho conforme contexto.
- PT-BR em todos `alt` e legendas.
- LEI #3 do CLAUDE.md: dark mode first-class, lucide-react para ícones
  funcionais, sem emoji em UI estrutural, tap targets ≥44px.

## Objetivo

A Laura passa a ser presença visual reconhecível e contínua. O usuário
associa a foto à marca em qualquer ponto do funil (LP → signup → plataforma
interna), e percebe que "falar com a Laura" tem rosto.

## Inventário — 11 pontos de aplicação

### A. Brand mark (substitui "LF") — 4 pontos

| Local | Tamanho atual | Tratamento novo |
|---|---|---|
| `MarketingNavbar.tsx:27-44` (`LauraLogo` interno) | size-8 (32px) | Avatar circular 32px + halo gradient violet→fuchsia atrás (blur-md), ring 1px violeta (white/15) |
| `MarketingFooter.tsx:18-29` | size-8 (32px) | Idêntico ao navbar |
| `AppSidebar.tsx:78-80` | size-9 (36px) | Avatar circular 36px + halo blur-md + ring 1px primary/30 |
| `AuthLayout.tsx:24-26` | 72×72px | Avatar circular **96px** + halo violet→fuchsia mais intenso (blur-2xl) + ring 2px white/20. Wordmark "Laura Finance" mantém posição/tamanho. |

### B. Pontos de destaque na LP — 5 pontos

1. **`Hero.tsx` — card flutuante WhatsApp** (linhas 116-150).
   `MessageCircle` no círculo gradient (linha 127-132) → avatar real da Laura
   (32px circular, ring 1px violet/40). O texto "Laura Finance · agora mesmo"
   passa a soar como mensagem dela. Sem mudança no card.

2. **`PilarAssistente.tsx` — header do mockup** (linha 343-374).
   Antes do label "Laura Finance" no header do card direito, adicionar mini
   avatar 28px (ring sutil) reforçando que ela é a interface da plataforma.

3. **`PilarFamilia.tsx` — Laura como hub central** (linhas 26-67 são membros
   João/Maria/Lucas/Clara mandando "Laura, gastei R$..."). Adicionar avatar
   Laura (lg = 56px, halo radial) no centro do mockup do chat/visualização,
   com setas/linhas saindo dela para cada membro — Laura é o hub que recebe
   tudo. Layout interno do mockup é o lugar para tocar; a estrutura da seção
   (header/título) fica intacta. Reuso do componente `LauraAvatar`.

4. **`PilarViagens.tsx` — header do mockup**.
   Mini avatar 28px no header do mockup de orçamento de viagem, alinhado ao
   padrão do `PilarAssistente`.

5. **`CTAFinal.tsx`** (linha 37-74).
   Bloco final de conversão. Adicionar Laura **hero (200×200px desktop, 140×
   140 mobile)** à esquerda do bloco de texto, com halo intenso violet→
   fuchsia (`blur-3xl` radial), ring 2px violet/40. Em mobile vira topo
   centralizado (acima do título). Headline "Pronto para assumir o controle?"
   passa a ter rosto que olha para você.

### C. Plataforma interna — 2 pontos

6. **Dashboard header** (`(dashboard)/layout.tsx:53-58`).
   Mini avatar 24px com ring fino antes do texto "Laura Finance" no top bar
   da plataforma. Continuidade visual com sidebar.

7. **`AppSidebar.tsx` — atalho "Falar com Laura"** (linhas 197-202).
   `MessageCircle` (verde) → avatar circular 20px da Laura. Mantém indicador
   de status verde via `dot` 6px na borda inferior do avatar (substitui a
   cor verde do ícone). Sem mudar texto nem layout do menu.

### D. Pontos descartados (decisão consciente)

- `Testimonials.tsx`: cada card é uma pessoa real diferente. Laura confunde.
- `TrustBar.tsx`: 4 ícones decorativos, não cabe.
- `TrialBanner.tsx`/`PastDueBanner.tsx`/`EmailVerificationBanner.tsx`:
  banners técnicos. Laura distrai. Manter.
- PWA icons (`public/icons/icon-*.svg`, `manifest.json`): trocar afeta o
  ícone de app instalado. "LF" geométrico continua sendo melhor leitura em
  tamanhos PWA pequenos. Decisão: avatar é o brand mark *na UI*; ícone de
  app instalado mantém "LF". (Atualização futura: gerar ícones com avatar
  cropado pode ser fase posterior, fora do escopo aqui.)

## Componentes novos

### `LauraAvatar` (`src/components/brand/LauraAvatar.tsx`)

```ts
type LauraAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
// xs=20  sm=28  md=36  lg=56  xl=96  hero=200 (desktop)
type LauraAvatarProps = {
  size?: LauraAvatarSize;
  halo?: "none" | "soft" | "intense";   // glow radial atrás
  ring?: "none" | "violet" | "subtle" | "primary";
  priority?: boolean;                   // next/image priority
  className?: string;
  alt?: string;                         // default "Laura, sua assistente financeira"
  withStatusDot?: boolean;              // dot verde 6px (sidebar "Falar com Laura")
};
```

Renderiza `next/image` recortado em círculo via wrapper `overflow-hidden
rounded-full`, com `object-cover object-top` (preserva o rosto). Sizes do
`next/image` mapeados por variante via `sizes="..."`. Halo é `div`
aria-hidden com gradient radial violet→fuchsia atrás do círculo, com `blur`
proporcional (md/xl/2xl/3xl). Ring via `ring-N ring-color`.

Animação de entrada: `motion.div` com `initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}` — sutil,
respeita LEI #3 (Framer Motion apenas em elementos de complexidade visual).
Brand mark (xs/sm/md) **não** anima; só lg/xl/hero animam (custo de
JS/render).

### `LauraBrandMark` (`src/components/brand/LauraBrandMark.tsx`)

Combina `LauraAvatar` (sm/md) + wordmark "Laura Finance" (mesmo gradient
white→violet-300→fuchsia-300 do código atual, mesma `font-bold tracking-
tight`). Recebe `variant="navbar" | "footer" | "sidebar" | "auth"` para
ajustar tamanho de avatar/wordmark e espaçamento. Estrutura do span é
exatamente a mesma do `LauraLogo` interno atual; apenas o ícone muda.

## Assets

- Origem: `/Users/joaovitorzanini/Downloads/Modelo Laura (Laura Finance).png`
  (1254×1254, PNG, RGB, transparente).
- Destino: `laura-pwa/public/brand/laura-portrait.png` (cópia direta).
- Sem geração webp/avif manual: `next/image` (Next 16) gera variantes em
  runtime conforme `sizes`.
- `alt` padrão PT-BR: `"Laura, sua assistente financeira da Laura Finance"`.
- Ratio circular: PNG transparente respeita borda sem faixa branca; testar
  em fundo `#0A0A0F` para garantir 0 halo branco residual (caso haja, usar
  `mix-blend-multiply` ou ajustar via Photoshop — cópia inicial direta
  primeiro, validar visualmente no `pnpm dev`).

## Performance / acessibilidade

- `priority={true}` em Hero (acima da dobra) e AuthLayout. Demais usam
  default lazy.
- `sizes` corretos por variante para que o `next/image` não baixe a imagem
  de 1254px num avatar de 28px:
  - xs/sm: `sizes="32px"` (acaba pegando ~64px @2x)
  - md: `sizes="48px"`
  - lg: `sizes="80px"`
  - xl: `sizes="128px"`
  - hero: `sizes="(min-width: 768px) 256px, 160px"`
- Tap targets mantidos (≥44×44px envelopam o avatar quando ele é clicável,
  via `min-h-11` no `<Link>` parent já existente).
- Iconografia `lucide-react` mantida onde já existe; Laura é *adição*, não
  substituição de ícone funcional. Exceções autorizadas pelo escopo:
  Hero `MessageCircle` (assinante WhatsApp), `AppSidebar` "Falar com Laura"
  — semântica é literalmente a Laura.
- Compatibilidade dark mode confirmada: blazer/blusa da foto batem com
  paleta do site; halo violet→fuchsia atrás amplifica integração visual em
  vez de competir.

## Critério de pronto

1. Os 4 "LF" foram substituídos pelo `LauraBrandMark`.
2. Laura tem destaque em Hero (msg WhatsApp), PilarAssistente (header
   mockup), PilarFamilia (hub central), PilarViagens (header mockup),
   CTAFinal (200px com halo).
3. Plataforma interna: avatar no header do dashboard + avatar no atalho
   "Falar com Laura".
4. Nenhuma cor/componente/copy do design system foi alterado fora dos
   pontos listados.
5. `pnpm typecheck` e `pnpm lint` verdes.
6. `pnpm dev` carrega Hero/auth com `priority` sem CLS visível e sem
   halo branco residual em volta da foto.
7. Tag `phase-19-laura-rosto` aplicada após commit.
