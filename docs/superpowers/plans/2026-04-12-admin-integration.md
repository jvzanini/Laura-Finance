# Super Admin Panel — Full Platform Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Super Admin Panel fully functional — fix broken pages, integrate admin configs with the live platform, add CRUD for categories+subcategories, build email template system, and generate API docs page.

**Architecture:** All admin changes are persisted to PostgreSQL tables and consumed by the platform via server actions that query the same tables. The PWA uses Next.js App Router with server components fetching data and client components for interactivity. The Go backend provides REST endpoints with direct DB fallback in the PWA.

**Tech Stack:** Next.js 16 (App Router + Turbopack), React 19, PostgreSQL 16, Go/Fiber, Tailwind CSS, Lucide icons, Resend (email)

---

## File Structure

### Files to modify:
- `laura-pwa/src/components/admin/AdminOptionsCrud.tsx` — remove `icon` prop (fix serialization bug)
- `laura-pwa/src/app/(admin)/admin/goal-templates/page.tsx` — remove icon prop, pass icon name string
- `laura-pwa/src/app/(admin)/admin/financial-config/page.tsx` — remove icon props
- `laura-pwa/src/app/(admin)/admin/AdminSidebar.tsx` — rename "Categorias" → "Categorias e Subs"
- `laura-pwa/src/app/(admin)/admin/categories/page.tsx` — full rewrite: CRUD for categories + subcategories
- `laura-pwa/src/app/(admin)/admin/email-config/page.tsx` — add email templates section
- `laura-pwa/src/app/(admin)/admin/api-docs/page.tsx` — full rewrite: interactive API docs
- `laura-pwa/src/lib/actions/adminConfig.ts` — add category template CRUD actions, email template actions
- `laura-pwa/src/lib/email.ts` — use DB templates instead of hardcoded HTML
- `laura-pwa/src/app/(dashboard)/categories/default-seed.ts` — read from DB `category_templates` instead of hardcoded array
- `laura-pwa/src/lib/actions/categories.ts` — update seedCategoriesAction to use admin templates
- `infrastructure/migrations/000033_create_email_templates.sql` — new table

### Files to create:
- `laura-pwa/src/app/(admin)/admin/categories/CategoryTemplatesCrud.tsx` — client component for category CRUD
- `laura-pwa/src/app/(admin)/admin/email-config/EmailTemplatesCrud.tsx` — client component for email template CRUD
- `laura-go/internal/handlers/admin_email_templates.go` — Go handler for email template CRUD

---

## Task 1: Fix AdminOptionsCrud icon serialization bug

The `AdminOptionsCrud` component receives Lucide icon components as the `icon` prop. React components (functions) can't be serialized from Server Components to Client Components. Fix: pass an icon name string and render it inside the client component.

**Files:**
- Modify: `laura-pwa/src/components/admin/AdminOptionsCrud.tsx`
- Modify: `laura-pwa/src/app/(admin)/admin/goal-templates/page.tsx`
- Modify: `laura-pwa/src/app/(admin)/admin/financial-config/page.tsx`

- [ ] **Step 1: Update AdminOptionsCrud to use icon name string**

Replace the icon prop from `React.ElementType` to `string` and use a lookup map inside the client component:

```tsx
// AdminOptionsCrud.tsx — replace the import and type sections

"use client";

import { useState, useTransition } from "react";
import { createOptionAction, toggleOptionAction, deleteOptionAction } from "@/lib/actions/adminConfig";
import {
    Plus, Trash2, Power, Target, Landmark, CreditCard, TrendingUp, PieChart, Package,
} from "lucide-react";
import { useRouter } from "next/navigation";

const ICON_MAP: Record<string, React.ElementType> = {
    Target, Landmark, CreditCard, TrendingUp, PieChart, Package,
};

// ... keep OptionItem and FieldConfig types unchanged ...

export function AdminOptionsCrud({
    resource,
    items,
    fields,
    title,
    iconName,
}: {
    resource: string;
    items: OptionItem[];
    fields: FieldConfig[];
    title: string;
    iconName?: string;
}) {
    const Icon = (iconName && ICON_MAP[iconName]) || Package;
    // ... rest unchanged, Icon is already used as <Icon className="h-4 w-4 text-primary" />
```

