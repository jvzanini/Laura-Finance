# Story 1.1: Core Infrastructure & Project Setup

Status: ready-for-dev

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

- [ ] Repositório e Frontend Setup
  - [ ] Executar o comando inicial `npx create-next-app@latest laura-pwa --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - [ ] Inicializar o shadcn-ui `npx shadcn-ui@latest init` no diretório laura-pwa e configurar tema Dark Mode padrão
- [ ] Backend Go Setup
  - [ ] Executar `go mod init laura-finance-bot` no subdiretório `laura-bot`
  - [ ] Criar a estrutura básica de diretórios Go (`cmd/api`, `cmd/bot`, `internal/database`)
- [ ] Infraestrutura de Banco de Dados
  - [ ] Preparar o arquivo `docker-compose.yml` raiz provendo o PostgreSQL com suporte a RAG (ex: imagem base com `pgvector`)
  - [ ] Criar pasta `infrastructure/migrations` para SQL puras e script base para inicializar a DB vazia
- [ ] Documentação e Padrões
  - [ ] Configurar os linters na linguagem raiz (TS e Go)
  - [ ] Adicionar READMEs vazios nas sub-pastas

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
