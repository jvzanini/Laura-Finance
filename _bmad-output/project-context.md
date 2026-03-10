---
project_name: 'Laura Finance (Vibe Coding)'
user_name: 'Nexus AI'
date: '2026-03-10T15:12:39-03:00'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 15
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

Last Updated: 2026-03-10T15:12:39-03:00