- [ ] **Step 2: Update goal-templates page to pass iconName**

```tsx
// goal-templates/page.tsx
<AdminOptionsCrud
    resource="goal-templates"
    items={templates}
    title="Objetivos"
    iconName="Target"
    fields={[
        { name: "name", label: "Nome", placeholder: "Ex: Viagem", required: true },
        { name: "emoji", label: "Emoji", placeholder: "✈️" },
        { name: "color", label: "Cor", placeholder: "#3B82F6" },
    ]}
/>
```

- [ ] **Step 3: Update financial-config page to pass iconName**

Replace all 4 `icon={Component}` with `iconName="Name"`:
- `icon={Landmark}` → `iconName="Landmark"`
- `icon={CreditCard}` → `iconName="CreditCard"`
- `icon={TrendingUp}` → `iconName="TrendingUp"`
- `icon={PieChart}` → `iconName="PieChart"`

Remove Lucide imports from financial-config/page.tsx since they're no longer needed.

- [ ] **Step 4: Verify both pages load without errors**

Open `http://localhost:3100/admin/goal-templates` and `http://localhost:3100/admin/financial-config` — both should render without the "Only plain objects can be passed" error.

- [ ] **Step 5: Commit**

```bash
git add laura-pwa/src/components/admin/AdminOptionsCrud.tsx \
        laura-pwa/src/app/\(admin\)/admin/goal-templates/page.tsx \
        laura-pwa/src/app/\(admin\)/admin/financial-config/page.tsx
git commit -m "fix: resolve Lucide icon serialization in AdminOptionsCrud"
```

---

## Task 2: Rename sidebar item and build Categories + Subcategories CRUD

**Files:**
- Modify: `laura-pwa/src/app/(admin)/admin/AdminSidebar.tsx`
- Rewrite: `laura-pwa/src/app/(admin)/admin/categories/page.tsx`
- Create: `laura-pwa/src/app/(admin)/admin/categories/CategoryTemplatesCrud.tsx`
- Modify: `laura-pwa/src/lib/actions/adminConfig.ts`

- [ ] **Step 1: Rename sidebar item**

In `AdminSidebar.tsx`, change:
```tsx
{ title: "Categorias", url: "/admin/categories", icon: Tag },
```
to:
```tsx
{ title: "Categorias e Subs", url: "/admin/categories", icon: Tag },
```

- [ ] **Step 2: Add CRUD server actions for category templates with subcategories**

Append to `laura-pwa/src/lib/actions/adminConfig.ts`:

```ts
// ─── Category Templates CRUD (with subcategories) ───

export type AdminCategoryTemplate = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description: string | null;
    subcategories: { name: string; emoji: string }[];
    sort_order: number;
    active: boolean;
};

export async function fetchAdminCategoryTemplatesFullAction(): Promise<{ templates: AdminCategoryTemplate[] } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const result = await pool.query(
        "SELECT id, name, emoji, color, description, subcategories, sort_order, active FROM category_templates ORDER BY sort_order, name"
    );
    const templates = result.rows.map((r: any) => ({
        ...r,
        subcategories: typeof r.subcategories === "string" ? JSON.parse(r.subcategories) : (r.subcategories || []),
    }));
    return { templates };
}

export async function createCategoryTemplateFullAction(data: {
    name: string; emoji: string; color: string; description?: string;
    subcategories: { name: string; emoji: string }[];
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };
    if (!data.name) return { error: "Nome obrigatório" };

    await pool.query(
        `INSERT INTO category_templates (name, emoji, color, description, subcategories, sort_order)
         VALUES ($1, $2, $3, $4, $5::jsonb, (SELECT COALESCE(MAX(sort_order),0)+1 FROM category_templates))`,
        [data.name, data.emoji || "📂", data.color || "#808080", data.description || null, JSON.stringify(data.subcategories || [])]
    );
    return { success: true };
}

export async function updateCategoryTemplateFullAction(id: string, data: {
    name: string; emoji: string; color: string; description?: string;
    subcategories: { name: string; emoji: string }[];
    active?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE category_templates SET name=$1, emoji=$2, color=$3, description=$4,
         subcategories=$5::jsonb, active=COALESCE($6, active), updated_at=CURRENT_TIMESTAMP WHERE id=$7`,
        [data.name, data.emoji, data.color, data.description || null, JSON.stringify(data.subcategories || []), data.active ?? null, id]
    );
    return { success: true };
}

