# Laura Finance

SaaS de gestao financeira familiar com assistente inteligente via WhatsApp.

## Arquitetura

```
laura-go/          Backend Go (Fiber v2) — API REST + WhatsApp Bot + NLP
laura-pwa/         Frontend Next.js 16 (PWA) — Painel web com tema escuro
infrastructure/    Docker Compose + 34 migrations PostgreSQL
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, TypeScript |
| Backend | Go 1.26, Fiber v2, pgx/v5, whatsmeow, Groq/OpenAI/Gemini (multi-provider) |
| Banco | PostgreSQL 16 + pgvector |
| Infra | Docker Compose, Testcontainers (E2E) |

## Funcionalidades

### Plataforma (Usuarios)

- **WhatsApp Bot** — Registra transacoes via linguagem natural (texto e audio)
- **Dashboard** — Saldo, cashflow, score financeiro, contas proximas
- **Cartoes** — CRUD de credito/debito com visual de bandeira e banco
- **Objetivos** — Metas financeiras com progresso e templates dinamicos
- **Investimentos** — Portfolio com retorno %
- **Categorias** — 13 categorias + 100 subcategorias com descricoes, personalizaveis
- **Faturas** — Controle de faturas com status open/paid/overdue
- **Empurrar Fatura** — Simulador de rollover com operadoras e taxas reais
- **Relatorios** — 9 dimensoes (DRE, categoria, cartao, membro, comparativo, tendencia...)
- **Multi-tenant** — Workspaces isolados, multiplos membros por familia
- **Score Financeiro** — Nota 0-100 baseada em 4 fatores configuraveis
- **PWA** — Service worker, install prompt, offline fallback

### Super Admin Panel

- **Dashboard** — Metricas cross-workspace, rolagem de divida, tendencias
- **Planos** — CRUD completo (nome, preco, capabilities IA, limites, features)
- **Config IA** — API keys por provider, modelo por plano, config padrao
- **Categorias e Subs** — 13 categorias + 100 subcategorias com descricoes completas
- **Objetivos** — Templates de metas com emoji, cor, descricao, valor padrao
- **Financeiro** — Bancos, bandeiras, corretoras, tipos de investimento (CRUD)
- **Operadoras** — Gerenciamento de processadoras de pagamento
- **Score** — Pesos, thresholds e lookback editaveis com preview visual
- **Workspaces** — Busca/filtro, troca de plano, suspend/reactivate
- **Audit Log** — Filtros por acao/entidade/admin/data, diff JSON, paginacao
- **WhatsApp** — Multi-instancia (estilo Evolution API)
- **Email** — Templates HTML editaveis (8 tipos), ativacao por tipo, preview
- **Seguranca** — Config de senha e NLP
- **Sistema** — Config global (nome, registro, manutencao, alertas)
- **API Docs** — Referencia interativa de 70+ endpoints com busca

## Setup Local

### Pre-requisitos

- Docker + Docker Compose
- Go 1.26+
- Node.js 20+
- Conta Groq (API key gratuita em console.groq.com)

### Opcao 1: Script automatico

```bash
./start.sh
```

O script detecta Google Drive, sobe banco, roda migrations, instala deps e inicia frontend + backend.

### Opcao 2: Manual

#### 1. Banco de dados

```bash
cd infrastructure
docker compose up -d
```

#### 2. Migrations

```bash
for f in infrastructure/migrations/*.sql; do
    docker compose -f infrastructure/docker-compose.yml exec -T postgres \
        psql -U laura -d laura_finance < "$f"
done
```

#### 3. Backend (Go)

```bash
cd laura-go
cp .env.example .env
# Edite .env com suas credenciais
go run main.go
```

Na primeira execucao, escaneie o QR code no terminal com seu WhatsApp.

#### 4. Frontend (PWA)

```bash
cd laura-pwa
cp .env.example .env.local
npm install
npm run dev
```

Acesse `http://localhost:3100`

## API

70+ endpoints REST sob `/api/v1/*`, todos autenticados via cookie de sessao.

| Metodo | Endpoints | Dominio |
|--------|-----------|---------|
| GET | 35+ | Leitura (transacoes, relatorios, dashboard, score, options...) |
| POST | 20+ | Criacao (cartoes, categorias, faturas, membros, admin...) |
| PUT | 15+ | Atualizacao (perfil, planos, config, workspaces...) |
| DELETE | 10+ | Remocao (cartao, transacao, membro, templates...) |

Rotas admin requerem `RequireSuperAdmin()` middleware.

Documentacao interativa disponivel em `/admin/api-docs` (super admin).

## Banco de Dados

34 migrations em `infrastructure/migrations/`:

| Range | Dominio |
|-------|---------|
| 001-024 | Core: users, workspaces, cards, categories, transactions, goals, investments, invoices, score, processors |
| 025-032 | Admin: system_config, subscription_plans, goal_templates, options (banks, brands, brokers, investment_types), category_templates, whatsapp_instances, audit_log |
| 033 | Email templates (8 tipos com HTML editavel) |
| 034 | Seed: 13 categorias reais + 100 subcategorias com descricoes |

## Variaveis de Ambiente

Veja `laura-go/.env.example` e `laura-pwa/.env.example`.

## Licenca

Proprietario - NexusAI. Todos os direitos reservados.
