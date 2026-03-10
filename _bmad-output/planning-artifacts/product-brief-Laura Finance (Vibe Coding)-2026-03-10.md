---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments: []
date: 2026-03-10
author: Nexus AI
---

# Product Brief: Laura Finance (Vibe Coding)

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

O Laura Finance é um assistente financeiro inteligente e conversacional projetado para eliminar o atrito do controle financeiro pessoal, familiar e de pequenos negócios (MEI/Autônomos). Através de um ecossistema que integra um painel Web completo (para configurações e análises profundas) e uso 100% via WhatsApp, a "Laura" atua como uma Diretora Financeira de Bolso. O sistema extrai inteligência de conversas informais e as transforma em dados estruturados (JSON) para categorizar gastos automaticamente (em mais de 13 super categorias e dezenas de subcategorias), gerar relatórios on-demand em tempo real (com envio de gráficos visuais no WhatsApp) e automatizar planejamentos financeiros complexos — como rolagem de faturas de cartão utilizando plataformas parceiras de crédito.

---

## Core Vision

### Problem Statement

Autônomos (Prosumers e MEIs) e famílias gerenciam fluxos de caixa altamente misturados, combinando contas de casa, custos de equipamentos e receitas avulsas, muitas vezes usando os mesmos cartões, num método falho ou de "caderneta mental". Plataformas financeiras atuais cobram um "pedágio" de tempo muito alto: exigem o download de um app, o acesso e a categorização inflexível manual de cada gasto (data, banco, de quem foi, qual categoria). O alto atrito de inserção gera abandono.

### Problem Impact

Sem a continuidade no registro de dados, a visibilidade financeira desaparece. Isso leva a surpresas com limites de orçamento (chegar no dia 20 com 90% dos gastos de delivery estourados, por exemplo), perda da rastreabilidade em famílias (não saber qual cônjuge gastou), mistura nociva entre capital pessoal e da empresa, além do sofrimento com juros não planejados devido a falta de cálculos claros na hora de rolar ou parcelar faturas de cartões.

### Why Existing Solutions Fall Short

Aplicativos financeiros tradicionais operam passivamente — dependem totalmente que o usuário tenha disciplina para abrir o app e caçar onde os gastos ocorreram. Eles também focam apenas nos polos extremos: ou são genéricos e simplistas demais para uso individual solitário, ou são ERPs robustos projetados para médias empresas com contadores dedicados, deixando o autônomo (que mistura doações à Igreja e contas de luz à assinaturas de SaaS) completamente sozinho.

### Proposed Solution

Uma interface "Zero Atrito" baseada no WhatsApp, turbinada por Inteligência Artificial (a assistente Laura), suportada por um backbone robusto configurável no PWA/Web. A Laura mapeia compras parceladas, entende pronomes possesivos no áudio ("minha mulher gastou"), processa divisoes ("30 no débito, 20 no crédito"), emite alertas proativos sobre aproximação do limite orçamentário pré-definido pelo usuário e gera instantaneamente arquivos de imagem com gráficos de pizza/barras respondendo a faturamentos mensais via chat.

### Key Differentiators

- **Gestão "Prosumer" Fluida (PF + MEI):** Estrutura de banco de dados robusta pré-configurada baseada em 13 super-categorias (Vida Pessoal, Empresa, Espiritual, Relacionamentos, etc). A abstração do "multi-perfil" é controlada no painel Web e operada nativamente no mesmo número de WhatsApp.
- **Relatórios Gerados e Entregues no Chat:** Integração do processamento analítico com design. A Laura não fornece só resumos textuais de gastos e faturas, mas envia recortes gráficos legíveis e atraentes diretamente na linha do tempo do usuário para rápida leitura.
- **Micro-inteligência em Ações Estruturadas via NLP:** Capacidade exclusiva da "Laura" de mapear e abstrair instituições financeiras "on the fly" através de conversas, calculando taxas de parcelamento e instruindo a complexa "Rolagem/Empurrada de Fatura" via maquininhas e adquirentes pré-cadastrados (ex: InfinitePay).

