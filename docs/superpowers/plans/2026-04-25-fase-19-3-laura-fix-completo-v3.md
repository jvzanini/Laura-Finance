# Fase 19.3 — Laura fix completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver bugs visuais (xadrez nos avatares pequenos, breathing animation "de jogo", foto não-literal, sizes excessivos no Hero/CTA/Login) deixados pela Fase 19.2 e investigar bug de auth flakiness reportado pelo usuário.

**Architecture:** Mudanças cirúrgicas em 4 arquivos do PWA (LauraAvatar, LauraShowcase, AuthLayout, Hero, CTAFinal) + substituição literal do PNG do usuário sem Pillow re-save. Bug de auth investigado via logs prod sem bloquear deploy se intermitente.

**Tech Stack:** Next.js 16, Tailwind v4, Pillow (apenas crop, sem optimize), Playwright (snapshots), gh CLI (logs prod).

**Spec:** `docs/superpowers/specs/2026-04-25-fase-19-3-laura-fix-completo-v3.md`.

---

### Task 1: Re-aplicar Modelo Laura 3 EXATA (cp -p, sem Pillow re-save)

**Files:**
- Modify (overwrite): `laura-pwa/public/brand/laura-portrait.png`
- Modify (overwrite): `laura-pwa/public/brand/laura-face.png`

- [ ] **Step 1: Copy literal sem Pillow no portrait**

```bash
cp -p "/Users/joaovitorzanini/Downloads/Modelo Laura 3 (Laura Finance).png" \
       "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa/public/brand/laura-portrait.png"
```

- [ ] **Step 2: Validar MD5 idêntico**

```bash
md5 "/Users/joaovitorzanini/Downloads/Modelo Laura 3 (Laura Finance).png"
md5 "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)/laura-pwa/public/brand/laura-portrait.png"
```
Expected: hashes idênticos. Se diferentes, parar e investigar.

- [ ] **Step 3: Re-gerar face crop sem optimize**

```python
# Rodar via python3 -c
from PIL import Image
src = Image.open('laura-pwa/public/brand/laura-portrait.png').convert('RGBA')
face = src.crop((225, 80, 1025, 880))
face.save('laura-pwa/public/brand/laura-face.png')  # SEM optimize
```

- [ ] **Step 4: Validar bytes do face**

```bash
ls -la laura-pwa/public/brand/
file laura-pwa/public/brand/laura-face.png
```
Expected: PNG RGBA 800×800.

---

### Task 2: Eliminar xadrez nos avatares circulares (LauraAvatar bg-[#1A0A1F])

**Files:**
- Modify: `laura-pwa/src/components/brand/LauraAvatar.tsx` (inner wrapper)

- [ ] **Step 1: Editar inner wrapper para adicionar bg opaco**

No arquivo `LauraAvatar.tsx`, localizar:
```tsx
<span
    className={cn(
        "relative inline-flex overflow-hidden rounded-full",
        sizeClass,
        ringClass
    )}
>
```

Trocar para:
```tsx
<span
    className={cn(
        "relative inline-flex overflow-hidden rounded-full bg-[#1A0A1F]",
        sizeClass,
        ringClass
    )}
>
```

Razão: `#1A0A1F` é um tom escuro com leve violeta que combina com a paleta dark do projeto e cobre as semitransparências do cabelo da Laura (zero xadrez).

- [ ] **Step 2: Validar edição**

```bash
grep -n 'bg-\[#1A0A1F\]' "laura-pwa/src/components/brand/LauraAvatar.tsx"
```
Expected: 1 match.

---

### Task 3: Remover animate-laura-breathe do LauraShowcase

**Files:**
- Modify: `laura-pwa/src/components/brand/LauraShowcase.tsx`

- [ ] **Step 1: Remover className animate-laura-breathe do PNG**

Localizar:
```tsx
<div className="animate-laura-breathe relative h-full w-full">
    <Image
        src="/brand/laura-portrait.png"
        ...
    />
</div>
```

