# Epic: Super Admin Panel — PRD & Stories (v2)

**Data:** 2026-04-12
**Autor:** Claude Opus 4.6 + NexusAI
**Status:** Aprovado
**Prioridade:** Alta
**Revisao:** v2 — corrigido com audit completo de hardcoded values

---

## 1. Visao Geral

O Super Admin Panel e o painel de controle centralizado do SaaS Laura Finance, acessivel apenas por usuarios com `is_super_admin = true`. Permite **configurar todos os parametros** do sistema sem deploy: modelos de IA por plano, operadoras de pagamento, templates globais, instancias WhatsApp, limites de plano, formula do score, e qualquer valor que hoje esta hardcoded no codigo.

**Principio:** Se o usuario final ve ou usa, o admin pode configurar.

**Rota base:** `/admin`

---

## 2. Estrutura de Navegacao

```
/admin
  /admin                    -> Dashboard (indicadores SaaS + saude do sistema)
  /admin/plans              -> Planos de assinatura, limites e capabilities
  /admin/ai-config          -> Providers de IA, API keys, modelos por plano
  /admin/processors         -> Operadoras de pagamento (gateway fees)
  /admin/categories         -> Templates de categorias/subcategorias globais
  /admin/goal-templates     -> Presets de objetivos financeiros
  /admin/financial-config   -> Corretoras, bancos, bandeiras, tipos investimento
  /admin/scoring            -> Pesos do score, thresholds, lookback periods
  /admin/whatsapp           -> Instancias WhatsApp (multi-conexao)
  /admin/workspaces         -> Gestao de workspaces (visualizar, suspender)
  /admin/email-config       -> Remetente, dominio, TTLs de tokens
  /admin/security           -> Politica de senha, roles, permissoes
  /admin/audit-log          -> Log de acoes do admin (quem mudou o que)
  /admin/api-docs           -> Documentacao interativa da API REST + WhatsApp
  /admin/system             -> Config geral, feature flags, manutencao
```

---

## 3. Epics & Stories

---

### Epic A: Infraestrutura do Admin Panel

**Objetivo:** Base tecnica — layout, rotas, middleware, navegacao, migrations.

#### Story A.1: Layout e sidebar do admin
- Layout `/app/(admin)/layout.tsx` com sidebar dedicada
- Tema escuro/roxo consistente com PWA, icone de engrenagem no header
- Sidebar com todas as secoes, badges de contagem onde aplicavel
- Badge "Super Admin" no header
- Redirect para `/login` se nao for super_admin
- Responsivo (sidebar colapsavel em mobile)

#### Story A.2: Middleware de protecao admin
- Server component: verifica `is_super_admin` em todas as rotas `/admin/*`
- Go: grupo `/api/v1/admin/*` com `RequireSuperAdmin()` (ja existe)
- Todos os novos endpoints admin no mesmo grupo

