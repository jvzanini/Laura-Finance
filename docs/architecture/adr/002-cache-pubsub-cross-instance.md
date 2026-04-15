# ADR 002 — Cache pub/sub cross-instance via Redis

**Status:** Accepted
**Data:** 2026-04-15
**Fase:** 15

## Contexto

O `RedisCache` hoje guarda itens no Redis compartilhado, mas a
**invalidação** (`Invalidate(pattern)`) é disparada por código de
negócio (handlers de mutação). Em deploy multi-instância (ex: Fly
Machines com N réplicas), apenas a instância que processou a mutação
apaga as chaves — as demais servem dados stale até a expiração do TTL.

## Alternativas consideradas

1. **TTL curto agressivo** — aceitar staleness até TTL expirar.
   Rejeitado: TTL de 5s mata o ganho do cache; TTL de 60s+ viola
   expectativas de consistência após ação do usuário.
2. **CRDT / invalidação por versionamento** — cada chave tem versão,
   leitor valida versão antes de servir. Rejeitado: complexidade alta,
   precisaria refatorar toda a interface Cache.
3. **Stampede lock + re-fetch síncrono** — mitiga thundering herd mas
   não resolve staleness.
4. **Redis pub/sub** — canal único `laura:cache:invalidate` com
   payload `(instance_id, pattern)`. Cada instância publica em
   Invalidate e consome do canal aplicando invalidação local
   (ignorando self-publish).

## Decisão

Adotar **Redis pub/sub (alternativa 4)**. Simplicidade operacional
alta (Redis já é dependência), latência <500ms em testes, loop
prevention via `instance_id` UUID gerado em boot.

## Consequências

**Positivas:**
- Invalidação cross-instance near-real-time.
- Zero mudança na interface `Cache` (pub/sub é interno a `RedisCache`).
- Kill-switch `CACHE_PUBSUB_DISABLED=true` se explodir em produção.
- Observability: metrics `laura_cache_pubsub_{publishes,receives}_total`
  + Sentry warn em loss de conexão >5 tentativas.

**Negativas:**
- At-least-once (pode haver mensagens duplicadas — idempotência no
  apply é necessária; DELETE é idempotente, OK).
- Se Redis cair, subscribers ficam em retry exponential (1s..16s) e
  publishes perdem — fallback é o TTL do cache cobrir janela curta.
- Cardinalidade controlada: label `pattern_kind` do publishes counter
  é resumido (workspace/other), não o pattern full.

## Implementação

- `RedisCache{instanceID: uuid.New(), ...}` criado em
  `bootstrap/cache.go`.
- `RedisCache.Start(ctx)` goroutine `PSubscribe` loop.
- `Invalidate(pattern)` faz delete local + publish.
- Handler ignora `msg.InstanceID == self.instanceID`.
- Metrics via `obs.CachePubsubMetrics` injetada com `SetMetrics`.

## Referências

- Commit `feat(cache): pub/sub cross-instance invalidation`.
- Testes: `internal/cache/redis_pubsub_test.go` (3 testes integration).
- Plan Fase 15 Sprint D.
</content>
</invoke>
