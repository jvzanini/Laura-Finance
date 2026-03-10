"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addCardAction } from "@/lib/actions/cards";

export function CardWizard() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // States do form contínuo
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("mastercard");
    const [color, setColor] = useState("#7C3AED");
    const [closingDay, setClosingDay] = useState("");
    const [dueDay, setDueDay] = useState("");
    const [lastFour, setLastFour] = useState("");

    const handleNext = () => setStep((s) => Math.min(s + 1, 3));
    const handleBack = () => setStep((s) => Math.max(s - 1, 1));

    const handleSave = async () => {
        setLoading(true);
        setErrorMsg(null);
        const fd = new FormData();
        fd.append("name", name);
        fd.append("brand", brand);
        fd.append("color", color);
        fd.append("closing_day", closingDay);
        fd.append("due_day", dueDay);
        fd.append("last_four", lastFour);

        const res = await addCardAction(fd);
        setLoading(false);

        if (res.error) {
            setErrorMsg(res.error);
        } else {
            setStep(4); // Passo Final Sucesso
        }
    };

    const resetAndContinue = () => {
        setName("");
        setBrand("mastercard");
        setColor("#7C3AED");
        setClosingDay("");
        setDueDay("");
        setLastFour("");
        setStep(1);
        setErrorMsg(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <span className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 bg-transparent border border-input shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                    💳 Cadastrar Novo Cartão
                </span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Setup de Emissor</DialogTitle>
                    <DialogDescription>
                        Associe o seu cartão para a assistente rastrear as faturas.
                    </DialogDescription>
                </DialogHeader>

                {step < 4 && (
                    <Progress value={(step / 3) * 100} className="w-full h-2 mb-4" />
                )}

                {errorMsg && (
                    <div className="bg-destructive/20 text-destructive text-sm p-2 rounded-md mb-2">
                        {errorMsg}
                    </div>
                )}

                <div className="py-2">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Label>Nome (Ex: NuBank do Joao)</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apelido do Cartão" />
                            </div>
                            <div className="space-y-2">
                                <Label>Bandeira Primária</Label>
                                <Select value={brand} onValueChange={(v) => setBrand(v || "mastercard")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mastercard">Mastercard</SelectItem>
                                        <SelectItem value="visa">Visa</SelectItem>
                                        <SelectItem value="amex">American Express</SelectItem>
                                        <SelectItem value="elo">Elo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Label>Dia de Fechamento (Fatura)</Label>
                                <Input type="number" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="ex: 20" />
                            </div>
                            <div className="space-y-2">
                                <Label>Dia de Vencimento</Label>
                                <Input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="ex: 27" />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Label>Últimos 4 Dígitos (Opcional, Maior precisão na IA)</Label>
                                <Input maxLength={4} value={lastFour} onChange={(e) => setLastFour(e.target.value)} placeholder="4455" />
                            </div>
                            <div className="space-y-2">
                                <Label>Cor de Identificação</Label>
                                <div className="flex gap-2">
                                    <Input type="color" className="w-14 p-1 h-10 cursor-pointer" value={color} onChange={(e) => setColor(e.target.value)} />
                                    <div className="flex-1 border rounded-md" style={{ backgroundColor: color }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center space-y-4 py-8 animate-in zoom-in-95 fade-in duration-300">
                            <div className="h-16 w-16 bg-primary/20 flex items-center justify-center rounded-full">
                                <span className="text-2xl">✅</span>
                            </div>
                            <p className="text-center font-bold">Cartão salvo com sucesso!</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex w-full mt-4 flex-row gap-2 justify-between items-center sm:justify-between">
                    {step < 4 && step > 1 && (
                        <Button variant="outline" type="button" onClick={handleBack} disabled={loading}>
                            Voltar
                        </Button>
                    )}
                    {step === 1 && <div />}

                    {step < 3 && (
                        <Button onClick={handleNext} disabled={loading}>Próximo Passo</Button>
                    )}

                    {step === 3 && (
                        <Button onClick={handleSave} disabled={loading}>
                            {loading ? "Salvando..." : "Confirmar e Salvar"}
                        </Button>
                    )}

                    {step === 4 && (
                        <div className="flex w-full gap-2">
                            <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">Fechar Painel</Button>
                            <Button onClick={resetAndContinue} className="flex-1">Cadastrar Outro</Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
