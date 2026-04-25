# Fase 19.3 — Laura fix completo (Spec v1)

## Contexto e bugs descobertos

Após Fase 19.2 deployed, usuário enviou 4 prints + feedback duro:

1. **Foto não foi atualizada de fato.** Hash MD5 da `public/brand/laura-
   portrait.png` em prod (`27062d743b2a...`, 1.28MB) **difere** do
   `Modelo Laura 3 (Laura Finance).png` original (`0699e38ed108...`,
   2.10MB). Causa raiz: `Image.save(optimize=True)` do Pillow recodificou
   a imagem na 19.2, alterando os bytes. Visualmente parece igual mas
   não é a foto literal que o usuário enviou.
2. **Xadrez nos avatares circulares pequenos** (sidebar header, dashboard
   top bar, atalho "Falar com Laura"). Causa raiz: removi o
   `bg-gradient-to-br` do wrapper de `LauraAvatar` na 19.1 para
   resolver xadrez do PNG antigo (que tinha alpha parcial nas bordas).
   Com a Modelo Laura 3 (RGBA limpa), as bordas ainda têm fios de
   cabelo com alpha parcial — sem nenhum bg sólido atrás, vaza
   o que está abaixo do componente. Em alguns containers (sidebar
   header com fundo `oklch(0.985 0 0)` no light mode? não, é dark mas
   o screenshot mostra padrão de transparência).
3. **Breathing animation** (`scale 1 → 1.018 → 1` em 5s) está visível
   o suficiente pra usuário descrever como "ficar pulando, flutuando,
   parece de jogo". Float Y já foi removido na 19.2; agora preciso
   matar o breathing também.
4. **AuthLayout**: Laura "muito atrás do negócio" (do card). Diminuir
   tamanho.
5. **Hero**: Laura "muito grande, ficou na lateral, quase caindo da
   tela". Diminuir e reposicionar.
6. **CTA Final**: bacana, mas "diminuir um pouco e encaixar mais pra
   esquerda".
7. **Login com 3 tentativas pra logar**: bug intermitente no fluxo
   de autenticação. Reportado pelo usuário em prod. Investigar
   logs prod.
8. **Parallax mouse OK** — usuário aprovou.

## Não negociáveis

- Foto **literal** do usuário (`Modelo Laura 3 (Laura Finance).png`)
  copiada **sem otimização Pillow** — `cp` direto. MD5 deve bater.
- Face crop pode usar Pillow para recortar 800×800, **mas sem
  `optimize=True`** (preserva bytes originais do crop).
- ZERO xadrez visível em qualquer avatar circular.
- ZERO animação de "flutuar/pular/respirar" no PNG. Manter só halo
  pulse + aura conic + parallax.
- Não mexer em cores, copy ou estrutura fora do escopo.
- Skill `superpowers:brainstorming`, `writing-plans`, `ui-ux-pro-max`,
  `verification-before-completion`, `requesting-code-review`
  invocadas.

## Mudanças

### A. Asset replacement (literal)

```bash
cp "/path/Modelo Laura 3 (Laura Finance).png" \
   "laura-pwa/public/brand/laura-portrait.png"
# Verifica MD5 idêntico ao original
md5 laura-pwa/public/brand/laura-portrait.png
md5 "/path/Modelo Laura 3 (Laura Finance).png"
# Devem bater.
```

Face crop:
```python
from PIL import Image
src = Image.open('laura-pwa/public/brand/laura-portrait.png').convert('RGBA')
face = src.crop((225, 80, 1025, 880))
face.save('laura-pwa/public/brand/laura-face.png')  # SEM optimize
```

### B. Eliminar xadrez nos avatares circulares

Causa: `LauraAvatar` (xs/sm/md/lg) sem bg sólido atrás permite que o
container pai apareça através das semitransparências do cabelo.

