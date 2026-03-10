"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addPhoneAction } from "@/lib/actions/phones";
import { Users } from "lucide-react";

export function MemberWizard() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("membro");

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        setSuccess(false);

        const fd = new FormData();
        fd.append("name", name);
        fd.append("phone_number", phone);
        fd.append("role", role);

        const res = await addPhoneAction(fd);
        setLoading(false);

        if (res.error) {
            setErrorMsg(res.error);
        } else {
            setSuccess(true);
            setTimeout(() => {
                setOpen(false);
                setSuccess(false);
                setName("");
                setPhone("");
            }, 2000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <span className="flex items-center gap-2 inline-flex whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2">
                    <Users size={16} /> Equipe e Dependentes
                </span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Membros do PWA</DialogTitle>
                    <DialogDescription>
                        Associe um novo número do WhatsApp que estará liberado para interagir com a Laura neste orçamento compartilhado.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {success ? (
                        <div className="py-8 text-center text-primary font-bold">
                            🎉 Membro Autorizado com Sucesso!
                        </div>
                    ) : (
                        <form id="memberForm" onSubmit={handleSave} className="space-y-4">
                            {errorMsg && (
                                <div className="bg-destructive/20 text-destructive text-sm p-2 rounded-md mb-2">
                                    {errorMsg}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Nome Completo / Parentesco</Label>
                                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Esposa" />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp Formato Internacional</Label>
                                <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
                                <p className="text-xs text-muted-foreground">Digite apenas números com DDI. Ex: Brasil (55) + DDD (11) + Número</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Permissão de Acesso PWA / Laura</Label>
                                <Select value={role} onValueChange={(val) => setRole(val as string)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="membro">Membro (Pode Gastar / Ler Extrato)</SelectItem>
                                        <SelectItem value="dependente">Dependente (Gastos Ocultos / Kids)</SelectItem>
                                        <SelectItem value="administrador">Administrador (+ Cadastrar Cartões)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </form>
                    )}
                </div>

                <DialogFooter>
                    {!success && (
                        <Button form="memberForm" type="submit" disabled={loading} className="w-full">
                            {loading ? "Liberando Chave..." : "Liberar WhatsApp deste Usuário"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
