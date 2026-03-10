# Story 1.4: Disparo de Acessos e Comprovantes (Email Transacional)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Banco de Dados / Core System,
I want disparar automaticamente emails via Resend/AWS SES para o pagador,
So that ele guarde sua nota de garantia e as credenciais invioláveis (Login seguro de Papéis).

## Acceptance Criteria

1. **Given** a confirmação do webhook do Gateway na Story 1.3 de uma Assinatura sucedida
2. **When** a API Go intercepta o pagamento
3. **Then** e-mails templates construídos devem ser enviados para o Proprietário (com receipt)
4. **And** caso novos dependentes sejam registrados, eles também devem receber senhas temporárias de acesso geradas e formatadas na caixa de e-mail.

## Tasks / Subtasks
- [x] Instalar Client do Resend para Node.js no App Next.js (já que Webhook do Stripe foi movido para o Next)
- [x] Criar classe/serviço `lib/email.ts` responsável por despachar e-mails.
  - [x] Implementar método `sendReceiptEmail(email, planName, amount)`.
  - [x] Implementar método `sendWelcomeEmail(email, temporaryPassword, role)`.
- [x] Conectar Envio de E-mail de Receita dentro do Webhook da Stripe (onde altera o status do Workspace para "active").

## Dev Notes

### Technical Requirements
- Utilizar a biblioteca `resend`. As keys de Resend e e-mail remetente devem ser `RESEND_API_KEY` e `NEXT_PUBLIC_APP_URL` ou mock.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/lib/email.ts`
- `laura-pwa/src/app/api/stripe/webhook/route.ts`