---

## Target Users

### Primary Users

**1. Casais e Famílias Jovens (O Administrador e Co-Gestor)**
- **Perfil:** Casais jovens ou de meia-idade (CLTs ou autônomos, até ~40 anos), habituados com tecnologia e que desejam unificar e organizar as finanças da casa.
- **A Dor:** A falta de sincronização financeira. Gastam sem saber se o outro já pagou a conta de luz, não sabem quanto resta do orçamento de "Lazer" conjunto e vivem perguntando "você pagou com qual cartão?". Tentam usar planilhas, mas o atrito do preenchimento manual faz com que logo abandonem.
- **Visão de Sucesso:** Poder consultar os gastos conjuntos ("Laura, me mostre os gastos da casa de ontem") em formato visual e imediato. Lançar gastos por áudio no supermercado e a Laura deduzir automaticamente quem gastou apenas pelo número do WhatsApp que enviou a mensagem.

**2. O "Prosumer" / Empreendedor Autônomo e Freelancer**
- **Perfil:** Profissionais liberais (dentistas, engenheiros), MEIs ou donos de pequenas agências.
- **A Dor:** Ficam com a vida financeira familiar e empresarial "embaralhada". Usam o mesmo cartão pessoal para comprar equipamento da empresa ou pagar a janta com a esposa. Sofrem no fim do mês para separar o que foi para a casa e qual foi o lucro real do negócio.
- **Visão de Sucesso:** Poder mandar um áudio no trânsito ("Laura, paguei 200 de AWS no Nubank e 150 do lanche das crianças no Inter") e saber que a Laura vai alocar tudo perfeitamente (200 para "Empresa/Cloud" e 150 para "Família/Filhos").

**3. O Jovem Profissional Individual (CLT ou Solteiro)**
- **Perfil:** Indivíduos que têm preguiça de apps financeiros tradicionais engessados, mas querem ter controle do seu dinheiro.
- **A Dor:** Odeiam preencher formulários. Acham a gestão financeira metódica uma prioridade chata, exigente e demorada.
- **Visão de Sucesso:** Interagir com suas finanças de forma conversacional e sem atrito, recebendo "broncas" amigáveis ou elogios da Laura quando estão perto de estourar a meta da subcategoria "Delivery".

### Secondary Users

**1. O Membro / Dependente / Perfil Jovem**
- **Perfil:** Filhos adolescentes ou dependentes financeiros dentro da família. Não são o público pagante (idosos/avôs), mas são usuários da ponta.
- **Interação:** Através do WhatsApp, conseguem registrar os gastos que eles próprios realizaram com os métodos pré-aprovados ou consultar o saldo de suas mesadas/orçamentos isolados (Ex: "Laura, quanto ainda tenho de mesada para games?"), sem acesso à visão macro dos pais.

### User Journey

**A Jornada de Valor do Laura Finance**

1. **Onboarding (Setup Inicial):** O Usuário Proprietário (ex: o cônjuge mais engajado) acessa o painel Web/PWA uma vez. Configura o núcleo do sistema: cartões que a família usa, contas, orçamentos e metadados.
2. **Setup Familiar:** Adiciona os Membros (cadastrando o celular da esposa como Administradora e do filho como Membro no sistema atrelado àquela conta central).
3. **O Momento Mágico (Lançamento Diário):** Em vez de abrir o app, a esposa manda um áudio no WhatsApp dela: "Laura, 200 reais de fralda pelo Pix do Nubank". A Laura intercepta, reconhece a voz/celular e já categoriza no orçamento familiar automaticamente.
4. **Resolução de Crise Avançada (Empurrar Fatura):** Chega o vencimento do cartão e o saldo está curto. Pelo WhatsApp, um dos administradores comanda: "Laura, vou empurrar 5 mil da fatura do Itaú na maquininha Ton em 3x". A Laura calcula as taxas e valores das parcelas, valida com o usuário e, se aprovado, autogera o fluxo no banco de dados.
5. **Fechamento de Ciclo (Gráficos On-Demand):**  Sexta à noite, o casal quer ver o panorama da família. Pelo chat perguntam: "Quanto gastamos de lazer?". Em segundos recebem imagens geradas dinamicamente com gráficos em fatias da realidade deles.