export async function deleteCategoryTemplateFullAction(id: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("DELETE FROM category_templates WHERE id = $1", [id]);
    return { success: true };
}
```

- [ ] **Step 3: Create CategoryTemplatesCrud client component**

Create `laura-pwa/src/app/(admin)/admin/categories/CategoryTemplatesCrud.tsx` — a full CRUD client component that:
- Lists all category templates with their subcategories shown as chips
- Has a "Nova Categoria" form with fields: name, emoji, color, description
- Inside each category, can add/remove subcategories (name + emoji)
- Toggle active/inactive
- Delete with confirmation
- Edit inline (expand card to edit form)

The component receives `initial: AdminCategoryTemplate[]` as prop and uses the server actions above.

- [ ] **Step 4: Rewrite categories admin page as server component**

```tsx
// laura-pwa/src/app/(admin)/admin/categories/page.tsx
import { fetchAdminCategoryTemplatesFullAction } from "@/lib/actions/adminConfig";
import { CategoryTemplatesCrud } from "./CategoryTemplatesCrud";
import { Tag } from "lucide-react";

export default async function CategoriesPage() {
    const result = await fetchAdminCategoryTemplatesFullAction();
    const templates = "templates" in result ? result.templates : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Categorias e Subcategorias</h1>
                    <p className="text-sm text-muted-foreground">
                        Templates usados como seed para novos workspaces. {templates.length} categorias cadastradas.
                    </p>
                </div>
            </div>
            <CategoryTemplatesCrud initial={templates} />
        </div>
    );
}
```

- [ ] **Step 5: Verify categories page works with full CRUD**

Open `http://localhost:3100/admin/categories` — should show all 8 seed categories with subcategories, allow creating/editing/deleting.

- [ ] **Step 6: Commit**

```bash
git add laura-pwa/src/app/\(admin\)/admin/AdminSidebar.tsx \
        laura-pwa/src/app/\(admin\)/admin/categories/ \
        laura-pwa/src/lib/actions/adminConfig.ts
git commit -m "feat(admin): CRUD for category templates with subcategories"
```

---

## Task 3: Connect category seed to admin templates

Currently `seedCategoriesAction()` uses a hardcoded `DEFAULT_SEED_CATEGORIES` array. Change it to read from `category_templates` table.

**Files:**
- Modify: `laura-pwa/src/lib/actions/categories.ts`
- Modify: `laura-pwa/src/app/(dashboard)/categories/default-seed.ts`

- [ ] **Step 1: Add fetchCategoryTemplatesForSeed to categories.ts**

Add a function that reads active templates from DB:

```ts
async function getCategoryTemplatesFromDB(): Promise<SeedCategory[] | null> {
    try {
        const result = await pool.query(
            "SELECT name, emoji, color, description, subcategories FROM category_templates WHERE active = true ORDER BY sort_order"
        );
        if (result.rowCount === 0) return null;
        return result.rows.map((r: any) => {
            const subs = typeof r.subcategories === "string" ? JSON.parse(r.subcategories) : (r.subcategories || []);
            return {
                name: r.name,
                emoji: r.emoji || "📂",
                color: r.color || "#808080",
                description: r.description || "",
                subcategories: subs.map((s: any) => ({
                    name: s.name,
                    emoji: s.emoji || "📄",
                    description: s.description || "",
                })),
            };
        });
    } catch {
        return null;
    }
}
```

- [ ] **Step 2: Update seedCategoriesAction to try DB templates first**

In `seedCategoriesAction`, before using the passed `categoriesData`, try DB:

