"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addPhoneAction, fetchPhonesAction, deletePhoneAction } from "@/lib/actions/phones";
import { Users, Trash2 } from "lucide-react";

export function MemberWizard() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("membro");

    const [members, setMembers] = useState<any[]>([]);

    const loadMembers = async () => {
        const res = await fetchPhonesAction();
        if (res.phones) setMembers(res.phones);
    };

    // Load list when modal opens
    if (open && members.length === 0) {
        loadMembers();
    }

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
            loadMembers();
            setTimeout(() => {
                setSuccess(false);
                setName("");
                setPhone("");
                setOpen(false);
            }, 2000);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover acesso ao WhatsApp deste membro?")) return;
        setMembers(prev => prev.filter(m => m.id !== id));
        await deletePhoneAction(id);
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
                    <DialogTitle>Cadastrar Membro</DialogTitle>
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
                                <Label>Nome do Membro</Label>
                                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Esposa, Filho, João..." />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp Formato Internacional</Label>
                                <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
                                <p className="text-xs text-muted-foreground">Digite apenas números com DDI. Ex: Brasil (55) + DDD (11) + Número</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Permissão de Acesso</Label>
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

                    {!success && members.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                            <Label className="mb-2 block text-muted-foreground">Membros Autorizados ({members.length})</Label>
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                {members.map(m => (
                                    <div key={m.id} className="flex justify-between items-center text-sm p-2 bg-muted/20 rounded-md">
                                        <div>
                                            <p className="font-bold">{m.name}</p>
                                            <p className="text-xs text-muted-foreground">+{m.phone_number} • {m.role}</p>
                                        </div>
                                        <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive p-1" title="Excluir Membro">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!success && (
                        <Button form="memberForm" type="submit" disabled={loading} className="w-full">
                            {loading ? "Validando e Cadastrando..." : "Cadastrar Membro"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
