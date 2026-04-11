---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: 
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# Laura Finance (Vibe Coding) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Laura Finance (Vibe Coding), decomposing the requirements from the PRD, UX Design se existir, e requisitos de Arquitetura em histórias implementáveis, com especial atenção à integração do Modelo SaaS (Pagamentos Stripe/BR) e E-mails no MVP.

## Requirements Inventory

### Functional Requirements

- FR1: O Proprietário pode se cadastrar e criar a sua conta no PWA utilizando provedor de e-mail proprietário comum ou integração agnóstica de contas externas para autenticação.
- FR2: O Proprietário pode cadastrar números dos emissores mensageiros pertencentes aos membros da família ou dependentes, atribuindo as permissões rigorosas (Admin ou Dependente).
- FR3: O Usuário Autenticado pode iniciar uma comunicação através do aplicativo de mensagens e ter o envio referenciado empiricamente à sua identidade PWA por meio do ID numérico comunicador subjacente.
- FR4: O Usuário Autenticado pode solicitar a exclusão de sua conta e o engavetamento/apagamento irrestrito de dados transacionais via PWA (LGPD).
- FR5: O Usuário logado pode alimentar ativamente despesas e ganhos através de mensagens de texto ou áudio curtos via mensageiria social.
- FR6: O Administrador pode visualizar com exatidão sua mensagem convertida nas entidades essenciais estruturadas na contabilidade (Valor, Categoria Base, Temporaridade, Instituição Emissora e Autor).
- FR7: O Usuário pode ser interpelado para aprovar diretamente a desambiguação do chat caso o nível algorítmico da abstração matemática decaia especificamente de um patamar pré-definido < 85%.
- FR8: O Usuário pode anular o englobamento numérico recém alimentado revertendo ativamente através do próprio comando conversacional expresso sem migrar plataforma.
- FR9: O Proprietário ou Administrador pode inserir emissores de crédito e definir teto global permissivo, janelas de expiração fiscal do fechamento e datas vencimento.
- FR10: O Proprietário ou Administrador pode construir barreiras e tetos de gastos associados perfeitamente a compartimentos contábeis unificados mensais (ex: "Mercado", "Lazer").
- FR11: O Proprietário ou Administrador pode manusear intervenções cirúrgicas nas transações puras em um Dashboard tradicional suprimindo eventuais delírios semânticos.
- FR12: O Prosumer pode estruturar seus outputs através de marcações avulsas ("Tags") operando a bifurcação transversal à métrica raiz, como as contas do CNPJ blindadas e isoladas da Pessoa Física.
- FR13: O Usuário Autenticado pode receber dicas hiper-direcionais pontuais caso alguma despesa do montante atinja estatisticamente um consumo superior ao rácio percentual de 80% do teto.
- FR14: O Administrador pode ser alertado espontaneamente, com prazo antecipado configurável e fixo de 3 dias úteis cheios antes das cobranças predatizadas adentrarem à carência de pagamento.
- FR15: O Administrador e Dependentes podem realizar diálogos de consulta extraindo saldos imediatos obtendo conversas fluídas sem acessar painéis frios.
- FR16: O Usuário pode evocar ordens para fatiar seus deveres contábeis ativando o sub-sistema simulador da rolagem transacional prevenindo multas nos cartões cadastrados.
- FR17: O Administrador pode escrutinar alternativas detalhadas contendo modelagem estruturada de dívida, recebendo propostas estáticas embasadas exclusivamente de arranjos financeiros gravados abstratamente.
- FR18: O Administrador pode oficializar as sugestões financeiras no mensageiro forçando a camada algorítmica a injetar as alocações preditivas das frações de dívida nos meses contábeis calendários correspondentes.
- FR19: O Usuário pode gerar e acessar visualizações PNG ricas geradas através da IA operando inferências instantâneas pre-rendidas.
- FR20: O Empreendedor Administrador pode supervisionar debaixo dos painéis restritos Web ao mínimo uma métrica evolutiva mensal (Gráfico Barra), gráfico DRE Simplificado numérico e composição por Pizza.
- FR21: O Contador logado pode agendar exportações de saídas agnósticas (planilhadas isoladas sem codificações proprietárias) portando logs organizados das matrizes baseadas nas `Tags`.
- FR22: O Proprietário pode assinar o modelo SaaS realizando pagamento via Gateway (ex: Stripe ou solução BR) no Dashboard web, liberando os acessos.
- FR23: Após a assinatura, o sistema dispara e-mails transacionais automáticos contendo comprovantes financeiros e links/credenciais de acesso inicial altamente seguros (separados por Papel: Proprietário, Admin, Membro).
- FR24 (Retro-doc 2026-04-11): O Proprietário/Administrador pode criar, acompanhar e concluir **Metas Financeiras** (`financial_goals`) no PWA, contendo emoji, nome, descrição, valor-alvo em centavos, acumulado atual, prazo (deadline) e cor, com seleção a partir de presets (Viagem, Carro, Casa, iPhone, Fundo de Emergência, Educação, Casamento, Investimento) e status `active|completed|paused`.
- FR25 (Retro-doc 2026-04-11): O Proprietário/Administrador pode cadastrar **Investimentos** (`investments`) por corretora/broker (Ágora, BTG, Clear, Inter, Nu Invest, Rico, XP, Binance, IC Markets, IQ Option), classificados em `Investimentos|Cripto|Poupança`, registrando valor investido, valor atual e aporte mensal em centavos, com cálculo de rendimento percentual na camada de view.
- FR26 (Retro-doc 2026-04-11): As **Categorias** passam a suportar `emoji` e `description`, e ganham hierarquia com `subcategories` (migration 000011) permitindo seed em batch transacional de uma árvore de categoria → subcategorias (8 categorias com ~36 subcategorias no seed default).
- FR27 (Retro-doc 2026-04-11): O Proprietário/Administrador pode simular **"Empurrar Fatura"** (rolagem de dívida) diretamente no PWA escolhendo cartão, valor da fatura, pagamento inicial, maquininha (InfinitePay, Ton, Stone, Mercado Pago, Cielo, PagBank) e parcelamento 1x–12x, recebendo uma timeline de operações saque+pagamento e persistindo o resultado em `debt_rollovers` com `operations_json` (JSONB) para histórico. Esta é a contraparte PWA do Epic 5 (que antes era WhatsApp-only).
- FR28 (Retro-doc 2026-04-11): O Proprietário vê um **Score Financeiro** (0–100) no dashboard calculado via ponderação de 4 fatores: `billsOnTime` (35%), `budgetRespect` (25%), `savingsRate` (25%), `debtLevel` (15%), com níveis Excelente/Bom/Regular/Crítico (≥80, ≥60, ≥40, <40), renderizado como gauge SVG animado — componente puramente visual, sem persistência em banco no momento.
- FR29 (Retro-doc 2026-04-11): O módulo **Relatórios** (`/reports`) expande o DRE simples do FR20 para **9 abas** navegáveis: DRE, Categorias, Subcategorias, Por Membro, Por Cartão, Método de Pagamento, Modo Viagem, Comparativo e Tendência — com filtros por mês/membro/categoria/tipo. O "Modo Viagem" fica atrás de um toggle na sidebar.