```ts
export async function seedCategoriesAction(categoriesData: any) {
    // ...session check...
    // Try admin-configured templates first
    const dbTemplates = await getCategoryTemplatesFromDB();
    const seedData = dbTemplates && dbTemplates.length > 0 ? dbTemplates : categoriesData;
    // ...rest uses seedData instead of categoriesData...
}
```

- [ ] **Step 3: Verify seed uses admin templates**

1. Change a category template name in admin (e.g., "Pessoal" → "Pessoal Teste")
2. Create a test workspace or clear categories
3. Click "Popular categorias padrão" — should use the modified template

- [ ] **Step 4: Commit**

```bash
git add laura-pwa/src/lib/actions/categories.ts
git commit -m "feat: seed categories from admin templates instead of hardcoded array"
```

---

## Task 4: Email Templates System — Migration + Server Actions

**Files:**
- Create: `infrastructure/migrations/000033_create_email_templates.sql`
- Modify: `laura-pwa/src/lib/actions/adminConfig.ts`

- [ ] **Step 1: Create migration for email_templates table**

```sql
-- Email templates HTML editáveis pelo super admin.
-- Cada template tem um "type" (verificacao, reset_senha, convite, etc.)
-- e apenas um pode estar ativo por type por vez.
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    description VARCHAR(500),
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_active_per_type
    ON email_templates(type) WHERE active = TRUE;

-- Seed com os templates atuais (hardcoded no email.ts)
INSERT INTO email_templates (type, name, subject, html_body, description, active) VALUES
-- Verificação de email
('verificacao_email', 'Verificação Padrão', 'Confirme seu e-mail — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo, {{userName}}! 🎉</h2>
  <p>Obrigado por criar sua conta na Laura Finance! Só falta confirmar seu e-mail para liberar todos os recursos.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{verifyUrl}}" style="display: inline-block; padding: 12px 32px; background: #10B981; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Confirmar e-mail</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">O link é válido por <strong>24 horas</strong>. Se você não criou esta conta, ignore esta mensagem.</p>
  <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
  <p style="font-size: 11px; color: #71717A;">Link completo:<br/><code style="word-break: break-all;">{{verifyUrl}}</code></p>
</div>', 'Template padrão de verificação de email', true),

-- Reset de senha
('reset_senha', 'Reset Padrão', 'Recuperação de senha — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Olá, {{userName}}! 👋</h2>
  <p>Recebemos uma solicitação para redefinir a senha da sua conta Laura Finance.</p>
  <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>30 minutos</strong>.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{resetUrl}}" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir senha</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Se você não pediu esse reset, ignore este e-mail — sua senha continua segura.</p>
</div>', 'Template padrão de reset de senha', true),

-- Convite de membro
('convite_membro', 'Convite Padrão', 'Acesso Liberado: Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Você foi convidado! 🥳</h2>
  <p>Um acesso como <strong>{{role}}</strong> foi provisionado para você na Laura Finance.</p>
  <p>Sua credencial de primeiro acesso:</p>
  <div style="background: #18181B; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 4px 0; font-size: 14px;">Login: <strong>{{email}}</strong></p>
    <p style="margin: 4px 0; font-size: 14px;">Senha Temporária: <strong>{{tempPassword}}</strong></p>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Por favor, troque sua senha ao logar no painel.</p>
</div>', 'Template padrão de convite de membro', true),

-- Comprovante de pagamento
('comprovante_pagamento', 'Comprovante Padrão', 'Seu Comprovante Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo à Laura Finance PRO! 🎉</h2>
  <p>Seu pagamento para o plano <strong>{{planName}}</strong> foi aprovado com sucesso.</p>
  <p>Valor faturado: <strong>{{amount}}</strong></p>
  <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
  <p>Você já pode desfrutar dos limites ilimitados da sua Inteligência Artificial no WhatsApp.</p>
  <p style="color: #71717A; font-size: 12px;">Atenciosamente, Equipe Laura</p>
</div>', 'Template padrão de comprovante', true),

-- Cobrança / lembrete de pagamento
('cobranca', 'Cobrança Padrão', 'Lembrete de Pagamento — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #F59E0B; margin-top: 0;">Lembrete de Pagamento 💳</h2>
  <p>Olá, {{userName}}!</p>
  <p>Seu plano <strong>{{planName}}</strong> vence em <strong>{{dueDate}}</strong>.</p>
  <p>Valor: <strong>{{amount}}</strong></p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{paymentUrl}}" style="display: inline-block; padding: 12px 32px; background: #F59E0B; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 600;">Pagar Agora</a>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Evite a suspensão do seu acesso mantendo seu plano em dia.</p>
</div>', 'Template padrão de cobrança', true),

-- Alerta de orçamento
('alerta_orcamento', 'Alerta Orçamento Padrão', 'Alerta de Orçamento — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #EF4444; margin-top: 0;">Atenção ao Orçamento! ⚠️</h2>
  <p>Olá, {{userName}}!</p>
  <p>Você já utilizou <strong>{{percentage}}%</strong> do orçamento da categoria <strong>{{categoryName}}</strong> este mês.</p>
  <p>Gasto atual: <strong>{{spent}}</strong> de <strong>{{budget}}</strong></p>
  <p style="font-size: 12px; color: #A1A1AA;">Fique de olho nos gastos para manter suas finanças sob controle!</p>
</div>', 'Template padrão de alerta de orçamento', true),

-- Relatório mensal
('relatorio_mensal', 'Relatório Mensal Padrão', 'Seu Resumo Financeiro — Laura Finance',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">Resumo de {{month}} 📊</h2>
  <p>Olá, {{userName}}! Aqui está seu resumo financeiro:</p>
  <div style="background: #18181B; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 8px 0;">Receitas: <strong style="color: #10B981;">{{income}}</strong></p>
    <p style="margin: 8px 0;">Despesas: <strong style="color: #EF4444;">{{expenses}}</strong></p>
    <p style="margin: 8px 0;">Saldo: <strong style="color: #7C3AED;">{{balance}}</strong></p>
    <p style="margin: 8px 0;">Score: <strong>{{score}}/100</strong></p>
  </div>
  <p style="font-size: 12px; color: #A1A1AA;">Acesse o dashboard para ver mais detalhes.</p>
</div>', 'Template padrão de relatório mensal', true),

-- Marketing / novidades
('marketing', 'Marketing Padrão', 'Novidades Laura Finance ✨',
'<div style="font-family: ''Helvetica Neue'', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
  <h2 style="color: #7C3AED; margin-top: 0;">{{title}}</h2>
  <p>{{body}}</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{ctaUrl}}" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">{{ctaText}}</a>
  </div>
  <p style="font-size: 11px; color: #71717A;">Você recebeu este e-mail por ser usuário da Laura Finance.</p>
</div>', 'Template padrão de marketing', true)

ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Run the migration**

```bash
docker exec -i infrastructure-postgres-1 psql -U laura -d laura_finance < infrastructure/migrations/000033_create_email_templates.sql
```

- [ ] **Step 3: Add email template server actions to adminConfig.ts**

```ts
// ─── Email Templates ───

