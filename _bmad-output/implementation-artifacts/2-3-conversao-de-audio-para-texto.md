# Story 2.3: Conversão de Áudio para Texto (Whisper/Groq)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Integrador Cloud de IA,
I want que o servidor Go intercepte arquivos de áudio (.ogg/.mp4) provenientes do WhatsApp e os envie para a Cloud (Groq/Whisper)
So that a plataforma consiga converter instantaneamente falas, lamentos e áudios gravados no carro em texto "cru", preparando o dado para parsing estruturado posterior.

## Acceptance Criteria

1. **Given** a rotina de processamento já assíncrona recebendo a requisição
2. **When** o payload do WhatsApp contiver um anexo/base64 de áudio `.ogg` ou `.mp3`
3. **Then** o servidor deverá baixar ou decodificar o arquivo.
4. **And** fazer um POST multipart para a API da `Groq` usando o model `whisper-large-v3-turbo`
5. **And** retornar a transcrição limpa para ser repassada para o Cérebro Llama-3 de Categorização.

## Tasks / Subtasks
- [x] Ajustar o struct `WebhookPayload` para aceitar parâmetros do Message Audio e capturar strings base64.
- [x] Criar pacote `packages/ai` ou `internal/services/groq.go`.
- [x] Implementar a func `TranscribeAudio(base64Data string)` que realiza Request `multipart/form-data` e conecta ao Groq.
- [x] Se o Payload possuir string conversacional comum (texto), ignoramos essa etapa. Se for áudio, substituimos o conteudo para a string extraida.

## Dev Notes

### Technical Requirements
- Groq URL: `https://api.groq.com/openai/v1/audio/transcriptions`
- Injetar `GROQ_API_KEY` no arquivo `.env`.
- Tratamento de erro robusto caso a Groq bloqueie com Rate Limit ou audio bugado.

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Debug Log References
### Completion Notes List
### File List
- `laura-go/internal/services/groq.go`
- `laura-go/internal/models/payload.go`
- `laura-go/internal/handlers/webhook.go`
