# Retrospectiva — Epic 5: Simulação de Rolagem e Resgate de Crise

**Data**: 2026-04-11
**Status do Epic**: done
**Stories incluídas**: 5.1, 5.2, 5.3
**Story correlata (Epic 9)**: 9.1 (contraparte PWA)

## Contexto

O Epic 5 foi originalmente classificado como "Growth / Post-MVP inicial" e focava em dar à Laura a capacidade de, a partir de uma mensagem de aperto financeiro no WhatsApp ("minha fatura veio 6000 e só tenho 4 pra pagar"), ativar um state-machine de "Crise Handler", rodar um motor matemático preditivo com taxas de adquirentes e devolver opções de rolagem ao usuário — que aprovaria via chat e teria os débitos persistidos em calendários futuros.

Além disso, durante a auditoria de retro-documentação de 2026-04-11 descobrimos que a **contraparte visual** deste épico foi construída no PWA como Story 9.1 (`/invoices/push`), que persiste as operações na nova tabela `debt_rollovers`. Essa reconciliação está documentada no novo Epic 9 em `epics.md`.

## O que funcionou bem (Keep)

- **Separação clara em 3 stories** (evocação → motor → commit) deu um fluxo bem modelável para o state-machine do bot. A Story 5.1 entregou a detecção de intenção, a 5.2 a matemática, a 5.3 o commit em SQL — cada uma com escopo fechado.
- **Decisão de marcar como "Post-MVP inicial"** foi acertada — permitiu que Epics 1–4 chegassem primeiro ao usuário, e a feature de crise veio quando o produto já tinha base de dados relevante para simular.
- **Contexto conversacional** via `pgvector` (regra do `project-context.md`) permitiu à 5.1 resgatar o histórico recente da conversa para fazer a detecção de crise, sem reinventar memória.
- **Tabela de taxas centralizada no Go** (Story 5.2) foi reutilizada quase 1:1 quando o frontend do PWA precisou simular as mesmas operações na Story 9.1 — convergência feliz.

## O que não funcionou / pontos de atenção (Change)

- **Não existia tabela de persistência** no momento da implementação do Epic 5. A Story 5.3 gravava as prorrogações como `transactions` futuras puras, sem distinção semântica entre "despesa normal" e "parcela de rolagem". A Story 9.1 corrigiu isso introduzindo `debt_rollovers` — **mas o motor do Epic 5 ainda não escreve nessa tabela**. Hoje há duas fontes de verdade (WhatsApp grava em `transactions`, PWA grava em `debt_rollovers`). **Item de ação crítico abaixo.**
- **Tabela de taxas hardcoded** no código Go não tem mecanismo de atualização sem deploy — as taxas de adquirentes mudam com frequência e isso vai virar dívida técnica.
- **Ausência de UI de confirmação rica no WhatsApp**: a Story 5.2 previa botões in-line via templates oficiais, mas a implementação atual usa resposta textual simples devido à limitação do whatsmeow (não-oficial). Compensação foi feita pela Story 9.1 que oferece a confirmação visual rica no PWA.
- **Sem testes automatizados do motor matemático** (`regra de cobertura crítica 100%` do `project-context.md`). A matemática de Tabela Price e taxas compostas é exatamente o tipo de código que uma regressão silenciosa destrói.

## Aprendizados (Learn)

1. **Features "Crise" se beneficiam de dupla superfície (chat + PWA) desde o início**. O usuário em aperto não necessariamente está em mobilidade — muitas vezes está sentado no computador tentando organizar a vida. A Story 9.1 validou isso.
2. **Persistência específica > reuso oportunista da tabela principal**. Forçar rolagens a caberem em `transactions` gerou dívida semântica. Tabelas dedicadas como `debt_rollovers` com JSONB são a escolha certa para fluxos complexos com dados aninhados.
3. **State machines conversacionais precisam de "escape hatches"** — o Crise Handler do 5.1 precisou de tratamento explícito para o usuário digitar "cancela" a qualquer momento, algo que não estava nos ACs originais e foi descoberto em produção.
4. **Convergência Go ↔ PWA funciona quando a fonte de verdade é estabelecida cedo**. A migração Story 9.1 → Epic 5 motor Go é viável porque a estrutura de dados é compatível.

