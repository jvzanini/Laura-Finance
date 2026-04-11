---
project_name: 'Laura Finance (Vibe Coding)'
user_name: 'Nexus AI'
date: '2026-03-10T15:12:39-03:00'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 20
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Frontend:** Next.js 15 (App Router), TypeScript 5+, Tailwind CSS v4, shadcn/ui
- **Backend/Worker:** Go (Core API & whatsmeow WhatsApp Bot)
- **Database:** PostgreSQL puro (sem wrappers ORM pesados) + extensão `pgvector`
- **AI/LLM Engine:** OpenAI "mini" series (GPT-4.1-mini ou modelo equivalente), com arquitetura agnóstica para falback via Anthropic/Gemini

## Critical Implementation Rules

### Language-Specific Rules

- **PostgreSQL**: Nomeação estritamente em `snake_case` absoluto e tabelas no plural (ex: `users`, `transactions`).
- **Go Backend**: `PascalCase` para Structs, `camelCase` para variables, `snake_case` absoluto para JSON tags (mapeamento com o banco).
- **TypeScript**: Componentes e tipagens em `PascalCase` (sem 'I' explícito nas interfaces). Custom Hooks e utils em `camelCase`.
- **Tratamento de Moeda (CRÍTICO)**: O banco de dados DEVE armazenar todos os valores como `INTEGER` representando **centavos**. Proibido usar `FLOAT` ou `DECIMAL`. Conversão para real apenas na camada de interface.

### Framework-Specific Rules

- **API Responses (Go)**: Todas as rotas de API devem seguir a estrutura JSON wrapper: `{ "data": { ... }, "error": null, "success": true }`.
- **Next.js Boundaries**: Arquivos em `/components/ui` são UI base via shadcn. Arquivos em `/components/features` contêm regras de negócios, hooks e lógicas focadas do app.
- **Next.js Error Handling**: Erros não capturados da API no Frontend devem bater nos arquivos `error.tsx` nativos do App Router para Error Recovery Suave.

### Testing Rules

- **Test Frameworks**: Acoplar testes padrão de mercado (Jest ou Vitest) mantendo padrões unitários focados na camada correspondente (ex: testar serialização JSON no Go, hooks separados no Next.js).
- **Cobertura Crítica**: Regras de parsing de transações e transição monetária cents/reais requerem 100% test coverage.

### Code Quality & Style Rules

- **Pure SQL**: É terminantemente proibido o uso de ORMs super-abstratos ou pseudo-BDs como Supabase SDKs a não ser que especificamente documentado/recertificado. Focar em PostgreSQL puro e `pgvector`.
- **UI Styling & Design System**: Tailwind CSS v4 + utilitários `cn` do shadcn. Todo estilo deve aderir rigidamente ao Design System preestabelecido na especificação UX. 
  - **Dark Mode First-Class**: O tema padrão e mandatório é Dark Mode. Use CSS variables para base `#0A0A0F`, primary `#7C3AED` (violeta) e secondary `#10B981` (verde).
  - **Acessibilidade (A11y)**: Tap targets mobile devem ter mínimo **44x44px**. Cores de status (verde/vermelho) DEVEM SEMPRE estar acompanhadas de iconografia pertinente (✅, ❌) devido a daltonismo. WCAG AA mínimo em todos os contrastes.
  - **Uso de Animações**: Não sobrecarregue a interface. `Framer Motion` restrito apenas a elementos de complexidade alta estipulados no UX (ex: *HealthScoreGauge*, *MetricCard countUp*, *StreakBadge*). Componentes base apenas usam transições CSS nativas.

### Development Workflow Rules

- **Deploy Structure**: PWA gerido via Vercel (Front-end), Bot WhatsApp buildado via Docker com websockets persistentes em Cloud de alta estabilidade (para suportar o whatsmeow).

### Critical Don't-Miss Rules

- 🚫 **NUNCA** calcule ou insira valores `float` ou `decimal` referenciando saldo bancário. Centavos (Integer) sempre e exaustivamente, delegando parse decimal apenas à view render.
- 🚫 **SÃO PROIBIDOS** spinners crônicos. A aplicação baseia-se em Skeletons que mimetizam a forma final da UI. Spinner reservado estritamente a load de botões (`isLoading=true`) e ações pull-to-refresh.
- ⚠️ **Histórico de Chat Vetorizado**: O histórico transacional NLP para manter o contexto das interações do bot obrigatoriamente persiste nativamente via `pgvector`.
- ⚠️ **Banco de Dados Centralizado (SOT)**: Como a arquitetura é dual (Bot + PWA ocorrendo concorrentemente no backend Go), a UI não retém estado de tenant de forma crua - obedeça rigorosamente autorização relacional de `tenant_id`/`family_id` pelo DB.
- ⚠️ **Exceção Permitida a FLOAT/DECIMAL (auditoria 2026-04-11)**: A regra de "cents-only" aplica-se a **valores monetários**. Percentuais e taxas (ex: `debt_rollovers.fee_percentage DECIMAL(5,2)`, taxa de adquirente como `3.99%`) podem usar DECIMAL porque representam razões, não dinheiro. Ainda proibido: FLOAT em qualquer contexto, e DECIMAL para valores em R$.
- ⚠️ **Emoji em colunas de texto**: Tabelas como `categories`, `financial_goals`, `investments` usam `VARCHAR(10)` para emoji para acomodar sequências ZWJ do Unicode. Não usar `CHAR(1)` nem `VARCHAR(4)`.
- ⚠️ **Batch seeds exigem transação**: Sempre que uma server action fizer seed/import de hierarquia (ex: `seedCategoriesAction` com categorias + subcategorias), obrigatório BEGIN/COMMIT/ROLLBACK. Falha parcial = rollback total.
- ⚠️ **Planejamento ≠ Registro**: O PWA tem duas camadas distintas: **Registro** (`transactions`, `cards`, `invoices` — eventos que aconteceram) e **Planejamento** (`financial_goals`, `investments`, `categories.monthly_limit_cents` — alvos e tetos). Features novas devem declarar explicitamente em qual camada vivem. Confundir as duas gera bug semântico.
- ⚠️ **Fonte única de verdade para rolagens de dívida**: `debt_rollovers` é o sink oficial para o feature "Empurrar Fatura" de AMBOS os canais (WhatsApp Epic 5 e PWA Story 9.1). Não gravar rolagens só em `transactions` futuras — sempre escrever também em `debt_rollovers` com `operations_json` preenchido.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-11 (retro-doc: Epics 8 e 9 adicionados, 5 novas regras críticas incorporadas)
