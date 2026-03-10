---
workflowType: 'prd'
workflow: 'edit'
stepsCompleted: 
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
classification:
  projectType: web_app
  domain: fintech
  complexity: high
  projectContext: greenfield
inputDocuments: 
  - product-brief-Laura Finance (Vibe Coding)-2026-03-10.md
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 0
workflowType: 'prd'
---

# Product Requirements Document - Laura Finance (Vibe Coding)

**Author:** Nexus AI
**Date:** 2026-03-10

## Executive Summary

A Laura Finance é um ecossistema de assistência financeira inteligente que remove completamente o atrito do controle de fluxo de caixa para casais, famílias e profissionais autônomos (MEI/Prosumers). Operando majoritariamente via WhatsApp (através da integração com a API Oficial e uma plataforma de mensageria complementar), o sistema atua como uma "Diretora Financeira de Bolso". A solução substitui painéis passivos e planilhas exigentes por um modelo ativo e conversacional: a IA processa áudios e textos em linguagem natural para categorizar gastos instantaneamente, dividir despesas entre membros, alertar proativamente sobre limites orçamentários e gerar relatórios gráficos on-demand. Todo o processamento analítico é suportado por um robusto backbone Web/PWA, onde as configurações operacionais avançadas e painéis de controle consolidados residem.

### What Makes This Special

O diferencial central da Laura Finance é o conceito de **"Atrito Zero na Captura de Dados"**. Enquanto plataformas financeiras tradicionais fracassam em retenção ao exigir o preenchimento manual rigoroso em aplicativos isolados, a Laura vai até onde o usuário já se comunica. A principal inovação reside na sua capacidade de interpretar intenções complexas no meio da rotina (ex: "Laura, empurre a fatura do Itaú de 5 mil reais em 3x na maquininha Ton"), realizando instantaneamente toda a engenharia financeira (cálculos de amortização e rotativo) e devolvendo evidências visuais diretamente no chat. Este modelo de interação natural elimina o fardo temporal da gestão financeira, transformando uma obrigação tediosa em um relacionamento contínuo e engajador.

## Project Classification

- **Project Type:** Aplicação Web (PWA) e Assistente Chatbot Integrado
- **Domain:** Fintech (Gestão Financeira Pessoal / MEI)
- **Complexity:** Alta (Integração de IA para extração textual, cálculos financeiros paramétricos focados, motor de renderização gráfica on-demand e integrabilidade com plataformas de roteamento assincrono de chat)
- **Project Context:** Greenfield (Produto Novo)

## Success Criteria

### User Success

- **Adoção de Hábito (Fricção Zero):** O usuário deve conseguir registrar um gasto complexo (ex: "Laura, gastei 200 no Nubank, sendo 150 pra casa e 50 pra empresa") em menos de 10 segundos via áudio no WhatsApp.
- **Micro-Vitórias Financeiras:** Os usuários devem receber e reagir ativamente (com emojis ou mensagens) aos alertas da Laura sobre o respeito aos tetos de gastos e pagamentos de fatura em dia.
- **Visibilidade Imediata:** A capacidade de solicitar e receber um panorama financeiro visual (gráfico gerado em imagem) diretamente no chat em menos de 5 segundos.

### Business Success

- **Retenção de Longo Prazo (Stickiness):** Alcançar uma taxa de retenção superior a 70% no Mês 3 de assinatura, provando que o relacionamento interativo com a IA supera os dashboards estáticos da concorrência.
- **Engajamento Ativo (WAU):** Manter pelo menos 80% dos usuários ativos semanalmente interagindo com a Laura via WhatsApp (inserindo dados, pedindo relatórios ou respondendo aos alertas de orçamento).
- **Conversão de Fluxo Misto:** Adoção por usuários Prosumer/MEIs que configuram e utilizam com sucesso a separação de orçamentos (Pessoal vs. CNPJ) sob a mesma conta.

