# Fase 18.4 — Polish profundo LP + Auth + Responsividade (Spec v2 — final)

> v2 incorpora self-review: (a) resolveu placeholder do ícone (Sparkles confirmado via git history); (b) mantém slug DB `standard`, só altera display para "Trial"; (c) explicita layout de cards iguais (w-full + auto-rows-fr); (d) extrai estilos dos tabs do Pilar 1 como referência para sidebar do Pilar 3; (e) clarifica listas de transações e gráfico de barras.

## Objetivo
Segunda rodada de polish após feedback extenso do usuário. Corrigir cada ponto levantado sem deixar nada passar. 10 áreas de mudança agrupadas abaixo.

## 1. Hero / TrustBar

### 1.1 — 4º chip: voltar ícone `Sparkles`
Hoje: `{ icon: Brain, text: "IA que te entende" }`.
Ação: manter texto "IA que te entende", **voltar ícone para `Sparkles`** (confirmado via git log: antes era `Sparkles` com "IA treinada para o PT-BR"; texto mudou em 18.3, ícone mudou junto e não deveria).

## 2. PilarAssistente (5 itens)

### 2.1 — Scroll-triggered grow
Envelopar a `<section>` com `motion.section` ou `motion.div` interno:
- `initial={{ scale: 0.96, opacity: 0.85 }}`
- `whileInView={{ scale: 1, opacity: 1 }}`
- `viewport={{ once: true, margin: "-120px" }}`
- `transition={{ duration: 0.5, ease: "easeOut" }}`

O card do dashboard interativo (direita) tem scale mais pronunciado que o texto (esquerda):
- Texto: `0.98 → 1`.
- Card: `0.94 → 1` com atraso 100ms.

### 2.2 — Chamariz pulsante
Badge/chip visível no card do dashboard com animação convidativa:
```tsx
<motion.span
  animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
  className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-200"
>
  <MousePointerClick className="size-3.5" /> Experimente os filtros
</motion.span>
```
Posicionado no top-right do card ou acima da lista de tabs.

### 2.3 — Pizza maior + valor centralizado
- Aumentar radius do SVG circle de `~70px` para `~92px` (ou equivalente).
- Reduzir buraco central (donut hole) — aumentar `innerRadius` proporcional para manter estética.
- Texto total centralizado: `<text dominantBaseline="middle" textAnchor="middle" fontSize="16" fontWeight="600">` dentro de bounding box ≤ 60% do diâmetro para NÃO tocar as fatias.
- Valor em formato `R$ 1.240` ou equivalente em fonte que cabe no centro.

### 2.4 — Listar transações descritivas ao clicar categoria
Quando tab clicada → além de destacar fatia + reordenar barras de Top Cats, mostrar **lista vertical** abaixo do gráfico (ou ao lado, conforme layout):
```
<AnimatePresence mode="wait">
  <motion.ul key={selectedCategory} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-4}} transition={{duration:0.25}}>
    {TRANSACTIONS[selectedCategory].map(tx => (
      <li><span>{tx.name}</span><span>R$ {tx.amount}</span></li>
    ))}
  </motion.ul>
</AnimatePresence>
```
Dados seed por categoria:
- **Todas** (default): top 5 categorias consolidadas — "Moradia R$ 1.800", "Alimentação R$ 1.240", "Transporte R$ 700", "Lazer R$ 524", "Outros R$ 380".
- **Alimentação**: "Mercado R$ 380,00", "iFood R$ 220,00", "Restaurantes R$ 310,00", "Padaria R$ 85,00", "Delivery R$ 245,00".
- **Transporte**: "Combustível R$ 420,00", "Uber/99 R$ 180,00", "Estacionamento R$ 60,00", "Pedágio R$ 40,00".
- **Lazer**: "Bares R$ 220,00", "Esportes R$ 160,00", "Cinema R$ 90,00", "Streaming R$ 54,00".
- **Moradia**: "Aluguel R$ 1.800,00", "Condomínio R$ 480,00", "Energia R$ 210,00", "Internet R$ 99,00".

### 2.5 — Planilha "antiga feia": coluna Mês → Data
- Header: `Mês` → `Data`.
- Linhas com 8 datas abril/2026: `02/04/2026`, `05/04/2026`, `08/04/2026`, `11/04/2026`, `14/04/2026`, `17/04/2026`, `21/04/2026`, `24/04/2026`.
- Colunas `Gasto` e `Categoria` permanecem; atualizar valores para bater com as datas (coerente com dados de abril).

## 3. PilarFamilia (5 itens)

### 3.1 — Título
`Gestão familiar de verdade.` → **`Gestão familiar.`**