### NonFunctional Requirements

- NFR1 (Transacional): O tempo entre a IA receber a mensagem de áudio de uma despesa no WhatsApp e responder com o recibo textual processado deve ser inferior a 5 segundos no p90 (90% dos casos).
- NFR2 (Latência Visual): O carregamento inicial (First Contentful Paint) do Dashboard PWA não deve exceder 2.5 segundos em redes móveis 4G padrão.
- NFR3 (Criptografia): A totalidade dos inputs passivos do repositório relacional impõe criptografia profunda operando pelo protocolo base AES-256. Interconexões assíncronas dos conectivos web provindos requerem segredos restritos apartados operando com "salting" dinâmico fortificado.
- NFR4 (Compliance LGPD): Todo lixo sonoro contido (arquivos efêmeros impuros transbordantes de contexto conversacional de treinamento breve) obedecem deleção segura compulsória após 30 dias na ausência de aceite revalidado do proprietário da nuvem.
- NFR5 (Concessão Contínua de NLP): A arquitetura dos ouvintes que engatilha as predições autônomas precisa sustentar ondas anômalas (Traffic bursts) provendo SLA base contínuo para no mínimo 500 chamadas simultâneas engarrafando fluxos excedentes numa retaguarda resiliente elástica sem queda atômica.
- NFR6 (Uptime): A API que liga a LLM/NLP e o banco de dados deve objetivar 99.9% de uptime (permitindo cerca de 43 minutos de downtime tolerável por mês).

### Additional Requirements

**Requisitos Técnicos da Arquitetura:**
- Starter Template Frontend (Epic 1 / Story 1): Next.js 15 oficial + shadcn/ui. Comando inicial: `npx create-next-app@latest laura-pwa --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` seguido de `npx shadcn-ui@latest init`.
- Starter Template Backend (Epic 1 / Story 1): Arquitetura baseada em Go para o core / worker do mensageiro (`go mod init laura-finance-bot`).
- Banco de Dados (PostgreSQL puro): Sem Wrappers de ORM/SaaS. Valores em banco armazenados obrigatoriamente como INTEGER (cents). NUNCA usar FLOAT/DECIMAL.
- Inteligência Artificial (LLM/NLP): Integração via API do OpenAI/Gemini/Anthropic (foco nos modelos Mini).
- Integrações de Serviços de Terceiros: **Stripe (ou Gateway de Pagamento Nacional)** embutido via webhooks, e **Provedores de E-mail (Resend/Sendgrid)** conectados para entrega transacional de acessos.
- Landing Page & Marketing: Explicitamente declarados como V2.0 (Post-MVP), separados do core-product MVP.

### FR Coverage Map

FR1: Epic 1 - Autenticação e Perfis Seguros
FR4: Epic 1 - Regras LGPD e Exclusão de Conta
FR9: Epic 1 - Definição de Emissores da Conta
FR10: Epic 1 - Construção das Categorias Iniciais
FR22: Epic 1 - Módulo SaaS e Pagamentos Integrados
FR23: Epic 1 - Entrega de E-mails Transacionais com Acessos e Recibos
FR2: Epic 2 - Cadastro de WhatsApp e Dependentes
FR3: Epic 2 - Atribuição Identitária via WhatsApp
FR5: Epic 2 - Log Natural de Registros (Linguagem NLP)
FR6: Epic 3 - Visualização Transacional no PWA
FR8: Epic 3 - Reversão "Un-do" via Chat
FR11: Epic 3 - Curadoria Manual Especializada no PWA
FR12: Epic 3 - Sistema de Tags Customizadas (PF/PJ)
FR7: Epic 4 - Desambiguação Ativa da IA  
FR13: Epic 4 - Nudge Predictivo de Teto
FR14: Epic 4 - Nudge de Vencimento de Cartões
FR16: Epic 5 - Gatilho Simulação
FR17: Epic 5 - Motor Matemático de Solução Financeira
FR18: Epic 5 - Confirmação Assíncrona dos Novos Prazos
FR15: Epic 6 - Text-based relatórios diretos
FR19: Epic 6 - Gráficos Instantâneos via Whatsap
FR20: Epic 6 - Dashboard DRE Desktop
FR21: Epic 6 - Outputs planilhados para Contador
FR24: Epic 8 - Metas Financeiras (Goals)
FR25: Epic 8 - Investimentos (Investments)
FR26: Epic 8 - Categorias com Emoji e Subcategorias
FR27: Epic 9 - Empurrar Fatura (Simulador de Rolagem PWA)
FR28: Epic 9 - Score Financeiro (Dashboard)
FR29: Epic 9 - Relatórios Multidimensionais (9 Abas)