#### Story A.3: Migrations — tabelas de configuracao
```sql
-- 000025: system_config (key/value para config global)
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description VARCHAR(500),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- 000026: subscription_plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  stripe_price_id VARCHAR(200),
  capabilities JSONB NOT NULL DEFAULT '{"text":true,"audio":true,"image":false}',
  ai_model_config JSONB NOT NULL DEFAULT '{"provider":"groq","chat_model":"llama3-70b-8192","whisper_model":"whisper-large-v3-turbo","temperature":0.1}',
  limits JSONB NOT NULL DEFAULT '{"max_members":5,"max_cards":10,"max_transactions_month":500,"advanced_reports":false}',
  features_description JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 000027: goal_templates
CREATE TABLE goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) NOT NULL DEFAULT '🎯',
  description VARCHAR(500),
  default_target_cents INTEGER DEFAULT 0,
  color VARCHAR(7) NOT NULL DEFAULT '#8B5CF6',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- 000028: broker_options
CREATE TABLE broker_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  emoji VARCHAR(10) DEFAULT '🏦',
  category VARCHAR(50) DEFAULT 'nacional',
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 000029: bank_options (bancos para cartoes)
CREATE TABLE bank_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 000030: card_brand_options (bandeiras)
CREATE TABLE card_brand_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(30) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 000031: investment_type_options
CREATE TABLE investment_type_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 000032: category_templates (seed global — diferente de categories que e por workspace)
CREATE TABLE category_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '📂',
  color VARCHAR(7) DEFAULT '#808080',
  description VARCHAR(500),
  subcategories JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- 000033: whatsapp_instances
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  status VARCHAR(20) DEFAULT 'disconnected',
  webhook_url VARCHAR(500),
  webhook_events JSONB DEFAULT '["message_received","message_sent","status_change"]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ
);

-- 000034: admin_audit_log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 000035: add plan + instance refs to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_slug VARCHAR(50) DEFAULT 'standard';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES whatsapp_instances(id);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(500);

-- 000036: seed defaults
INSERT INTO subscription_plans (name, slug, price_cents, capabilities, limits, features_description, sort_order) VALUES
  ('Standard', 'standard', 0, '{"text":true,"audio":true,"image":false}', '{"max_members":3,"max_cards":5,"max_transactions_month":200,"advanced_reports":false}', '["Texto e audio via WhatsApp","Ate 3 membros","Ate 5 cartoes","200 transacoes/mes","Relatorios basicos"]', 1),
  ('VIP', 'vip', 4990, '{"text":true,"audio":true,"image":true}', '{"max_members":20,"max_cards":50,"max_transactions_month":5000,"advanced_reports":true}', '["Texto, audio e imagem via WhatsApp","Ate 20 membros","Ate 50 cartoes","5000 transacoes/mes","Relatorios avancados","Suporte prioritario"]', 2)
ON CONFLICT DO NOTHING;

-- Seed bank_options
INSERT INTO bank_options (name, slug, sort_order) VALUES
  ('Nubank','nubank',1),('Banco Inter','inter',2),('C6 Bank','c6',3),
  ('Bradesco','bradesco',4),('Itau','itau',5),('Santander','santander',6),
  ('Caixa Economica','caixa',7),('Banco do Brasil','bb',8),('BTG Pactual','btg',9),
  ('PagBank','pagbank',10),('Neon','neon',11),('Banco Pan','pan',12),
  ('Safra','safra',13),('Mercado Pago','mercadopago',14),('PicPay','picpay',15)
ON CONFLICT DO NOTHING;

-- Seed card_brand_options
INSERT INTO card_brand_options (name, slug, sort_order) VALUES
  ('Mastercard','mastercard',1),('Visa','visa',2),('Elo','elo',3),
  ('American Express','amex',4),('Hipercard','hipercard',5),('Diners Club','diners',6)
ON CONFLICT DO NOTHING;

-- Seed broker_options
INSERT INTO broker_options (name, slug, emoji, category, sort_order) VALUES
  ('Agora','agora','🏦','nacional',1),('BTG','btg','🏦','nacional',2),
  ('Clear','clear','🏦','nacional',3),('Inter','inter','🏦','nacional',4),
  ('Nu Invest','nuinvest','🏦','nacional',5),('Rico','rico','🏦','nacional',6),
  ('XP','xp','🏦','nacional',7),('Binance','binance','💎','cripto',8),
  ('IC Markets','icmarkets','📈','internacional',9),('IQ Option','iqoption','📊','internacional',10)
ON CONFLICT DO NOTHING;

-- Seed investment_type_options
INSERT INTO investment_type_options (name, slug, sort_order) VALUES
  ('Investimentos','investimentos',1),('Cripto','cripto',2),('Poupanca','poupanca',3),
  ('Renda Fixa','renda-fixa',4),('Renda Variavel','renda-variavel',5),('FIIs','fiis',6)
ON CONFLICT DO NOTHING;

-- Seed goal_templates
INSERT INTO goal_templates (name, emoji, color, sort_order) VALUES
  ('Viagem','✈️','#3B82F6',1),('Carro','🚗','#10B981',2),
  ('Casa Propria','🏠','#F59E0B',3),('iPhone / Eletronicos','📱','#8B5CF6',4),
  ('Fundo de Emergencia','🐷','#EF4444',5),('Educacao','🎓','#06B6D4',6),
  ('Casamento','💍','#EC4899',7),('Investimento Inicial','🏆','#F97316',8)
ON CONFLICT DO NOTHING;

-- Seed system_config defaults
INSERT INTO system_config (key, value, description) VALUES
  ('app_name', '"Laura Finance"', 'Nome exibido no sistema'),
  ('sender_email', '"laura@suaempresa.com"', 'Email remetente (Resend)'),
  ('sender_name', '"Laura Finance"', 'Nome do remetente'),
  ('registration_enabled', 'true', 'Cadastro aberto para novos usuarios'),
  ('maintenance_mode', 'false', 'Modo manutencao (bloqueia acesso)'),
  ('default_plan', '"standard"', 'Plano padrao para novos registros'),
  ('budget_alert_hour', '20', 'Hora do alerta diario de orcamento (0-23)'),
  ('score_snapshot_hour', '2', 'Hora do snapshot diario do score (0-23)'),
  ('score_weights', '{"billsOnTime":0.35,"budgetRespect":0.25,"savingsRate":0.25,"debtLevel":0.15}', 'Pesos do Score Financeiro'),
  ('score_thresholds', '{"excellent":80,"good":60,"fair":40}', 'Thresholds do Score (excelente/bom/regular/critico)'),
  ('score_lookback_days', '90', 'Periodo de lookback para calculo do score (dias)'),
  ('nlp_confidence_threshold', '0.85', 'Confianca minima para auto-classificar transacao sem review'),
  ('password_min_length', '6', 'Tamanho minimo de senha'),
  ('verify_email_ttl_hours', '24', 'Validade do token de verificacao de email (horas)'),
  ('password_reset_ttl_minutes', '30', 'Validade do token de reset de senha (minutos)')
ON CONFLICT DO NOTHING;

-- Seed category_templates (8 categorias padrao)
INSERT INTO category_templates (name, emoji, color, subcategories, sort_order) VALUES
  ('Pessoal','👤','#8B5CF6','[{"name":"Saude","emoji":"💊"},{"name":"Higiene","emoji":"🧴"},{"name":"Roupas","emoji":"👕"},{"name":"Assinaturas","emoji":"📺"},{"name":"Presentes","emoji":"🎁"}]',1),
  ('Moradia','🏠','#3B82F6','[{"name":"Aluguel","emoji":"🔑"},{"name":"Condominio","emoji":"🏢"},{"name":"Energia","emoji":"⚡"},{"name":"Agua","emoji":"💧"},{"name":"Internet","emoji":"📡"},{"name":"Manutencao","emoji":"🔧"}]',2),
  ('Alimentacao','🍔','#10B981','[{"name":"Mercado","emoji":"🛒"},{"name":"Restaurantes","emoji":"🍽️"},{"name":"Delivery","emoji":"📦"},{"name":"Padaria","emoji":"🥖"},{"name":"Feira","emoji":"🥬"}]',3),
  ('Transporte','🚗','#F59E0B','[{"name":"Combustivel","emoji":"⛽"},{"name":"Uber/99","emoji":"🚕"},{"name":"Estacionamento","emoji":"🅿️"},{"name":"Pedagio","emoji":"🛣️"},{"name":"Manutencao Veiculo","emoji":"🔧"}]',4),
  ('Lazer','🎮','#EC4899','[{"name":"Cinema","emoji":"🎬"},{"name":"Jogos","emoji":"🎮"},{"name":"Bares","emoji":"🍺"},{"name":"Viagens","emoji":"✈️"},{"name":"Esportes","emoji":"⚽"}]',5),
  ('Financas','💰','#EF4444','[{"name":"Cartao de Credito","emoji":"💳"},{"name":"Emprestimos","emoji":"🏦"},{"name":"Impostos","emoji":"📋"},{"name":"Seguros","emoji":"🛡️"},{"name":"Investimentos","emoji":"📈"}]',6),
  ('Trabalho','💼','#06B6D4','[{"name":"Material","emoji":"📎"},{"name":"Software","emoji":"💻"},{"name":"Marketing","emoji":"📢"},{"name":"Contabilidade","emoji":"🧮"}]',7),
  ('Viagem','✈️','#0EA5E9','[{"name":"Hospedagem","emoji":"🏨"},{"name":"Passagens","emoji":"🎫"},{"name":"Alimentacao Viagem","emoji":"🍽️"},{"name":"Passeios","emoji":"🗺️"}]',8)
ON CONFLICT DO NOTHING;
```

