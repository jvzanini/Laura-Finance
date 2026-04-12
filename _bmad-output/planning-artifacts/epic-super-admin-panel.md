# Epic: Super Admin Panel — PRD & Stories

**Data:** 2026-04-12
**Autor:** Claude Opus 4.6 + NexusAI
**Status:** Draft
**Prioridade:** Alta

---

## 1. Visao Geral

O Super Admin Panel e o painel de controle centralizado do SaaS Laura Finance, acessivel apenas por usuarios com `is_super_admin = true`. Diferente do admin atual (que so exibe indicadores), este painel permite **configurar** todos os parametros do sistema: modelos de IA, planos de assinatura, operadoras de pagamento, templates, instancias WhatsApp e mais.

**Rota base:** `/admin` (substituindo o admin atual de indicadores, que vira uma aba dentro do novo painel)

---

## 2. Estrutura de Navegacao

```
/admin
  /admin                    → Dashboard (indicadores atuais + saude do sistema)
  /admin/ai-models          → Configuracao de modelos IA por plano
  /admin/plans              → Planos de assinatura e capabilities
  /admin/processors         → Operadoras de pagamento (gateway fees)
  /admin/categories         → Templates de categorias/subcategorias globais
  /admin/goal-templates     → Presets de objetivos financeiros
  /admin/brokers            → Corretoras e tipos de investimento
  /admin/whatsapp           → Instancias WhatsApp (multi-conexao)
  /admin/workspaces         → Gestao de workspaces (visualizar, suspender)
  /admin/api-docs           → Documentacao interativa da API REST
  /admin/system             → Saude do sistema, logs, config geral
```

---

## 3. Epics & Stories

### Epic A: Infraestrutura do Admin Panel

**Objetivo:** Base tecnica para o painel — layout, rotas, middleware, navegacao.

#### Story A.1: Layout e sidebar do admin
- Criar layout `/app/(admin)/layout.tsx` com sidebar dedicada
- Mesmo tema escuro/roxo do PWA, mas com icone de engrenagem no header
- Sidebar com todas as secoes listadas acima
- Badge "Admin" visivel no header
- Redirect para `/login` se nao for super_admin

#### Story A.2: Middleware de protecao admin
- Toda rota `/admin/*` verifica `is_super_admin` no server component
- Go: grupo de rotas `/api/v1/admin/*` ja tem `RequireSuperAdmin()` middleware
- Adicionar novos endpoints admin no mesmo grupo

#### Story A.3: Migration — tabelas de configuracao global
- `system_config` (key/value JSONB para configuracoes gerais)
- `subscription_plans` (id, name, slug, price_cents, stripe_price_id, capabilities JSONB, ai_model_config JSONB, active)
- `goal_templates` (id, name, emoji, description, default_target_cents, color, sort_order, active)
- `broker_options` (id, name, slug, type, active, sort_order)
- `whatsapp_instances` (id, name, phone_number, status, device_store_id, created_at, last_connected_at)

---

### Epic B: Configuracao de Modelos IA por Plano

**Objetivo:** Admin pode escolher qual modelo de IA cada plano de assinatura usa, e quais capabilities (texto/audio/imagem) cada plano tem.

#### Story B.1: CRUD de planos de assinatura
- Tabela `subscription_plans` com campos:
  - `name`: "Standard", "VIP", etc.
  - `slug`: "standard", "vip"
  - `price_cents`: valor mensal em centavos
  - `stripe_price_id`: ID do produto no Stripe
  - `capabilities`: JSONB `{ "text": true, "audio": true, "image": false }`
  - `ai_model_config`: JSONB `{ "provider": "groq", "chat_model": "llama3-70b-8192", "whisper_model": "whisper-large-v3-turbo", "temperature": 0.1 }`
  - `active`: boolean
- Tela: lista de planos com toggle ativo/inativo, botao editar
- Modal de edicao: nome, preco, selecao de provider (Groq/OpenAI/Google), modelo, capabilities checkboxes

#### Story B.2: Registro de providers de IA disponiveis
- Tabela `ai_providers` ou config JSONB em `system_config`:
  - Provider: Groq, OpenAI, Google
  - API Key (criptografada): armazenada em `system_config` com chave `ai_provider_keys`
  - Modelos disponiveis por provider (hardcoded no frontend, nao precisa de tabela):
    - Groq: llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768
    - OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
    - Google: gemini-1.5-pro, gemini-1.5-flash
- Tela: cards por provider, campo de API key (masked), teste de conexao

#### Story B.3: Abstracoes no laura-go para multi-provider
- Criar interface `LLMProvider` em `internal/services/llm.go`:
  ```go
  type LLMProvider interface {
      ChatCompletion(prompt string, systemPrompt string) (string, error)
      TranscribeAudio(data []byte, filename string) (string, error)
      SupportsImage() bool
  }
  ```
- Implementacoes: `GroqProvider`, `OpenAIProvider`, `GeminiProvider`
- Factory: `NewLLMProvider(config PlanAIConfig) LLMProvider`
- Refatorar `nlp.go` e `groq.go` para usar a interface
- Na mensagem WhatsApp: resolver o plano do workspace → carregar provider correto