## Epic List

### Epic 1: Fundação, Onboarding, Pagamentos e Gestão de Privacidade (PWA)
Os usuários criam sua conta no modelo SaaS, realizam o pagamento da assinatura, recebem o seu acesso seguro e nota por e-mail, registram seus cartões e limites e gerenciam seus direitos de exclusão LGPD, destrancando o MVP.
**FRs covered:** FR1, FR4, FR9, FR10, FR22, FR23

### Epic 2: A Mágica do Whatsapp (Ingestão Fricção-Zero e Multi-perfil)
Membros convidados da família / empresa enviam áudios e textos pelo Whatsapp, tendo as despesas interceptadas, convertidas em entidades estruturadas através do NLP seguro e salvas na database central em tempo real sob alta disponibilidade.
**FRs covered:** FR2, FR3, FR5

### Epic 3: Dashboard Reactivo e Curadoria Segura (PWA)
Os proprietários possuem visibilidade instantânea dos gastos realizados pela assistente e podem retificar problemas (Human in the loop), anular ações desastrosas e dividir as despesas da empresa vs pessoa física de forma nativa através de Tags no visual dark mode do PWA.
**FRs covered:** FR6, FR8, FR11, FR12

### Epic 4: Assistente Proativo de Alerta e Retenção
Ao invés de aguardar dados, a Laura emite "Nudges" ativamente alertando para a proximidade do teto financeiro do mês (ex: 80% gasto no Lazer) ou do iminente vencimento da fatura dos cartões gravados, além de questionamentos de desambiguação proativa.
**FRs covered:** FR7, FR13, FR14

### Epic 5: Simulação de Rolagem e Resgate de Crise (Funcionalidade Growth / Post-MVP inicial)
O painel backend analisa taxas de crédito nativas ativas sugerindo vias alternativas matemáticas do fluxo caótico da dívida caso o cliente não consiga arcar o limite faturado. (Marcado como Prio Menor em face aos épicos 1~4).
**FRs covered:** FR16, FR17, FR18

### Epic 6: Relatórios Visuais Profissionais on-Demand
O software condensa os lançamentos numa DRE legível visualmente pelo desktop da Joana, permitindo extrações CSV limpas, ao passo em que também rende gráficos de imagens gerados dinamicamente no Whatsapp e garante a segurança do fluxo global.
**FRs covered:** FR15, FR19, FR20, FR21

### Epic 8: Planejamento Financeiro — Metas, Investimentos e Taxonomia Rica (Retro-doc)
Expansão pós-MVP descoberta durante auditoria de 2026-04-11: o PWA passou a permitir que o Proprietário construa o lado "planejamento" da vida financeira (antes só havia o lado "registro"), com Metas (`financial_goals`), Investimentos (`investments`) e uma taxonomia rica de Categorias com emoji, descrição e subcategorias. Stories retroativas documentando código já em produção nos commits `490b3ec` e `0b50751`.
**FRs covered:** FR24, FR25, FR26

### Epic 9: Intelligence Layer no PWA — Score, Relatórios Multidimensionais e Empurrar Fatura Visual (Retro-doc)
Expansão pós-MVP descoberta durante auditoria de 2026-04-11: o dashboard ganhou um Score Financeiro ponderado, o módulo de Relatórios saltou de uma DRE simples para 9 abas analíticas, e o Epic 5 (que era WhatsApp-only) ganhou uma contraparte visual no PWA — um simulador de "Empurrar Fatura" com persistência em `debt_rollovers`. Stories retroativas documentando código já em produção nos commits `490b3ec` e `0b50751`.
**FRs covered:** FR27, FR28, FR29

## Epic 1: Fundação, Onboarding, Pagamentos e Gestão de Privacidade (PWA)

Os usuários criam sua conta no modelo SaaS, realizam o pagamento da assinatura, recebem o seu acesso seguro e nota por e-mail, registram seus cartões e limites e gerenciam seus direitos de exclusão LGPD, destrancando o MVP.

### Story 1.1: Core Infrastructure & Project Setup

As a Desenvolvedor Frontend/Backend,
I want inicializar o repositório com Next.js 15, shadcn/ui e banco de dados Go+PostgreSQL,
So that possamos ter a infraestrutura escalável necessária para a PWA e o Webhooks Gateway.

**Acceptance Criteria:**

**Given** um novo repositório limpo
**When** configuramos a aplicação
**Then** devemos utilizar `npx create-next-app` seguido de `shadcn-ui init` com Tailwind CSS e Dark Mode Ativado
**And** devemos instanciar conexões limpas em um ORM seguro ou SQL puro com PostgreSQL armazenando transações nativamente em CENTS (Integer), sem tolerância a falhas de float.

### Story 1.2: Cadastro Inicial de Administradores

As a Proprietário,
I want me cadastrar no PWA inicializando meu Workspace (Família/Empresa) seguro com Dark Mode,
So that eu possa preparar meu painel para a chegada dos outros membros logando com sucesso.

**Acceptance Criteria:**

**Given** a página inicial do PWA (Authentication)
**When** eu me registro com e-mail forte e senha
**Then** o banco gera meu Tenant/Grupo seguro em AES-256 e me reconhece como "Proprietário"
**And** o sistema inicia a exibição do Dashboard visual (Ainda com Empty States em Skeletons baseados em componentes shadcn).

### Story 1.3: Assinatura e Integração com Checkout SaaS

As a Proprietário não-pagante,
I want visualizar as features premium da minha Assistente Laura e realizar o pagamento pela Landing Page de Checkout embutida,
So that as restrições de limite de uso e transações ilimitadas na infraestrutura da IA sejam liberadas.

**Acceptance Criteria:**

**Given** que eu acabei de criar a conta gratuita
**When** eu navego pelas opções bloqueadas e clico em "Assinar Laura Finance"
**Then** sou redirecionado a um painel seguro criptografado provido por Gateway (Stripe / Pagar.me)
**And** o status retornado via webhook pelo provedor desbloqueará temporariamente me dando as bandeiras ativas no banco de dados para iniciar o "PWA Pro".