---

### Epic B: Planos de Assinatura e Configuracao de IA

**Objetivo:** Admin configura planos (Standard/VIP), define modelos de IA por plano, capabilities (texto/audio/imagem), e limites (membros, cartoes, transacoes).

#### Story B.1: CRUD de planos de assinatura
- Tela `/admin/plans`: lista de planos com cards visuais
- Cada card mostra: nome, preco, capabilities (icones), limites, features
- Modal de edicao completo:
  - Nome, slug, preco em centavos
  - Stripe Price ID
  - Checkboxes: texto, audio, imagem
  - Limites: max membros, max cartoes, max transacoes/mes, relatorios avancados
  - Lista editavel de features (texto livre, exibido no UpgradeDialog)
  - Toggle ativo/inativo

#### Story B.2: Configuracao de providers de IA
- Tela `/admin/ai-config`:
  - Cards por provider (Groq, OpenAI, Google)
  - Campo API Key (masked, so mostra ultimos 4 chars)
  - Botao "Testar Conexao" (faz health check no provider)
  - Status: conectado/erro/nao configurado
- Selecao de modelo por plano:
  - Para cada plano ativo, dropdown com modelos disponiveis do provider selecionado
  - Groq: llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768
  - OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
  - Google: gemini-1.5-pro, gemini-1.5-flash
  - Slider de temperature (0.0 a 1.0)