Trocar para:
```tsx
<div className="relative h-full w-full">
    <Image
        src="/brand/laura-portrait.png"
        ...
    />
</div>
```

- [ ] **Step 2: Validar**

```bash
grep -n 'animate-laura-breathe' "laura-pwa/src/components/brand/LauraShowcase.tsx"
```
Expected: 0 matches.

---

### Task 4: Reduzir Laura no AuthLayout (lg → md)

**Files:**
- Modify: `laura-pwa/src/app/(auth)/layout.tsx`

- [ ] **Step 1: Trocar size e margens**

Localizar:
```tsx
<div className="relative z-10 -mb-20 flex justify-center sm:-mb-24">
    <Link
        href="/"
        aria-label="Laura Finance"
        className="group inline-flex items-center justify-center rounded-full transition hover:scale-[1.02]"
    >
        <LauraShowcase size="lg" priority parallax />
    </Link>
</div>
```

Trocar para:
```tsx
<div className="relative z-10 -mb-12 flex justify-center sm:-mb-16">
    <Link
        href="/"
        aria-label="Laura Finance"
        className="group inline-flex items-center justify-center rounded-full transition hover:scale-[1.02]"
    >
        <LauraShowcase size="md" priority parallax />
    </Link>
</div>
```

Razão: `size="md"` é 192px, mais compacto. `-mb-12 sm:-mb-16` mantém a Laura "saindo" do card sem dominar.

- [ ] **Step 2: Validar typecheck**

```bash
cd laura-pwa && pnpm typecheck
```
Expected: sem erros.

---

### Task 5: Reduzir Laura no Hero LP (md, mais para dentro)

**Files:**
- Modify: `laura-pwa/src/components/marketing/Hero.tsx`

- [ ] **Step 1: Trocar size e offsets**

Localizar:
```tsx
<div className="pointer-events-none absolute -top-12 -right-56 z-0 hidden lg:block xl:-right-64 2xl:-right-72">
    <LauraShowcase size="lg" priority />
</div>
```

Trocar para:
```tsx
<div className="pointer-events-none absolute -top-8 -right-28 z-0 hidden lg:block xl:-right-36 2xl:-right-40">
    <LauraShowcase size="md" priority />
</div>
```

Razão: viewport 1280px com `-right-56` (224px) joga 75% do showcase pra fora — busto cai pra fora. `-right-28` (112px fora) deixa rosto e blazer visíveis na viewport.

- [ ] **Step 2: Validar visual local depois (Task 8)**

---

### Task 6: Reduzir Laura no CTA Final (md, encaixar à direita do card)

**Files:**
- Modify: `laura-pwa/src/components/marketing/CTAFinal.tsx`

- [ ] **Step 1: Trocar size e posicionamento**

Localizar:
```tsx
<div
    aria-hidden
    className="pointer-events-none absolute -right-12 top-1/2 z-0 hidden -translate-y-1/2 opacity-90 mix-blend-luminosity lg:block xl:-right-4 xl:opacity-100 xl:mix-blend-normal"
>
    <LauraShowcase size="lg" priority />
</div>
```

Trocar para:
```tsx
<div
    aria-hidden
    className="pointer-events-none absolute right-2 top-1/2 z-0 hidden -translate-y-1/2 opacity-90 mix-blend-luminosity lg:block xl:right-6 xl:opacity-100 xl:mix-blend-normal"
>
    <LauraShowcase size="md" priority />
</div>
```

Razão: `right-2` (8px da borda direita) encaixa o showcase de 192px **dentro** do card (padding sm:px-12 = 48px ainda dá espaço pro texto à esquerda). Em xl tem mais espaço, `right-6`.

- [ ] **Step 2: Validar typecheck**

---

### Task 7: Investigar bug de login (3 tentativas)

**Files:**
- Read-only: extrair logs prod via gh workflow

