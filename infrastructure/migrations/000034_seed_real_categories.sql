-- Migration 000034: Reseed category_templates com as 13 categorias reais e subcategorias detalhadas.
-- Idempotente: deleta tudo e reinsere.

-- Garantir coluna description (já existe na 000029, mas por segurança)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'category_templates' AND column_name = 'description'
    ) THEN
        ALTER TABLE category_templates ADD COLUMN description VARCHAR(500);
    END IF;
END $$;

-- Limpar seed antigo
DELETE FROM category_templates;

INSERT INTO category_templates (name, emoji, color, description, subcategories, sort_order) VALUES

-- 1. Pessoal
(
    'Pessoal', '👤', '#8B5CF6',
    'Uma categoria dedicada aos gastos e atividades que envolvem o cuidado e o prazer individual. Aqui se concentram desde itens de higiene pessoal e vestuário até hobbies, presentes e tudo que contribui para a qualidade de vida pessoal.',
    '[
        {"emoji":"💅","name":"Cuidados pessoais","description":"Cabeleireiro, manicure, barbearia, depilação, tratamentos estéticos, salão de beleza, sobrancelhas, limpeza de pele, cuidados com barba e cabelo."},
        {"emoji":"🧴","name":"Higiene e Cosméticos","description":"Shampoo, sabonete, desodorante, pasta de dente, perfume, cremes corporais, protetor solar, produtos de skincare e higiene diária."},
        {"emoji":"👗","name":"Roupas e Calçados","description":"Vestuário casual e profissional, uniformes, jaquetas, tênis, cintos, meias, roupas íntimas, acessórios e pequenos ajustes de costura."},
        {"emoji":"🛍","name":"Compras Pessoais","description":"Acessórios, eletrônicos de uso pessoal (fone, smartwatch), mochilas, livros não-didáticos, presentes para si mesmo e pequenas compras de desejo."},
        {"emoji":"🎸","name":"Música e Instrumentos","description":"Aulas de canto, violão, guitarra, teclado, bateria e outros instrumentos; compra, manutenção e acessórios musicais."},
        {"emoji":"🧩","name":"Hobbies","description":"Atividades recreativas como fotografia, jardinagem, leitura, modelismo, escrita, culinária, artesanato, pintura, skate ou colecionismo."},
        {"emoji":"🎁","name":"Presentes e Datas Especiais","description":"Presentes dados ou recebidos em aniversários, Natal, Dia dos Namorados, amigo secreto, lembranças e materiais de presente."}
    ]'::jsonb,
    1
),

-- 2. Profissional
(
    'Profissional', '💼', '#06B6D4',
    'Reúne os custos e receitas associados à atividade profissional. Inclui ferramentas digitais, equipamentos de trabalho, materiais de escritório, comunicação e entradas financeiras relacionadas ao trabalho.',
    '[
        {"emoji":"💻","name":"Ferramentas e Softwares","description":"Assinaturas de SaaS, licenças de software, domínios, hospedagem, ferramentas de produtividade, design e desenvolvimento."},
        {"emoji":"🖥️","name":"Equipamentos e Manutenção Técnica","description":"Computadores, periféricos, monitores, teclados, mouses, headsets, manutenção técnica de equipamentos e upgrades."},
        {"emoji":"🗂️","name":"Materiais e Escritório","description":"Papelaria, impressão, pastas, canetas, cartuchos, organizadores, cadernos e materiais de apoio ao escritório."},
        {"emoji":"📡","name":"Comunicação e Internet","description":"Planos de internet, telefone corporativo, chips, créditos de ligação, VoIP e serviços de comunicação profissional."},
        {"emoji":"🖇️","name":"Despesas Operacionais","description":"Custos recorrentes do dia a dia profissional como coworking, café do escritório, deslocamento a trabalho, correios e taxas."},
        {"emoji":"🤑","name":"Entradas e Recebimentos","description":"Pagamentos recebidos por serviços, freelances, salário, comissões, bonificações e qualquer entrada financeira profissional."}
    ]'::jsonb,
    2
),