### Technical Success

- **Precisão de NLP e Categorização:** A inteligência da Laura deve categorizar corretamente o gasto inferido por voz/texto em 95% das vezes, dispensando correção manual no PWA.
- **Confiabilidade da Mensageria (API Oficial e Alternativas):** Garantir 99.9% de uptime no recebimento e envio de mensagens e geração de relatórios gráficos *on-demand*.
- **Cálculo de Engenharia Financeira:** 100% de precisão nos cálculos de juros, rolagem e amortização simulados no momento em que o usuário pede para "empurrar uma fatura".

### Measurable Outcomes

- Redução do tempo médio gasto por semana em gestão financeira pelo usuário (de 2-3 horas em planilhas para minutos diários no chat).
- Aumento do índice de pagamentos de faturas realizados sem atraso (graças aos *nudges*/alertas preditivos da Laura).
- Taxa de cancelamento (*churn*) inferior a 5% ao mês, justificada pela criação do hábito de uso contínuo.

## Product Scope

### MVP - Minimum Viable Product

- **Mensageria Multimodal (WhatsApp):** Integração via API Oficial e sistema complementar e resiliente de interface conversacional não-oficial suportando textos e áudios.
- **Motor NLP de Categorização:** Classificação automática em 13 super-categorias fixas, identificação de posse (quem gastou) e método de pagamento.
- **Painel PWA/Web Básico:** Interface para onboarding do "Proprietário", cadastro manual de cartões, limites de orçamento, criação de membros (multi-perfil) e painel consolidado de métricas.
- **Gestão Ativa de Orçamento:** Sistema de alertas/nudges via WhatsApp (elogios e "broncas") baseado nos tetos definidos no PWA.
- **Engenharia de Fatura (Rolagem):** Fluxo conversacional da Laura para calcular e lançar parcelamentos de fatura usando taxas de adquirentes conhecidos (ex: InfinitePay).
- **Geração Gráfica On-Demand:** Respostas a comandos de chat com envio de imagens contendo gráficos dinâmicos de faturamento.

### Growth Features (Post-MVP)

- Multiplicidade completa de perfis de dependentes (filhos/adolescentes com controles estritos e mesadas visíveis por chat).
- Expansão da gamificação (distribuição de "troféus virtuais").
- Síntese de voz realista (TTS) para chamadas ativas ou respostas em áudio da própria Laura via WhatsApp.
- Módulo avançado de "Metas e Sonhos" com acompanhamento interativo de aportes.

### Vision (Future)

- **Open Finance Integrado:** Leitura passiva de transações bancárias oficiais cruzadas com o contexto conversacional.
- Gestão algorítmica de crédito (sugerindo ativamente a transferência de dívidas de cartões caros para opções de crédito mais baratas mapeadas no mercado).

## User Journeys

### Jornada 1: O "Momento Mágico" da Gestão Familiar (Caminho Feliz)
**Persona:** Mariana (34 anos) - Mãe, esposa e "Proprietária" da conta conjunta na Laura Finance.
- **A Dor:** Mariana fazia as compras de supermercado e depois precisava sentar à noite, abrir o app do banco, tentar lembrar se usou o cartão dela ou do marido, e depois abrir uma planilha pesada para categorizar tudo. Era exaustivo e ela frequentemente abandonava na metade do mês. 
- **O Desafio:** Manter o orçamento compartilhado da casa (Mercado, Lazer, Filhos) em dia, sem virar escrava do controle financeiro.
- **A Solução:** Mariana sai do supermercado empurrando o carrinho. Em vez de guardar as notinhas, ela saca o celular e manda um áudio no WhatsApp: *"Laura, deu 850 reais no Assaí, passei no crédito do Nubank do Thiago"*.
- **A Resolução:** A Laura usa NLP para identificar que "Assaí" é Supermercado (categoria), lê o valor, atribui o gasto ao cartão do cônjuge (Thiago) e subtrai 850 reais do teto mensal da família. Em 2 segundos, Laura responde no chat: *"Anotado, Mari! Foram R$ 850 para o Supermercado no Nubank do Thiago. Vocês ainda têm R$ 400 nessa categoria até o fim do mês"*. Mariana sorri, guarda o celular e volta para casa com a mente livre.