### Story 1.4: Disparo de Acessos e Comprovantes (Email Transacional)

As a Banco de Dados / Core System,
I want disparar automaticamente emails via Resend/AWS SES para o pagador,
So that ele guarde sua nota de garantia e as credenciais invioláveis (Login seguro de Papéis).

**Acceptance Criteria:**

**Given** a confirmação do webhook do Gateway na Story 1.3 de uma Assinatura sucedida
**When** a API Go intercepta o pagamento
**Then** e-mails templates construídos devem ser enviados para o Proprietário (com receipt)
**And** caso novos dependentes sejam registrados, eles também devem receber senhas temporárias de acesso geradas e formatadas na caixa de e-mail.

### Story 1.5: Wizard de Cadastro de Emissores (Cartões)

As a Proprietário/Administrador,
I want registrar e configurar meus cartões de crédito e as contas correntes de uso (Emissores) predefinindo seus fechamentos,
So that a Laura no Whatsapp saiba exatamente onde o dinheiro foi processado.

**Acceptance Criteria:**

**Given** o Stepper do Dashboard do PWA
**When** eu preencho os campos de "Novo Cartão" (Sem os 16 dígitos físicos, apenas a Bandeira, Vencimento, Cor, e Nome do dono e final/apelido)
**Then** o PostgreSQL relacional salvará o emissor associado aquele perfil
**And** eu terei a chance sequencial e otimizada (Progress Bar de passos) de continuar incluindo cartões em menos de 1 minuto sem reloading massivo de UI. 

### Story 1.6: Setup de Categorias e Orçamentos Básicos

As a Proprietário/Administrador,
I want visualizar e construir caçambas financeiras ("Lazer, Mercado") especificando Tetos Fixos Mensais,
So that os alertas e nudges de 80% possuam referências estáticas e matemáticas precisas para avisar o usuário desatento.

**Acceptance Criteria:**

**Given** a tela do dashboard com categorias 
**When** eu defino, por exemplo, R$ 2000,00 limitando 'Supermercado'
**Then** eu visualizarei componentes dinâmicos de barra de progresso (CategoryProgressBars) 
**And** este valor será gravado em `cents` no backend atrelado o ID global orgânico dos gastos.

### Story 1.7: Painel de Privacidade e Compliance LGPD

As a Membro/Admistrador/Proprietário logado,
I want acessar uma sessão de configurações de Segurança explícita e pedir a exclusão automática e física (Soft e/ou Hard delete),
So that lixos sonoros contendo conversas privadas curtas e áudios que gravei há mais de 30 dias sejam deletados dos provedores IA (OpenAI/S3).

**Acceptance Criteria:**

**Given** o acesso ao app em desktop ou mobile restrito
**When** o usuário exige exclusão na aba "Meus Dados / Direito ao esquecimento"
**Then** não só o encerramento do vínculo (churn SaaS e pausa de Gateway) deve ocorrer
**And** scripts transacionais baseados na LGPD processam hard deletion do tenant limpo (ou deleção passiva forçada cronometrada a 30 dias na ausência explícita do ok temporário).

## Epic 2: A Mágica do Whatsapp (Ingestão Fricção-Zero e Multi-perfil)

Membros convidados da família / empresa enviam áudios e textos pelo Whatsapp, tendo as despesas interceptadas, convertidas em entidades estruturadas através do NLP seguro e salvas na database central em tempo real sob alta disponibilidade.

### Story 2.1: Cadastro Seguro de Múltiplos Números no PWA

As a Proprietário,
I want adicionar números de celular/WhatsApp dos meus filhos, cônjuges ou sócios no PWA e dar permissões a eles,
So that a Laura reconheça seus remetentes quando for solicitada a transação.

**Acceptance Criteria:**

**Given** a interface de "Lista de Integrantes" em /members
**When** eu adiciono o contato e seleciono o Role (Ex: Admin ou Dependente)
**Then** esse usuário ficará atrelado com segurança à conta mestra
**And** o bot no Go começará a aceitar mensagens desse usuário na próxima interação.

### Story 2.2: Conexão WebSocket WhatsApp + API Go

As a Integrador IA,
I want estabelecer os canais conectivos de infraestrutura entre as bibliotecas do WhatsApp e a minha API central Go,
So that o recebimento cru dos textos e arquivos de áudios aconteça em latência baixíssima sem perdas.

**Acceptance Criteria:**

**Given** um celular com a conta enviando mensagens teste
**When** a mensagem chega no canal webhook/websocket do Go 
**Then** não devem haver dropouts para chamadas simultâneas altas (Sustentações elásticas parciais de fila)
**And** os IDs dos remetentes devem ser logados e filtrados permitindo o processamento apenas dos cadastrados na Story 2.1 (Bloqueando spam passivo).

### Story 2.3: Conversão de Áudio para Texto Transacional

As a Membro Registrado,
I want mandar um áudio desestruturado pro Bot na rua ("Gastei 15 num Uber e mais 60 de almoço"),
So that eu não precise abrir aplicativos e telas densas enquanto ando.

**Acceptance Criteria:**

**Given** minha conta verificada trocando mensagem com Laura
**When** o motor Go intercepta minha gravação
**Then** um provedor Speech-to-Text de IA veloz converte o arquivo
**And** passa uma string correta e polida sem corromper pontuações (STT base sem parsing matemático ainda).

### Story 2.4: NLP Parsing, Estruturação e Log no Banco de Dados

As a API Go,
I want processar a cadeia textual num LLM focado em extração JSON de Alta performance (Ex: GPT-4o-mini estruturado),
So that os elementos matemáticos transacionais apareçam no banco instantaneamente.

**Acceptance Criteria:**