-- 3. Educação e Crescimento
(
    'Educação e Crescimento', '🧠', '#3B82F6',
    'Engloba todos os investimentos relativos ao aprendizado contínuo e ao desenvolvimento pessoal e profissional. De cursos e livros a certificações e idiomas.',
    '[
        {"emoji":"🎓","name":"Cursos e Treinamentos","description":"Cursos online e presenciais, bootcamps, mentorias pagas, plataformas de ensino como Udemy, Alura, Coursera e similares."},
        {"emoji":"📚","name":"Materiais de Estudo","description":"Apostilas, cadernos, canetas marca-texto, fichas de estudo, impressões de material didático e recursos de apoio ao aprendizado."},
        {"emoji":"🗣️","name":"Palestras e Workshops","description":"Ingressos e inscrições em palestras, workshops, seminários, congressos, conferências e eventos educacionais."},
        {"emoji":"📖","name":"Livros e e-Books","description":"Livros físicos e digitais, audiobooks, assinaturas de bibliotecas virtuais como Kindle Unlimited e similares."},
        {"emoji":"🚀","name":"Desenvolvimento Pessoal","description":"Coaching, terapias focadas em performance, retiros de autoconhecimento, journaling guiado e programas de crescimento pessoal."},
        {"emoji":"🗺️","name":"Aulas e Idiomas","description":"Aulas particulares, escolas de idiomas, aplicativos como Duolingo Plus, intercâmbio linguístico e materiais de idioma."},
        {"emoji":"📜","name":"Certificações e Formações","description":"Taxas de certificação, provas de proficiência, diplomas, formações complementares e registros profissionais."}
    ]'::jsonb,
    3
),

-- 4. Saúde e Bem-Estar
(
    'Saúde e Bem-Estar', '☀️', '#10B981',
    'Consolida tudo que envolve a manutenção da saúde física e mental. Planos de saúde, consultas, medicamentos, academia, terapias e práticas esportivas.',
    '[
        {"emoji":"🏥","name":"Plano de Saúde","description":"Mensalidades de planos de saúde, coparticipações, reajustes anuais e planos odontológicos vinculados."},
        {"emoji":"🧘","name":"Terapia e Psicologia","description":"Sessões de psicoterapia, psicologia, psiquiatria, terapia ocupacional, terapia de casal e acompanhamento emocional."},
        {"emoji":"💊","name":"Medicamentos","description":"Remédios de uso contínuo ou pontual, vitaminas, suplementos, manipulados, farmácia e itens de primeiros socorros."},
        {"emoji":"🦷","name":"Dentista","description":"Consultas odontológicas, limpezas, restaurações, ortodontia, clareamento, implantes e procedimentos dentários."},
        {"emoji":"💆","name":"Massagem e Spa","description":"Sessões de massagem relaxante ou terapêutica, day spa, ofurô, sauna, tratamentos corporais e bem-estar."},
        {"emoji":"🏋️","name":"Academia e Exercícios","description":"Mensalidades de academia, personal trainer, CrossFit, pilates, yoga, natação e atividades físicas regulares."},
        {"emoji":"⚽","name":"Esportes","description":"Prática esportiva como futebol, vôlei, tênis, corrida, ciclismo; equipamentos esportivos, uniformes e inscrições."},
        {"emoji":"🩺","name":"Consultas Médicas","description":"Consultas com clínico geral, especialistas, exames laboratoriais, check-ups, ultrassom, raio-x e procedimentos médicos."}
    ]'::jsonb,
    4
),

-- 5. Relacionamentos e Família
(
    'Relacionamentos e Família', '💞', '#EC4899',
    'Agrega os gastos e atividades relacionados à vida em família e aos relacionamentos afetivos. Casal, filhos, escola, lazer infantil e momentos em família.',
    '[
        {"emoji":"💍","name":"Casal","description":"Jantares românticos, presentes para o parceiro(a), passeios a dois, comemorações de aniversário de namoro/casamento e experiências juntos."},
        {"emoji":"👨‍👩‍👧‍👦","name":"Família","description":"Passeios em família, presentes para familiares, contribuições para pais/irmãos, reuniões familiares e despesas compartilhadas."},
        {"emoji":"🎒","name":"Filhos e Escola","description":"Mensalidades escolares, material escolar, uniforme, transporte escolar, lanche, atividades extracurriculares e cursos dos filhos."},
        {"emoji":"🧢","name":"Itens Pessoais dos Filhos","description":"Roupas, calçados, acessórios, higiene e itens de uso pessoal dos filhos, incluindo fraldas e produtos infantis."},
        {"emoji":"🧸","name":"Brinquedos e Lazer Infantil","description":"Brinquedos, jogos, parques, cinema infantil, festas de aniversário, buffet e entretenimento para crianças."}
    ]'::jsonb,
    5
),

