# Fase 19 — Laura como rosto da marca (Spec v3 — final)

## Contexto

Hoje a marca usa um quadrado gradiente violet→fuchsia com as letras "LF" como
brand mark, em 4 lugares (`MarketingNavbar`, `MarketingFooter`, `AppSidebar`,
`AuthLayout`). A "Laura" é apenas uma palavra; não tem rosto.

O usuário forneceu uma foto (`/Users/joaovitorzanini/Downloads/Modelo Laura
(Laura Finance).png`, 1254×1254 PNG transparente, busto profissional, blazer
violeta + blusa rosada — já casa com a paleta primária `#7C3AED`/violet→
fuchsia→rose) e quer que essa personagem ganhe vida tanto na LP quanto na
plataforma interna pós-login. A LP e a plataforma devem virar "um só
produto" com a Laura como assinatura visual contínua.

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

## Inventário — 9 pontos de aplicação (validado)

### A. Brand mark (substitui "LF") — 4 pontos

| Local | Tamanho | Tratamento |
|---|---|---|
| `MarketingNavbar.tsx:27-44` (`LauraLogo` interno) | avatar 32px | halo violet→fuchsia `blur-md` atrás + ring 1px `white/15` |
| `MarketingFooter.tsx:18-29` | avatar 32px | idêntico ao navbar |
| `AppSidebar.tsx:78-80` | avatar 36px | halo `blur-md` + ring 1px `primary/30` |
| `AuthLayout.tsx:24-26` | avatar **96px desktop / 80px mobile** | halo intenso `blur-2xl` + ring 2px `white/20`, mantém shadow `shadow-fuchsia-500/30` no wrapper |

### B. Pontos de destaque na LP — 4 pontos

1. **`Hero.tsx` — card flutuante WhatsApp** (linhas 116-150).
   `MessageCircle` no círculo gradient (linhas 127-132) → avatar real da
   Laura **(32px circular, ring 1px violet/40, sem halo — o card já tem
   shadow violeta)**. O texto "Laura Finance · agora mesmo" passa a soar
   como mensagem dela. **`priority={true}`** porque está acima da dobra.
   Sem outras mudanças no card.

2. **`PilarAssistente.tsx` — header do mockup** (linha 343-374).
   Antes do label "Laura Finance" no header do card direito, adicionar
   mini avatar **28px** (ring sutil, sem halo) reforçando que ela é a
   interface da plataforma.

3. **`PilarFamilia.tsx` — header do painel da família** (linha 364-368).
   Antes do label "Laura Finance · Família" no painel direito, adicionar
   mini avatar **28px** (ring sutil, sem halo). Mantém o layout intacto.
   *(Decisão consciente: NÃO adicionar bolha de resposta da Laura nas
   mensagens da esquerda para evitar inflar escopo e quebrar a animação
   de stagger atual.)*

4. **`PilarViagens.tsx` — header do mockup**.
   Mini avatar **28px** no header do card de orçamento de viagem,
   alinhado ao padrão do `PilarAssistente`/`PilarFamilia`.

### C. CTA Final + plataforma interna — 3 pontos

5. **`CTAFinal.tsx`** (linhas 37-74).
   Bloco final de conversão. Adicionar Laura **160px desktop / 120px
   mobile centralizada acima do badge "Experimente sem compromisso"**,
   com halo `intense` (gradient radial violet→fuchsia→rose, `blur-3xl`,
   maior que o avatar) e ring 2px `violet/40`. Não compete com headline;
   acrescenta rosto à promessa "assumir o controle". `priority={false}`
   (abaixo da dobra), animação `motion` fade+scale ao entrar no viewport.

6. **Dashboard header** (`(dashboard)/layout.tsx:53-58`).
   Mini avatar **24px** com ring fino antes do texto "Laura Finance" no
   top bar da plataforma. Continuidade visual com sidebar.

7. **`AppSidebar.tsx` — atalho "Falar com Laura"** (linhas 197-202).
   `MessageCircle` (verde, h-4 w-4) → avatar circular **20px** da Laura.
   Mantém indicador de status verde via dot 6px no canto inferior direito
   do avatar (substitui a cor verde do ícone). Sem mudar texto nem
   estrutura do menu.

### D. Pontos descartados (decisão consciente, documentada)

- `Testimonials.tsx`: cada card é uma pessoa real diferente.
- `TrustBar.tsx`: 4 ícones decorativos.
- `TrialBanner` / `PastDueBanner` / `EmailVerificationBanner`: técnicos.
- PWA icons (`public/icons/icon-*.svg`, `manifest.json`): mexer afeta o
  ícone do app instalado. "LF" geométrico mantém leitura em ícones
  pequenos. Avatar é o brand mark *na UI*; ícone de app instalado
  permanece "LF". (Atualização do PWA icon pode ser fase posterior.)

## Componentes novos

### `LauraAvatar` (`src/components/brand/LauraAvatar.tsx`)