**Solução:** voltar com um background sólido **opaco** dentro do
clip circular do `LauraAvatar`, mas usar uma cor que case com o tom
da pele/blazer da Laura (não cinza/violeta que vazava antes na 19.0).

Opções consideradas:
- (a) `bg-zinc-800` — neutro escuro, 100% opaco. Bom para o cabelo
  escuro misturar.
- (b) `bg-[#1A0F22]` (gradient base do dark mode roxo) — combina com
  o tema mas pode ainda mostrar diferença.
- (c) `bg-zinc-900` — mais escuro ainda, melhor para fundir com o
  cabelo preto.

**Escolha:** `bg-zinc-900` (`#18181B`). Fundo escuro neutro opaco
que se confunde com o cabelo escuro da Laura nos pixels com alpha
parcial — sem aparecer xadrez nem cor estranha.

Removida da 19.1: `bg-gradient-to-br from-violet-900/20 to-fuchsia-
900/20` (transparente, vazava).
Adicionada agora: `bg-zinc-900` (opaco, escuro neutro).

### C. Remover breathing do LauraShowcase

Tirar `animate-laura-breathe` do PNG. Manter:
- Aura conic rotativa 22s
- Halo radial pulse 5s (no halo, não no PNG)
- Parallax mousemove ±8px desktop only

Resultado: PNG totalmente estático. Halo atrás "respira" pela opacity
pulsante — nunca o rosto se move.

### D. Posicionamentos finos

| Surface | Antes (19.2) | Depois (19.3) |
|---|---|---|
| AuthLayout | `LauraShowcase size="lg"` (288px) emergindo `-mb-20 sm:-mb-24` | `size="md"` (192px) emergindo `-mb-12 sm:-mb-16`. Menor presença, mais "saída" do card. |
| Hero LP desktop | `size="lg"` (288px) `-top-12 -right-56 lg → -right-72 2xl` | `size="md"` (192px) `-top-8 -right-32 lg → -right-40 xl → -right-44 2xl`. Não cai mais da tela em telas médias. |
| CTA Final | `size="lg"` (288px) `-right-12 top-1/2` lateral direita | `size="md"` (192px) `-right-2 sm:-right-4 top-1/2`. Diminui e move pra esquerda (encaixa melhor). |
| LauraAvatar (circulares) | sem bg | `bg-zinc-900` opaco no inner wrapper |
| LauraShowcase | breathing scale 1.018 | sem breathing — totalmente estático |

### E. Bug de login (3 tentativas)

Investigar logs prod via Portainer (memory tem `prod-api-debug` /
`prod-db-exec` workflows). Possíveis causas:
- Rate limiter mais agressivo do que documentado
- Race condition no HMAC
- Cache do navegador servindo response stale
- WebSocket whatsmeow flapping causando 5xx no API

Ação: rodar workflow `prod-api-debug` para inspecionar últimas 100
linhas de log do api Go. Se aparecer pattern claro, criar fix.
Se intermitente sem causa óbvia, documentar como follow-up.

### F. Validação visual

Playwright snapshots (já temos `playwright-snapshots.config.ts` da
19.2) — re-rodar após implementação. Verificar:
- Login: Laura visível + halo limpo + sem xadrez no card
- Hero: Laura ao lado do mockup, NÃO cortada pela viewport em 1280px
- CTA: headline central visível + Laura à direita encaixada (não
  sangrando além da borda do card)
- Avatares circulares (sidebar/dashboard/atalhos): sem xadrez

## Critério de pronto

1. MD5 da `laura-portrait.png` em prod = MD5 do PNG original do usuário.
2. Avatares circulares pequenos sem xadrez visível.
3. PNG da Laura 100% estático nos showcases (sem breathing).
4. Hero/Login/CTA com tamanhos reduzidos conforme spec.
5. typecheck/lint verdes, Playwright 5/5 snapshots verdes.
6. Review prods: bug de login investigado e documentado/fixado.
7. Tags `phase-19-3-fix-completo` + `phase-19-3-deployed` aplicadas.