-- 6. Espiritual e Igreja
(
    'Espiritual e Igreja', '⛪', '#F59E0B',
    'Centraliza contribuições e gastos vinculados à fé e à comunidade religiosa. Dízimos, ofertas, doações, missões e participação em eventos da igreja.',
    '[
        {"emoji":"💪🏼","name":"Dízimo","description":"Contribuição regular do dízimo à igreja ou comunidade religiosa, seja mensal ou conforme a frequência praticada."},
        {"emoji":"🫘","name":"Oferta","description":"Ofertas voluntárias e espontâneas feitas durante cultos, celebrações ou campanhas especiais da igreja."},
        {"emoji":"🐝","name":"Parceiro de Deus","description":"Contribuições em campanhas específicas de parceria, como projetos missionários, construção de templos e ações especiais."},
        {"emoji":"💟","name":"Doação","description":"Doações para instituições religiosas, ONGs cristãs, cestas básicas, roupas e apoio a pessoas em vulnerabilidade social."},
        {"emoji":"🕊️","name":"Missões e Ações Sociais","description":"Apoio financeiro a missionários, viagens missionárias, evangelismo, ações sociais comunitárias e projetos assistenciais."},
        {"emoji":"🙏","name":"Eventos da Igreja","description":"Conferências, retiros espirituais, encontros de jovens, acampamentos, congressos e eventos promovidos pela igreja."},
        {"emoji":"🎚️","name":"Ministério e Equipamentos","description":"Instrumentos musicais da igreja, equipamentos de som, mídia, iluminação, materiais para ministérios e voluntariado."}
    ]'::jsonb,
    6
),

-- 7. Financeiro e Investimentos
(
    'Financeiro e Investimentos', '💰', '#EF4444',
    'Trata do gerenciamento do patrimônio e das obrigações financeiras. Cartões, impostos, empréstimos, investimentos, reservas e operações de trading.',
    '[
        {"emoji":"🧾","name":"Fatura Cartão de Crédito","description":"Pagamento de faturas de cartão de crédito, anuidades, tarifas e encargos relacionados ao uso do cartão."},
        {"emoji":"🔁","name":"Reembolsos e Estornos","description":"Valores recebidos por devoluções, estornos de compras, reembolsos de despesas e créditos em conta."},
        {"emoji":"🦁","name":"Impostos e Taxas","description":"IRPF, IPTU, IPVA, taxas bancárias, IOF, tarifas governamentais e tributos diversos obrigatórios."},
        {"emoji":"📉","name":"Multas e Juros","description":"Multas de trânsito, juros por atraso, encargos financeiros, mora e penalidades diversas."},
        {"emoji":"🏛️","name":"Cartório e Documentações","description":"Taxas de cartório, autenticações, reconhecimento de firma, certidões, registros e documentos oficiais."},
        {"emoji":"💸","name":"Empréstimos e Financiamentos","description":"Parcelas de empréstimos pessoais, financiamento de veículo, imóvel, consórcios e crédito consignado."},
        {"emoji":"💹","name":"Investimentos e Aplicações","description":"Aportes em renda fixa, renda variável, fundos de investimento, previdência privada, CDB, Tesouro Direto e ações."},
        {"emoji":"🪙","name":"Dividendos e Rendimentos","description":"Recebimento de dividendos, juros sobre capital próprio, rendimentos de aplicações e retorno de investimentos."},
        {"emoji":"🏦","name":"Reserva de Emergência","description":"Aportes e movimentações na reserva de emergência, fundo de segurança financeira e poupança de proteção."},
        {"emoji":"⚓","name":"Resgates de Investimentos","description":"Resgates de aplicações financeiras, liquidação de posições, saques de fundos e recuperação de capital investido."},
        {"emoji":"📊","name":"Operações de Trading","description":"Compra e venda de ativos no curto prazo, day trade, swing trade, opções, futuros e operações especulativas."},
        {"emoji":"💱","name":"Câmbio e Moeda Estrangeira","description":"Compra e venda de moeda estrangeira, remessas internacionais, spread cambial e operações em dólar/euro."},
        {"emoji":"🔧","name":"Ajustes e Conciliações","description":"Ajustes manuais de saldo, conciliação bancária, correções de lançamento e acertos contábeis diversos."}
    ]'::jsonb,
    7
),