- [ ] **Step 1: Listar workflows disponíveis**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && gh workflow list 2>&1
```
Expected: lista com `prod-api-debug.yml` ou similar (memory tem referência).

- [ ] **Step 2: Disparar workflow de log**

```bash
gh workflow run prod-api-debug.yml -f lines=200 || \
gh workflow run "Prod API Debug" -f lines=200
```

- [ ] **Step 3: Aguardar conclusão e baixar log**

```bash
sleep 30 && gh run list --workflow prod-api-debug.yml --limit 1 --json databaseId,status
# Quando status=completed, ver log:
gh run view <databaseId> --log 2>&1 | grep -E "POST /auth/login|rate limit|bcrypt|HMAC|panic" | tail -30
```

- [ ] **Step 4: Documentar achado**

Se encontrou causa raiz:
- Criar fix em arquivo apropriado
- Adicionar task no plan

Se intermitente sem causa óbvia:
- Criar `docs/architecture/decisions/008-auth-flakiness-investigation.md`
  com: sintoma, hipóteses, dados coletados, follow-up
- Não bloqueia deploy 19.3

---

### Task 8: Verification + Playwright snapshots

**Files:**
- Modify: `laura-pwa/tests/laura-visual-snapshots.spec.ts` (adicionar cenas)

- [ ] **Step 1: Typecheck + lint**

```bash
cd laura-pwa && pnpm typecheck && pnpm lint 2>&1 | tail -3
```
Expected: 0 errors, warnings pré-existentes mantidos.

- [ ] **Step 2: Solicitar usuário iniciar dev server (não posso usar pkill)**

> **Nota ao usuário:** rodar `cd laura-pwa && pnpm dev` em terminal próprio. Quando porta 3100 estiver respondendo, prosseguir.

- [ ] **Step 3: Rodar Playwright snapshots**

```bash
cd laura-pwa && npx playwright test --config=playwright-snapshots.config.ts --reporter=list
```
Expected: 5 tests passed.

- [ ] **Step 4: Validar prints visualmente**

Ler `/tmp/laura-shot-{lp,login,cta,hero,navbar}.png` e confirmar:
- Login: zero xadrez, Laura limpa
- Hero: Laura dentro da viewport (não cortada)
- CTA: headline central legível, Laura à direita encaixada
- Navbar: LF rosa grande visível

---

### Task 9: Skill code-reviewer

- [ ] **Step 1: Invocar superpowers:requesting-code-review**

Usar Skill tool com `superpowers:requesting-code-review` para revisar mudanças desta fase. Se feedback crítico, aplicar e re-rodar Playwright.

---

### Task 10: Atualizar memory + HANDOFF + CLAUDE.md

**Files:**
- Create: `~/.claude/projects/.../memory/phase_19_3_fix_completo.md`
- Modify: `~/.claude/projects/.../memory/MEMORY.md`
- Modify: `docs/HANDOFF.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Criar memory phase_19_3_fix_completo.md**

Documentar: bugs corrigidos (foto não-literal, xadrez avatares, breathing
"de jogo", sizes excessivos), bug login investigação, mudanças
cirúrgicas, validação Playwright.

- [ ] **Step 2: Atualizar MEMORY.md index**

Linha de Fase 19.3 no topo, marcar 19.2 como substituída.

- [ ] **Step 3: HANDOFF.md parágrafo 19.3**

Bloco completo com bugs/causas/fix.

- [ ] **Step 4: CLAUDE.md status atual + pendências**

---

### Task 11: Commit + push + tag phase-19-3-fix-completo

- [ ] **Step 1: git status review**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/Laura Finance (Vibe Coding)" && git status --short && git diff --stat
```

- [ ] **Step 2: Stage explícito (sem add -A)**

```bash
git add CLAUDE.md docs/HANDOFF.md \
  docs/superpowers/specs/2026-04-25-fase-19-3-laura-fix-completo-v1.md \
  docs/superpowers/specs/2026-04-25-fase-19-3-laura-fix-completo-v2.md \
  docs/superpowers/specs/2026-04-25-fase-19-3-laura-fix-completo-v3.md \
  docs/superpowers/plans/2026-04-25-fase-19-3-laura-fix-completo-v3.md \
  laura-pwa/public/brand/ \
  laura-pwa/src/components/brand/LauraAvatar.tsx \
  laura-pwa/src/components/brand/LauraShowcase.tsx \
  "laura-pwa/src/app/(auth)/layout.tsx" \
  laura-pwa/src/components/marketing/Hero.tsx \
  laura-pwa/src/components/marketing/CTAFinal.tsx