- API keys armazenadas em `system_config` com chave `ai_provider_keys` (JSONB criptografado)

#### Story B.3: Abstracao multi-provider no Go
- Interface `LLMProvider` em `internal/services/llm.go`:
  ```go
  type LLMProvider interface {
      ChatCompletion(ctx context.Context, systemPrompt, userMessage string) (string, error)
      TranscribeAudio(ctx context.Context, data []byte, filename string) (string, error)
      SupportsImage() bool
      ProviderName() string
  }
  ```
- Implementacoes: `GroqProvider`, `OpenAIProvider`, `GeminiProvider`
- Factory: `NewLLMProvider(config PlanAIConfig) LLMProvider`
- Cache em memoria do provider por plan_slug (invalidado via admin endpoint)
- Refatorar `nlp.go` e `groq.go` para usar a interface

#### Story B.4: Enforcement de capabilities e limites no bot
- Quando mensagem WhatsApp chega:
  1. Resolver workspace do sender
  2. Carregar plano do workspace
  3. Checar capability (audio/imagem/texto)
  4. Checar limites (transacoes do mes atual < max_transactions_month)
  5. Se bloqueado: responder com mensagem amigavel + sugestao de upgrade
- Enforcement tambem nas server actions do PWA (criar membro, criar cartao, etc.)

#### Story B.5: Endpoints admin para planos
- `GET /api/v1/admin/plans` — lista todos
- `POST /api/v1/admin/plans` — criar
- `PUT /api/v1/admin/plans/:slug` — editar
- `DELETE /api/v1/admin/plans/:slug` — desativar
- `GET /api/v1/admin/ai-providers` — status dos providers
- `PUT /api/v1/admin/ai-providers/:provider/key` — salvar API key
- `POST /api/v1/admin/ai-providers/:provider/test` — testar conexao

---

### Epic C: Gestao de Payment Processors

**Objetivo:** CRUD de operadoras de pagamento com taxas por parcela.

