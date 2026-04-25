# Fase 19.3 — Laura fix completo (Spec v2)

## Mudanças em relação à v1

- **Asset replacement** documentado com comando exato `cp -p` para
  preservar timestamps e bytes (zero risco de Pillow tocar).
- **Face crop**: removido `optimize=True` na regeneração — preserva
  bytes do crop original.
- **Posicionamentos**: valores recalculados a partir de medidas reais
  do viewport 1280×800 e padding interno do CTA card.
- **Investigação login**: workflow `prod-api-debug` substituído por
  `gh run` + descrição clara do que extrair.
- **bg dos avatares**: refinado para `bg-[#1A0A1F]` (próximo ao
  background do card dark mode) em vez de `bg-zinc-900` puro — combina
  melhor com a paleta violeta do projeto.

## Contexto e bugs descobertos

(Idêntico à v1. Ver `2026-04-25-fase-19-3-laura-fix-completo-v1.md`
para histórico do problema.)

## Não negociáveis

- Foto **literal** do usuário (`Modelo Laura 3 (Laura Finance).png`)
  via `cp -p`, sem Pillow re-save no portrait. MD5 deve bater.
- Face crop pode usar Pillow para recortar 800×800, mas **sem
  `optimize=True`**.
- ZERO xadrez visível em qualquer avatar circular.
- ZERO animação de "flutuar/pular/respirar" no PNG. Manter só halo
  pulse + aura conic + parallax.
- Cores/copy/estrutura do design system intactas.
- Skills exigidas: `superpowers:brainstorming`, `writing-plans`,
  `ui-ux-pro-max`, `verification-before-completion`,
  `requesting-code-review`.

## Mudanças

### A. Asset replacement (literal, sem mexer nos bytes do portrait)

```bash
cp -p "/Users/joaovitorzanini/Downloads/Modelo Laura 3 (Laura Finance).png" \
       "laura-pwa/public/brand/laura-portrait.png"

md5 laura-pwa/public/brand/laura-portrait.png
md5 "/Users/joaovitorzanini/Downloads/Modelo Laura 3 (Laura Finance).png"
# Devem bater. Esperado: 0699e38ed108...
```

Face crop (Pillow apenas para crop, sem otimização):
```python
from PIL import Image
src = Image.open('laura-pwa/public/brand/laura-portrait.png').convert('RGBA')
face = src.crop((225, 80, 1025, 880))
face.save('laura-pwa/public/brand/laura-face.png')  # SEM optimize
```

### B. Eliminar xadrez nos avatares circulares

`LauraAvatar` recebe novamente um background sólido **opaco** dentro
do clip circular, mas em **`#1A0A1F`** (tom escuro alinhado com a
paleta violeta do projeto, próximo ao `--card-bg` dark). Cobre 100%
das semitransparências do cabelo da Laura nos avatares pequenos.

```tsx
<span className="relative inline-flex overflow-hidden rounded-full bg-[#1A0A1F] ...">
  <Image ... />
</span>
```

Por que não `bg-zinc-900` (`#18181B`)? Porque o tom é cinza-azulado
e em sidebar (também cinza-azulado) gera "achatamento" sem
diferenciação. `#1A0A1F` tem violeta sutil que casa com o ring
`primary/30` e respeita o brand.

### C. LauraShowcase totalmente estático no PNG

Tirar `animate-laura-breathe` da imagem da Laura. PNG **nunca se
move** sozinho. Animação visível fica no halo (pulse + conic rotate)
e no parallax que segue o cursor (desktop only).

### D. Posicionamentos finos (medidos em viewport 1280×800)

| Surface | Antes (19.2) | Depois (19.3) | Justificativa |
|---|---|---|---|
| AuthLayout | `size="lg"` 288px, `-mb-20 sm:-mb-24` | `size="md"` 192px, `-mb-12 sm:-mb-16` | Laura menor "salta" mais do card. Card de login fica protagonista. |
| Hero LP `lg` | `size="lg"` 288px, `-top-12 -right-56` | `size="md"` 192px, `-top-8 -right-28` | Em viewport 1280, `-right-56` joga 224px pra fora — busto inteiro fora da viewport. `-right-28` (112px fora) deixa a face e ombros visíveis sem sangrar pra fora. |
| Hero LP `xl` | `-right-64` | `-right-36` | Idem |
| Hero LP `2xl` | `-right-72` | `-right-40` | Idem |
| CTA Final | `size="lg"` 288px, `-right-12` lateral direita | `size="md"` 192px, `right-6 lg:right-12` lateral direita "encaixada" no card | Padding interno do card é `sm:px-12` (48px). `right-12` posiciona o início do showcase **na borda externa do padding** — Laura fica visível no canto direito do card sem sangrar. Em lg+ tem mais espaço, pode usar `right-12`. |
| LauraAvatar inner | sem bg (transparente) | `bg-[#1A0A1F]` opaco | Resolve xadrez. |
| LauraShowcase PNG wrapper | `animate-laura-breathe` | sem animação | PNG estático. |

### E. Bug de login (investigação)

Comando para extrair logs do api Go em prod:
```bash
gh workflow run prod-api-debug.yml -f lines=200
# OU se workflow não existir/não rodar:
# Pedir ao usuário para abrir Portainer em
# https://portainer.nexusai360.com → stack laura → laura-api logs
```

Buscar nos logs últimas tentativas de `POST /auth/login`. Sinais a
buscar:
- `rate limit exceeded` (Bearer Auth Limit)
- `bcrypt mismatch` × N (senha errada de fato?)
- `session cookie set` mas seguido de `401` (HMAC falhou ao validar)
- `panic` ou stack trace

Se causa identificada, criar fix. Se intermitente sem causa, criar
ADR `auth-flakiness-2026-04-25.md` para investigação posterior — não
bloqueia deploy 19.3.

### F. Validação visual via Playwright

Re-rodar `playwright-snapshots.config.ts` após mudanças. Adicionar
3 cenas novas:
- Login zoomed (foco no card e avatar Laura)
- Sidebar header da plataforma interna (precisa autenticar — talvez
  pular e validar manualmente)
- Mini avatar do dashboard top bar

Comparar visualmente com prints recebidos do usuário. Critério:
- Login: nenhum xadrez visível, Laura claramente "saindo" do card
- Hero: Laura busto visível ao lado do mockup, nada cortado pela
  viewport
- CTA: headline + botão central visíveis, Laura à direita encaixada
- Avatares circulares: superfície sólida atrás (sem xadrez)

## Critério de pronto

1. `md5 laura-pwa/public/brand/laura-portrait.png` = `md5 ~/Downloads/
   Modelo Laura 3 (Laura Finance).png`.
2. Avatares circulares: zero xadrez em screenshot.
3. PNG da Laura 100% estático.
4. Hero/Login/CTA com sizes reduzidos conforme tabela.
5. typecheck/lint verdes, Playwright snapshots verdes.
6. Login bug: investigado, fix se possível, ADR se não.
7. Skill `requesting-code-review` invocada após implementação.
8. Tags `phase-19-3-fix-completo` + `phase-19-3-deployed`.
