# Story 2.2: Conexão Webhook / WhatsApp API (Go)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Arquitetura Integrada,
I want que o nosso backend em Golang crie um endpoint Webhook via HTTP (ex: Fiber ou Gin)
So that mensagens enviadas via WhatsApp API / EvolutionAPI (Baileys) cheguem no backend da Laura de forma extremamente rápida, leve e concorrente.

## Acceptance Criteria

1. **Given** a inicialização da aplicação Golang
2. **When** ocorrer um POST request na rota `/webhook/whatsapp` contendo um payload JSON com o numero do remetente e `remoteJid`
3. **Then** o sistema extrai o texto do áudio/mensagem, valida no PostgresC (Tabela Phones) se aquele número pode interagir.
4. **And** se for válido, ele devolve HTTP 200 OK imediato e enfileira uma goroutine pra continuar o fluxo passivo.
5. **And** se não estiver na tabela, ele apenas ignora pra não sobrecarregar LLM nem logs com spam.

## Tasks / Subtasks
- [x] Inicializar módulo em Go (`laura-go/`).
- [x] Instalar Framework web leve (ex: `github.com/gofiber/fiber/v2`).
- [x] Instalar pgx (`github.com/jackc/pgx/v5`) para conectar com Postgre.
- [x] Construir Router + Webhook Handler `/webhook/whatsapp`.
- [x] Validar DDI+DDD contra Tabela `phones` extraindo o WorkspaceID associado para repassar a request para frente.

## Dev Notes

### Technical Requirements
- Utilize variáveis de ambiente no lado do Go `.env` igual ao Next.js (`PGHOST`, `PGUSER` etc).
- Para desenvolvimento vamos forçar `PGHOST=127.0.0.1` e porta `5433` que remapeamos no Docker.
- Retornar Respostas limpas para evitar refazer requests do Whatsapp Partner.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-go/main.go`
- `laura-go/internal/db/db.go`
- `laura-go/internal/handlers/webhook.go`
- `laura-go/internal/models/payload.go`
- `laura-go/go.mod`
