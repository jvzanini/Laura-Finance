# ADR 001 — golangci-lint aguarda v2.x com suporte Go 1.26

**Data:** 2026-04-15
**Status:** Aceito

## Contexto

golangci-lint v1.x não suporta Go 1.26 (built with Go 1.24). Job CI `lint` desabilitado desde Fase 10.

## Decisão

Manter job CI `lint` desabilitado até golangci-lint v2.x ser publicado com suporte Go 1.26.

## Alternativas rejeitadas

- **Downgrade Go 1.26 → 1.24:** perde features novas (slog.WithoutCancel, etc).
- **Fork custom golangci-lint:** overhead alto, pouco benefício.

## Revisão

Revisitar trimestralmente. Tracking upstream: https://github.com/golangci/golangci-lint/issues
