"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardWizard } from "@/components/features/CardWizard";
import { CreditCard, Plus, Calendar, AlertCircle } from "lucide-react";

type CardData = {
    id: string;
    name: string;
    brand: string;
    color: string;
    lastFour: string;
    closingDay: number;
    dueDay: number;
};

const MOCK_CARDS: CardData[] = [
    { id: "1", name: "Nubank Principal", brand: "Mastercard", color: "#8B5CF6", lastFour: "4455", closingDay: 20, dueDay: 27 },
    { id: "2", name: "Inter PJ", brand: "Visa", color: "#F97316", lastFour: "7891", closingDay: 15, dueDay: 22 },
    { id: "3", name: "C6 Bank Black", brand: "Mastercard", color: "#1F2937", lastFour: "3322", closingDay: 5, dueDay: 12 },
];

function CreditCardVisual({ card }: { card: CardData }) {
    return (
        <div
            className="relative w-full aspect-[1.586/1] rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-xl hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
            style={{
                background: `linear-gradient(135deg, ${card.color}, ${card.color}CC, ${card.color}88)`,
            }}
        >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{card.brand}</p>
                    <p className="text-white font-bold text-lg mt-0.5">{card.name}</p>
                </div>
                <CreditCard className="h-8 w-8 text-white/40" />
            </div>

            <div className="relative z-10">
                <p className="text-white font-mono text-xl tracking-[0.25em] mb-3">
                    •••• •••• •••• {card.lastFour}
                </p>
                <div className="flex gap-6 text-white/80 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>Fecha dia {card.closingDay}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" />
                        <span>Vence dia {card.dueDay}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CardsPage() {
    const [cards] = useState(MOCK_CARDS);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cartões</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie seus cartões de crédito e contas vinculadas.
                    </p>
                </div>
                <CardWizard />
            </div>

            {cards.length === 0 ? (
                <Card className="border-dashed border-border/50 bg-card">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <CreditCard className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">Nenhum cartão cadastrado</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Cadastre seus cartões para a Laura rastrear faturas e ajudar no controle financeiro.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                        <CreditCardVisual key={card.id} card={card} />
                    ))}

                    {/* Add new card slot */}
                    <div className="w-full aspect-[1.586/1] rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer">
                        <Plus className="h-8 w-8" />
                        <span className="text-sm font-medium">Adicionar Cartão</span>
                    </div>
                </div>
            )}
        </div>
    );
}
