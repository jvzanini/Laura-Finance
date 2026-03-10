# Story 2.4: NLP Parsing, Estruturação e Log (Groq/Llama-3)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Eng. de Dados de IA,
I want que o servidor Go processe a String final recebida do WhatsApp em um modelo Llama-3-70b
So that possamos extrair estruturadamente a intenção de gasto/ganho (JSON), e salvar o raw log e a transação correspondente no PostgreSQL, finalizando o pipe base.

## Acceptance Criteria

1. **Given** a string transcrita em áudio ou texto cru de WhatsApp ("gastei 20 reais no ifood hoje no cartão nubank")
2. **When** o sistema acionar `ParseTransactionGroq()`
3. **Then** o retorno será um JSON estruturado com: valor numérico, descrição original, tipo(ganho/gasto), e nome do cartão/categoria identificado.
4. **And** O log será salvo na tabela `message_logs`.
5. **And** Se for um gasto identificado, uma nova linha é criada na tabela `transactions`.

## Tasks / Subtasks
- [x] Criar Migration para Tabela `message_logs` e `transactions` (PostgreSQL) `000007` e `000008` (se ainda não existirem).
- [x] Configurar chamada REST em `internal/services/groq.go` para usar Text Generation model `llama-3-70b-versatile`.
- [x] Criar função de prompt no source-code, instruindo formato System Message "Apenas responda JSON raw".
- [x] Conectar os repositórios Go para inserir o Log e a Transaction.

## Dev Notes

### Technical Requirements
- Transactions Database Schema: `id`, `workspace_id`, `amount`, `description`, `type`, `date`, `card_id` (NULL-able), `category_id` (NULL-able). 
- Inserir tudo em `UTC` nas datas como fallback.
- Se o LLM não conseguir traduzir o json, devolve erro limpo via fallback no Background GoRoutine e não quebra o sistema.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-go/internal/services/nlp.go`
- `infrastructure/migrations/000007_create_message_logs.sql`
- `infrastructure/migrations/000008_create_transactions.sql`
- `laura-go/internal/handlers/webhook.go`