#### Story B.4: Capabilities enforcement no bot
- Quando mensagem chega via WhatsApp:
  1. Buscar workspace do sender
  2. Buscar plano do workspace (`workspaces.plan_slug` → `subscription_plans`)
  3. Checar capabilities do plano
  4. Se mensagem e audio e plano nao tem `audio: true` → responder "Seu plano nao suporta audio. Envie por texto."
  5. Se mensagem e imagem e plano nao tem `image: true` → responder "Seu plano nao suporta leitura de imagens. Faca upgrade para o plano VIP."
- Tudo configuravel via admin panel sem deploy

---

### Epic C: Gestao de Payment Processors

**Objetivo:** Admin pode cadastrar, editar e remover operadoras de pagamento com suas taxas por parcela.

#### Story C.1: CRUD de operadoras
- Tabela `payment_processors` ja existe (migration 000016)
- Tela admin: lista de operadoras com nome, slug, status ativo
- Modal: nome, slug, toggle ativo/inativo
- Tabela de taxas: grid editavel 1x a 12x com percentuais
- Botao "Adicionar operadora" e "Remover"

#### Story C.2: Endpoints admin para processors
- `GET /api/v1/admin/processors` — lista todas (inclusive inativas)
- `POST /api/v1/admin/processors` — criar
- `PUT /api/v1/admin/processors/:id` — editar (nome, fees, active)
- `DELETE /api/v1/admin/processors/:id` — remover

#### Story C.3: Validacao e preview
- Preview em tempo real: ao editar taxas, mostrar simulacao "Fatura de R$1.000 em 6x = R$X com taxa de Y%"
- Validacao: taxa nao pode ser negativa ou > 100%

---

### Epic D: Templates Globais (Categorias, Objetivos, Corretoras)

**Objetivo:** Admin configura os defaults que sao aplicados a novos workspaces no registro.

#### Story D.1: Templates de categorias globais
- Tabela `category_templates` (id, name, emoji, color, description, subcategories JSONB, sort_order, active)
- Tela admin: arvore visual de categorias → subcategorias
- Drag-and-drop para reordenar
- Editar emoji, cor, nome, descricao
- Adicionar/remover subcategorias inline
- Essas templates sao usadas no `registerAction` como seed

#### Story D.2: Templates de objetivos
- Tabela `goal_templates` (nova)
- Tela admin: lista de presets (Viagem, Carro, Casa, iPhone, Fundo de Emergencia, Educacao, Casamento, Investimento)
- Cada preset: nome, emoji, cor, valor default sugerido, descricao
- Toggle ativo/inativo
- Adicionar novos presets
- Esses presets aparecem na tela `/goals` do usuario como opcoes rapidas

#### Story D.3: Corretoras e tipos de investimento
- Tabela `broker_options` (nova)
- Tela admin: lista de corretoras (Agora, BTG, Clear, Inter, Nu Invest, Rico, XP, Binance, IC Markets, IQ Option)
- Cada uma: nome, slug, tipo (nacional/internacional/cripto), ativo
- Tipos de investimento configuravel: Investimentos, Cripto, Poupanca, Renda Fixa, Renda Variavel, FIIs
- Esses aparecem como opcoes nos selects da tela `/investments`

---

### Epic E: Instancias WhatsApp (Multi-Conexao)

**Objetivo:** Admin pode gerenciar multiplas conexoes WhatsApp, similar a Evolution API.

#### Story E.1: Migration e modelo de instancias
- Tabela `whatsapp_instances`:
  - `id` UUID PK
  - `name` VARCHAR (ex: "Laura Principal", "Laura Suporte")
  - `phone_number` VARCHAR (preenchido apos conexao)
  - `status` ENUM: 'disconnected', 'connecting', 'qr_pending', 'connected', 'banned'
  - `webhook_url` VARCHAR (opcional, para notificar sistema externo)
  - `created_at`, `last_connected_at`, `disconnected_at`
- Cada instancia e uma conexao whatsmeow independente

#### Story E.2: Refatorar whatsmeow para multi-instancia
- Substituir `var Client *whatsmeow.Client` global por `InstanceManager`:
  ```go
  type InstanceManager struct {
      instances map[string]*WhatsAppInstance
      mu        sync.RWMutex
  }
  type WhatsAppInstance struct {
      ID     string
      Name   string
      Client *whatsmeow.Client
      Status string
  }
  ```
- Cada instancia tem seu proprio device store no Postgres
- `InitWhatsmeow()` carrega todas as instancias ativas do banco
- Mensagens recebidas: identifica qual instancia recebeu

#### Story E.3: Tela de gerenciamento de instancias
- Layout inspirado na Evolution API:
  - Cards por instancia com: nome, numero, status (badge colorido), uptime
  - Botoes: Conectar (gera QR), Desconectar, Reiniciar, Excluir
