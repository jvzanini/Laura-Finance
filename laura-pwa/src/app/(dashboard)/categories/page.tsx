"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag, ChevronRight, ChevronDown, Plus } from "lucide-react";

type Subcategory = {
    id: string;
    name: string;
    emoji: string;
    description: string;
};

type Category = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description: string;
    subcategories: Subcategory[];
};

const CATEGORIES: Category[] = [
    {
        id: "1", name: "Pessoal", emoji: "👤", color: "#8B5CF6",
        description: "Gastos relacionados a vida pessoal",
        subcategories: [
            { id: "1a", name: "Compras Pessoais", emoji: "🛍", description: "Roupas, acessórios, eletrônicos" },
            { id: "1b", name: "Saúde e Bem-estar", emoji: "💊", description: "Farmácia, academia, consultas" },
            { id: "1c", name: "Educação", emoji: "📚", description: "Cursos, livros, treinamentos" },
            { id: "1d", name: "Beleza e Estética", emoji: "💇", description: "Salão, barbearia, cosméticos" },
        ],
    },
    {
        id: "2", name: "Moradia", emoji: "🏠", color: "#3B82F6",
        description: "Gastos com habitação",
        subcategories: [
            { id: "2a", name: "Aluguel / Financiamento", emoji: "🏢", description: "Prestação do imóvel" },
            { id: "2b", name: "Condomínio", emoji: "🏘", description: "Taxa condominial" },
            { id: "2c", name: "Contas de Consumo", emoji: "💡", description: "Luz, água, gás, internet" },
            { id: "2d", name: "Manutenção", emoji: "🔧", description: "Reparos e melhorias" },
        ],
    },
    {
        id: "3", name: "Alimentação", emoji: "🍽", color: "#10B981",
        description: "Gastos com comida e bebida",
        subcategories: [
            { id: "3a", name: "Supermercado", emoji: "🛒", description: "Compras de casa" },
            { id: "3b", name: "Restaurantes", emoji: "🍕", description: "Comer fora" },
            { id: "3c", name: "Delivery", emoji: "📦", description: "iFood, Rappi, etc." },
            { id: "3d", name: "Lanches e Cafés", emoji: "☕", description: "Padaria, cafeteria" },
        ],
    },
    {
        id: "4", name: "Transporte", emoji: "🚗", color: "#F59E0B",
        description: "Gastos com locomoção",
        subcategories: [
            { id: "4a", name: "Combustível", emoji: "⛽", description: "Gasolina, etanol, diesel" },
            { id: "4b", name: "App de Transporte", emoji: "📱", description: "Uber, 99, Cabify" },
            { id: "4c", name: "Estacionamento / Pedágio", emoji: "🅿️", description: "Vagas, tags" },
            { id: "4d", name: "Manutenção Veicular", emoji: "🔩", description: "Oficina, revisão, pneus" },
            { id: "4e", name: "Transporte Público", emoji: "🚌", description: "Ônibus, metrô, trem" },
        ],
    },
    {
        id: "5", name: "Lazer", emoji: "🎮", color: "#EC4899",
        description: "Gastos com diversão e entretenimento",
        subcategories: [
            { id: "5a", name: "Entretenimento", emoji: "🎬", description: "Cinema, shows, eventos" },
            { id: "5b", name: "Jogos", emoji: "🕹", description: "Games, consoles, assinaturas" },
            { id: "5c", name: "Streaming", emoji: "📺", description: "Netflix, Spotify, Disney+" },
            { id: "5d", name: "Hobbies", emoji: "🎨", description: "Atividades pessoais" },
        ],
    },
    {
        id: "6", name: "Finanças", emoji: "💰", color: "#EF4444",
        description: "Operações financeiras e taxas",
        subcategories: [
            { id: "6a", name: "Cartão de Crédito", emoji: "💳", description: "Faturas e anuidades" },
            { id: "6b", name: "Empréstimos", emoji: "🏦", description: "Parcelas de empréstimo" },
            { id: "6c", name: "Taxas e Tarifas", emoji: "📋", description: "IOF, taxas bancárias" },
            { id: "6d", name: "Impostos", emoji: "🧾", description: "IR, IPTU, IPVA" },
            { id: "6e", name: "Seguros", emoji: "🛡", description: "Auto, vida, residencial" },
        ],
    },
    {
        id: "7", name: "Trabalho / Empresa", emoji: "💼", color: "#06B6D4",
        description: "Investimentos profissionais",
        subcategories: [
            { id: "7a", name: "Ferramentas e Software", emoji: "🖥", description: "SaaS, licenças" },
            { id: "7b", name: "Marketing", emoji: "📢", description: "Anúncios, branding" },
            { id: "7c", name: "Funcionários", emoji: "👥", description: "Salários, freelancers" },
            { id: "7d", name: "Escritório / Coworking", emoji: "🏢", description: "Aluguel, materiais" },
        ],
    },
    {
        id: "8", name: "Viagem", emoji: "✈️", color: "#0EA5E9",
        description: "Gastos durante viagens",
        subcategories: [
            { id: "8a", name: "Passagens", emoji: "🎫", description: "Aéreas, rodoviárias" },
            { id: "8b", name: "Hospedagem", emoji: "🏨", description: "Hotel, Airbnb" },
            { id: "8c", name: "Alimentação na Viagem", emoji: "🍽", description: "Restaurantes, mercado" },
            { id: "8d", name: "Passeios e Turismo", emoji: "🗺", description: "Tours, ingressos" },
            { id: "8e", name: "Transporte Local", emoji: "🚕", description: "Táxi, aluguel de carro" },
        ],
    },
];

export default function CategoriesPage() {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Tag className="h-6 w-6 text-primary" />
                        Categorias & Subcategorias
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Organize seus gastos por categorias para relatórios detalhados.
                    </p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Categorias</p>
                        <p className="text-2xl font-bold font-mono text-primary">{CATEGORIES.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Subcategorias</p>
                        <p className="text-2xl font-bold font-mono">
                            {CATEGORIES.reduce((s, c) => s + c.subcategories.length, 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/50 bg-card">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Cobertura</p>
                        <p className="text-2xl font-bold font-mono text-emerald-500">100%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Categories List */}
            <div className="space-y-3">
                {CATEGORIES.map((cat) => {
                    const isExpanded = expandedCategories[cat.id] || false;
                    return (
                        <Card key={cat.id} className="border-border/50 bg-card overflow-hidden">
                            <button
                                onClick={() => toggleCategory(cat.id)}
                                className="w-full p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors text-left"
                            >
                                <div
                                    className="h-11 w-11 rounded-xl flex items-center justify-center text-lg shrink-0"
                                    style={{ backgroundColor: `${cat.color}15` }}
                                >
                                    {cat.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold">{cat.name}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground font-medium">
                                            {cat.subcategories.length} sub
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                                </div>
                                <div
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                />
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                            </button>

                            {isExpanded && (
                                <div className="border-t border-border/30 bg-background/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {cat.subcategories.map((sub) => (
                                        <div
                                            key={sub.id}
                                            className="flex items-center gap-3 px-6 py-3 hover:bg-accent/20 transition-colors border-b border-border/10 last:border-b-0"
                                        >
                                            <span className="text-base shrink-0">{sub.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium">{sub.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{sub.description}</p>
                                            </div>
                                            <div
                                                className="h-2 w-2 rounded-full shrink-0 opacity-40"
                                                style={{ backgroundColor: cat.color }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