#### Story C.1: CRUD de operadoras
- Tela `/admin/processors`: tabela com todas operadoras (inclusive inativas)
- Modal de edicao: nome, slug, toggle ativo
- Grid editavel de taxas 1x a 12x (input numerico com %)
- Preview: "Fatura R$1.000 em 6x = R$X (taxa Y%)"
- Validacao: taxa >= 0 e <= 100

#### Story C.2: Endpoints admin para processors
- `GET /api/v1/admin/processors` — lista todas (inclusive inativas)
- `POST /api/v1/admin/processors` — criar
- `PUT /api/v1/admin/processors/:id` — editar
- `DELETE /api/v1/admin/processors/:id` — remover

---

### Epic D: Templates e Opcoes Globais

**Objetivo:** Admin configura todos os dados de referencia que o usuario ve no PWA.

#### Story D.1: Templates de categorias globais
- Tela `/admin/categories`: arvore visual categorias -> subcategorias
- Editar nome, emoji, cor, descricao
- Adicionar/remover subcategorias inline
- Reordenar via drag-and-drop
- Essas templates alimentam o seed no `registerAction`

#### Story D.2: Templates de objetivos
- Tela `/admin/goal-templates`: lista de presets
- CRUD: nome, emoji, cor, valor default, descricao
- Toggle ativo/inativo, reordenar
- Aparecem na tela `/goals` do usuario como opcoes rapidas

#### Story D.3: Bancos e bandeiras de cartao
- Tela `/admin/financial-config` (aba "Bancos & Bandeiras"):
- **Bancos**: CRUD (Nubank, Inter, C6...) — aparecem no select de criacao de cartao
- **Bandeiras**: CRUD (Visa, Mastercard, Elo...) — aparecem nos icones de cartao
- Toggle ativo/inativo, reordenar

#### Story D.4: Corretoras e tipos de investimento
- Tela `/admin/financial-config` (aba "Investimentos"):
- **Corretoras**: CRUD com emoji e categoria (nacional/cripto/internacional)
- **Tipos**: CRUD (Investimentos, Cripto, Poupanca, Renda Fixa, Renda Variavel, FIIs)
- Aparecem nos selects de `/investments`

#### Story D.5: Endpoints admin para opcoes
- `GET/POST/PUT/DELETE /api/v1/admin/category-templates`
- `GET/POST/PUT/DELETE /api/v1/admin/goal-templates`
- `GET/POST/PUT/DELETE /api/v1/admin/banks`
- `GET/POST/PUT/DELETE /api/v1/admin/card-brands`
- `GET/POST/PUT/DELETE /api/v1/admin/brokers`
- `GET/POST/PUT/DELETE /api/v1/admin/investment-types`
- Endpoints publicos (nao-admin) para consumo do PWA:
  - `GET /api/v1/options/banks`
  - `GET /api/v1/options/card-brands`
  - `GET /api/v1/options/brokers`
  - `GET /api/v1/options/investment-types`
  - `GET /api/v1/options/goal-templates`

#### Story D.6: Refatorar PWA para consumir opcoes do banco
- Substituir arrays hardcoded (`BANKS`, `BROKER_OPTIONS`, `PRESET_GOALS`, `CARD_BRANDS`) por fetch das opcoes via server actions
- Remover `default-seed.ts` — seed agora vem de `category_templates`
- Remover dados demo hardcoded ("Joao Vitor", "Maria Laura" no UserProfileDropdown e cards page)

---

### Epic E: Configuracao do Score Financeiro

**Objetivo:** Admin pode ajustar pesos, thresholds e periodos do Score Financeiro sem deploy.

#### Story E.1: Tela de configuracao do score
- Tela `/admin/scoring`:
  - 4 sliders de peso (billsOnTime, budgetRespect, savingsRate, debtLevel) — somam 100%
  - 3 inputs de threshold (excelente >= X, bom >= Y, regular >= Z)
  - Input de lookback period (dias)
  - Input de confidence threshold para NLP (auto-classificacao)
  - Preview: simulacao visual de como um score exemplo seria classificado