**Given** a string transcrita na Story 2.3 ou digitada ativamente
**When** o endpoint dispara contra o framework NLP interno do Go
**Then** a saída deve ser obrigatoriamente forçada num Schema JSON contendo `{"valor_em_cents": 1500, "categoria_id": X, "data": Y}` e inserida no Postgres
**And** as heurísticas financeiras não devem errar o montante global numérico caso jargões do tipo ("Mil e quinhentos") sejam alocados em contexto, e o usuário receberá a resposta em < 5s (NFR1).

## Epic 3: Dashboard Reactivo e Curadoria Segura (PWA)

Os proprietários possuem visibilidade instantânea dos gastos realizados pela assistente e podem retificar problemas (Human in the loop), anular ações desastrosas e dividir as despesas da empresa vs pessoa física de forma nativa através de Tags no visual dark mode do PWA.

### Story 3.1: Visualização de Transações Instantâneas (Server/Client via SWR/WebSocket)

As a Membro Registrado,
I want abrir a aba principal e me deparar com os cards descritivos das despesas processadas no Whatsapp atualizadas na hora,
So that eu confie absolutamente na transcrição sem questionar os extratos da Laura.

**Acceptance Criteria:**

**Given** um ambiente NextJS com Server Actions ativados
**When** os cartões de lista transacional (shadcn DataTable e Cards empilhados) chamam as tabelas Postgres da conta logada
**Then** não devem haver Delays acima de 2.5s do Loading Virtual
**And** caso um processamento novo do Whatsapp (Epic 2) ocorra concorrentemente enquanto eu uso o painel, a API engatilhe um revalidate ou push SSE em real-time e popule a interface reactivamente sem *hard refresh*.

### Story 3.2: Botão Desfazer / Un-do via Chat

As a Usuário Mobile,
I want responder a Laura na mesma conversa mandando ela "apagar" o último lançamento caso eu perceba que dito em voz alta estava muito equivocado,
So that a plataforma NLP do chatbot trate rollback diretamente, não necessitando entrar no PWA.

**Acceptance Criteria:**

**Given** o NLP Go Backend conversacional que acabou de processar a Story 2.4 e informou `"Gasto lançado"`
**When** o usuário no Whatsapp escreve: `"Poxa Laura, eu errei. Apaga esse aí de 15, na verdade foi só 5"`
**Then** as integrações de contexto por Vetorização da AI resgatarão o ID interno engatilhado na base SQL e executarão `DELETE` transacional.
**And** se mais longe no tempo for o erro (ex. erro detectado 2 dias depois), instruir a usar as intervenções da Story 3.3.

### Story 3.3: Curadoria Especializada Manual e Deleções Cirúrgicas

As a Proprietário / Administrador da Tabela Central no PWA,
I want conseguir editar os campos cruciais (Categoria, Valor e Banco) via campos textuais e visuais diretos no Dashboard Web,
So that os algoritmos da Inteligência nunca me aprisionem a categorizações questionáveis de semântica cinzenta.

**Acceptance Criteria:**

**Given** o clique/toque de detalhamento de um Card individual Transacional
**When** a "Bottom Sheet" do shadcn se constrói e mostra Selects preenchidos da modelagem AI crua original (FR11)
**Then** um fluxo UI "SaveChanges" altera a tabela principal do Postgres forçando recálculos DRE e atualizando relatórios
**And** também deve possuir o ícone destrutivo para Soft Delete visível confirmável "Tem certeza?".

### Story 3.4: Sistema Customizado de Tags Multivariadas (PF / PJ)

As a Prosumer / MEI / Empreendedor autônomo,
I want categorizar gastos "Paguei o Adobe" e vincular a Tags chamadas "Empresarial" diretamente para apartar o lucro pessoal,
So that eu nunca precise ter o esforço imenso mental de gerenciar *Workspaces* difíceis separados.

**Acceptance Criteria:**

**Given** um formulário simples "Add nova Tag"
**When** a string (ex `"Empresarial#PJ", color: "blue"`) entra no schema de DB
**Then** os Prompts de conversão conversacional e a IA nativamente tentarão mapear se a intenção contextual do áudio pedia `"Gastei 50 para a **empresa**"`. 
**And** as renderizações HTML React pintarão badges do *shadcn-ui* (violeta/azul/verde) atrelando esta etiqueta com peso unívoco aos `WHERE clauses` futuros no módulo de relatório (Evitando cruzamento de balanços FR12).

## Epic 4: Assistente Proativo de Alerta e Retenção

Ao invés de aguardar dados, a Laura emite "Nudges" ativamente alertando para a proximidade do teto financeiro do mês (ex: 80% gasto no Lazer) ou do iminente vencimento da fatura dos cartões gravados, além de questionamentos de desambiguação proativa.

### Story 4.1: Desambiguação Ativa NLP 

As a Assistente Laura,
I want que o Motor me recuse e avise para interromper fluxos perigosos se a inferência LLM cair drasticamente na precisão semântica (Confidence Score baixo),
So that eu pergunte para o humano de volta como no cenário da Story 1.

**Acceptance Criteria:**

**Given** o áudio *"Fiz um treco"* foi extraído do WhatsApp
**When** a JSON Schema ToolCall do motor LLM interno devolve `Uncertainty > Threshold Pré-acordado (Ex: < 85%)`
**Then** aborta-se explicitamente do Commit de SQL no banco (Não insere no BD vazio)
**And** engatilha prompt em português afável e carinhoso no WhatsApp de volta (Ex: *"Carlos, desculpa. Eu não entendi de qual conta bancária os US$ 10 da Amazon devem sair, foi Nu ou o Inter corporativo?"*, aguardando string afirmativa em FR7).

### Story 4.2: Nudges e Lembretes Estáticos Preditivos de Vencimento

As a CronJob Process Backend,
I want disparar varreduras na tabela de "Cartões e Emissores" para buscar as faturas prestes à expirar num *offset* restrito de 3 dias estritos,
So that eu notifique meu dependente com mensagens que os salvam com empatia.

**Acceptance Criteria:**

