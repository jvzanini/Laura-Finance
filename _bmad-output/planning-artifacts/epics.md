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