- Salva em `system_config` keys: `score_weights`, `score_thresholds`, `score_lookback_days`, `nlp_confidence_threshold`

#### Story E.2: Refatorar calculo do score
- Go: `handleCurrentScore` le pesos/thresholds de `system_config` em vez de hardcoded
- PWA: `FinancialScore.tsx` busca config via server action
- Cache em memoria no Go (invalida via admin endpoint)

---

### Epic F: Instancias WhatsApp (Multi-Conexao)

**Objetivo:** Admin gerencia multiplas conexoes WhatsApp, estilo Evolution API.

#### Story F.1: Refatorar whatsmeow para multi-instancia
- Substituir `var Client *whatsmeow.Client` global por `InstanceManager`
- Cada instancia: device store proprio no Postgres, client independente
- `InitWhatsmeow()` carrega todas instancias ativas do banco
- Event handler identifica qual instancia recebeu a mensagem

#### Story F.2: Tela de gerenciamento
- Tela `/admin/whatsapp`: cards por instancia
  - Nome, numero, status (badge colorido), uptime, ultima conexao
  - Botoes: Conectar (QR), Desconectar, Reiniciar, Excluir
  - Modal QR Code (polling a cada 5s ate conectar)
  - Formulario "Nova Instancia": nome, webhook URL
- Atribuicao de instancia a workspace via dropdown

#### Story F.3: Endpoints admin
- `GET /api/v1/admin/whatsapp/instances` — lista
- `POST /api/v1/admin/whatsapp/instances` — criar
- `GET /api/v1/admin/whatsapp/instances/:id/qr` — QR code (base64 PNG)
- `POST /api/v1/admin/whatsapp/instances/:id/connect`
- `POST /api/v1/admin/whatsapp/instances/:id/disconnect`
- `DELETE /api/v1/admin/whatsapp/instances/:id`
- `PUT /api/v1/admin/whatsapp/instances/:id`

#### Story F.4: Webhook de eventos
- Quando instancia recebe mensagem, dispara POST para `webhook_url` configurada
- Payload: `{ event, instance_id, phone, message, timestamp }`
- Retry com backoff exponencial (3 tentativas)
- Log de webhooks no `admin_audit_log`

---

### Epic G: Gestao de Workspaces

**Objetivo:** Admin visualiza, suspende e gerencia workspaces do SaaS.

#### Story G.1: Lista e detalhes de workspaces
- Tela `/admin/workspaces`: tabela paginada
- Colunas: nome, proprietario, email, plano, status, membros, transacoes, criado em
- Filtros: plano, status (ativo/suspenso), busca
- Clique abre detalhes: metricas, membros, cartoes, score, historico de plano
- Acoes: suspender/reativar, alterar plano, ver como usuario

#### Story G.2: Endpoints admin
- `GET /api/v1/admin/workspaces` — lista com paginacao
- `GET /api/v1/admin/workspaces/:id` — detalhes
- `PUT /api/v1/admin/workspaces/:id/suspend` — suspender (motivo obrigatorio)
- `PUT /api/v1/admin/workspaces/:id/reactivate`
- `PUT /api/v1/admin/workspaces/:id/plan` — alterar plano

---

### Epic H: Email, Seguranca e Config Geral

**Objetivo:** Admin configura email, politica de senha, e parametros do sistema.

#### Story H.1: Configuracao de email
- Tela `/admin/email-config`:
  - Email remetente (`sender_email`)
  - Nome remetente (`sender_name`)
  - Dominio Resend (`sender_domain`)
  - TTL verificacao de email (horas)
  - TTL reset de senha (minutos)
  - Botao "Enviar email de teste"

#### Story H.2: Politica de senha e roles
- Tela `/admin/security`:
  - Tamanho minimo de senha (slider 6-20)
  - Roles disponiveis: visualizacao dos 4 roles atuais e suas permissoes
  - (v2: CRUD de roles customizados)