### 3.2 — Subcopy em 1 linha
Full texto: "Cada membro lança seu gasto pelo WhatsApp ou app. Você acompanha a família toda em um só painel."
- Aplicar `md:whitespace-nowrap` + `max-w-none md:max-w-[64rem]` no container para caber em 1 linha no desktop.
- Mobile pode quebrar naturalmente (mantém `whitespace-normal` no mobile via reset).

### 3.3 — Remover losangulo nos balões WhatsApp
Header do balão hoje tem algum adorno decorativo (losangulo `◆` ou SVG rotacionado) antes do label "WhatsApp". Remover esse elemento em todos os 4 balões. Header final deve ser apenas:
```tsx
<div className="flex items-center gap-2 text-xs text-white/70">
  <MessageCircle className="size-3.5 text-emerald-300" />
  <span>WhatsApp · {memberName}</span>
</div>
```

### 3.4 — Ao clicar membro: gráfico de barras horizontais por categoria
Layout do card principal muda para:
```
Nome do membro selecionado (ex.: João)
───────────────────────────────
Alimentação  ████████████████  R$ 320,00
Transporte   ██████████         R$ 140,00
Lazer        █████              R$ 80,00
Moradia      █████████████████  R$ 900,00
Pessoal      ███                R$ 60,00
───────────────────────────────
Total        R$ 1.500,00
```
Barras horizontais: largura proporcional ao maior valor do membro. Cor violet/fuchsia gradient. Valor à direita tabular-nums.

Valores seed:
- **João**: Alimentação 320 (R$ 150 mercado + R$ 95 iFood + R$ 75 restaurante), Transporte 140, Lazer 80, Moradia 900, Pessoal 60. Total 1500.
- **Maria**: Alimentação 260, Transporte 180, Lazer 120, Moradia 800, Pessoal 95. Total 1455.
- **Lucas**: Alimentação 90, Transporte 40, Lazer 150, Pessoal 110. Total 390.
- **Clara**: Alimentação 180, Lazer 70 (cinema R$ 70), Pessoal 150, Transporte 35. Total 435.

Seletor "Todos" volta ao painel consolidado atual.

### 3.5 — Transições suaves
- `AnimatePresence mode="wait"` entre views (Todos → membro).
- Duration 280ms entrada, 200ms saída. Easing `[0.2, 0.8, 0.2, 1]` (mais suave que `easeOut`).
- Evitar layout shift brusco — preserva altura do card com `min-h-[24rem]`.

Ajustes de valores nos balões existentes:
- Clara cinema: R$ 150 → **R$ 70**.
- João mercado: R$ 85 → **R$ 150**.

## 4. PilarViagens (3 itens)

### 4.1 — Scroll-triggered grow + chamariz pulsante
Mesmo pattern do 2.1 e 2.2. Chip pulsante no card principal: "Navegue pelos relatórios" ou "Experimente as abas".

### 4.2 — Cores do sidebar = tabs do Pilar 1 (consistência)
**Extrair** estilo exato dos tabs do PilarAssistente. Estilo provável:
- Ativo: `bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md`
- Inativo: `bg-white/5 text-zinc-300 hover:bg-white/10`
- Borda/radius consistente.

Aplicar os mesmos classes no sidebar do PilarViagens. Ambos infográficos devem parecer da mesma plataforma.

### 4.3 — Transições suaves entre views
`AnimatePresence mode="wait"` + duração 280ms + easing suave (igual 3.5). Mantém altura mínima do card.

## 5. Pricing / PricingClient (6 itens)

### 5.1 — Copy + 3 tags benefícios
Subcopy sem travessão:
"7 dias grátis em todos os planos. Sem cartão, sem pegadinha."

3 tags sutis em linha abaixo (mobile stack / desktop row):
- `CreditCardOff` — "Sem cartão"
- `Zap` — "Acesso imediato"
- `XCircle` — "Cancele quando quiser"

### 5.2 — Remover travessão em toda a seção

### 5.3 — Plano "Trial" em vez de "Básico"
- Manter slug DB `standard` (não quebrar integrações).
- Display name no card: **"Trial"**.
- Descrição diferente do VIP (não lista completa):
  - Título chamativo: "Teste tudo por 7 dias".
  - Subcopy 1 linha: "Todos os recursos do VIP liberados, sem cartão."
  - 4 bullets resumidos:
    - "Tudo do VIP por 7 dias"
    - "WhatsApp + app + dashboard"
    - "Modo viagem + Open Finance"
    - "Sem cobrança ao final"
  - Preço: "Grátis por 7 dias" (em vez de R$ 0,00/mês).
- CTA: "Comece grátis agora" (gradient violet→fuchsia).
- Link: `/register?plan=standard&cycle=trial`.

### 5.4 — Default Anual
`const defaultBilling: Billing = "yearly"` — sempre.