### Jornada 2: O Empreendedor "Linha Cruzada" (Recuperação/Caso Complexo)
**Persona:** Carlos (29 anos) - Designer autônomo e MEI.
- **A Dor:** Carlos não tem cartão corporativo. Ele paga a assinatura da Adobe, do servidor AWS e o jantar com a namorada usando o mesmo Inter Mastercard. No fim do ano, seu contador surta, e Carlos não sabe o que é lucro ou gasto pessoal.
- **O Desafio:** Isolar instantaneamente o que é PF (Pessoa Física) e PJ (Pessoa Jurídica) logo após a compra.
- **A Solução:** Carlos acabou de fechar a compra anual de um software de design de US$ 100. Na pressa, ele digita para a Laura: *"Renovei o Figma por 500 reais"*.
- **O Clímax:** A Laura percebe que a compra é tipicamente corporativa, mas nota que Carlos não especificou o destino. Ela devolve: *"Carlos, vi que gastou R$ 500 no Figma. Devo alocar em 'Empresa/Software' ou 'Pessoal/Cursos'?"*.
- **A Resolução:** Carlos responde apenas *"Empresa"*. A Laura confirma e já isola o gasto do demonstrativo de lucros do MEI dentro do painel PWA, mantendo o controle pessoal de Carlos intacto.

### Jornada 3: A "Engenharia de Crise" (Momento de Salvação)
**Persona:** Thiago (35 anos) - Cônjuge da Mariana (Administrador).
- **A Dor:** É dia 5 e o cartão do Itaú recém fechado de Thiago somou R$ 6.000, mas ele só tem R$ 4.500 na conta porque o pagamento de um cliente atrasou. Os juros do cartão chegam a absurdos 14% ao mês. Ele não sabe calcular opções de crédito para escapar do rotativo.
- **A Solução:** Desesperado, ele manda mensagem para a Laura: *"Laura, me ferrei, a fatura do Itaú fechou em 6 mil e só tenho 4, o que eu faço?"*
- **A Resolução Ativa:** Ao invés de ser um "extrato mudo", a Laura analisa os perfis (via integração de alta conectividade multicanal garantindo a entrega do alerta proativo crítico). *"Calma, Thiago. Posso te ajudar a rolar esses 2 mil que faltam usando a maquininha da InfinitePay que você cadastrou. Ali a taxa é de 3% ao mês. Se empurrarmos R$ 2.050 para o cartão do Inter em 2x de R$ 1.056, você foge do juros de 14% do Itaú. Posso gerar o fluxo?"*. O alívio de Thiago é imediato. Ele aprova, e a Laura já lança as futuras parcelas de R$ 1.056 para os próximos dois meses no calendário da família.

### Jornada 4: Visão Consolidada no PWA (O Setup e o Proprietário)
**Persona:** Joana (42 anos) - Mentora financeira que ajuda os pais idosos.
- **O Clímax Setup:** A Laura não funciona sozinha no WhatsApp sem um 'cérebro'. Joana abre o App/Dashboard web para a configuração inicial pesada.
- **O Uso Profundo:** Ela usa o PWA para cadastrar todas as 13 categorias de despesas, criar o perfil de "Pai" e "Mãe" e limitar orçamentos estritos para remédios. No fim do mês, ela precisa de uma visão agregada (que a tela estreita do WhatsApp não suporta tão bem). No painel web consolidado, Joana acessa relatórios robustos de DRE, consolida planilhas para o IR, e revisa o "Health Score" financeiro da família com gráficos profundos de tendência mensal.

### Journey Requirements Summary

