# Story 1.5: Wizard de Cadastro de Emissores (Cartões)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Proprietário/Administrador,
I want registrar e configurar meus cartões de crédito e as contas correntes de uso (Emissores) predefinindo seus fechamentos,
So that a Laura no Whatsapp saiba exatamente onde o dinheiro foi processado.

## Acceptance Criteria

1. **Given** o Stepper do Dashboard do PWA
2. **When** eu preencho os campos de "Novo Cartão" (Sem os 16 dígitos físicos, apenas a Bandeira, Vencimento, Cor, e Nome do dono e final/apelido)
3. **Then** o PostgreSQL relacional salvará o emissor associado aquele perfil da familia/empresa
4. **And** eu terei a chance sequencial e otimizada (Progress Bar de passos) de continuar incluindo cartões em menos de 1 minuto sem reloading massivo de UI. 

## Tasks / Subtasks
- [x] Construir a Migration de Cartões (`000004_create_cards.sql`) associado ao `workspace_id`.
- [x] Criar Action `lib/actions/cards.ts` para persistência ágil usando Server Actions.
- [x] Criar Componente Front-end Wizard Modal Shadcn (`CardWizard.tsx`).
  - [x] Implementar Progress Bar baseada no avanço visual passo-a-passo no próprio cliente.
  - [x] Ao salvar, limpar campos de forma fluida para perguntar "Quer cadastrar mais um?" sem recarregar a tela.
- [x] Adicionar botão "Meus Cartões" na Dashboard para invocar o modal do Wizard.

## Dev Notes

### Technical Requirements
- NUNCA coletamos dados reais do cartão (Pan integral / CVV), apenas meta-dados.
- Use `shadcn/ui` `dialog`, `progress`, `input`, `select`.
- Tabelas de Banco: `cards` com `workspace_id`, `name`, `brand`, `closing_day`, `due_day`, `color`, `last_four`.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `infrastructure/migrations/000004_create_cards.sql`
- `laura-pwa/src/lib/actions/cards.ts`
- `laura-pwa/src/components/features/CardWizard.tsx`
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`
