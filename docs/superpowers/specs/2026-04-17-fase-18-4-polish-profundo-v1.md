# Fase 18.4 — Polish profundo LP + Auth + Responsividade (Spec v1)

## Objetivo
Segunda rodada de polish após feedback extenso do usuário. Corrigir cada ponto levantado sem deixar nada passar. 10 áreas de mudança — organizadas abaixo.

## 1. Hero / TrustBar (1 item)

### 1.1 — 4º chip do TrustBar
- Hoje: `"IA que te entende"` com ícone `Brain`.
- Ação: **manter a copy "IA que te entende"** mas **voltar o ícone anterior** (antes era `Sparkles` segundo git history).
- Verificar `git log --follow laura-pwa/src/components/marketing/TrustBar.tsx` para confirmar e escolher o ícone pré-mudança.

## 2. PilarAssistente (5 itens)

### 2.1 — Scroll-triggered grow
Quando a seção entra em viewport, aplicar `scale(0.95) → scale(1)` suave + `opacity(0.85) → opacity(1)` usando `motion.section` com `whileInView` + `viewport={{ once: true, margin: "-120px" }}`. O card do dashboard interativo cresce de forma levemente mais pronunciada que o texto, criando efeito "entrando em foco".

### 2.2 — Botão/CTA chamariz pulsante
Na frase "Experimente os filtros" (ou em um badge ao lado do card), adicionar animação pulsante sutil `animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}` loop 2s — convida o usuário a interagir. Alternativa: setinha lucide `MousePointerClick` piscando.

### 2.3 — Pizza maior + valor centralizado
Hoje o valor central do gráfico toca as bordas do pie. Aumentar o SVG de pizza em ~20% (radius maior) e reduzir o buraco central relativo. O texto do total fica com `dominantBaseline="middle"` e `textAnchor="middle"` em fonte menor para caber dentro sem pegar bordas.

### 2.4 — Listar transações da categoria selecionada
Quando o usuário clica num tab (`Alimentação`, `Transporte`, `Lazer`, `Moradia`), além de destacar a fatia e animar barras de Top Categorias, **mostrar uma lista de descritivos** reais abaixo:
- **Alimentação**: "Mercado — R$ 380,00", "iFood — R$ 220,00", "Restaurantes — R$ 310,00", "Padaria — R$ 85,00", "Delivery — R$ 245,00".
- **Transporte**: "Uber/99 — R$ 180,00", "Combustível — R$ 420,00", "Estacionamento — R$ 60,00", "Pedágio — R$ 40,00".
- **Lazer**: "Cinema — R$ 90,00", "Bares — R$ 220,00", "Streaming — R$ 54,00", "Esportes — R$ 160,00".
- **Moradia**: "Aluguel — R$ 1.800,00", "Condomínio — R$ 480,00", "Energia — R$ 210,00", "Internet — R$ 99,00".
- **Todas**: mostrar uma lista consolidada top-5 das categorias.

Animação: `AnimatePresence` com `mode="wait"` entre transições.

### 2.5 — Planilha: coluna "Mês" → "Data"
Planilha "antiga feia" à esquerda hoje tem coluna "Mês" com valores inconsistentes (janeiro/janeiro/fevereiro/fevereiro). Trocar:
- Header: `Mês` → `Data`.
- Linhas: datas DD/MM/YYYY dentro de abril/2026 variando: 02/04/2026, 05/04/2026, 08/04/2026, 11/04/2026, 14/04/2026, 17/04/2026, 21/04/2026, 24/04/2026 (8 linhas).
- Colunas Gasto e Categoria mantêm — só dados atualizados para bater com as datas.

## 3. PilarFamilia (5 itens)

### 3.1 — Renomear título
"Gestão familiar de verdade." → **"Gestão familiar."** (remover "de verdade").

### 3.2 — Subcopy em 1 linha
"Cada membro lança seu gasto pelo WhatsApp ou app. Você acompanha a família toda em um só painel." → garantir que renderize em **1 linha** no desktop (`md:whitespace-nowrap` + reduzir tamanho fonte se necessário ou aumentar `max-w` do container texto). Mobile pode quebrar naturalmente.