Essas narrativas destravam necessidades cruciais para a construção do app:
- **Jornada 1 (Mariana):** Exige um motor flexível de processamento de linguagem natural (NLP) integrado a um roteador conversacional de intenções (áudio-para-texto e extração de parâmetros como `entidade`, `valor`, `categoria`, `meio de pagamento`). Exige controle unificado de carteira por "Família" onde celulares diferentes enviam dados pro mesmo Banco de Dados.
- **Jornada 2 (Carlos):** Revela a necessidade de um sistema de "Estado e Contexto" na API do chat. A Laura precisa lembrar do que falaram há 10 segundos atrás para pedir desambiguação e aplicar o conceito de "Tags/Sub-contas" (PF e PJ).
- **Jornada 3 (Thiago):** O requisito mais técnico e complexo: A Laura precisa de um módulo de *Engenharia Financeira*, contendo simulador matemático de juros de diferentes fontes (Tabela Price/SAC, taxas de adquirentes) e capacidade preditiva de alterar o fluxo de caixa dos meses subsequentes. Demanda uma arquitetura isolada conectando provedores de mensageria elásticos e seguros que complementam as limitações burocráticas nativas de soluções oficiais engessadas.
- **Jornada 4 (Joana):** Exige que, por trás do WhatsApp, exista uma API Rest robusta ligada a um portal Web (PWA) de gerenciamento, banco de dados relacional forte para controle de RBAC (Permissions: Proprietário, Admin e Dependente), além de um motor rico de relatórios e exportações.

## Domain-Specific Requirements

### Compliance & Regulatory
- **Separação Abstrata de Dados (PF e PJ):** Para o perfil *Prosumer/MEI*, embora não haja movimentação real de fundos através do PWA/WhatsApp, a base de dados deve manter registros fiscais categorizados de forma que a exportação de relatórios cumpra os preceitos básicos de contabilidade (DRE simplificado), facilitando a declaração de Imposto de Renda.
- **Lei Geral de Proteção de Dados (LGPD):** O sistema deve possuir mecanismos de consentimento claros e ferramentas para o usuário solicitar a "anonimização/exclusão" ("Esquecimento") de todos os seus áudios transcritos, extratos e mapeamento financeiro capturados pela IA.
- **Isenção de Atuação Direta:** O MVP deve operar exclusivamente como *Read-Only* ou registro gerencial. A Laura *não fará transferências de valores ou movimentações reais* entre bancos, blindando o projeto no MVP de licenças pesadas do Banco Central (ex: ITP - Iniciador de Transação de Pagamento).

### Technical Constraints
- **Segurança de Mensageria Contínua:** Todo tráfego roteado alternativamente para o mensageiro instantaneo oficial de comunicação corporativa exige que as conexões subjacentes, links dinâmicos e sessões possuam rotação constante e blindagem com os mais rígidos preceitos industriais da atualidade.
- **Mascaramento de Dados Sensíveis:** Sempre que a IA gerar resumos visuais no chat que forem ser enviados para grupos familiares, os últimos dígitos de cartões ou documentos descritivos críticos devem ser mascarados (Data Masking) por padrão, a menos que solicitado o contrário pelo Proprietário.
- **Garantia de Uptime NLP:** O motor de Processamento de Linguagem Natural (NLP) e Conversão de Voz-para-Texto (STT Transcription) que processa áudios de gastos na rua não pode, por limitação de timeout de infraestrutura, perder o conteúdo original. Se a IA falhar em interpretar, o texto/áudio bruto vai para a caixa de pendências para tratamento assíncrono.

### Integration Requirements
- **Interoperabilidade Híbrida de Chat:** Integração corporativa sistêmica e resiliente focada em escalar os limites operacionais das ferramentas base em prol da prioridade do usuário, operando de forma redundante e híbrida nos momentos de predição estrita.
- **Bancos e Adquirentes Pré-Cadastrados:** Integração lógica e matemática com as tabelas de juros de instituições financeiras/adquirentes (ex: InfinitePay, Nubank, Itaú) para o módulo simulador da "Rolagem de Fatura/Engenharia de Crise". (No MVP, trata-se de integração de tabelas e atualização contínua, não via API de Open Banking real).

