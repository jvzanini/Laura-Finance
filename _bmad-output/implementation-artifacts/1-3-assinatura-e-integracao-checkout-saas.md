# Story 1.3: Assinatura e Integração com Checkout SaaS

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Proprietário não-pagante,
I want visualizar as features premium da minha Assistente Laura e realizar o pagamento pela Landing Page de Checkout embutida,
So that as restrições de limite de uso e transações ilimitadas na infraestrutura da IA sejam liberadas.

## Acceptance Criteria

1. **Given** que eu acabei de criar a conta gratuita
2. **When** eu navego pelas opções bloqueadas e clico em "Assinar Laura Finance" no Dashboard
3. **Then** sou redirecionado a um painel seguro criptografado provido por Gateway (Stripe)
4. **And** o status retornado via webhook pelo provedor desbloqueará temporariamente me dando as bandeiras ativas no banco de dados para iniciar o "PWA Pro".

## Tasks / Subtasks
- [x] Criação de Migration de Stripe IDs
  - [x] Criar `000003_add_subscription_to_workspaces.sql` adicionando campos de `stripe_customer_id`, `stripe_subscription_id`, `plan_status`.
- [x] Integração com Stripe Checkout
  - [x] Criar um pacote Stripe no Next.js (instalar stripe SDK)
  - [x] Rota `/api/stripe/checkout` para inicializar a sessão de checkout
  - [x] Componente visual `UpgradeDialog` em Shadcn (Card de planos) na dashboard
- [x] Construir o Webhook do Stripe (Go API ou Next.js)
  - [x] Rota `/api/stripe/webhook` que lida com o evento `checkout.session.completed` para atualizar a tabela `workspaces`.

## Dev Notes

### Technical Requirements
- Next.js API Routes (Route Handlers) para o lado client/server do middleware Stripe ou webhooks.
- Stripe SDK oficial (`stripe`).
- Banco de dados PostgreSQL direto.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