## Itens de ação

1. **[✅ DONE 2026-04-11 — commit `91b9dab`]** ~~Migrar a Story 5.3 para persistir em `debt_rollovers`~~. Resolvido. O handler da confirmação "Sim Laura, prorroga" agora chama `SimulateRollover` + `PersistRollover` em `laura-go/internal/services/rollover.go`, gravando na tabela `debt_rollovers` (SOT oficial) dentro de uma transação que também mantém as `transactions` futuras para o fluxo de DRE do Epic 6. Testes unitários cobrindo os casos principais ficam em `rollover_test.go`.

2. **[✅ DONE 2026-04-11 — commits `91b9dab`, `5d56a31`, `b3b2a60`, `93adb09`]** ~~Mover tabela de taxas das adquirentes~~. Resolvido em duas etapas:
   - Etapa 1 (`91b9dab`): tabela centralizada em `FeeTable` em `rollover.go` com as 6 adquirentes × 12 parcelamentos + teste de paridade com o PWA.
   - Etapa 2 (`5d56a31` + `b3b2a60` + `93adb09`): criada migration `000016_create_payment_processors` com tabela Postgres + seed idempotente. `rollover.go` passa a usar `LoadFeeTable(ctx)` com cache de 5min que consulta o banco; `fallbackFeeTable` preservado para testes offline. PWA ganhou `fetchPaymentProcessorsAction` + refactor do `/invoices/push` em server component async para consumir a action. Agora Postgres é SOT único das taxas para Go e TypeScript, alterar uma taxa é apenas um UPDATE em produção sem deploy.

3. **[✅ DONE 2026-04-11 — commit `b3b2a60`]** ~~Test suite para o motor matemático da Story 5.2~~. Cobertura ampla:
   - `rollover_test.go`: 6 testes sobre `SimulateRollover` (InfinitePay 2x, Stone 12x, processor inválido, installments inválido, roundtrip JSONB, paridade).
   - `crisis_context_test.go`: 6 testes sobre `SetCrisisContext`/`GetCrisisContext`/`PeekCrisisContext`/expiry/isolamento de telefones/nil-handling/overwrite.
   - `score_snapshot_test.go`: testes sobre `ScoreFactors.Score()` (zeros, max, fallback, crítico, pesos isolados).
   - A heurística naive `parsedTx.Amount * 0.35 + Tabela Price inline` foi **removida** — a detecção de crise agora chama `SimulateRollover` diretamente com o valor real extraído pelo NLP, armazena o contexto via `SetCrisisContext` e a confirmação consome via `GetCrisisContext`. Convergência total entre preview e persistência.
   - **Restante como backlog**: teste de integração end-to-end com Postgres real cobrindo parse texto → Set → Get → PersistRollover. Infra-de-teste mais que lógica.

4. **[Média]** Unificar a UX de confirmação: a Story 5.2 hoje manda texto puro no WhatsApp. Quando migrarmos para WhatsApp Business API oficial, implementar os botões in-line previstos no AC original.
   - **Owner sugerido**: backend Go
   - **Effort**: M (bloqueado por migração whatsmeow → oficial)

5. **[Baixa]** Adicionar um "painel de crises ativas" no super admin (Epic 7) para o empreendedor Admin do SaaS poder ver padrões agregados de uso do feature de rolagem — insight de PM.
   - **Owner sugerido**: frontend PWA
   - **Effort**: S

## Métricas de entrega

| Indicador | Valor |
|---|---|
| Stories planejadas | 3 |
| Stories entregues | 3 (100%) |
| Commits relacionados | `70f80ca` (Epic 4/5), `490b3ec`, `0b50751` (retro Epic 9.1) |
| Dívida técnica conhecida | 3 itens (items 1, 2, 3 acima) |
| Impacto em Epic adjacente | Epic 9 foi criado para formalizar a contraparte PWA |

---

**Retrospectiva fechada por**: Auditoria de reconciliação BMAD em 2026-04-11.
**Status final do Epic 5**: ✅ done (com 5 itens de ação para backlog subsequente).
