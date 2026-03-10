# Story 1.7: Painel de Privacidade e Compliance LGPD

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Membro/Admistrador/Proprietário logado,
I want acessar uma sessão de configurações de Segurança explícita e pedir a exclusão automática e física (Soft e/ou Hard delete),
So that lixos sonoros contendo conversas privadas curtas e áudios que gravei há mais de 30 dias sejam deletados dos provedores IA (OpenAI/S3) e meu vínculo seja quebrado de imediato.

## Acceptance Criteria

1. **Given** o acesso ao app em desktop ou mobile restrito
2. **When** o usuário exige exclusão na aba "Meus Dados / Direito ao esquecimento"
3. **Then** não só o encerramento do vínculo (churn SaaS e pausa de Gateway) deve ocorrer
4. **And** scripts transacionais baseados na LGPD processam hard deletion do tenant limpo (ou deleção passiva forçada cronometrada a 30 dias na ausência explícita do ok temporário).

## Tasks / Subtasks
- [x] Criar Action `lib/actions/lgpd.ts` contendo `deleteAccountAction()`.
  - [x] Ao rodar a action, se houver Subscription da Stripe, chamar a API da Stripe para cancelar a assinatura com status 'canceled'.
  - [x] Processar um `DELETE FROM workspaces WHERE id = $1` executando um Hard Delete brutal. Como desenhamos a arquitetura com `ON DELETE CASCADE` de FKs, isso varre `users`, `cards`, `categories` e `transactions` automaticamente e perfeitamente validado no PostgreSQL.
- [x] Construir Rota e Tela `/settings`.
  - [x] Uma sub-tab visual de "Disclaimer LGPD".
  - [x] Um Dialog Shadcn de "Red Zone" destrutiva (Are you sure? com typing confirm validation).
  - [x] Redirecionar para index (`/`) com sessão destruída instantaneamente.

## Dev Notes

### Technical Requirements
- Utilize `stripe.subscriptions.cancel(sub_id)` se o usuário for Premium.
- Para destruir a sessão local chame a action existente `deleteSession()`.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/lib/actions/lgpd.ts`
- `laura-pwa/src/app/(dashboard)/settings/page.tsx`
- `laura-pwa/src/app/(dashboard)/layout.tsx`