### Risk Mitigations
- **Risco de Hallucination (Alucinação da IA):**
  - *Risco:* A IA da Laura processar "Gastei 15 no pão" e entender "Gastei 1.500 no pão", destruindo o registro do usuário.
  - *Mitigação:* Implementar validações (sanity-checks) de limite estatístico na arquitetura do sistema e confirmação ativa ("Você quis dizer R$ 1.500? Responda Sim ou Não") para qualquer gasto que desvie agressivamente da média da categoria.
- **Risco de Bloqueio de Número do WhatsApp:**
  - *Mitigação:* Arquitetura híbrida modular usando canais oficiais com severo controle de *rate-limiting* e respeito explícito ao opt-in. Alertas focados requerem aprovação em base sistêmica confiável pela infra do mensageiro social.

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **"Zero-Friction" Data Ingestion via NLP e Mensageria:** 
   Substituir a interface gráfica primária de captura de dados (formulários de apps tradicionais) por um canal consolidado de comunicação diária (WhatsApp). O usuário interage como se falasse com um contador ou parceiro de negócios, e a IA faz a complexa estruturação relacional (entidade, valor, fonte pagadora, destinatário, tags) em segundo plano.

2. **Engenharia Financeira Conversacional Ativa:**
   Capacidade de "diagnosticar rotativo" e oferecer uma rota de fuga via chat (ex: empurrar fatura com adquirentes parceiros) através de simuladores pré-parametrizados. A IA deixa de ser apenas uma leitora passiva de extratos e passa a agir como uma consultoria preditiva em momentos de crise de caixa aguda.

### Market Context & Competitive Landscape

- Aplicativos líderes como Mobills, Guiabolso (descontinuado) e Organizze focam intensamente em dashboards belíssimos, mas possuem uma taxa de abandono massiva nos primeiros 3 meses devido à fricção da captura de dados (dependem do Open Finance que falha, ou inserção manual).
- Bots de WhatsApp existentes para finanças (como o antigo *Olivia* e *Minhas Finanças bot*) geralmente funcionam através de regras engessadas (*menus de opções númericas: Digite 1 para cadastro*), não suportando a maleabilidade de um áudio coloquial longo para múltiplos registros sequenciais ("gastei 50 no pão, 20 na farmácia e 100 de gasolina corporativa").

### Validation Approach

- **POC de Transcrição e Categorização:** Testar o modelo de LLM com 100 áudios reais, extremamente coloquiais e carregados de sotaque/ruído, enviados por *beta-testers*. O teste passa se o NLP extrair e categorizar os metadados financeiros corretamente em 95% das tentativas.
- **Métrica de "Time-to-Log":** Auditar o tempo entre a decisão do usuário de registrar o gasto e o log ser computado no banco de dados. O alvo de sucesso da inovação é manter esse tempo sob a marca de 10 segundos, comparado aos mais de 45 segundos de um app tradicional.

### Risk Mitigation

- **Complexidade do Áudio Não-Trivial:** Usuários podem enviar áudios muito abstratos ("Laura, paguei aquela conta lá"). A mitigação é a implementação de um *Prompt* de Desambiguação inteligente. Se a IA atingir uma margem de confiança menor que 80%, ela retorna a pergunta no chat de forma educada delimitando o que faltou ("Qual foi o valor, Carlos?").
- **Dependência de Plataforma Central:** Risco severo de bloqueio ou banimento por políticas do mensageiro mobile base. A mitigação arquitetural proposta (o uso de plataformas conversacionais complementares e independentes somadas à Oficial) isolará lógicas transacionais puras das comunicações marqueteiras propensas a bloqueios temporários.