-- 8. Casa e Estrutura
(
    'Casa e Estrutura', '🏡', '#78716C',
    'Agrupa os gastos relacionados ao lar e à infraestrutura residencial. Aluguel, contas, manutenção, móveis, compras de mercado, pets e segurança.',
    '[
        {"emoji":"🏠","name":"Aluguel e Condomínio","description":"Aluguel mensal, condomínio, IPTU residencial, taxa de lixo, seguro residencial e encargos do imóvel."},
        {"emoji":"💡","name":"Contas Domésticas","description":"Energia elétrica, água e esgoto, gás encanado ou de botijão, internet residencial e telefone fixo."},
        {"emoji":"🧰","name":"Manutenção e Limpeza","description":"Produtos de limpeza, faxineira, diarista, lavanderia, dedetização, manutenção de eletrodomésticos e reparos gerais."},
        {"emoji":"🪑","name":"Móveis e Decoração","description":"Sofás, mesas, cadeiras, estantes, camas, cortinas, quadros, vasos, tapetes e itens de decoração."},
        {"emoji":"🛒","name":"Mercado e Compras","description":"Compras de supermercado, feira, açougue, hortifruti, itens de despensa, congelados e produtos de uso doméstico."},
        {"emoji":"🪛","name":"Serviços e Reparos","description":"Encanador, eletricista, marceneiro, pintor, pedreiro, chaveiro, técnico de ar-condicionado e serviços residenciais."},
        {"emoji":"🐾","name":"Pet e Cuidados Animais","description":"Ração, petiscos, veterinário, vacinas, banho e tosa, medicamentos, acessórios e cuidados com animais de estimação."},
        {"emoji":"🛡️","name":"Segurança","description":"Sistemas de alarme, câmeras, cercas elétricas, portaria, vigilância e serviços de segurança residencial."},
        {"emoji":"🧺","name":"Utensílios e Utilidades","description":"Panelas, talheres, potes, organizadores, lâmpadas, pilhas, extensões, ferramentas básicas e utilidades domésticas."}
    ]'::jsonb,
    8
),

-- 9. Mobilidade e Transporte
(
    'Mobilidade e Transporte', '🚗', '#F97316',
    'Reúne todas as despesas associadas ao deslocamento. Veículo próprio, combustível, manutenção, transporte público, aplicativos e alternativas de mobilidade.',
    '[
        {"emoji":"🚙","name":"Veículo e Documentação","description":"IPVA, licenciamento, seguro do veículo, transferência, emplacamento, vistoria e documentação veicular."},
        {"emoji":"⚙️","name":"Manutenção Veicular","description":"Revisões, troca de óleo, filtros, pastilhas de freio, pneus, alinhamento, balanceamento e reparos mecânicos."},
        {"emoji":"⛽","name":"Combustível e Abastecimento","description":"Gasolina, etanol, diesel, GNV, recarga de veículo elétrico e abastecimento em geral."},
        {"emoji":"🧼","name":"Lavagem e Higienização","description":"Lavagem simples, lavagem completa, higienização interna, polimento, cristalização e cuidados estéticos do veículo."},
        {"emoji":"🅿️","name":"Estacionamento e Pedágio","description":"Estacionamento rotativo, mensalistas, zona azul, pedágios, tags de pedágio e tarifas de circulação."},
        {"emoji":"🚘","name":"Locação e Transporte","description":"Aluguel de veículos, locação de vans, motorista particular, frete pessoal e serviços de transporte privado."},
        {"emoji":"🚕","name":"Transporte por Aplicativo","description":"Uber, 99, inDrive, Cabify e demais aplicativos de transporte individual por demanda."},
        {"emoji":"🛞","name":"Acessórios e Peças","description":"Peças de reposição, acessórios automotivos, som, película, tapetes, capas, suportes e itens para o veículo."},
        {"emoji":"🚲","name":"Transporte Alternativo","description":"Bicicleta, patinete elétrico, skate, aluguel de bikes compartilhadas e meios alternativos de locomoção."},
        {"emoji":"🚉","name":"Transporte Público","description":"Ônibus, metrô, trem, barca, bilhete único, recarga de cartão de transporte e passagens urbanas."}
    ]'::jsonb,
    9
),