**Given** datas pré-calculadas de fechamento
**When** a rotina interna programada via Task Runner (ex: Goroutines e tickers) atinge Janela de Alertas = 3
**Then** executa um send MessageOutbound de WhatsApp Text cru englobando template e o saldo final para reter a fatura.
**And** esta notificação push DEVE seguir todas as templates API oficiais aceitáveis em caso de mensageria Oficial WhatsApp (FR14).

### Story 4.3: Semáforos Orçamentários e Alertas Dinâmicos de Teto (Thresholds 80%)

As a Motor de Aggregações Periciais,
I want calcular os percentuais de completude da Categoria Base do mês instantaneamente todo final de novo Insert para verificar batimentos perigosos,
So that antes que o usuário atinga o buraco da quebra orçametária de 100%, ele saiba e reduza passivo.

**Acceptance Criteria:**

**Given** o evento Post-Insertion das operações da Story 2.4 no banco
**When** a matemática atinge (`Σ despesas >= 0.8 * Teto Categoria` do Epic 1.6)
**Then** eu envio ativamente um alerta amigável mas firme `"Ei João, cuida aí. Somados esse lanche, faltam pouco mais de R$ 100 pras tuas cotas de Lazer deste mês! Segura as pontas."`
**And** deve possuir lógica idempotente evitando que ele mande isso em **todos os gastos** subsequentes do threshold dentro da mesma janela contábil de 30 dias se já interpelado (FR13).

## Epic 5: Simulação de Rolagem e Resgate de Crise (Funcionalidade Growth / Post-MVP inicial)

O painel backend analisa taxas de crédito nativas ativas sugerindo vias alternativas matemáticas do fluxo caótico da dívida caso o cliente não consiga arcar o limite faturado. (Marcado como Prio Menor em face aos épicos 1~4).

### Story 5.1: Evocação da Crise Baseada em Intenção via NLP

As a Usuário Desesperado,
I want mandar uma mensagem "Laura me ferrei, minha fatura veio 6000 e só tenho 4 pra pagar",
So that a Laura entenda a anomalia semântica de falha e acenda a Flag de simulação matemática (FR16).

**Acceptance Criteria:**

**Given** um contexto interpretativo de déficit de fatura no Go NLP
**When** a string carrega semânticas de socorro ("Não vou conseguir pagar o Itaú")
**Then** não trate como despesa tradicional de banco ou categoria simples
**And** transicione imediatamente a state-machine do Chatbot para o "Crise Handler" perguntando: *"Posso calcular uma ajuda de rolagem entre teus cartões?"*.

### Story 5.2: Motor Matemático Preditivo de Adquirentes e Amortização

As a Core Go Service,
I want compilar na lógica do backend as taxas mensais de adquirentes simples da praça (InfinitePay a 3%) e tabelar Tabela Price,
So that quando a Story 5.1 for engatilhada, eu devolva na hora uma string formatada simulando opções lógicas (FR17).

**Acceptance Criteria:**

**Given** o motor de Crise engatilhado
**When** ele busca a diferença que falta Pagar
**Then** ele rodará cálculos de rolagem: *"Dividir R$ 2000 em 2x de R$ 1056"* vs taxa do cartão original (14% ao mês)
**And** retornará o Push JSON formatando os dados bonitos pro WhatsApp para aprovação humana (Ex: Botões In-Line do Whatsapp).

### Story 5.3: Confirmação e Commit da Prorrogação de Dívida

As a Banco de Dados,
I want processar os retornos post-simulação e gravar os débitos proativamente nos próximos meses calendários subsequentes,
So that o simulador passe a ser a realidade orçamentária do usuário e as progressBars do Epic 3 se atualizem mês que vem. (FR18)

**Acceptance Criteria:**

**Given** a proposição de simulação aprovada via WhatsApp ou Bottom Sheet do PWA
**When** a API Go executa a lógica de sucesso
**Then** ele criará um evento persistente que emite novos Insert em SQL forçados para os Timestamp futuros corretos (Mes 2, Mes 3...)
**And** notificará o usuário finalizando o ciclo de aflição de crise.

## Epic 6: Relatórios Visuais Profissionais on-Demand

O software condensa os lançamentos numa DRE legível visualmente pelo desktop da Joana, permitindo extrações CSV limpas, ao passo em que também rende gráficos de imagens gerados dinamicamente no Whatsapp e garante a segurança do fluxo global.

### Story 6.1: Geração de Imagens Ricas em NodeJS (WhatsApp Backend)

As a Membro Registrado,
I want mandar áudio pendindo "Manda um gráfico de como anda meu mês na pizzaria" ou "Gráfico corporativo geral",
So that a tela do meu Whats receba uma imagem formatada rica JPEG gerada on-the-fly sem a engessação do HTML de aplicativo.

**Acceptance Criteria:**

**Given** a intent "Quero ver relatório" aprovada pela engine LLM
**When** o worker repassa para um microservico/NextJS api de Puppeteer/Canvas
**Then** deve interceptar as métricas em memória dos cartões de Recharts via SSR React e montar o layout em memória
**And** empurrar de volta pelo webhook como Buffer de File (Image) provendo a magia total (FR19).

### Story 6.2: DRE Simplificado e Analytics no PWA (Desktop/Mobile)

As a Empreendedor/Proprietário,
I want abrir a Tabs "Relatórios" no PWA pelo Desktop e analisar agrupamentos massivos da minha vida e CNPJ,
So that eu veja grafos evolutivos anuais em Barras e consiga fazer scroll profundo no Datatable. (FR20)

**Acceptance Criteria:**

**Given** o Workspace do PWA aberto em telas de alta-resolução (Desktop lg > 1024px)
**When** acessada a rota `/reports`
**Then** componentes unificados renderizarão um overview gráfico lateral usando `Recharts` e uma Tabela de Data Completa na esquerda
**And** Toggle groups interativos alternarão a data filtrada cruzando implicitamente a Tags (PF vs PJ da Epic 3).

