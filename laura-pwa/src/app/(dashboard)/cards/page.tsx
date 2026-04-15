"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { CreditCard, Plus, Calendar, AlertCircle, Building2, User, Trash2, Edit2, Loader2 } from "lucide-react";
import { fetchCardsAction, deleteCardAction, addCardAction } from "@/lib/actions/cards";
import { fetchBankOptionsAction, fetchCardBrandOptionsAction } from "@/lib/actions/options";

type CardData = {
    id: string;
    name: string;
    brand: string;
    type: "credito" | "debito" | "ambos";
    color: string;
    lastFour: string;
    closingDay: number;
    dueDay: number;
    bankBroker: string;
    holder: string;
    creditLimit: number;
};

const FALLBACK_BANKS = [
    "Nubank", "Banco Inter", "C6 Bank", "Bradesco", "Itaú", "Santander",
    "Caixa Econômica", "Banco do Brasil", "BTG Pactual", "PagBank", "Neon",
    "Banco Pan", "Safra", "Mercado Pago", "PicPay",
];

function fmt(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function CreditCardVisual({ card }: { card: CardData }) {
    return (
        <div
            className="relative w-full aspect-[1.586/1] rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-xl hover:scale-[1.02] transition-transform duration-300 cursor-pointer group"
            style={{
                background: `linear-gradient(135deg, ${card.color}, ${card.color}CC, ${card.color}88)`,
            }}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider">{card.brand} • {card.type === "ambos" ? "Débito/Crédito" : card.type === "credito" ? "Crédito" : "Débito"}</p>
                    <p className="text-white font-bold text-base mt-0.5">{card.name}</p>
                    <p className="text-white/50 text-[10px] mt-0.5">{card.bankBroker} • {card.holder}</p>
                </div>
                <CreditCard className="h-7 w-7 text-white/40" />
            </div>

            <div className="relative z-10">
                <p className="text-white font-mono text-lg tracking-[0.25em] mb-2">
                    •••• •••• •••• {card.lastFour}
                </p>
                <div className="flex gap-4 text-white/80 text-[10px]">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Fecha dia {card.closingDay}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Vence dia {card.dueDay}</span>
                    </div>
                </div>
                {card.creditLimit > 0 && (
                    <p className="text-white/60 text-[10px] mt-1 font-mono">
                        Limite: {fmt(card.creditLimit)}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function CardsPage() {
    const [cards, setCards] = useState<CardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [banks, setBanks] = useState<string[]>(FALLBACK_BANKS);
    const [brands, setBrands] = useState<{ name: string; slug: string }[]>([
        { name: "Mastercard", slug: "mastercard" }, { name: "Visa", slug: "visa" },
        { name: "Elo", slug: "elo" }, { name: "American Express", slug: "amex" },
    ]);

    // Form states
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("mastercard");
    const [type, setType] = useState("ambos");
    const [color, setColor] = useState("#7C3AED");
    const [closingDay, setClosingDay] = useState("");
    const [dueDay, setDueDay] = useState("");
    const [lastFour, setLastFour] = useState("");
    const [bankBroker, setBankBroker] = useState("");
    const [holder, setHolder] = useState("");
    const [creditLimit, setCreditLimit] = useState("");

    useEffect(() => {
        loadCards();
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const [bankOpts, brandOpts] = await Promise.all([
                fetchBankOptionsAction(),
                fetchCardBrandOptionsAction(),
            ]);
            if (bankOpts.length > 0) setBanks(bankOpts.map((b: { name: string }) => b.name));
            if (brandOpts.length > 0) setBrands(brandOpts.map((b: { name: string; slug: string }) => ({ name: b.name, slug: b.slug })));
        } catch { /* keep fallbacks */ }
    };

    const loadCards = async () => {
        setLoading(true);
        const res = await fetchCardsAction();
        if (res.cards) {
            setCards(res.cards as CardData[]);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!name || !closingDay || !dueDay || !bankBroker) return;
        setSubmitting(true);

        const formData = new FormData();
        formData.append("name", name);
        formData.append("brand", brand);
        formData.append("type", type);
        formData.append("color", color);
        formData.append("closingDay", closingDay);
        formData.append("dueDay", dueDay);
        formData.append("lastFour", lastFour);
        formData.append("bankBroker", bankBroker);
        formData.append("holder", holder);
        formData.append("creditLimit", creditLimit);

        const res = await addCardAction(formData);
        
        setSubmitting(false);
        if (res?.success) {
            await loadCards();
            resetForm();
            setOpen(false);
        } else {
            alert(res?.error || "Erro ao salvar cartão");
        }
    };

    const resetForm = () => {
        setName("");
        setBrand("mastercard");
        setType("ambos");
        setColor("#7C3AED");
        setClosingDay("");
        setDueDay("");
        setLastFour("");
        setBankBroker("");
        setHolder("João Vitor");
        setCreditLimit("");
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este cartão?")) return;
        
        const res = await deleteCardAction(id);
        if (res?.success) {
            await loadCards();
        } else {
            alert(res?.error || "Erro ao remover cartão");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CreditCard className="h-6 w-6 text-primary" />
                        Cartões
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie seus cartões de crédito e débito.
                    </p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                        <Plus className="h-4 w-4" />
                        Novo Cartão
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Cadastrar Novo Cartão</DialogTitle>
                            <DialogDescription>
                                Preencha os dados do cartão para a Laura rastrear faturas e ajudar no controle financeiro.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Nome / Apelido</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank JV" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Banco / Instituição</Label>
                                    <Select value={bankBroker} onValueChange={(val) => setBankBroker(val || "")}>
                                        <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                            {banks.map((b) => (
                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Bandeira</Label>
                                    <Select value={brand} onValueChange={(val) => setBrand(val || "")}>
                                        <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {brands.map((b) => (
                                                <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Tipo</Label>
                                    <Select value={type} onValueChange={(v) => setType(v || "")}>
                                        <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="credito">💳 Crédito</SelectItem>
                                            <SelectItem value="debito">💳 Débito</SelectItem>
                                            <SelectItem value="ambos">💳 Débito + Crédito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Titular</Label>
                                    <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Nome do titular" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Limite de Crédito (R$)</Label>
                                    <Input type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="8000.00" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Dia de Fechamento</Label>
                                    <Input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="20" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Dia de Vencimento</Label>
                                    <Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="27" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Últimos 4 Dígitos</Label>
                                    <Input maxLength={4} value={lastFour} onChange={(e) => setLastFour(e.target.value)} placeholder="4455" className="h-9 bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Cor</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" className="w-12 h-9 p-1 cursor-pointer" value={color} onChange={(e) => setColor(e.target.value)} />
                                        <div className="flex-1 h-9 border rounded-md" style={{ backgroundColor: color }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Cartão
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                     <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                        <div key={card.id} className="relative group">
                            <CreditCardVisual card={card} />
                            <button
                                onClick={() => handleDelete(card.id)}
                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500/80 transition-all z-20"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => setOpen(true)}
                        className="w-full aspect-[1.586/1] rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                    >
                        <Plus className="h-8 w-8" />
                        <span className="text-sm font-medium">Adicionar Cartão</span>
                    </button>
                </div>
            )}
        </div>
    );
}