-- 10. Alimentação e Refeições
(
    'Alimentação e Refeições', '🍽️', '#84CC16',
    'Abrange todas as despesas com alimentação fora de casa e bebidas. Refeições, delivery, cafés, restaurantes, doces e bebidas diversas.',
    '[
        {"emoji":"🍔","name":"Refeições Fora de Casa","description":"Almoço, jantar e refeições avulsas em restaurantes, lanchonetes, praças de alimentação e self-service."},
        {"emoji":"🥡","name":"Delivery","description":"Pedidos por iFood, Rappi, Zé Delivery, Uber Eats e demais aplicativos de entrega de comida."},
        {"emoji":"☕","name":"Cafés e Lanches","description":"Cafeterias, padarias, salgados, sanduíches, açaí, sucos, smoothies e lanches rápidos do dia a dia."},
        {"emoji":"🍝","name":"Restaurantes e Jantares","description":"Jantares especiais, restaurantes temáticos, rodízios, experiências gastronômicas e refeições comemorativas."},
        {"emoji":"🍰","name":"Doces e Sobremesas","description":"Sorveterias, confeitarias, chocolates, bolos, tortas, brigadeiros, docerias e sobremesas em geral."},
        {"emoji":"🥤","name":"Bebidas em Geral","description":"Água, refrigerantes, sucos industrializados, energéticos, chás gelados e bebidas não alcoólicas."},
        {"emoji":"🍻","name":"Bebidas Alcoólicas","description":"Cervejas, vinhos, destilados, drinks, coquetéis e bebidas alcoólicas consumidas fora ou compradas para casa."}
    ]'::jsonb,
    10
),

-- 11. Entretenimento e Viagens
(
    'Entretenimento e Viagens', '🎬', '#A855F7',
    'Integra atividades de lazer, cultura e deslocamentos para turismo. Cinema, shows, festas, streaming, viagens, hospedagens e experiências turísticas.',
    '[
        {"emoji":"🎟️","name":"Cinema Teatro e Shows","description":"Ingressos de cinema, teatro, stand-up, shows musicais, festivais, espetáculos e apresentações culturais."},
        {"emoji":"🎢","name":"Passeios e Lazer","description":"Parques de diversão, zoológico, aquário, museus, exposições, feiras e atividades de lazer ao ar livre."},
        {"emoji":"🪩","name":"Baladas e Festas","description":"Casas noturnas, baladas, festas, open bar, ingressos de eventos noturnos e entretenimento noturno."},
        {"emoji":"💃","name":"Dança e Atividades Culturais","description":"Aulas de dança, teatro amador, oficinas culturais, coral, grupos artísticos e atividades de expressão cultural."},
        {"emoji":"🎮","name":"Entretenimento Digital","description":"Jogos de videogame, compras in-app, consoles, assinaturas gamer, Xbox Game Pass, PlayStation Plus e similares."},
        {"emoji":"📺","name":"Assinaturas de Streaming","description":"Netflix, Disney+, HBO Max, Amazon Prime Video, Spotify, YouTube Premium, Apple TV+ e plataformas de conteúdo."},
        {"emoji":"🎧","name":"Música e Podcasts","description":"Assinaturas de música, compra de álbuns digitais, podcasts premium, Audible e conteúdo em áudio."},
        {"emoji":"🎊","name":"Eventos e Confraternizações","description":"Churrascos, festas de fim de ano, confraternizações, happy hours, encontros sociais e celebrações em grupo."},
        {"emoji":"📷","name":"Experiências e Turismo","description":"City tours, passeios turísticos, trilhas guiadas, experiências gastronômicas, aventuras e roteiros de viagem."},
        {"emoji":"✈️","name":"Passagens e Deslocamentos","description":"Passagens aéreas, rodoviárias, ferroviárias, transfer aeroporto, milhas e deslocamentos de viagem."},
        {"emoji":"🏨","name":"Hospedagens e Reservas","description":"Hotéis, pousadas, Airbnb, hostels, resorts, camping e reservas de acomodação para viagens."},
        {"emoji":"🚐","name":"Translados e Excursões","description":"Vans de translado, excursões organizadas, passeios de barco, buggy, quadriciclo e transporte turístico."}
    ]'::jsonb,
    11
),