---

## Success Metrics

### User Success

- **Controle Financeiro Descomplicado:** Fim do uso de planilhas e cadernetas. O usuário não se preocupa em acessar painéis complexos todo dia; a Laura tira a "fricção" através do WhatsApp.
- **Relacionamento e Reforço Positivo:** A Laura constrói um vínculo com o usuário. O sucesso ocorre quando o usuário reage aos reforços da IA: ele gosta da "puxada de orelha" amigável se estourar o orçamento e vibra com o "parabéns" por economizar na categoria (ex: gastou apenas R$ 200 dos R$ 500 no Delivery).
- **Gamificação de Bons Hábitos (Troféus Virtuais):** O usuário comemora micrometas financeiras percebidas pela IA, como "Pagar a fatura sem atraso", "Respeitar o teto de gastos", ou "Manter o ritmo de aportes".
- **Realização Guiada de Objetivos:** Conseguir acompanhar e injetar dinheiro em objetivos reais (ex: Viagem de Férias), sendo motivado mensalmente pela Laura com relatórios de projeção de quando o sonho será realizado.

### Business Objectives

- **Retenção pelo Relacionamento (Stickiness):** Nossa principal aposta é que o modelo puramente "frio" e automatizado falha em reter. A Laura precisa gerar um relacionamento contínuo (com alertas precisos, nunca irritantes) para derrubar as taxas de churn (cancelamentos de assinatura). O usuário fica pela interação humana simulada e o zelo da IA, e não apenas pelo relatório que ela gera.
- **Formação de Hábito Ativo:** Transformar a Laura na constante "memória financeira" da família. O objetivo é que os alertas proativos ("Vi que a fatura vence hoje!") eduquem o usuário a lançar seus dados sempre.
- **Open Finance como Suporte, não Muleta:** Mesmo no futuro, com integração das contas bancárias (Open Finance) para baixar dados automaticamente, a estratégia de negócios exige que a Laura mantenha a *interação*. A automação total mata o relacionamento; o negócio vence se a Laura puxar a conversa com o usuário sobre o dado importado.

### Key Performance Indicators (KPIs)

- **Taxa de Engajamento Interativo:** Volumetria de DAUs/WAUs (Weekly Active Users) enviando prompts de lançamentos, dúvidas ou gráficos no WhatsApp vs. os que estão inativos no chat.
- **Aderência ao "Teto de Gastos":** % de usuários que finalizam o ciclo mensal gastando o que orçaram nas categorias sem sofrer grandes desvios. A eficácia das "broncas" da IA é medida aqui.
- **Taxa de Objetivos Em Andamento:** Número médio de metas cadastradas (viagens, quitação de dívidas, carros) recebendo aportes contínuos baseados nos alertas de incentivo da Laura.
- **Health Score da Interação:** Métricas de retenção a longo prazo (Mês 3 e Mês 6 de assinatura). Validar se a personalização da IA reduz a fadiga e mantém o LTV (Lifetime Value) alto em relação a concorrentes.
- **Evitação de Atrasos:** % de contas e faturas cadastradas que são pagas antes ou no dia do vencimento como resultado direto de um "alerta/nudge" da Laura.

---

## MVP Scope

### Core Features