#### Story H.3: Configuracoes gerais do sistema
- Tela `/admin/system`:
  - Nome do app
  - Toggle: cadastro aberto/fechado
  - Toggle: modo manutencao
  - Plano padrao para novos registros (dropdown)
  - Hora do alerta de orcamento (0-23)
  - Hora do snapshot de score (0-23)
- Status do sistema: Postgres, WhatsApp, Groq, uptime, versao

#### Story H.4: Endpoints admin para config
- `GET /api/v1/admin/config` — todas as configs
- `PUT /api/v1/admin/config/:key` — atualizar config especifica
- `POST /api/v1/admin/email/test` — enviar email de teste

---

### Epic I: Audit Log

**Objetivo:** Rastreabilidade de todas as acoes do admin.

#### Story I.1: Log automatico de acoes
- Middleware Go que intercepta todos os `POST/PUT/DELETE` em `/api/v1/admin/*`
- Registra: admin_user_id, action, entity_type, entity_id, old_value, new_value, ip, timestamp
- Exemplos: "Atualizou plano VIP", "Desativou operadora Cielo", "Suspendeu workspace X"

#### Story I.2: Tela de visualizacao
- Tela `/admin/audit-log`: tabela cronologica com filtros
- Colunas: data/hora, admin, acao, entidade, detalhes
- Filtros: por admin, por tipo de entidade, por data
- Expansivel: clique mostra diff old_value → new_value

---

### Epic J: Documentacao da API

**Objetivo:** Documentacao visual dos endpoints REST e WhatsApp.

#### Story J.1: Documentacao REST
- Tela `/admin/api-docs` (aba "REST API"):
  - Todos os 42+ endpoints agrupados por dominio
  - Para cada: metodo, path, descricao, request body, response body
  - Codigo de exemplo (curl)

#### Story J.2: Documentacao WhatsApp API
- Tela `/admin/api-docs` (aba "WhatsApp API"):
  - Endpoints de instancia (criar, conectar, QR, desconectar)
  - Endpoint de envio de mensagem: `POST /api/v1/admin/whatsapp/instances/:id/send`
  - Endpoint de validacao de numero: `POST /api/whatsapp/validate`
  - Formato do webhook de recebimento
  - Exemplos de payloads

#### Story J.3: Arquivo OpenAPI
- `laura-go/api-spec.yaml` (OpenAPI 3.0)
- Documentar todos os endpoints (atuais + novos admin)

---

## 4. Ordem de Implementacao

| Fase | Epic | Estimativa | Dependencias |
|------|------|-----------|-------------|
| 1 | A (infra + migrations) | 1 sessao | Nenhuma |
| 2 | D (templates + opcoes) | 1-2 sessoes | A |
| 3 | C (processors) | 1 sessao | A |
| 4 | H (email + config + sistema) | 1 sessao | A |
| 5 | E (score config) | 1 sessao | A, H |
| 6 | G (workspaces) | 1 sessao | A |
| 7 | B (planos + IA) | 2-3 sessoes | A, D |
| 8 | I (audit log) | 1 sessao | A |
| 9 | F (WhatsApp multi) | 2-3 sessoes | A |
| 10 | J (docs API) | 1 sessao | Todos |

---

## 5. Correcoes de Dados Demo Hardcoded

Alem dos epics acima, estes fixes pontuais devem ser feitos:

| Arquivo | Problema | Correcao |
|---------|---------|---------|
| `UserProfileDropdown.tsx` | "Joao Vitor" e "nexusai360@gmail.com" hardcoded | Ler do perfil do usuario logado |
| `cards/page.tsx` L99,237 | Holder "Joao Vitor" / "Maria Laura" hardcoded | Ler membros do workspace |
| `cards/page.tsx` L92 | Cor default "#7C3AED" hardcoded | Ler de `system_config` ou manter como default sensato |
| `investments/page.tsx` L52 | Tipo default "Investimentos" hardcoded | Ler primeiro tipo ativo de `investment_type_options` |
| `email.ts` L8-108 | "laura@suaempresa.com" (4x) | Ler de `system_config.sender_email` |
