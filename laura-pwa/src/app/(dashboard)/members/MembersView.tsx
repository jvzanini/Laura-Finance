"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Shield, ShieldCheck, ShieldAlert, Phone, Sparkles } from "lucide-react";
import { addPhoneAction, deletePhoneAction } from "@/lib/actions/phones";

export type Member = {
    id: string;
    name: string;
    phone_number: string;
    role: string;
};

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

export function MembersView({ members }: { members: Member[] }) {
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const [role, setRole] = useState("membro");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name || !phoneInput) {
            setError("Nome e telefone são obrigatórios.");
            return;
        }

        const fd = new FormData();
        fd.append("name", name);
        fd.append("phone_number", phoneInput);
        fd.append("role", role);

        startTransition(async () => {
            const res = await addPhoneAction(fd);
            if ("error" in res && res.error) {
                setError(res.error);
                return;
            }
            setName("");
            setPhoneInput("");
            setRole("membro");
            setShowForm(false);
            window.location.reload();
        });
    };

    const handleRemove = (id: string) => {
        if (!confirm("Remover acesso deste membro ao WhatsApp?")) return;
        setRemovingId(id);
        setError(null);
        startTransition(async () => {
            const res = await deletePhoneAction(id);
            if ("error" in res && res.error) {
                setError(res.error);
                setRemovingId(null);
                return;
            }
            setRemovingId(null);
            window.location.reload();
        });
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

            {error && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            {showForm && (
                <Card className="border-primary/20 bg-card animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Novo Membro</CardTitle>
                        <CardDescription className="text-xs">
                            O número é validado contra o laura-go (/api/whatsapp/validate) antes de ser persistido.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Nome</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: João"
                                        className="h-9 bg-background"
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">WhatsApp (com DDI)</Label>
                                    <Input
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value)}
                                        placeholder="5511999999999"
                                        className="h-9 bg-background"
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Permissão</Label>
                                    <Select value={role} onValueChange={(v) => v && setRole(v)}>
                                        <SelectTrigger className="h-9 bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="membro">Membro</SelectItem>
                                            <SelectItem value="dependente">Dependente</SelectItem>
                                            <SelectItem value="administrador">Administrador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowForm(false)}
                                    disabled={isPending}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" size="sm" disabled={isPending}>
                                    {isPending ? "Validando..." : "Cadastrar"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {members.length === 0 && !showForm && (
                <Card className="border-dashed border-2 border-primary/30 bg-card">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Sparkles className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <p className="text-base font-bold">Nenhum membro cadastrado</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Adicione o número do WhatsApp de pessoas autorizadas a lançar transações via Laura.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                                            <span className="text-xs text-muted-foreground font-mono">+{m.phone_number}</span>
                                        </div>
                                    </div>
                                </div>
                                {m.role !== "proprietário" && (
                                    <button
                                        onClick={() => handleRemove(m.id)}
                                        disabled={isPending && removingId === m.id}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {getRoleIcon(m.role)}
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getRoleBadge(m.role)}`}
                                >
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