### Story 6.3: Exportações CSV Agendar e Instantâneas para o Contador

As a Proprietário Cauteloso,
I want apertar o botão "Baixar CSV" agrupado ou mensal na lateral do relatorio,
So that eu não dependa de formatos blindados do aplicativo para mostrar minha DRE pro meu contador real (FR21).

**Acceptance Criteria:**

**Given** as matrizes filtradas de relatórios no Desktop (Story 6.2)
**When** ativado o Hook de Download no framework Next
**Then** um blob content type 'text/csv' com cabeçalhos coerentes ("Data, Categoria, Despesa, Tipo") e mascaramento seguro opcional deve ser emitido pelo Browser
**And** o usuário nunca deverá ter perdas de codificações base no Excel (Ex. Falha de UTF-8 do Windows vs Mac).

## Epic 8: Planejamento Financeiro — Metas, Investimentos e Taxonomia Rica (Retro-doc 2026-04-11)

> **Nota de retro-documentação**: Este épico documenta retroativamente código já em produção nos commits `490b3ec` (2026-04-10) e `0b50751` (2026-04-11), que foram implementados fora do fluxo BMAD durante uma fase de "vibe coding" pós-MVP. A arquitetura real observada é compatível com o `project-context.md` (cents, sem ORM, dark mode, shadcn). Stories marcadas como `done` para refletir o estado atual.

Expansão do PWA que adiciona a camada de **planejamento** (antes só existia a camada de **registro** via Epics 1–4). O Proprietário agora planeja para onde o dinheiro vai antes de gastá-lo: define Metas com prazos, rastreia Investimentos por corretora e organiza uma taxonomia rica de Categorias com emoji/descrição/subcategorias.

### Story 8.1: Enriquecimento da Taxonomia de Categorias (Emoji, Descrição e Subcategorias)

As a Proprietário/Administrador,
I want que cada Categoria tenha emoji, descrição textual e uma lista de subcategorias navegáveis,
So that eu e minha família tenhamos uma linguagem visual imediata e consistente ao classificar gastos, reduzindo fricção cognitiva.

**Acceptance Criteria:**

**Given** a tabela `categories` pré-existente do Epic 1.6
**When** a migration `000015_add_emoji_to_categories.sql` é aplicada
**Then** as colunas `emoji VARCHAR(10)` e `description VARCHAR(500)` devem ser adicionadas sem perda de dados
**And** a rota `/categories` deve renderizar uma árvore expansível de 8 categorias-raiz (Pessoal, Moradia, Alimentação, Transporte, Lazer, Finanças, Trabalho, Viagem) com ~36 subcategorias, cada uma com emoji próprio
**And** a server action `seedCategoriesAction` deve popular em batch transacional (BEGIN/COMMIT/ROLLBACK) a árvore default a partir de um payload JSON tipado
**And** a action `addCategoryAction` deve aceitar emoji e description em novos cadastros, preservando a regra de `monthly_limit_cents` (INTEGER, nunca float).

**Implementation artifacts:**
- `infrastructure/migrations/000011_create_subcategories.sql` (pré-req hierarquia)
- `infrastructure/migrations/000015_add_emoji_to_categories.sql`
- `laura-pwa/src/app/(dashboard)/categories/page.tsx`
- `laura-pwa/src/lib/actions/categories.ts` (`addCategoryAction`, `fetchCategoriesAction`, `fetchCategorySummariesAction`, `seedCategoriesAction`)

### Story 8.2: Módulo de Metas Financeiras (Financial Goals)

As a Proprietário/Administrador,
I want cadastrar e acompanhar metas financeiras com prazo, valor-alvo, emoji e cor,
So that eu visualize o progresso de objetivos concretos (Viagem, Carro, Casa, iPhone, Fundo de Emergência, Educação, Casamento, Investimento) e mantenha a família motivada a poupar.

**Acceptance Criteria:**

**Given** a migration `000012_create_financial_goals.sql` aplicada
**When** eu acesso `/goals` no PWA
**Then** devo ver 3 summary cards (Total Acumulado, Meta Total, Objetivos Ativos) e uma grid de cards por meta, cada um com emoji, progress bar, "guardar por mês" calculado (meta − atual) ÷ meses restantes
**And** o formulário de criação deve expor 8 presets (pré-configurados com emoji e cor) e um modo manual, gravando `target_cents` e `current_cents` como INTEGER
**And** `deadline` deve ser DATE, `status` default `active` com transições `completed` / `paused`
**And** a tabela deve ter `workspace_id` com `ON DELETE CASCADE` e index `idx_goals_workspace` para isolamento tenant.

**Implementation artifacts:**
- `infrastructure/migrations/000012_create_financial_goals.sql`
- `laura-pwa/src/app/(dashboard)/goals/page.tsx` (351 linhas)
- `laura-pwa/src/lib/actions/goals.ts` (`addGoalAction`, `fetchGoalsAction`)

### Story 8.3: Módulo de Investimentos (Investment Tracking por Corretora)

As a Proprietário Prosumer,
I want cadastrar meus investimentos por corretora (broker), tipo e aporte mensal,
So that eu veja meu patrimônio total, rendimento percentual e disciplina de aportes consolidados no mesmo dashboard dos gastos.

**Acceptance Criteria:**

**Given** a migration `000013_create_investments.sql` aplicada
**When** eu acesso `/investments` no PWA
**Then** devo ver 4 summary cards (Patrimônio Total, Total Investido, Rendimento com %, Aporte Mensal)
**And** o form deve permitir seleção de broker a partir de uma lista visual (Ágora, BTG, Clear, Inter, Nu Invest, Rico, XP, Binance, IC Markets, IQ Option) e tipo `Investimentos|Cripto|Poupança`
**And** cada card exibido deve ter broker, tipo, valor atual, rendimento % calculado em view camada (`(current − invested) / invested`), e aporte mensal
**And** `invested_cents`, `current_cents` e `monthly_contribution_cents` devem ser INTEGER em centavos — proibido float
**And** `workspace_id` com `ON DELETE CASCADE` e index `idx_investments_workspace`.