### 5.5 — 2 cards sempre, mesmo tamanho
- Grid `grid-cols-1 sm:grid-cols-2` com `gap-6` e `auto-rows-fr` (altura igual entre cards).
- Ambos cards com `w-full`, mesmo padding (`p-6 sm:p-8`), mesmo border radius.
- **Card Trial** à esquerda sempre (sortOrder 1).
- **Card VIP** à direita sempre (sortOrder 2), muda só o conteúdo de preço conforme toggle.
- Trial não aparece/desaparece com toggle — **sempre fixo**. Toggle afeta apenas display do VIP.

### 5.6 — VIP anual: 12× R$ 19,90 / R$ 199,90 no Pix
- DB: `price_cents_yearly = 19990`, `price_cents_yearly_discount = 19990` (Pix mesmo valor à vista).
- Display:
  - Valor grande: "12× **R$ 19,90**"
  - Abaixo: "ou **R$ 199,90** no Pix à vista"
  - Sublabel mensal equivalente (opcional): "R$ 16,66 por mês"

Mensal continua R$ 29,90.

## 6. Testimonials (2 itens)

### 6.1 — +3 depoimentos (total 6)
Novos:
- "Conectei meus bancos e em 2 semanas a família inteira estava lançando gastos no WhatsApp. Acabou a planilha." — Pedro S., analista financeiro
- "Usei o Modo Viagem na nossa lua de mel e voltei sem aquela dor de cabeça do cartão explodindo sem aviso." — Camila L., designer
- "Tirei foto de um cupom de mercado e a IA identificou cada item. Isso mudou meu dia a dia." — Rafael M., empresário

Total 6 com os 3 existentes.

### 6.2 — Carrossel horizontal scrollable
- Container com `overflow-x-auto` + `snap-x snap-mandatory`.
- Cards com `flex-none w-[85%] sm:w-[46%] lg:w-[32%]` + `snap-start`.
- Drag no desktop com `motion.div drag="x" dragConstraints`.
- Swipe nativo no mobile já funciona com overflow.
- Indicadores opcionais (pontos) abaixo.

## 7. Navbar (3 itens)

### 7.1 — "Recursos" → "Pilares"

### 7.2 — "Depoimentos" entre "Planos" e "FAQ"
Adicionar âncora `#depoimentos` no componente Testimonials e link na navbar.

### 7.3 — Botão "Entrar" outline
- `border border-violet-400/60 bg-transparent text-violet-100`
- Hover: `hover:bg-violet-500/15 hover:border-violet-300 transition`
- Mesma altura e tap 44×44.

## 8. Login (3 itens)

### 8.1 — Logo LF 2× maior
Quadrado gradient atual é ~40×40. Aumentar para 72×72 ou 80×80 com `text-lg` dentro.

### 8.2 — Novo slogan
Atual: "gestão financeira inteligente via WhatsApp" (se existir na página login).
Novo: **"Sua plataforma financeira completa."**

### 8.3 — Responsividade mobile/tablet
- Card `w-full max-w-md` com `px-4 sm:px-6 md:px-8` no container externo.
- Espaçamentos `space-y-4 sm:space-y-5`.
- Garantir em 320px e 375px sem overflow.

## 9. SignupWizard responsividade

- Progress bar 3 passos cabe em 320px.
- OTPCodeInput: boxes `w-10 h-12 sm:w-12 sm:h-14` (reduzir mobile).
- Card max-width `max-w-md` + padding responsivo `p-5 sm:p-8`.
- Inputs sempre `h-11` (tap 44px).

## 10. Plataforma responsiva (escopo amplo — quick check)

- LP em mobile: seções empilham, infográficos touch funcionam.
- Auth em 375px, 768px, 1024px sem overflow.
- Regression mental check no dashboard (já é responsive).

---

## Entregáveis

1. **SQL update prod** em `subscription_plans`:
   - Plano `standard`: name="Trial", price_cents=0, features novas (trial-focus), monthly_enabled=true, yearly_enabled=false.
   - Plano `vip`: price_cents_yearly=19990, price_cents_yearly_discount=19990.
2. **Código PWA modificado**: Hero, TrustBar, PilarAssistente, PilarFamilia, PilarViagens, PricingClient, Testimonials, MarketingNavbar, MarketingFooter (âncora depoimentos), `(auth)/login/page.tsx`, `(auth)/layout.tsx`, `SignupWizard.tsx`, CTAFinal (remover travessões se houver).
3. Verificação: `pnpm typecheck && pnpm lint && pnpm build` verde.
4. Deploy prod + smoke + tag `phase-18-4-deployed`.

## Fora de escopo
- Dashboard interno completo.
- Backend Go (só SQL via workflow existente).
- Templates email.