### 3.3 — Remover losangulo nos balões WhatsApp
Cada balão de mensagem tem um pequeno losangulo antes do rótulo (provavelmente `◆` ou um span rotacionado decorativo). Localizar e remover. Header do balão deve ficar apenas: ícone verde/emerald discreto + "WhatsApp · <nome>".

### 3.4 — Ao clicar membro: gráfico de barras (não lista filtrada)
Comportamento atual: filtra a lista de transações. Novo: ao clicar num dos 4 membros (João, Maria, Lucas, Clara), **renderizar gráfico de barras horizontais** com gastos por categoria DAQUELE membro (categorias: Alimentação, Transporte, Lazer, Moradia, Viagem, Pessoal). Cada barra com valor em R$ à direita. Usar categorias reais da plataforma.

Valores seed por membro (exemplo):
- **João**: Alimentação R$ 320 (inclui os R$ 150 do mercado), Transporte R$ 140, Lazer R$ 80, Moradia R$ 900, Pessoal R$ 60.
- **Maria**: Alimentação R$ 260, Transporte R$ 180, Lazer R$ 120, Moradia R$ 800, Pessoal R$ 95.
- **Lucas**: Alimentação R$ 90, Transporte R$ 40, Lazer R$ 150, Pessoal R$ 110.
- **Clara**: Alimentação R$ 180, Lazer R$ 70 (o cinema), Pessoal R$ 150, Transporte R$ 35.

Quando "Todos" selecionado, volta ao painel consolidado atual.

### 3.5 — Transições suaves
Usar `motion.div` com `layout` + `AnimatePresence mode="wait"` e durations ~250–350ms + easing `ease-out` para entrada e `ease-in` para saída. Evitar mudança brusca. Ajustar valores:
- Clara cinema: R$ 150 → R$ 70.
- João mercado: R$ 85 → R$ 150.

## 4. PilarViagens (3 itens)

### 4.1 — Scroll-triggered grow + botão pulsante
Mesmo efeito do 2.1 + 2.2 aplicado aqui. Card cresce, algum elemento (ícone de ação ou chip) pulsa sutil para convidar à interação.

### 4.2 — Cores do sidebar iguais às tabs do Pilar 1
Consistência entre infográficos interativos: os botões do sidebar ("Orçamento", "Gastos por dia", "Por categoria", "Conversão") devem usar **a mesma paleta** dos tabs do PilarAssistente (provavelmente tabs com `bg-violet-500` ativo / `bg-white/5` inativo ou similar). Extrair os estilos dos tabs e aplicar.

### 4.3 — Transições mais suaves entre views
Ao trocar de view no sidebar, transição com `AnimatePresence mode="wait"` + duração 300ms + easing suave. Hoje está "grosseira/brusca".

## 5. Pricing / PricingClient (6 itens)

### 5.1 — Copy de benefícios claros
Substituir a subcopy única atual ("Assine quando quiser — os 7 primeiros dias são por nossa conta.") por:
- Título: "Escolha seu plano" (mantém).
- Subcopy curta sem travessão: "7 dias grátis em todos os planos. Sem cartão, sem pegadinha."
- **3 tags** sutis abaixo da subcopy (ícones lucide sutis + texto curto):
  - `CreditCardOff` — "Sem cartão"
  - `Zap` — "Acesso imediato"
  - `XCircle` — "Cancele quando quiser"

### 5.2 — Remover travessão
Zero travessões na seção pricing.

### 5.3 — Plano Básico → Plano Trial
- Renomear card "Básico" para **"Trial"** (ou "Teste grátis").
- Copy curta em vez de lista de features: uma única frase forte tipo "Experimente a Laura Finance VIP por 7 dias. Sem cartão, sem custo."
- Abaixo, 3–4 bullet points resumidos (diferente do VIP — não copiar features):
  - "Todos os recursos do VIP liberados"
  - "Até 6 membros"
  - "WhatsApp ilimitado (texto, áudio, imagem)"
  - "Modo viagem + Open Finance"
- CTA: "Comece grátis agora" (gradient violet→fuchsia).
- Link: `/register?plan=trial` (slug novo; precisa ser inserido no DB).

### 5.4 — Default = Anual
`useState<Billing>("yearly")` como default. Se `anyYearly && anyMonthly`, começa "yearly".