```ts
type LauraAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
// xs=20  sm=28  md=36  lg=56  xl=96  hero=160 (desktop) / 120 (mobile)
type HaloIntensity = "none" | "soft" | "intense";
type RingStyle = "none" | "violet" | "subtle" | "primary";

type LauraAvatarProps = {
  size?: LauraAvatarSize;
  halo?: HaloIntensity;
  ring?: RingStyle;
  priority?: boolean;
  className?: string;
  alt?: string;                  // default "Laura, sua assistente financeira"
  withStatusDot?: boolean;       // dot verde 6px (sidebar "Falar com Laura")
  animate?: boolean;             // fade+scale ao montar (default false; true em hero)
};
```

Implementação:
- Wrapper `relative inline-flex` com tamanho do avatar como dimensão
  externa (ring não conta no flow).
- Halo: `div aria-hidden absolute -inset-N rounded-full bg-[radial-
  gradient(...)] blur-N opacity-N`. Inset/blur escalam com size:
  - soft: `-inset-2 blur-md opacity-70`
  - intense: `-inset-6 blur-3xl opacity-90` (size hero/xl)
- Ring via `ring-N ring-color`:
  - violet: `ring-2 ring-violet-500/40`
  - subtle: `ring-1 ring-white/15`
  - primary: `ring-1 ring-primary/30`
- Avatar: `next/image` em wrapper `overflow-hidden rounded-full` com
  `object-cover object-top` (preserva o rosto).
- `sizes` por variante:
  - xs/sm: `40px`
  - md: `56px`
  - lg: `96px`
  - xl: `128px`
  - hero: `(min-width: 768px) 224px, 168px`
- Status dot: `absolute bottom-0 right-0 size-1.5 rounded-full bg-emerald-
  400 ring-1 ring-[#0A0A0F]` (apenas se `withStatusDot`).
- Animação: `motion.div` apenas quando `animate=true`, com `initial={{
  opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.35 }}`. Brand mark (xs/sm/md) **nunca**
  anima — performance.

### `LauraBrandMark` (`src/components/brand/LauraBrandMark.tsx`)

```ts
type LauraBrandMarkVariant = "navbar" | "footer" | "sidebar" | "auth";
type LauraBrandMarkProps = {
  variant: LauraBrandMarkVariant;
  className?: string;
};
```

Mapeamento por variant:
- `navbar`: avatar `sm` (32px) halo `soft` ring `subtle` + wordmark
  `text-xl font-bold` (igual ao atual).
- `footer`: avatar `sm` (32px) halo `soft` ring `subtle` + wordmark
  `text-lg font-bold` (igual ao atual).
- `sidebar`: avatar `md` (36px) halo `soft` ring `primary` + texto
  "Laura Finance" + sublinha "Gestão Inteligente" (igual ao atual).
- `auth`: avatar `xl` (96px desktop / 80px mobile via responsive class)
  halo `intense` ring `subtle` + wordmark `text-lg font-semibold` (igual
  ao atual). `priority=true`.

O wordmark e estrutura do span são exatamente os existentes; só o ícone
muda do quadrado "LF" para `<LauraAvatar />`.

## Assets

- Origem: `/Users/joaovitorzanini/Downloads/Modelo Laura (Laura Finance).png`
  (1254×1254, PNG, RGB, transparente).
- Destino: `laura-pwa/public/brand/laura-portrait.png` (cópia direta).
- Sem geração webp/avif manual: `next/image` (Next 16) gera variantes em
  runtime conforme `sizes`.
- `alt` padrão PT-BR: `"Laura, sua assistente financeira da Laura Finance"`.
- Validação visual no `pnpm dev` para confirmar 0 halo branco residual em
  fundo `#0A0A0F` (PNG transparente já é fim do alfa, mas se tiver fringe
  cuidado: usar `mix-blend-luminosity` ou ajustar mask se necessário).

## Performance / acessibilidade

- `priority={true}` em Hero (avatar do card WhatsApp) e AuthLayout (acima
  da dobra). Demais usam default lazy.
- `sizes` corretos por variante (ver acima).
- Tap targets mantidos (≥44×44px envelopam o avatar quando ele é clicável,
  via `min-h-11` no `<Link>` parent já existente).
- Iconografia `lucide-react` mantida onde já existe; Laura é *adição*, não
  substituição de ícone funcional. Exceções autorizadas pelo escopo:
  Hero `MessageCircle` (assinante WhatsApp = Laura), `AppSidebar` "Falar
  com Laura" (semântica é literalmente a Laura).
- Compatibilidade dark mode confirmada: blazer/blusa da foto batem com
  paleta do site; halo violet→fuchsia atrás amplifica integração visual.

## Critério de pronto

1. Os 4 "LF" foram substituídos pelo `LauraBrandMark`.
2. Laura tem destaque em Hero (msg WhatsApp), PilarAssistente
   (header mockup), PilarFamilia (header painel), PilarViagens (header
   mockup), CTAFinal (160/120px com halo intenso).
3. Plataforma interna: avatar no header do dashboard + avatar no atalho
   "Falar com Laura" (com status dot verde).
4. Nenhuma cor/componente/copy do design system foi alterado fora dos
   pontos listados.
5. `pnpm typecheck` e `pnpm lint` verdes.
6. `pnpm dev` carrega Hero/auth com `priority` sem CLS visível e sem
   halo branco residual em volta da foto.
7. Tag `phase-19-laura-rosto` aplicada após commit final.
