// Seed default de categorias + subcategorias usado quando o workspace
// ainda não tem categorias cadastradas no banco. O payload é consumido
// pela server action seedCategoriesAction via botão "Popular categorias
// padrão" no empty state de /categories.

export type SeedSubcategory = {
    name: string;
    emoji: string;
    description: string;
};

export type SeedCategory = {
    name: string;
    emoji: string;
    color: string;
    description: string;
    subcategories: SeedSubcategory[];
};

export const DEFAULT_SEED_CATEGORIES: SeedCategory[] = [
    {
        name: "Pessoal",
        emoji: "👤",
        color: "#8B5CF6",
        description: "Gastos relacionados a vida pessoal",
        subcategories: [
            { name: "Compras Pessoais", emoji: "🛍", description: "Roupas, acessórios, eletrônicos" },
            { name: "Saúde e Bem-estar", emoji: "💊", description: "Farmácia, academia, consultas" },
            { name: "Educação", emoji: "📚", description: "Cursos, livros, treinamentos" },
            { name: "Beleza e Estética", emoji: "💇", description: "Salão, barbearia, cosméticos" },
        ],
    },
    {
        name: "Moradia",
        emoji: "🏠",
        color: "#3B82F6",
        description: "Gastos com habitação",
        subcategories: [
            { name: "Aluguel / Financiamento", emoji: "🏢", description: "Prestação do imóvel" },
            { name: "Condomínio", emoji: "🏘", description: "Taxa condominial" },
            { name: "Contas de Consumo", emoji: "💡", description: "Luz, água, gás, internet" },
            { name: "Manutenção", emoji: "🔧", description: "Reparos e melhorias" },
        ],
    },
    {
        name: "Alimentação",
        emoji: "🍽",
        color: "#10B981",
        description: "Gastos com comida e bebida",
        subcategories: [
            { name: "Supermercado", emoji: "🛒", description: "Compras de casa" },
            { name: "Restaurantes", emoji: "🍕", description: "Comer fora" },
            { name: "Delivery", emoji: "📦", description: "iFood, Rappi, etc." },
            { name: "Lanches e Cafés", emoji: "☕", description: "Padaria, cafeteria" },
        ],
    },
    {
        name: "Transporte",
        emoji: "🚗",
        color: "#F59E0B",
        description: "Gastos com locomoção",
        subcategories: [
            { name: "Combustível", emoji: "⛽", description: "Gasolina, etanol, diesel" },
            { name: "App de Transporte", emoji: "📱", description: "Uber, 99, Cabify" },
            { name: "Estacionamento / Pedágio", emoji: "🅿️", description: "Vagas, tags" },
            { name: "Manutenção Veicular", emoji: "🔩", description: "Oficina, revisão, pneus" },
            { name: "Transporte Público", emoji: "🚌", description: "Ônibus, metrô, trem" },
        ],
    },
    {
        name: "Lazer",
        emoji: "🎮",
        color: "#EC4899",
        description: "Gastos com diversão e entretenimento",
        subcategories: [
            { name: "Entretenimento", emoji: "🎬", description: "Cinema, shows, eventos" },
            { name: "Jogos", emoji: "🕹", description: "Games, consoles, assinaturas" },
            { name: "Streaming", emoji: "📺", description: "Netflix, Spotify, Disney+" },
            { name: "Hobbies", emoji: "🎨", description: "Atividades pessoais" },
        ],
    },
    {
        name: "Finanças",
        emoji: "💰",
        color: "#EF4444",
        description: "Operações financeiras e taxas",
        subcategories: [
            { name: "Cartão de Crédito", emoji: "💳", description: "Faturas e anuidades" },
            { name: "Empréstimos", emoji: "🏦", description: "Parcelas de empréstimo" },
            { name: "Taxas e Tarifas", emoji: "📋", description: "IOF, taxas bancárias" },
            { name: "Impostos", emoji: "🧾", description: "IR, IPTU, IPVA" },
            { name: "Seguros", emoji: "🛡", description: "Auto, vida, residencial" },
        ],
    },
    {
        name: "Trabalho / Empresa",
        emoji: "💼",
        color: "#06B6D4",
        description: "Investimentos profissionais",
        subcategories: [
            { name: "Ferramentas e Software", emoji: "🖥", description: "SaaS, licenças" },
            { name: "Marketing", emoji: "📢", description: "Anúncios, branding" },
            { name: "Funcionários", emoji: "👥", description: "Salários, freelancers" },
            { name: "Escritório / Coworking", emoji: "🏢", description: "Aluguel, materiais" },
        ],
    },
    {
        name: "Viagem",
        emoji: "✈️",
        color: "#0EA5E9",
        description: "Gastos durante viagens",
        subcategories: [
            { name: "Passagens", emoji: "🎫", description: "Aéreas, rodoviárias" },
            { name: "Hospedagem", emoji: "🏨", description: "Hotel, Airbnb" },
            { name: "Alimentação na Viagem", emoji: "🍽", description: "Restaurantes, mercado" },
            { name: "Passeios e Turismo", emoji: "🗺", description: "Tours, ingressos" },
            { name: "Transporte Local", emoji: "🚕", description: "Táxi, aluguel de carro" },
        ],
    },
];
