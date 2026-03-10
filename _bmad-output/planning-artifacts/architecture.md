---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-Laura Finance (Vibe Coding)-2026-03-10.md
  - ux-design-specification.md
workflowType: 'architecture'
project_name: 'Laura Finance (Vibe Coding)'
user_name: 'Joao'
date: '2026-03-10T14:21:03-03:00'
lastStep: 8
status: 'complete'
completedAt: '2026-03-10T14:49:21-03:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
A aplicação possui dupla interface. Uma API conversacional (via WhatsApp) responsável por input de dados (texto/áudio), parsing via NLP e categorização automática. E um PWA frontend (Next.js) focado em outputs estruturados, relatórios (DRE) e configurações complexas (tetos, usuários).

**Non-Functional Requirements:**
- **Performance:** Latência de resposta do bot < 2 segundos. PWA load < 1.5s.
- **Segurança/Compliance:** Adequação à LGPD, criptografia de dados financeiros sensíveis.
- **Disponibilidade:** 99.9% de uptime para não deixar o usuário "no vácuo" no WhatsApp.

**Scale & Complexity:**
A complexidade é classificada como **Alta** devido à orquestração de APIs externas (WhatsApp, provedores de LLM/NLP) concorrendo com acessos via web PWA.

- **Primary domain:** Full-stack distribuído (Web + Bot Backend).
- **Complexity level:** Alto.
- **Estimated architectural components:** 5-7 (Web App, API Gateway, Bot Worker, NLP Engine, Database, Message Queue).

### Technical Constraints & Dependencies

- Dependência crítica das políticas e estabilidade da API do WhatsApp (oficial ou não oficial).
- Custos indiretos com APIs de Inteligência Artificial para parsing de transações (ex: OpenAI, Anthropic ou LLMs locais).
- Necessidade de estado persistente seguro para multi-tenancy familiar (dados divididos por grupo/family_id).

### Cross-Cutting Concerns Identified

- **Sincronização PWA vs Chat:** Quando uma transação ocorre no chat, o Dashboard PWA deve ser atualizado rapidamente.
- **Data Privacy & Security:** Rígida segregação de tenant e obfuscamento (masking de valores nativo no frontend).
- **Resiliência de rede:** O PWA deve ser installable e lidar graciosamente com conexões ruins (Error Recovery Suave descrito no UX).

## Starter Template Evaluation

### Primary Technology Domain

Full-stack distribuído (Web App Frontend em Next.js 15 + Bot Backend). Baseado na necessidade de dualidade (Chatbot e PWA).

### Starter Options Considered

- **SaaS Boilerplates exaustivos (Ex: Next.js SaaS Starter):** Oferecem muito, mas podem vir com lock-in de auth (Clerk) ou ORM que pode não se adequar à orquestração com o Go backend.
- **Custom Clean Setup (Official `create-next-app` com `shadcn-ui@latest init`):** Setup sob medida, leve, focado exatamente no que a stack de UX pediu. Padrão ouro para desenvolvedores experientes.
- **Go Backend Boilerplate:** Custom `go mod init` focado em performance (Echo/Fiber) para o bot do WhatsApp.

### Selected Starter: Official Next.js 15 + shadcn/ui Base

**Rationale for Selection:**
A Laura Finance não é um SaaS genérico; é primariamente uma interface de bot no WhatsApp e um PWA "reativo". Um template exagerado traria muito ruído (Auth flows complexos, billing) que já serão gerenciados via WhatsApp. O setup modular oficial permite quebrar as partes do frontend facilmente e fazer um deploy acoplado à nossa API Go.

**Initialization Command:**

