# Story 2.1: Cadastro Seguro de Múltiplos Números (Filhos/Cônjuge)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Proprietário/Administrador,
I want adicionar dependentes informando seus números de WhatsApp via PWA,
So that a Laura do Whatsapp aceite interações desses números atrelados ao meu Workspace, permitindo finanças conjuntas de forma segura.

## Acceptance Criteria

1. **Given** a aba Logada no PWA (podendo ser em Settings ou no Dashboard)
2. **When** o administrador inputar o número DDI+DDD+Telefone de um dependente
3. **Then** este número é salvo no banco atrelado ao usuário/membro no PostgreSQL.
4. **And** se este número tentar usar o WhatsApp (no futuro módulo em Go), ele passará pela trava de segurança validando sua existência no Workspace.

## Tasks / Subtasks
- [x] Criar Migration `000006_create_phones.sql` para cadastrar telefones extras no PostgreSQL.
  - Campos: `user_id` (Membro logado ou novo membro simplificado), `phone_number` e nome.
- [x] Componente UI no PWA em `(dashboard)` para visualizar e registrar dependentes ("Family/Team Members").
- [x] Server Action `lib/actions/members.ts` contendo lógica para convidar/adicionar um novo número de telefone.

## Dev Notes

### Technical Requirements
- O número de telefone deve ser formatado ou normalizado (idealmente E.164, ex: `5511999999999`) para bater exatamente com a requisição webhook do parceiro de WhatsApp (Evolution API / Baileys).
- Essa história preparará a base PostgreSQL para que a história 2.2 da Go API tenha como checar: "Esse remetente no WhatsApp existe no banco? -> Não -> Ignorar."

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `infrastructure/migrations/000006_create_phones.sql`
- `laura-pwa/src/lib/actions/phones.ts`
- `laura-pwa/src/components/features/MemberWizard.tsx`
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