- Modal de QR Code: exibe QR code em tempo real via polling ou SSE
- Formulario "Nova Instancia": nome, webhook opcional
- Status em tempo real com refresh a cada 10s

#### Story E.4: Endpoints admin para instancias
- `GET /api/v1/admin/whatsapp/instances` — lista todas
- `POST /api/v1/admin/whatsapp/instances` — criar nova
- `GET /api/v1/admin/whatsapp/instances/:id/qr` — gerar/retornar QR code
- `POST /api/v1/admin/whatsapp/instances/:id/connect` — conectar
- `POST /api/v1/admin/whatsapp/instances/:id/disconnect` — desconectar
- `DELETE /api/v1/admin/whatsapp/instances/:id` — remover
- `PUT /api/v1/admin/whatsapp/instances/:id` — editar nome/webhook

#### Story E.5: Atribuicao de instancia a workspace
- Campo `whatsapp_instance_id` na tabela `workspaces`
- Admin pode atribuir qual instancia atende qual workspace
- Default: instancia "principal" atende todos os workspaces sem atribuicao especifica

---

### Epic F: Gestao de Workspaces

**Objetivo:** Admin pode visualizar, suspender e gerenciar workspaces do SaaS.

#### Story F.1: Lista de workspaces
- Tela admin: tabela com todos os workspaces
- Colunas: nome, proprietario, plano, status, membros, transacoes (count), criado em
- Filtros: por plano, por status, busca por nome/email
- Acao: ver detalhes, suspender/reativar

#### Story F.2: Detalhes do workspace
- Pagina de detalhes: metricas do workspace, membros, cartoes, score
- Botao suspender (bloqueia acesso sem deletar dados)
- Botao reativar
- Alterar plano manualmente

#### Story F.3: Endpoints admin para workspaces
- `GET /api/v1/admin/workspaces` — lista com paginacao e filtros
- `GET /api/v1/admin/workspaces/:id` — detalhes
- `PUT /api/v1/admin/workspaces/:id/suspend` — suspender
- `PUT /api/v1/admin/workspaces/:id/reactivate` — reativar
- `PUT /api/v1/admin/workspaces/:id/plan` — alterar plano

---

### Epic G: Documentacao da API

**Objetivo:** Pagina visual no admin com documentacao dos endpoints REST.

#### Story G.1: Pagina de documentacao
- Rota `/admin/api-docs`
- Lista todos os 42+ endpoints agrupados por dominio
- Para cada endpoint: metodo, path, descricao, request body (schema), response body (exemplo)
- Gerada a partir de um JSON/YAML de definicao mantido no repo
- Botao "Testar" que faz curl inline (opcional, v2)

#### Story G.2: Arquivo de definicao da API
- `laura-go/api-spec.yaml` (OpenAPI 3.0 simplificado)
- Documentar todos os endpoints atuais
- Incluir os novos endpoints admin

---

### Epic H: Saude do Sistema e Config Geral

**Objetivo:** Admin ve status dos servicos e configura parametros globais.

#### Story H.1: Dashboard de saude
- Cards: status Postgres (up/down + latencia), status WhatsApp (instancias online), status Groq (API reachable), uso de disco
- Uptime do servidor Go
- Ultimos erros logados (top 10)

#### Story H.2: Configuracoes globais
- Tabela `system_config` (key VARCHAR PK, value JSONB, updated_at)
- Tela: formulario com configuracoes:
  - `app_name`: nome do SaaS (default "Laura Finance")
  - `sender_email`: email remetente (default "laura@suaempresa.com")
  - `sender_domain`: dominio Resend
  - `default_plan`: plano padrao para novos registros
  - `registration_enabled`: boolean (desligar cadastro)
  - `maintenance_mode`: boolean
  - `budget_alert_hour`: hora do alerta diario (default 20)
  - `score_snapshot_hour`: hora do snapshot diario (default 2)

---

## 4. Migrations Necessarias

```
000025_create_system_config.sql
000026_create_subscription_plans.sql
000027_create_goal_templates.sql
000028_create_broker_options.sql
000029_create_whatsapp_instances.sql
000030_add_plan_to_workspaces.sql
000031_add_instance_to_workspaces.sql
000032_seed_default_plans.sql
```

---

## 5. Ordem de Implementacao Sugerida

1. **Epic A** (infraestrutura) — base para tudo
2. **Epic C** (processors) — mais simples, tabela ja existe
3. **Epic D** (templates) — categoria/objetivo/corretora
4. **Epic H** (sistema) — config global + saude
5. **Epic F** (workspaces) — gestao do SaaS
6. **Epic B** (modelos IA) — refatoracao do NLP + planos
7. **Epic E** (WhatsApp multi-instancia) — mais complexo, por ultimo
8. **Epic G** (docs API) — pode ser feito em paralelo

---

## 6. Fora de Escopo (v1)

- Billing/cobranca automatica (Stripe webhooks pra upgrade/downgrade automatico)
- Marketplace de templates de categorias
- API publica para terceiros (apenas documentacao interna)
- Logs de auditoria de acoes do admin
- Dashboard analytics com graficos de crescimento do SaaS
