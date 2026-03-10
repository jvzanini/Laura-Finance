# Story 1.1: Core Infrastructure & Project Setup

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Desenvolvedor Frontend/Backend,
I want inicializar o repositório com Next.js 15, shadcn/ui e banco de dados Go+PostgreSQL,
so that possamos ter a infraestrutura escalável necessária para a PWA e o Webhooks Gateway.

## Acceptance Criteria

1. **Given** um novo repositório limpo
2. **When** configuramos a aplicação
3. **Then** devemos utilizar `npx create-next-app` seguido de `shadcn-ui init` com Tailwind CSS e Dark Mode Ativado
4. **And** devemos instanciar conexões limpas em um ORM seguro ou SQL puro com PostgreSQL armazenando transações nativamente em CENTS (Integer), sem tolerância a falhas de float.

## Tasks / Subtasks

- [x] Repositório e Frontend Setup
  - [x] Executar o comando inicial `npx create-next-app@latest laura-pwa --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - [x] Inicializar o shadcn-ui `npx shadcn-ui@latest init` no diretório laura-pwa e configurar tema Dark Mode padrão
- [x] Backend Go Setup
  - [x] Executar `go mod init laura-finance-bot` no subdiretório `laura-bot`
  - [x] Criar a estrutura básica de diretórios Go (`cmd/api`, `cmd/bot`, `internal/database`)
- [x] Infraestrutura de Banco de Dados
  - [x] Preparar o arquivo `docker-compose.yml` raiz provendo o PostgreSQL com suporte a RAG (ex: imagem base com `pgvector`)
  - [x] Criar pasta `infrastructure/migrations` para SQL puras e script base para inicializar a DB vazia
- [x] Documentação e Padrões
  - [x] Configurar os linters na linguagem raiz (TS e Go)
  - [x] Adicionar READMEs vazios nas sub-pastas

## Dev Notes

### Technical Requirements
- Next.js 15 (App Router), TypeScript 5+, Tailwind CSS v4, shadcn/ui
- Go (Core API)
- PostgreSQL puro com abstrações limpas ou pgx, garantindo schema com `INTEGER` cents
- PostgreSQL DEVE usar a imagem que suporta a extensão `pgvector`

### Project Structure Notes
- Alignment with unified project structure:
```text
laura-finance/
├── laura-pwa/                 
│   ├── src/app/
│   ├── src/components/ui/    
│   ├── src/components/features/
├── laura-bot/                 
│   ├── cmd/
│   ├── internal/database/     
└── infrastructure/            
    ├── migrations/            
    ├── docker-compose.yml     
```

### Critical Rules constraints
- O banco de dados DEVE armazenar todos os valores como `INTEGER` representando **centavos**. Proibido usar `FLOAT` ou `DECIMAL`.
- É terminantemente proibido o uso de ORMs super-abstratos; prefira queries puras de SQL no Go utilizando db drivers confiáveis como `pq` ou `pgx`.
- Respeite o `Dark Mode First-Class`: CSS variables base `#0A0A0F`, `#7C3AED` (violeta), `#10B981` (verde).

### References
- [Source: _bmad-output/project-context.md#Technology-Stack-Versions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1-Core-Infrastructure-Project-Setup]

## Dev Agent Record

### Agent Model Used

Antigravity 1.5 Pro

### Debug Log References

- Executado Next.js v15 e Tailwind v4 via node v20.20.1
- Inicializado Shadcn v4 UI e atualizados os globals.css com Dark Mode root default.
- Instalada toolchain do Go via Brew e setado init para `laura-finance-bot`.
- Linter configurado via arquivo .golangci.yml.

### Completion Notes List

Toda infraestrutura baseline foi instanciada sem intervenção com testes positivos na compilação do App Router (Next) e inicialização passiva do banco relacional puro com PgVector preparado para a Story 2 do Chatbot e processamento local.

### File List

- `laura-pwa/*`
- `laura-bot/go.mod`
- `laura-bot/.golangci.yml`
- `infrastructure/docker-compose.yml`
- `infrastructure/migrations/000001_init.sql`