## Web App / PWA Specific Requirements

### Project-Type Overview

A Laura Finance possui arquitetura dual: a "cabeça" interativa opera no WhatsApp (mensageria), enquanto o "corpo" de configuração e ingestão profunda é um **Web App escalável moldado como PWA (Progressive Web App)**, acessível via browsers em *desktop* e *mobile*. Esta estrutura garante a agilidade na captura de dados e a robustez no gerenciamento administrativo.

### Technical Architecture Considerations

- **SPA com Pre-rendering:** Front-end como Single Page Application (ex: React, Vue, ou Next.js no Bubble se *no-code*) para renderizar dashboards pesados instantaneamente após o carregamento inicial.
- **WebSocket / Webhooks Realizados:** Infraestrutura de Real-time e Webhooks contínua para sincronizar imediatamente ações do WhatsApp com as telas abertas no PWA (o dashboard atualiza assim que o usuário digita "ok" no chat).

### Key Architectural Matrices

#### Browser Matrix & Responsive Design
- Suporte total aos últimos releases do Chrome, Safari e Edge. Interface concebida seguindo o princípio *Mobile-First*, pois a grande maioria do uso administrativo ocorrerá na tela restrita do smartphone via PWA. O uso desktop é reservado para gestão agregada e DRE pelo perfil "Empreendedor/Proprietário".

#### Performance Targets
- Tempo perceptível de carregamento (*Time to Interactive*) abaixo de 3 segundos no mobile. 
- O motor de renderização de gráficos on-demand para o WhatsApp deve entregar o PNG/JPEG gerado pela API de backend da requisição em, no máximo, 2 segundos reais.

#### SEO Strategy & Discovery
- Landing pages otimizadas para motores de busca focado no longo prazo ("app de fluxo de caixa", "bot financeiro para whatsapp"), com SSR (Server-Side Rendering) nas homepages e páginas institucionais de captação.
- Como o core da aplicação fica atrás de autenticação (mural fechado para os dados com RBAC seguro), não há indexação de fluxos de usuários pelos buscadores.

#### Accessibility Level
- Cumprimento rigoroso das práticas W3C/WCAG (contraste mínimo e suporte a leitores de tela na versão web) sabendo-se que muito da experiência de ponta ocorre de forma falada e guiada no chat do WhatsApp, o que intrinsecamente já é inclusivo.

### Implementation Considerations

- Todo o miolo transacional da Laura, a calculadora simulada de fluxo de caixa futuro e o gateway conversacional modular deverão ficar encapsulados e unicamente providos pelos clusters computacionais autônomos de Backend para suportar de modo estanque as conexivas do usuário frente transicionamento assíncrono.
- A instalação local deve ser simulada por meio do manifesto de PWA para permitir o ícone de atalho na tela inicial do celular sem depender imediatamente de Stores (GPlay/App Store) para aprovação, reduzindo as barreiras burocráticas no MVP.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP (Foco implacável em retirar o atrito e entregar visibilidade instantânea sem a construção prematura de features passivas).
**Resource Requirements:** Equipe enxuta (Lean Team): 1 Full-Stack (voltado ao SPA Web / Backend relacional), 1 Especialista em Integrações e Redes Híbridas de Mensageria instantânea, 1 Designer UI visando a dualidade simplificada PWA x Chatbot.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Jornada 1: Lançamento rápido de gastos por áudio e texto.
- Jornada 2: Desambiguação inteligente de gastos multi-perfil.
- Jornada 3: Orientação e simulação básica de rolagem de dívida no cartão.

**Must-Have Capabilities:**
- Inteface "Invisible App" operando robustamente no WhatsApp.
- Autenticação e painel de configuração web de Orçamentos e Cartões (PWA).
- Motor de Extração de NLP para áudios coloquiais curtos e longos.

### Post-MVP Features