```bash
# Frontend
npx create-next-app@latest laura-pwa --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn-ui@latest init

# Backend
go mod init laura-finance-bot
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript 5+ para tipagem ponta-a-ponta (essencial para dados financeiros). No Backend, Go para máxima performance.

**Styling Solution:**
Tailwind CSS v4 integrado + utilitários `cn` do shadcn. Suporte a Dark Mode configurado via `next-themes`.

**Build Tooling:**
Webpack/Turbopack via Next.js 15.

**Testing Framework:**
A ser acoplado (Jest ou Vitest via setups padronizados de mercado).

**Code Organization:**
Arquitetura baseada em App Router (`/src/app`) com Server Components ativos por padrão. Separação de `/components/ui`.

**Development Experience:**
Fast Refresh no dev server de Next.js. Feedback em tempo real para os ajustes visuais.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database Engine: Estritamente PostgreSQL
- AI Core Model: Modelos mini de última geração (GPT-4.1-mini, GPT-5-mini)

**Important Decisions (Shape Architecture):**
- AI/LLM Agnosticism: Suporte multi-provedor (OpenAI, Anthropic, Google Gemini)

### Data Architecture

- **Database:** PostgreSQL puro padrão. Sem Supabase ou wrappers pesados, para maior controle e flexibilidade.
- **Vetorização/RAG:** Uso de `pgvector` nativo no PostgreSQL para suportar recursos de busca semântica, Retrieval-Augmented Generation (RAG) da própria IA de forma integrada.
- **Modelagem Financeira:** Valores financeiros armazenados de forma estrita em centavos (Integer) para evitar erros de ponto flutuante, crucial para transações e reportes DRE robustos.

### Artificial Intelligence & NLP

- **LLM Engine Principal:** OpenAI "mini" series focada na velocidade e custo otimizado para cenários conversacionais repetitivos. Modelos alvo: GPT-4.1-mini, GPT-5-mini ou GPT-5.4-mini (conforme disponibilidade da API 2026).
- **Provedores Alternativos:** Arquitetura deve ser agnóstica ou pelo menos facilmente permutável no backend Go para permitir Anthropic (Claude 3.5 Haiku) ou Google (Gemini 1.5 Flash), prevendo falhas ou alteração de preços do provedor.
- **Context Management:** Manutenção de sessões via PostgreSQL (histórico de mensagens curtas) vetorizadas via `pgvector` caso seja necessário injetar histórico longo.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
Definimos 4 áreas críticas onde agentes de IA poderiam tomar rotas diferentes e quebrar a aplicação (Database, Go Backend, Next.js e Dados Financeiros).

### Naming Patterns

**Database Naming Conventions (PostgreSQL):**
- **Formato:** `snake_case` absoluto e tabelas no plural.
- **Exemplos:** `users`, `transactions`, `family_groups`.
- **Primary/Foreign Keys:** `id` para PK, `user_id` para FK.
- **Restrição:** Nunca usar `camelCase` no banco de dados.

**Backend Go Conventions:**
- **Structs:** `PascalCase` (ex: `type Transaction struct`).
- **Variables:** `camelCase` (ex: `transactionTotal`).
- **JSON Tags:** Sempre `snake_case` para mapeamento perfeito com PostgreSQL e APIs (ex: ``json:"user_id"``).

**Frontend Next.js Conventions:**
- **Componentes React:** `PascalCase` para o nome do arquivo e função (ex: `MetricCard.tsx`).
- **Hooks e Utilitários:** `camelCase` (ex: `useTransaction.ts`, `formatCurrency.ts`).
- **Tipagens (TypeScript):** `PascalCase` e sem prefixo 'I' (ex: `type Transaction = {}`).

### Format Patterns

**Tratamento de Moeda (CRÍTICO):**
- O banco de dados PostgreSQL DEVE armazenar todos os valores como `INTEGER` representando **centavos**.
- É terminantemente proibido o uso de `FLOAT` ou `DECIMAL` para dinheiro no banco.
- Exemplo: R$ 50,25 é obrigatoriamente armazenado como `5025`.
- Apenas a camada de vizualização do Frontend fará a divisão por 100 para display.

**Tratamento de Datas:**
- PostgreSQL: `TIMESTAMPTZ` (Timestamp com Timezone).
- APIs: Envio/Recebimento estrito no formato `ISO 8601`.
- Frontend: Conversão UTC para o fuso do usuário via date-fns ou biblioteca equivalente.

### Communication Patterns

**API Response Formats (Go -> Next.js):**
Sempre envelopar as respostas de API do backend num formato padrão garantido:
```json
// Sucesso
{ "data": { ... }, "error": null, "success": true }

