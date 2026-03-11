"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trash2, Plus, Shield, ShieldCheck, ShieldAlert, Phone } from "lucide-react";

type Member = {
    id: string;
    name: string;
    phone: string;
    role: string;
};

const MOCK_MEMBERS: Member[] = [
    { id: "1", name: "Nexus AI", phone: "5511999990000", role: "proprietário" },
    { id: "2", name: "Maria", phone: "5511988881111", role: "membro" },
];

function getRoleIcon(role: string) {
    if (role === "proprietário") return <ShieldAlert className="h-4 w-4 text-primary" />;
    if (role === "administrador") return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
    return <Shield className="h-4 w-4 text-muted-foreground" />;
}

function getRoleBadge(role: string) {
    const colors: Record<string, string> = {
        proprietário: "bg-primary/15 text-primary",
        administrador: "bg-emerald-500/15 text-emerald-500",
        membro: "bg-muted text-muted-foreground",
        dependente: "bg-amber-500/15 text-amber-500",
    };
    return colors[role] || colors.membro;
}

export default function MembersPage() {
    const [members, setMembers] = useState(MOCK_MEMBERS);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("membro");

    const handleAdd = () => {
        if (!name || !phone) return;
        setMembers([...members, { id: Date.now().toString(), name, phone, role }]);
        setName("");
        setPhone("");
        setShowForm(false);
    };

    const handleRemove = (id: string) => {
        if (!confirm("Remover acesso deste membro ao WhatsApp?")) return;
        setMembers(members.filter((m) => m.id !== id));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Membros</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie quem pode interagir com a Laura no WhatsApp.
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Membro
                </Button>
            </div>

            {/* Add Member Form */}
            {showForm && (
                <Card className="border-primary/20 bg-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Novo Membro</CardTitle>
                        <CardDescription className="text-xs">
                            Associe um número do WhatsApp para interagir com a Laura.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Nome</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João" className="h-9 bg-background" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">WhatsApp (com DDI)</Label>
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" className="h-9 bg-background" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Permissão</Label>
                                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                                    <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="membro">Membro</SelectItem>
                                        <SelectItem value="dependente">Dependente</SelectItem>
                                        <SelectItem value="administrador">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button size="sm" onClick={handleAdd}>Cadastrar</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Members List */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => (
                    <Card key={m.id} className="border-border/50 bg-card hover:border-border transition-colors group">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                        {m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{m.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground font-mono">+{m.phone}</span>
                                        </div>
                                    </div>
                                </div>
                                {m.role !== "proprietário" && (
                                    <button
                                        onClick={() => handleRemove(m.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {getRoleIcon(m.role)}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getRoleBadge(m.role)}`}>
                                    {m.role}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