**Phase 2 (Post-MVP - Versão 2.0):**
- Módulo de Vendas e Marketing: Landing page oficial, analytics/tracking de navegação e automação de e-mails para conversão e abandono.
- Gestão completa de dependentes limitados (mesada de filhos).
- Sistema de Gamificação (Medalhas de engajamento e conquistas por disciplina).
- TTS (Text-to-Speech) para avisos sonoros enviados ativamente pela Laura.

**Phase 3 (Expansion):**
- Conexão nativa e certificada via Open Finance para auditoria passiva.
- Corretora de crédito integrada onde a IA transfere saldos automaticamente.

### Risk Mitigation Strategy

**Technical Risks:** O maior risco é a arquitetura não suportar NLP em tempo real. *Mitigação:* Usar APIs externas potentes (OpenAI Whisper/GPT-4o mini) com fallback assíncrono para os casos timeout, no qual o app informa o usuário de que computará o registro em alguns minutos.
**Market Risks:** O usuário não confiar na IA gerenciando/lendo dados da sua vida. *Mitigação:* Estratégia firme de Onboarding humanizado, e transparência radical por meio do painel Web, mostrando de forma visual que *tudo o que a Laura faz no WhatsApp tem espelho num BD seguro clássico e auditável pelo usuário*.
**Resource Risks:** Escassez de budget/tempo para o *Engine* preditivo complexo de Juros. *Mitigação:* Iniciar o MVP implementando o cálculo de "empurrar fatura" num simulador reativo com lógica parametrizada simplificada, focando em apenas 1 ou 2 adquirentes conhecidos para validar a tração da feature.

## Functional Requirements

### Account & Identity Management
- FR1: O Proprietário pode se cadastrar e criar a sua conta no PWA utilizando provedor de e-mail proprietário comum ou integração agnóstica de contas externas para autenticação.
- FR2: O Proprietário pode cadastrar números dos emissores mensageiros pertencentes aos membros da família ou dependentes, atribuindo as permissões rigorosas (Admin ou Dependente).
- FR3: O Usuário Autenticado pode iniciar uma comunicação através do aplicativo de mensagens e ter o envio referenciado empiricamente à sua identidade PWA por meio do ID numérico comunicador subjacente.
- FR4: O Usuário Autenticado pode solicitar a exclusão de sua conta e o engavetamento/apagamento irrestrito de dados transacionais via PWA (LGPD).
- FR22: O Proprietário pode assinar o modelo SaaS realizando pagamento via Gateway (ex: Stripe ou solução BR) no Dashboard web, liberando os acessos.
- FR23: Após a assinatura, o sistema dispara e-mails transacionais automáticos contendo comprovantes financeiros e links/credenciais de acesso inicial altamente seguros (separados por Papel: Proprietário, Admin, Membro).

### Data Ingestion & NLP Processing (WhatsApp)
- FR5: O Usuário logado pode alimentar ativamente despesas e ganhos através de mensagens de texto ou áudio curtos via mensageiria social.
- FR6: O Administrador pode visualizar com exatidão sua mensagem convertida nas entidades essenciais estruturadas na contabilidade (Valor, Categoria Base, Temporaridade, Instituição Emissora e Autor).
- FR7: O Usuário pode ser interpelado para aprovar diretamente a desambiguação do chat caso o nível algorítmico da abstração matemática decaia especificamente de um patamar pré-definido < 85%.
- FR8: O Usuário pode anular o englobamento numérico recém alimentado revertendo ativamente através do próprio comando conversacional expresso sem migrar plataforma.