- **Omnichannel Inteligente e Multimodal (WhatsApp Oficial):** Integração com a API Oficial do WhatsApp (Meta) para uso de recursos premium como Flows e Carrosséis. A IA "Laura" é totalmente multimodal: compreende texto, contexto, áudio, imagens, stickers/GIFs e emojis. Ela também consegue responder em áudio sintetizado (usando TTS com excelente custo-benefício como OpenAI ou ElevenLabs) e realizar chamadas de voz pelo WhatsApp.
- **Ecossistema Sincronizado (Web/App Bubble):** A mesma inteligência e contexto da Laura estarão disponíveis na plataforma Web/PWA através de um assistente flutuante (bubble). O histórico e o contexto são unificados, gerando notificações e interações ativas também dentro da própria interface web.
- **Mapeamento Categórico Inferido (NLP):** Categorização automática baseada em um banco de categorias curadas pré-existentes (13 supercategorias). A IA lê a conversa e já aloca o lançamento no destino correto, rejeitando o cadastro manual de categorias pelo usuário.
- **Ecossistema Multi-Perfil e Permissões:** Estrutura hierárquica base operando dentro do painel (Proprietário, Administrador, Membro) e a criação das "tags" que definem de qual entidade foi o gasto (Pessoa, Empresa, Familiar, Dependente).
- **Setup Central Web (Core Data):** Painel Web/PWA exigido para cadastros essenciais de controle como Instituições Financeiras (pré-carregadas para escolha), Cartões de Crédito (com limites, vencimentos, donos, fechamento de faturas), Corretoras e Operadoras de Crédito.
- **Engenharia Financeira Acelerada:** Execução completa do fluxo interativo de "Empurrar Fatura", realizando todos os cálculos de amortização e rotativo via chat e lançando as parcelas nos meses seguintes na plataforma de forma contínua.
- **Notificações, Comportamento e Tetos (O Relacionamento):** Implantação de tetos/limites orçamentários por Categoria, com alertas reativos e proativos (elogios ou 'broncas' amigáveis via WhatsApp, configuráveis/ajustáveis nativamente pelo Painel Web), construindo um controle de hábito que vai de avisos de estouro de meta até o "Vi que sua fatura vence daqui a 2 dias".
- **Gestão de Objetivos e Metas:** Criação de caixas de "Metas e Sonhos" (ex: Viagem, Carro, Câmera) no Painel e acompanhamento interativo do progresso ("Faltam 2 mil!") com report visual.
- **Motor de Gráficos e Imagens Dinâmicas:** Relatórios solicitados no chat ("Mostre os gastos fixos em pizza") sendo devolvidos em milissegundos como Imagem estática + Resumo formatado nativamente no app de mensagens e relatórios fixos no dashboard PWA.

### Out of Scope for MVP

- **Open Finance / Integração Direta Inicial:** Para a fase 1, o núcleo operará inteiramente com o que o usuário interage via banco de dados próprio, sem leitura ou acesso cru de movimentações e saldos nas APIs e sistemas dos bancos abertos para evitar extrema complexidade regulatória e de dependência no MVP.
- **Consulta a Bureau de Crédito e Extrato de Scores (Serasa/SPC):** Consultas pesadas externas de pontuação do usuário não entrarão nesse ciclo.
- **Pagamentos Autorizados Nativos:** A própria "Laura" não autorizará saídas de caixa nativas via Pix dinâmico ou emissão de boletos para quitar a fatura através dela. O pagamento real é externo, e a baixa do pagamento (sinalização da vitória) é confirmada no chat ou painel.

### Future Vision

A visão de produto da Laura Finance para a Janela V2.0 e 3.0 (Cenário do 2º Ano em diante) envolve o amadurecimento como Ecossistema Absoluto Ativo.
A expansão envolverá as amarras via **Automação do Sistema Bancário de Base** por Open Finance — quando todas as informações transitarem nativamente da rede bancária em plano de fundo —, mantendo o diferencial da curadoria da conversa para avisos. Neste escopo visionário, prevê-se os módulos de extração de Credit Score e cruzamentos em tempo real em que a Laura poderia sugerir a renegociação de faturas em outros bancos detectando as taxas do ecossistema nacional e executando transações se permitida pelo usuário.