export const EMAIL_TEMPLATE_TYPES = [
    { value: "verificacao_email", label: "Verificação de Email" },
    { value: "reset_senha", label: "Reset de Senha" },
    { value: "convite_membro", label: "Convite de Membro" },
    { value: "comprovante_pagamento", label: "Comprovante de Pagamento" },
    { value: "cobranca", label: "Cobrança / Lembrete" },
    { value: "alerta_orcamento", label: "Alerta de Orçamento" },
    { value: "relatorio_mensal", label: "Relatório Mensal" },
    { value: "marketing", label: "Marketing / Novidades" },
] as const;

export type EmailTemplate = {
    id: string;
    type: string;
    name: string;
    subject: string;
    html_body: string;
    description: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export async function fetchEmailTemplatesAction(): Promise<{ templates: EmailTemplate[] } | { error: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    const result = await pool.query(
        "SELECT id, type, name, subject, html_body, description, active, created_at, updated_at FROM email_templates ORDER BY type, active DESC, name"
    );
    return { templates: result.rows };
}

export async function createEmailTemplateAction(data: {
    type: string; name: string; subject: string; html_body: string; description?: string;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };
    if (!data.type || !data.name || !data.subject || !data.html_body) return { error: "Campos obrigatórios faltando" };

    await pool.query(
        `INSERT INTO email_templates (type, name, subject, html_body, description, active)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [data.type, data.name, data.subject, data.html_body, data.description || null]
    );
    return { success: true };
}

export async function updateEmailTemplateAction(id: string, data: {
    name: string; subject: string; html_body: string; description?: string;
}): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query(
        `UPDATE email_templates SET name=$1, subject=$2, html_body=$3, description=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
        [data.name, data.subject, data.html_body, data.description || null, id]
    );
    return { success: true };
}

export async function activateEmailTemplateAction(id: string, type: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    // Deactivate all of same type, then activate the chosen one
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("UPDATE email_templates SET active = FALSE WHERE type = $1", [type]);
        await client.query("UPDATE email_templates SET active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
    return { success: true };
}

export async function deleteEmailTemplateAction(id: string): Promise<{ success?: boolean; error?: string }> {
    const gate = await assertSuperAdmin();
    if (!gate.ok) return { error: "Sem permissão" };

    await pool.query("DELETE FROM email_templates WHERE id = $1", [id]);
    return { success: true };
}
```

- [ ] **Step 4: Commit**

```bash
git add infrastructure/migrations/000033_create_email_templates.sql \
        laura-pwa/src/lib/actions/adminConfig.ts
git commit -m "feat: email templates table + admin CRUD actions"
```

---

## Task 5: Email Templates Admin UI

**Files:**
- Rewrite: `laura-pwa/src/app/(admin)/admin/email-config/page.tsx`
- Create: `laura-pwa/src/app/(admin)/admin/email-config/EmailTemplatesCrud.tsx`

- [ ] **Step 1: Create EmailTemplatesCrud client component**

Create `laura-pwa/src/app/(admin)/admin/email-config/EmailTemplatesCrud.tsx` — a client component that:
- Groups templates by type (accordion/tabs per type)
- Each type shows all templates, with the active one highlighted (green badge)
- "Ativar" button on inactive templates, "Ativo" badge on the active one
- "Novo Template" form per type with: name, subject, HTML body (textarea), description
- Edit form (expand to edit name, subject, HTML body)
- Delete with confirmation
- HTML preview (toggle to show rendered preview in an iframe/sandbox)
- Shows available variables per type (e.g., `{{userName}}`, `{{verifyUrl}}`) as helper chips

- [ ] **Step 2: Rewrite email-config page to include both config editor and templates**

```tsx
// email-config/page.tsx
import { fetchAdminConfigAction, fetchEmailTemplatesAction } from "@/lib/actions/adminConfig";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import { EmailTemplatesCrud } from "./EmailTemplatesCrud";
import { Mail } from "lucide-react";

export default async function EmailConfigPage() {
    const [configResult, templatesResult] = await Promise.all([
        fetchAdminConfigAction(),
        fetchEmailTemplatesAction(),
    ]);

    const configs = "configs" in configResult ? (configResult.configs ?? []) : [];
    const templates = "templates" in templatesResult ? (templatesResult.templates ?? []) : [];

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Configuração de Email</h1>
                    <p className="text-sm text-muted-foreground">Remetente, templates HTML e tokens</p>
                </div>
            </div>

            {/* Sender config */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Remetente</h2>
                <AdminConfigEditor
                    configs={configs}
                    filter={["sender_email", "sender_name", "verify_email_ttl_hours", "password_reset_ttl_minutes"]}
                />
            </div>

            {/* Email templates */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Templates de Email</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Crie e gerencie templates HTML para cada tipo de email. Apenas um template ativo por tipo.
                </p>
                <EmailTemplatesCrud initial={templates} />
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify email templates UI works**

Open `http://localhost:3100/admin/email-config` — should show sender config at top and all 8 email template types with their seed templates below.

- [ ] **Step 4: Commit**

```bash
git add laura-pwa/src/app/\(admin\)/admin/email-config/
git commit -m "feat(admin): email templates CRUD UI with preview and activation"
```

---

## Task 6: Integrate email.ts with DB templates

**Files:**
- Modify: `laura-pwa/src/lib/email.ts`

- [ ] **Step 1: Add template fetcher and variable replacer**

Add to `email.ts`:

```ts
type TemplateVars = Record<string, string>;

async function getActiveTemplate(type: string): Promise<{ subject: string; html_body: string } | null> {
    try {
        const result = await pool.query(
            "SELECT subject, html_body FROM email_templates WHERE type = $1 AND active = TRUE LIMIT 1",
            [type]
        );
        if (result.rowCount === 0) return null;
        return result.rows[0];
    } catch {
        return null;
    }
}

function applyVars(template: string, vars: TemplateVars): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
```

- [ ] **Step 2: Update each send function to use DB template with hardcoded fallback**

For each of the 4 existing send functions, add template lookup at the start. Example for `sendVerifyEmailEmail`:

```ts
export async function sendVerifyEmailEmail(to: string, verifyUrl: string, userName: string) {
    try {
        const tpl = await getActiveTemplate("verificacao_email");
        const vars: TemplateVars = { userName, verifyUrl };
        const subject = tpl ? applyVars(tpl.subject, vars) : "Confirme seu e-mail — Laura Finance";
        const html = tpl ? applyVars(tpl.html_body, vars) : `<div>...hardcoded fallback...</div>`;

        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject,
            html,
        });
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail de verificação", error);
        return null;
    }
}
```

Apply same pattern to: `sendReceiptEmail` (type: `comprovante_pagamento`), `sendPasswordResetEmail` (type: `reset_senha`), `sendWelcomeEmail` (type: `convite_membro`).

- [ ] **Step 3: Commit**

```bash
git add laura-pwa/src/lib/email.ts
git commit -m "feat: email.ts uses DB templates with hardcoded fallback"
```

---

## Task 7: API Docs Page

Build an interactive API documentation page showing all endpoints from the Go backend router.

**Files:**
- Rewrite: `laura-pwa/src/app/(admin)/admin/api-docs/page.tsx`

- [ ] **Step 1: Build API docs page with all endpoints**

Create a server component that renders a static but well-organized API reference. Group endpoints by domain (Auth, Categories, Cards, Transactions, Goals, Investments, Invoices, Debt Rollovers, Members, Reports, Score, Dashboard, Admin). Each endpoint shows: method badge (GET/POST/PUT/DELETE with color), path, brief description, auth requirement.

The data is a hardcoded array in the page derived from `router.go` — no need for runtime introspection.

Structure:
- Search/filter bar (client component wrapper)
- Collapsible sections per domain
- Method badges: GET=blue, POST=green, PUT=amber, DELETE=red
- Auth badges: "Session" for authenticated routes, "Super Admin" for admin routes
- Copy endpoint path on click

- [ ] **Step 2: Verify API docs page renders**

Open `http://localhost:3100/admin/api-docs` — should show all ~60+ endpoints organized by domain.

- [ ] **Step 3: Commit**

```bash
git add laura-pwa/src/app/\(admin\)/admin/api-docs/
git commit -m "feat(admin): interactive API documentation page"
```

---

## Task 8: Sync all files back to source + final build verification

**Files:**
- All modified files in `/tmp/laura-pwa-dev/`

- [ ] **Step 1: Copy all changes from /tmp/laura-pwa-dev back to source (Google Drive)**

```bash
rsync -av --exclude='node_modules' --exclude='.next' /tmp/laura-pwa-dev/src/ "$PROJECT_ROOT/laura-pwa/src/"
rsync -av /tmp/laura-pwa-dev/../infrastructure/migrations/ "$PROJECT_ROOT/infrastructure/migrations/"
```

- [ ] **Step 2: Run build to verify no errors**

```bash
cd /tmp/laura-pwa-dev && npx next build
```

Expected: Build succeeds with all admin routes listed.

- [ ] **Step 3: Restart dev server**

```bash
kill $(lsof -t -i:3100) && cd /tmp/laura-pwa-dev && nohup npx next dev -p 3100 > /tmp/laura-pwa-dev.log 2>&1 &
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: integrate admin configs into live system — complete admin panel"
```