-- 12. Outros / Diversos
(
    'Outros / Diversos', '🌐', '#6B7280',
    'Categoria-coringa para registrar gastos pontuais, inesperados ou que não se encaixam em nenhuma outra categoria. Emergências, despesas avulsas e itens diversos.',
    '[
        {"emoji":"🚨","name":"Itens de Emergência","description":"Gastos urgentes e imprevistos como chaveiro emergencial, guincho, pronto-socorro, medicação de urgência e reparos emergenciais."},
        {"emoji":"💥","name":"Despesas Inesperadas","description":"Gastos não planejados que surgem sem aviso, como quebra de equipamentos, acidentes domésticos e imprevistos diversos."},
        {"emoji":"📬","name":"Correios e Entregas","description":"Envio de encomendas, sedex, PAC, taxa de entrega, frete de compras online e serviços postais."},
        {"emoji":"🎯","name":"Projetos Temporários","description":"Gastos vinculados a projetos com prazo definido, como reformas pontuais, eventos específicos ou iniciativas temporárias."},
        {"emoji":"🧳","name":"Perdas e Extravio","description":"Perda de carteira, celular roubado, extravio de bagagem, furtos e prejuízos materiais diversos."},
        {"emoji":"🔄","name":"Outros","description":"Qualquer despesa ou receita que não se encaixe nas demais subcategorias. Uso temporário até reclassificação."}
    ]'::jsonb,
    12
),

-- 13. Empresa
(
    'Empresa', '🏢', '#0EA5E9',
    'Consolida o operacional e financeiro de uma agência/empresa. Receitas, projetos, equipe, marketing, infraestrutura, contabilidade e aspectos legais do negócio.',
    '[
        {"emoji":"💲","name":"Contratos e Receitas","description":"Recebimentos de contratos fechados, mensalidades de clientes, fee mensal, receita recorrente e faturamento da empresa."},
        {"emoji":"🎯","name":"Projetos e Serviços Prestados","description":"Custos e receitas de projetos específicos, serviços avulsos, entregas pontuais, freelas da empresa e jobs."},
        {"emoji":"💵","name":"Salários e Pagamento de Equipe","description":"Folha de pagamento, salários, vale-transporte, vale-refeição, benefícios, férias, 13º e encargos trabalhistas."},
        {"emoji":"🤝","name":"Parceiros e Colaborações","description":"Pagamento a freelancers, parceiros comerciais, comissões de indicação, afiliados e colaboradores externos."},
        {"emoji":"📢","name":"Marketing e Publicidade","description":"Anúncios pagos, tráfego pago (Meta Ads, Google Ads), materiais promocionais, branding e campanhas de marketing."},
        {"emoji":"☁️","name":"Infraestrutura Servidores e Cloud","description":"Servidores, hospedagem cloud (AWS, GCP, Azure), domínios, CDN, banco de dados, DevOps e infraestrutura digital."},
        {"emoji":"🧮","name":"Contabilidade e Assessoria","description":"Honorários do contador, assessoria fiscal, escrituração, declarações, obrigações acessórias e consultoria contábil."},
        {"emoji":"⚖️","name":"Jurídico e Consultoria Legal","description":"Advogados, consultoria jurídica, contratos, registros de marca, propriedade intelectual e questões legais."},
        {"emoji":"🏬","name":"Estrutura Física e Manutenção","description":"Aluguel do escritório, condomínio comercial, manutenção do espaço, mobiliário corporativo e infraestrutura física."},
        {"emoji":"💎","name":"Retirada de Lucro e Pró-Labore","description":"Pró-labore dos sócios, distribuição de lucros, dividendos empresariais e remuneração dos proprietários."},
        {"emoji":"📃","name":"Documentação e Licenças","description":"Alvarás, licenças de funcionamento, certificados digitais, CNPJ, inscrições estaduais e documentação empresarial."}
    ]'::jsonb,
    13
);