**Implementation artifacts:**
- `infrastructure/migrations/000013_create_investments.sql`
- `laura-pwa/src/app/(dashboard)/investments/page.tsx` (292 linhas)
- `laura-pwa/src/lib/actions/investments.ts` (`addInvestmentAction`, `fetchInvestmentsAction`)

## Epic 9: Intelligence Layer no PWA — Score, Relatórios Multidimensionais e Empurrar Fatura Visual (Retro-doc 2026-04-11)

> **Nota de retro-documentação**: Este épico também documenta retroativamente código nos commits `490b3ec` e `0b50751`, implementados fora do BMAD. Ele complementa os Epics 5 e 6 originais, trazendo para o PWA features que antes eram exclusivas do WhatsApp ou de DRE simples.

O dashboard ganha uma camada de **inteligência**: um Score Financeiro ponderado dá um sinal de saúde imediato, o módulo de Relatórios vira multidimensional (9 abas), e o simulador de rolagem do Epic 5 (que era texto puro no WhatsApp) ganha uma interface visual persistente com histórico.

### Story 9.1: Simulador "Empurrar Fatura" no PWA + Persistência de Rolagens

As a Proprietário em aperto,
I want simular "empurrar" uma fatura de cartão usando maquininhas (saques no crédito) direto no PWA, escolhendo institution, parcelamento e pagamento inicial,
So that eu veja exatamente quanto vou pagar em taxas antes de fazer a operação real, e tenha um histórico permanente das rolagens feitas.

**Acceptance Criteria:**

**Given** a migration `000014_create_debt_rollovers.sql` aplicada e um cartão já cadastrado
**When** eu acesso `/invoices/push` no PWA
**Then** devo preencher: cartão (dropdown), valor da fatura, pagamento inicial, maquininha (InfinitePay, Ton, Stone, Mercado Pago, Cielo, PagBank), parcelamento 1x–12x
**And** a tela deve calcular e exibir uma timeline de operações com pagamento + saque detalhado usando tabela de taxas hardcoded por institution × parcelamento
**And** 4 summary cards devem mostrar Valor Fatura, Total Sacado, Total Taxas, Quantidade de Operações
**And** o botão "Salvar operação" deve persistir em `debt_rollovers` com `operations_json` JSONB contendo a timeline completa, `fee_percentage` DECIMAL(5,2), `total_fees_cents` e `invoice_value_cents` como INTEGER
**And** `card_id` deve ter `ON DELETE SET NULL` (preservar histórico mesmo se o cartão for removido)
**And** esta story representa a **contraparte PWA do Epic 5** — o motor matemático continua sendo o fonte de verdade quando acionado via chat.

**Implementation artifacts:**
- `infrastructure/migrations/000014_create_debt_rollovers.sql`
- `laura-pwa/src/app/(dashboard)/invoices/push/page.tsx` (315 linhas)
- `laura-pwa/src/lib/actions/invoices.ts` (`addDebtRolloverAction`, `fetchDebtRolloversAction`)

### Story 9.2: Score Financeiro no Dashboard (Gauge Animado)

As a Proprietário,
I want ver um Score Financeiro de 0–100 no topo do dashboard, com decomposição dos 4 fatores que o formam,
So that eu tenha um sinal único de saúde financeira sem precisar interpretar 10 gráficos.

**Acceptance Criteria:**

**Given** o usuário logado e o dashboard aberto
**When** o componente `FinancialScore` é montado
**Then** um gauge SVG animado deve renderizar o score 0–100 com cor e emoji por faixa: Crítico (<40) 🔴, Regular (40–59) 🟡, Bom (60–79) 🟢, Excelente (80+) ⭐
**And** 4 barras de progresso animadas devem mostrar os fatores: `billsOnTime` (peso 35%), `budgetRespect` (25%), `savingsRate` (25%), `debtLevel` (15%)
**And** o layout no dashboard deve usar `lg:col-span-2` ao lado do `DashboardChart` em `lg:col-span-3`
**And** animações devem respeitar a regra do `project-context.md` (uso criterioso de Framer Motion em componentes de complexidade alta)
**And** no momento atual a lógica vive no frontend — a persistência histórica do score em banco é um trabalho futuro.

**Implementation artifacts:**
- `laura-pwa/src/components/features/FinancialScore.tsx` (154 linhas)
- `laura-pwa/src/app/(dashboard)/dashboard/page.tsx`

### Story 9.3: Relatórios Multidimensionais — 9 Abas Analíticas

As a Empreendedor/Proprietário,
I want que a rota `/reports` tenha abas analíticas profundas (DRE, Categorias, Subcategorias, Por Membro, Por Cartão, Método de Pgto, Modo Viagem, Comparativo, Tendência) com filtros cruzados,
So that eu consiga responder qualquer pergunta sobre onde o dinheiro vai sem exportar CSV.

**Acceptance Criteria:**

**Given** o Workspace aberto em desktop ≥ 1024px
**When** acessada `/reports`
**Then** devem existir 9 abas navegáveis, com a aba **DRE** como default mostrando Receitas Brutas, Despesas Fixas, Despesas Variáveis, Investimentos e Resultado Líquido
**And** os filtros globais (mês, membro, categoria, tipo entrada/saída/saque) devem afetar todas as abas
**And** a aba **Modo Viagem** só deve ser acessível quando o usuário ativa o toggle correspondente na sidebar
**And** esta story **supersedes parcialmente** a Story 6.2 (DRE Simplificado) — os ACs da 6.2 continuam válidos como subconjunto, mas a implementação real é multi-aba
**And** o export CSV da Story 6.3 continua sendo fornecido como ponte para o contador.

**Implementation artifacts:**
- `laura-pwa/src/app/(dashboard)/reports/page.tsx` (413 linhas)
