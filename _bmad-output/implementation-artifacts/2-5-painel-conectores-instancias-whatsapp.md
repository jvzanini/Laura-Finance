# Story 2.5: Painel de Gerenciamento de Instâncias WhatsApp API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Administrador do Workspace
I want acessar um painel para ler um QR Code na tela
So that eu conecte a minha instância individual/compartilhada do WhatsApp via Evolution API (Whats1000) e faça o vínculo seguro com a minha conta SaaS.

## Acceptance Criteria

1. **Given** O usuário dono ou administrador logado no PWA
2. **When** a sessão acessar "WhatsApp Config / Scanner"
3. **Then** renderiza-se um card para solicitar um QR ou gerenciar instâncias ativas
4. **And** os dados são mascarados ou mantidos através de uma API segura evitando vazar informações.
5. **And** deve ter verificação de dois fatores/autenticação segura ou bloqueios de URL.

## Tasks / Subtasks
- [x] Construir layout/botões de `InstanceConnector` pra renderizar qr-code.
- [x] Server Action/API que simula o fetch do Whatsapp Partner Gateway e devolve string do QR.
- [x] Componente Renderizando qrcode de forma elegante.
- [x] Exibir Lista de conexões ativas e botão para "Desconectar".

## Dev Notes

### Technical Requirements
- Utilizar `qrcode.react` para desenhar o Base64/Hash vindo da Evolution API no FrontEnd.
- Como não temos O Gateway ao vivo 100%, vamos mocar o retorno com Promises com status `pending`, `qr`, e `connected`.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-pwa/src/components/features/InstanceConnector.tsx`
- `laura-pwa/src/app/(dashboard)/whatsapp/page.tsx`
- `laura-pwa/src/lib/actions/whatsapp.ts`
- `laura-pwa/src/app/(dashboard)/layout.tsx`
