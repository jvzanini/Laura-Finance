# ADR 008 — Auth login flakiness (investigation, 2026-04-25)

## Status
Investigation open. Not blocking phase 19.3 deploy.

## Context

Usuário reportou em 2026-04-25 que login em `https://laura.nexusai360.com/`
exigiu **3 tentativas** com as credenciais corretas antes de autenticar
com sucesso. Sintoma intermitente, sem mensagem de erro clara visível ao
usuário.

## Investigation

Disparado `Prod API Debug (all tasks logs)` workflow (run #24940886600,
2026-04-25 21:17 UTC). Achados:

1. **`webhook_secret_seed_failed`** repetido em vários startups do
   container `laura-api`:
   ```
   {"level":"WARN","msg":"webhook_secret_seed_failed",
    "err":"ERROR: invalid input syntax for type json (SQLSTATE 22P02)"}
   ```
   - Não relacionado a auth — falha no seed inicial do webhook secret
   - JSON malformado provavelmente em variável de ambiente
   - Follow-up: investigar separadamente

2. **`AUTH_INVALID_CREDENTIALS` em `GET /api/v*/.env`**:
   ```
   {"level":"WARN","msg":"request_error","error_code":"AUTH_INVALID_CREDENTIALS",
    "status":40*,"path":"/api/v*/.env","method":"GET"}
   ```
   - Bot scanner tentando acessar `.env` exposto
   - **Não relacionado** ao login do usuário (path errado, método GET)

3. **Sem evidência** de POST /auth/login com erro real do usuário
   nas últimas linhas extraídas. O log filtrado pelo workflow não
   cobriu a janela exata da tentativa de login do usuário, ou os
   logs de auth não estão sendo escritos com nível detectado pelo
   filtro.

## Hipóteses (sem dados pra confirmar agora)

| # | Hipótese | Como testar |
|---|---|---|
| 1 | Cache do browser servindo cookie session HMAC stale | Testar em janela anônima |
| 2 | Rate limit no api Go disparando após N tentativas (mas usuário só errou — ou não — 2x antes da 3ª funcionar) | Verificar config de rate limit |
| 3 | Race condition no HMAC quando dois requests concorrem (PWA pode estar fazendo 2 chamadas /me + /auth/login simultâneo) | Network tab no devtools |
| 4 | Latência do Postgres (cold start de connection pool em low traffic) | Verificar `connection_pool_idle` no api |
| 5 | Proxy/Traefik adicionando latência > timeout do client | Verificar logs do Traefik |

## Decision

**Não bloquear deploy 19.3.** Bug intermitente, sem causa raiz
identificada nos logs disponíveis. Documentado para investigação
quando reproduzir consistentemente.

**Próximos passos:**

1. Pedir ao usuário pra reproduzir em janela anônima (descarta hipótese 1).
2. Pedir pra reproduzir com Network tab aberto (captura sequence
   exata de requests + status codes).
3. Se reproduzir, abrir issue específica com payload + headers
   completos.
4. Investigar `webhook_secret_seed_failed` em paralelo (pode ser
   sintoma de problema mais amplo de bootstrap do api).

## Consequências

- Deploy 19.3 segue com mudanças visuais (foto literal + xadrez fix +
  sem breathing + sizes ajustados).
- Bug auth permanece como follow-up.
- Documentado pra próxima sessão não esquecer.
