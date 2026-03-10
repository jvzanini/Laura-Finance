# Story 1.2: Cadastro Inicial de Administradores

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Proprietário,
I want me cadastrar no PWA inicializando meu Workspace (Família/Empresa) seguro com Dark Mode,
So that eu possa preparar meu painel para a chegada dos outros membros logando com sucesso.

## Acceptance Criteria

1. **Given** a página inicial do PWA (Authentication)
2. **When** eu me registro com e-mail forte e senha
3. **Then** o banco gera meu Tenant/Grupo seguro em AES-256 e me reconhece como "Proprietário"
4. **And** o sistema inicia a exibição do Dashboard visual (Ainda com Empty States em Skeletons baseados em componentes shadcn).

## Tasks / Subtasks
- [x] Inicialização de Tabela de Usuários/Workspaces no banco de dados
  - [x] Criar nova migration `000002_create_users_workspaces.sql` para gerar as tabelas de `workspaces` e `users` com controle de password hash (AES).
- [x] Interface de Authentication PWA (Frontend)
  - [x] Desenvolver a página de onboarding `/register` e `/login` com `shadcn/ui` (Cards, Inputs, Buttons) preservando a tipografia e Dark Mode absoluto.
- [x] Lógica de Registro (Server Actions/Go API)
  - [x] Implementar a validação e o registro do "Proprietário".
- [x] Rota Protegida do Dashboard
  - [x] Criar a página base `/dashboard` bloqueada por auth.
  - [x] Apresentar "Skeletons" provisórios na Dashboard demonstrando estados vazios aguardando os próximos Épicos.

## Dev Notes

### Technical Requirements
- Utilize Server Actions no Next.js (ou API no Go) conectados ao PostgreSQL.
- Armazene senhas tratadas (bcrypt/AES enc).
- Use os componentes `shadcn/ui` primários.
- Mantenha estrita obediência ao `Dark Mode`.

### Project Structure Notes
- `/laura-pwa/src/app/(auth)/register/page.tsx`
- `/laura-pwa/src/app/(dashboard)/layout.tsx`
- `/infrastructure/migrations/000002_create_users_workspaces.sql`

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/app/(auth)/register/page.tsx`
- `laura-pwa/src/app/(auth)/login/page.tsx`
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
- `laura-pwa/src/app/(dashboard)/layout.tsx`
- `laura-pwa/src/app/page.tsx`
- `laura-pwa/src/lib/actions/auth.ts`
- `laura-pwa/src/lib/session.ts`
- `laura-pwa/src/lib/db.ts`
- `infrastructure/migrations/000002_create_users_workspaces.sql`
