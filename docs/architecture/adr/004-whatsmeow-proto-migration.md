# ADR 004 — whatsmeow proto migration (binary/proto → proto/waE2E)

**Data:** 2026-04-16
**Status:** ACEITO (Fase 17A).

## Contexto

Staticcheck `SA1019` reportava 5 warnings por uso de
`go.mau.fi/whatsmeow/binary/proto` (deprecated). O pacote
`go.mau.fi/whatsmeow/proto/waE2E` já está disponível em
`whatsmeow v0.0.0-20260305215846-fc65416c22c4` com as mesmas structs
(ex.: `Message{Conversation, ExtendedTextMessage, ...}` em
`WAWebProtobufsE2E.pb.go:9581`).

## Decisão

Migrar os 5 callsites (`client.go` ×3, `instance_manager.go` ×2)
para `waE2E`:

```go
// antes
waProto "go.mau.fi/whatsmeow/binary/proto"
waProto.Message{...}
// depois
waE2E "go.mau.fi/whatsmeow/proto/waE2E"
waE2E.Message{...}
```

## Consequências

- Zero `SA1019` remanescente.
- Alinhamento com upstream; sem risco em remoção futura de
  `binary/proto`.
- Cobertura `whatsapp` (16.3%) mantida; teste regression
  `TestSQLStoreNew_AutoCreatesWhatsmeowTables` valida schema
  `sqlstore` intacto com Postgres local.

## Alternativas consideradas

- Manter `binary/proto` com supressão `SA1019` permanente. Rejeitado:
  dívida crescente conforme upstream remove pacote legacy.
- Aguardar whatsmeow vX.Y com nova API unificada. Rejeitado: sem
  sinal de roadmap; `proto/waE2E` já é estável.
