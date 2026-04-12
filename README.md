# Laura Finance

SaaS de gestao financeira familiar com assistente inteligente via WhatsApp.

## Arquitetura

```
laura-go/          Backend Go (Fiber v2) — API REST + WhatsApp Bot + NLP
laura-pwa/         Frontend Next.js 15 (PWA) — Painel web com tema escuro
infrastructure/    Docker Compose + 24 migrations PostgreSQL
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS v4, shadcn/ui, TypeScript |
| Backend | Go 1.26, Fiber v2, pgx/v5, whatsmeow, Groq (Llama 3 + Whisper) |
| Banco | PostgreSQL 16 + pgvector |
| Infra | Docker Compose, Testcontainers (E2E) |

## Funcionalidades

- **WhatsApp Bot** — Registra transacoes via linguagem natural (texto e audio)
- **Dashboard** — Saldo, cashflow, score financeiro, contas proximas
- **Cartoes** — CRUD de credito/debito com visual de bandeira e banco
- **Objetivos** — Metas financeiras com progresso
- **Investimentos** — Portfolio com retorno %
- **Categorias** — 8 categorias padrao x 36 subcategorias, personalizaveis
- **Faturas** — Controle de faturas com status open/paid/overdue
- **Empurrar Fatura** — Simulador de rollover com 6 operadoras e taxas reais
- **Relatorios** — 9 dimensoes (DRE, categoria, cartao, membro, comparativo, tendencia...)
- **Multi-tenant** — Workspaces isolados, multiplos membros por familia
- **Score Financeiro** — Nota 0-100 baseada em 4 fatores
- **Admin SaaS** — Overview cross-workspace para super admin
- **PWA** — Service worker, install prompt, offline fallback

## Setup Local

### Pre-requisitos

- Docker + Docker Compose
- Go 1.26+
- Node.js 20+
- Conta Groq (API key gratuita em console.groq.com)

### 1. Banco de dados

```bash
cd infrastructure
docker compose up -d
```

### 2. Backend (Go)

```bash
cd laura-go
cp .env.example .env
# Edite .env com suas credenciais
go run cmd/main.go
```

Na primeira execucao, escaneie o QR code no terminal com seu WhatsApp.

### 3. Frontend (PWA)

```bash
cd laura-pwa
cp .env.example .env.local
# Edite .env.local com suas credenciais
npm install
npm run dev
```

Acesse `http://localhost:3100`

## API

42 endpoints REST sob `/api/v1/*`, todos autenticados via cookie de sessao.

| Metodo | Endpoints | Dominio |
|--------|-----------|---------|
| GET | 25 | Leitura (transacoes, relatorios, dashboard, score...) |
| POST | 14 | Criacao (cartoes, categorias, faturas, membros...) |
| PUT | 3 | Atualizacao (perfil, settings, senha) |
| DELETE | 3 | Remocao (cartao, transacao, membro) |

Cobertura: 37 testes E2E com Testcontainers (Postgres descartavel por teste).

## Variaveis de Ambiente

Veja `laura-go/.env.example` e `laura-pwa/.env.example`.

## Licenca

Proprietario - NexusAI. Todos os direitos reservados.