### 5.5 — Sempre 2 cards mesmo tamanho
Grid sempre `grid-cols-1 sm:grid-cols-2` com cards em `w-full`. Quando toggle muda, só o conteúdo do card VIP muda (valor, sublegenda). O card Trial **sempre** aparece como primeiro card, tanto no mensal quanto no anual — é o mesmo card.

### 5.6 — VIP anual 12× R$ 19,90 / R$ 199,90 no Pix
- `price_cents_yearly` vira **19990** (R$ 199,90).
- Display anual: "12× R$ 19,90" grande + "R$ 199,90 à vista no Pix" abaixo.
- Mensal (default no toggle? Não — default Anual, mas toggle mostra ambos): **R$ 29,90/mês**.
- Atualizar DB prod via SQL.

## 6. Testimonials (2 itens)

### 6.1 — +3 depoimentos (total 6)
Adicionar 3 novos depoimentos variados:
- Família que organizou finanças.
- Usuário que usou Modo Viagem.
- Usuário que tirou foto de cupom fiscal no WhatsApp e IA reconheceu.

### 6.2 — Carrossel horizontal scrollable
Lista horizontal com overflow-x-auto (scroll snap) + suporte a drag no desktop (motion.div com `drag="x"`) + swipe nativo mobile. Indicadores opcionais (pontos).

## 7. Navbar (3 itens)

### 7.1 — "Recursos" → nome melhor
Opções: "Pilares", "Produto", "O que tem". **Decisão: "Pilares"** (reflete a narrativa da LP).

### 7.2 — Adicionar "Depoimentos"
Novo item entre "Planos" e "FAQ". Âncora `#depoimentos` no componente Testimonials.

### 7.3 — Botão "Entrar" outline
Em vez de ghost atual, **outline com contorno** (border violet-500, texto violet-200). Hover: preenche levemente (`bg-violet-500/10`) ou efeito shine. Mantém tamanho e tap 44×44.

## 8. Login (3 itens)

### 8.1 — Logo LF 2× maior
Dobrar tamanho do quadrado gradient + texto "LF" dentro do logo do login page.

### 8.2 — Novo slogan
Hoje: "gestão financeira inteligente via WhatsApp" (se existir nessa tela). Substituir por algo alinhado ao novo positioning. Sugestão: "Sua plataforma financeira completa.". Curto e direto.

### 8.3 — Responsividade mobile/tablet
Revisar paddings, tamanhos de fonte e altura de componentes em breakpoints `sm` e `md`. Garantir que na viewport 375px e 768px o card cabe sem scroll horizontal e com margens adequadas.

## 9. SignupWizard responsividade

Revisar cada step:
- Progress bar cabe bem em mobile.
- Padding responsivo (`p-4 sm:p-6 md:p-8`).
- Inputs altura reduzida em mobile (`h-11` sempre; se precisar espaçamento menor entre campos, usar `space-y-3 sm:space-y-4`).
- OTPCodeInput: 6 boxes podem ficar apertadas em 320px — garantir `w-10 h-12 sm:w-12 sm:h-14`.

## 10. Plataforma inteira responsiva (escopo amplo)

Verificação mínima:
- Landing page (3 pilares) em mobile: infográficos empilham, interações touch funcionam.
- Dashboard PWA: já é responsive (dashboard existente), mas fazer regression quick check.
- Auth telas: 375px / 768px / 1024px sem overflow.

Fora de escopo desta fase: refactor completo de componentes da plataforma. Entregar responsividade específica de LP + auth.

---

## Entregáveis

1. Migration/SQL update em `subscription_plans` com:
   - Novo slug **`trial`** (plano "Trial"), price_cents=0, monthly_enabled=true, yearly_enabled=false, features curtas.
   - VIP com `price_cents_yearly=19990` (de 29990), `price_cents_yearly_discount` pode ser NULL ou manter 19990.
2. Código PWA modificado (13+ arquivos marketing + auth).
3. `pnpm typecheck && pnpm lint && pnpm build` verde.
4. Deploy prod via push master.
5. Tag `phase-18-4-deployed`.

## Fora de escopo

- Redesign do dashboard principal da plataforma (mantém o existente).
- Mudanças no backend Go (exceto o SQL update via workflow).
- Mudanças em emails/templates.
