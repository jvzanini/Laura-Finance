# ADR 001 — golangci-lint aguarda v2.x com suporte Go 1.26

**Data:** 2026-04-15
**Status:** Resolvido em 2026-04-15 (Fase 16) — golangci-lint v2.11.4
habilitado com suporte Go 1.26.

## Contexto

golangci-lint v1.x não suporta Go 1.26 (built with Go 1.24). Job CI `lint` desabilitado desde Fase 10.

## Decisão

Manter job CI `lint` desabilitado até golangci-lint v2.x ser publicado com suporte Go 1.26.

## Alternativas rejeitadas

- **Downgrade Go 1.26 → 1.24:** perde features novas (slog.WithoutCancel, etc).
- **Fork custom golangci-lint:** overhead alto, pouco benefício.

## Revisão

Revisitar trimestralmente. Tracking upstream: https://github.com/golangci/golangci-lint/issues

## Resolução (Fase 16 — 2026-04-15)

golangci-lint v2.11.4 (built with go1.26.1) released 2026-03-22
suporta Go 1.26. Habilitado em `.github/workflows/go-ci.yml` com
config `.golangci.yml` v2 (govet + ineffassign + staticcheck com
checks seletivos). Pre-existing issues (ST1005, QF* stylistic,
SA1019 upstream whatsmeow) silenciados — cleanup gradual em fases
futuras. `errcheck` e `revive` ficam para Fase 17+ (>38 warnings).