// Falha
{ "data": null, "error": { "code": "VALIDATION_FAILED", "message": "Motivo" }, "success": false }
```

### Process Patterns

**Loading State Patterns:**
- UX define Skeletons mimicando o conteúdo final como regra primária para page loads.
- Spinners são restritos a botões de submit ou pull-to-refresh (loaders concentrados).

**Error Handling Patterns:**
- Erros não capturados da API no Frontend devem bater nos arquivos `error.tsx` do App Router para um "Error Recovery Suave".

### Enforcement Guidelines

**All AI Agents MUST:**
- Armazenar saldos e valores como centavos (Inteiros).
- Usar PostgreSQL puro (nada de Supabase SDKs a não ser que revisto) com `pgvector`.
- Nomear tabelas estritamente em `snake_case`.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
laura-finance/
├── .github/
│   └── workflows/              # CI/CD pipelines (Testes, Deployments)
├── laura-pwa/                  # Frontend Web App (Next.js 15)
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/                # App Router (Páginas e Rotas API)
│   │   │   ├── (auth)/         # Rotas agrupadas de Login/Registro
│   │   │   ├── (dashboard)/    # Rotas privadas protegidas
│   │   │   ├── api/            # Ponto de comunicação Frontend -> Backend
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/             # Componentes base (shadcn)
│   │   │   ├── features/       # Componentes de negócio (MetricCard, etc)
│   │   │   └── layouts/        # Sidebar, BottomTabBar
│   │   ├── hooks/              # Custom hooks (estado, fetching)
│   │   ├── lib/                # Funções utilitárias (formatação de moeda, datas)
│   │   └── types/              # Definições TypeScript (Models de Transação, Usuário)
│   └── public/                 # Assets estáticos, manifest do PWA, ícones
│
├── laura-bot/                  # Backend Service & WhatsApp Bot (Go)
│   ├── go.mod
│   ├── go.sum
│   ├── cmd/
│   │   ├── bot/                # Entrypoint principal do worker do WhatsApp
│   │   └── api/                # Entrypoint para a API REST que serve o PWA
│   ├── internal/
│   │   ├── core/               # Domínio e lógica de negócio central
│   │   ├── database/           # Conexão PostgreSQL, Queries (`pgvector` e schemas)
│   │   ├── handlers/           # Handlers HTTP (para a web) e Handlers de Mensagem (bot)
│   │   ├── llm/                # Integração com OpenAI/Anthropic/Gemini
│   │   └── whatsapp/           # Camada de comunicação Whatsmeow
│   └── pkg/                    # Core libraries que poderiam ser extraídas no futuro
│
└── infrastructure/             # Scripts IaC, Dockerfiles, e Migrations de BD
    ├── migrations/             # Migrações SQL puras para o PostgreSQL
    ├── docker-compose.yml
    └── .env.example
```

### Architectural Boundaries

**API Boundaries:**
O PWA não conversa diretamente com o banco de dados. Ele se comunica com o backend Go através de uma API REST exposta pela pasta `laura-bot/cmd/api`. Todas as respostas de API seguem o padrão JSON envelope aprovado.

**Component Boundaries (Frontend):**
- Componentes em `/components/ui` são agnósticos (botões genéricos).
- Componentes em `/components/features` contêm lógica e integram com hooks (ex: `<TransactionFeed />` que chama os dados sozinho via SWR ou fetch).

**Data Boundaries (Backend):**
- O bot de WhatsApp APENAS recebe as mensagens de áudio/texto e repassa para a camada `/internal/llm/`.
- O LLM processa o áudio, categoriza a transação, converte dinheiro para centavos e repassa o objeto finalizado.
- Somente a camada `/internal/database/` executa SQL contra o PostgreSQL.

### Integration Points

**Internal Communication:**
- **Next.js ↔ Go API:** Comunicação primária via Fetch API/Server Actions, possivelmente utilizando SSE (Server Sent Events) em endpoints específicos para atualizar o PWA quando uma mensagem for recebida e parseada pelo robô do WhatsApp.

**External Integrations:**
- **WhatsApp Web API:** Comunicação via websocket persistido pelo backend Go.
- **LLM API (OpenAI/Anthropic):** Chamada via rede no momento da recepção de uma mensagem, usando streaming se possível.
- **Payment Gateway (SaaS):** Integração com Stripe ou nacional integrado no PWA para controle de assinaturas (webhooks).
- **Email Provider:** Integração transacional (ex: Resend, SES) para entrega segura de acessos e comprovantes aos adquirentes.

### Deployment Structure
A raiz do repositório acomoda subdiretórios facilmente plugáveis em provedores de cloud:
- `laura-pwa` pode ser entregue numa Vercel.
- `laura-bot` será buildado via Docker (`docker-compose.yml` providenciado) e alocado num servidor robusto (como DigitalOcean, AWS EC2 ou Railway) para manter o websocket do WhatsApp ativo ininterruptamente e se conectar ao banco PostgreSQL de forma segura.