### Financial Management & Budgeting (PWA)
- FR9: O Proprietário ou Administrador pode inserir emissores de crédito e definir teto global permissivo, janelas de expiração fiscal do fechamento e datas vencimento.
- FR10: O Proprietário ou Administrador pode construir barreiras e tetos de gastos associados perfeitamente a compartimentos contábeis unificados mensais (ex: "Mercado", "Lazer").
- FR11: O Proprietário ou Administrador pode manusear intervenções cirúrgicas nas transações puras em um Dashboard tradicional suprimindo eventuais delírios semânticos.
- FR12: O Prosumer pode estruturar seus outputs através de marcações avulsas ("Tags") operando a bifurcação transversal à métrica raiz, como as contas do CNPJ blindadas e isoladas da Pessoa Física.

### Proactive Nudging & Real-Time Intelligence
- FR13: O Usuário Autenticado pode receber dicas hiper-direcionais pontuais caso alguma despesa do montante atinja estatisticamente um consumo superior ao rácio percentual de 80% do teto.
- FR14: O Administrador pode ser alertado espontaneamente, com prazo antecipado configurável e fixo de 3 dias úteis cheios antes das cobranças predatizadas adentrarem à carência de pagamento.
- FR15: O Administrador e Dependentes podem realizar diálogos de consulta extraindo saldos imediatos obtendo conversas fluídas sem acessar painéis frios.

### Engineering & Crisis Resolution (Simulação)
- FR16: O Usuário pode evocar ordens para fatiar seus deveres contábeis ativando o sub-sistema simulador da rolagem transacional prevenindo multas nos cartões cadastrados.
- FR17: O Administrador pode escrutinar alternativas detalhadas contendo modelagem estruturada de dívida, recebendo propostas estáticas embasadas exclusivamente de arranjos financeiros gravados abstratamente.
- FR18: O Administrador pode oficializar as sugestões financeiras no mensageiro forçando a camada algorítmica a injetar as alocações preditivas das frações de dívida nos meses contábeis calendários correspondentes.

### Reporting & Export
- FR19: O Usuário pode gerar e acessar visualizações PNG ricas geradas através da IA operando inferências instantâneas pre-rendidas.
- FR20: O Empreendedor Administrador pode supervisionar debaixo dos painéis restritos Web ao mínimo uma métrica evolutiva mensal (Gráfico Barra), gráfico DRE Simplificado numérico e composição por Pizza.
- FR21: O Contador logado pode agendar exportações de saídas agnósticas (planilhadas isoladas sem codificações proprietárias) portando logs organizados das matrizes baseadas nas `Tags`.

## Non-Functional Requirements

### Performance
- NFR1 (Transacional): O tempo entre a IA receber a mensagem de áudio de uma despesa no WhatsApp e responder com o *recibo textual processado* deve ser inferior a 5 segundos no p90 (90% dos casos).
- NFR2 (Latência Visual): O carregamento inicial (First Contentful Paint) do Dashboard PWA não deve exceder 2.5 segundos em redes móveis 4G padrão.

### Security & Privacy
- NFR3 (Criptografia): A totalidade dos inputs passivos do repositório relacional impõe criptografia profunda operando pelo protocolo base AES-256. Interconexões assíncronas dos conectivos web provindos requerem segredos restritos apartados operando com "salting" dinâmico fortificado.
- NFR4 (Compliance LGPD): Todo lixo sonoro contido (arquivos efêmeros impuros transbordantes de contexto conversacional de treinamento breve) obedecem deleção segura compulsória após 30 dias na ausência de aceite revalidado do proprietário da nuvem.

### Scalability
- NFR5 (Concessão Contínua de NLP): A arquitetura dos ouvintes que engatilha as predições autônomas precisa sustentar ondas anômalas (Traffic bursts) provendo SLA base contínuo para no mínimo 500 chamadas simultâneas engarrafando fluxos excedentes numa retaguarda resiliente elástica sem queda atômica.

### Reliability & Availability
- NFR6 (Uptime): A API que liga a LLM/NLP e o banco de dados deve objetivar 99.9% de uptime (permitindo cerca de 43 minutos de *downtime* tolerável por mês), uma vez que gastos via chat são "compras de oportunidade" e o usuário confia no "Zero-Friction imediato".