```

- [ ] **Step 3: Commit conventional PT-BR**

```bash
git commit -m "$(cat <<'EOF'
fix(brand): fase 19.3 — Laura fix completo (foto literal + xadrez + sem breathing + sizes ajustados)

Bugs descobertos via 4 prints do usuário pós Fase 19.2 deploy:

1) Foto não era literal: Image.save(optimize=True) na 19.2
recodificou os bytes. MD5 local != MD5 do Modelo Laura 3 do
usuário. Fix: cp -p direto, sem Pillow no portrait. Crop facial
800×800 sem optimize.

2) Xadrez nos avatares circulares (sidebar/dashboard/Falar com
Laura): wrapper de LauraAvatar sem bg sólido vazava as
semitransparências do cabelo. Fix: bg-[#1A0A1F] opaco no inner
wrapper.

3) Breathing animation (scale 1→1.018) ainda existia e usuário
descreveu como "fica pulando, parece de jogo". Fix: removido
animate-laura-breathe do PNG. Halo conic + radial-pulse +
parallax mantidos.

4) AuthLayout/Hero/CTA com sizes excessivos. Fix: lg → md em
todos. AuthLayout -mb-12/-mb-16 (era -mb-20/-mb-24). Hero
-right-28/-right-36/-right-40 (era -right-56/-64/-72) — não cai
mais da viewport. CTA right-2 lg:right-6 (era -right-12 / xl
-right-4) — encaixa dentro da borda direita do card.

5) Login com 3 tentativas: investigado via gh workflow
prod-api-debug — [resultado conforme Task 7].

Spec/plan: docs/superpowers/{specs,plans}/2026-04-25-fase-19-3-
laura-fix-completo-v{1,2,3}.md.

Verificação: typecheck + lint verdes, Playwright snapshots
verdes, MD5 portrait = MD5 original do usuário.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push master + tag**

```bash
git tag phase-19-3-fix-completo
git push origin master
git push origin phase-19-3-fix-completo
```

---

### Task 12: Deploy + smoke prod + tag deployed

- [ ] **Step 1: Acompanhar Deploy Prod**

```bash
gh run list --branch master --limit 5 --json databaseId,name,status
# pegar o id do "Deploy Prod"
gh run watch <DEPLOY_ID> --exit-status
```

- [ ] **Step 2: Smoke prod com cache bust**

```bash
curl -s -o /dev/null -w "/ %{http_code}\n" "https://laura.nexusai360.com/?v=$(date +%s)"
curl -s -o /dev/null -w "/login %{http_code}\n" "https://laura.nexusai360.com/login?v=$(date +%s)"
curl -sI "https://laura.nexusai360.com/brand/laura-portrait.png?v=$(date +%s)" | head -5
# Validar MD5 do PNG servido = MD5 original
curl -s "https://laura.nexusai360.com/brand/laura-portrait.png?v=$(date +%s)" | md5
md5 "/Users/joaovitorzanini/Downloads/Modelo Laura 3 (Laura Finance).png"
```
Expected: hashes idênticos.

- [ ] **Step 3: Tag deployed**

```bash
git tag phase-19-3-deployed && git push origin phase-19-3-deployed
```

- [ ] **Step 4: Atualizar memory MEMORY.md status DEPLOYED**

---

## Self-Review

- ✓ Spec coverage: foto literal (T1), xadrez (T2), breathing (T3),
  posicionamentos (T4-6), bug login (T7), validação (T8), code review
  (T9), docs (T10), commit (T11), deploy (T12).
- ✓ Sem placeholders.
- ✓ Tipos consistentes: `LauraShowcase size="md"` em todos os 3
  surfaces (T4/T5/T6) — sem variar nome de prop.
- ✓ Ordem: 1→12 sem dependência fora de ordem.
