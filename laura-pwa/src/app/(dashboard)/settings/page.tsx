"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Phone, Mail, Shield, Eye, Bell, Moon, LogOut, Trash2, Camera } from "lucide-react";

export default function SettingsPage() {
    const [name, setName] = useState("Nexus AI");
    const [email, setEmail] = useState("nexusai360@gmail.com");
    const [phone, setPhone] = useState("5511999990000");
    const [hideBalances, setHideBalances] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Gerencie seu perfil, preferências e dados pessoais.
                </p>
            </div>

            {/* Profile */}
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Perfil
                    </CardTitle>
                    <CardDescription className="text-xs">Informações pessoais da sua conta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
                                <Camera className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div>
                            <p className="font-semibold">{name}</p>
                            <p className="text-xs text-muted-foreground">Proprietário do Workspace</p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                                <User className="h-3 w-3" /> Nome Completo
                            </Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Mail className="h-3 w-3" /> E-mail
                            </Label>
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-9 bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Phone className="h-3 w-3" /> Telefone (WhatsApp)
                            </Label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Shield className="h-3 w-3" /> Senha
                            </Label>
                            <Input type="password" value="••••••••" readOnly className="h-9 bg-background" />
                            <button className="text-xs text-primary hover:underline">Alterar senha</button>
                        </div>
                    </div>

                    <Button size="sm" className="w-full sm:w-auto">Salvar Alterações</Button>
                </CardContent>
            </Card>

            {/* Preferences */}
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preferências</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Ocultar saldos por padrão</p>
                                <p className="text-xs text-muted-foreground">Mascarar valores financeiros com •••</p>
                            </div>
                        </div>
                        <Switch checked={hideBalances} onCheckedChange={setHideBalances} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Notificações push</p>
                                <p className="text-xs text-muted-foreground">Alertas de teto, faturas e relatórios</p>
                            </div>
                        </div>
                        <Switch checked={notifications} onCheckedChange={setNotifications} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Moon className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Modo escuro</p>
                                <p className="text-xs text-muted-foreground">Tema dark premium ativo</p>
                            </div>
                        </div>
                        <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/30 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base text-destructive flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Zona de Perigo
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Ações irreversíveis. Prossiga com cautela.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-background/50">
                        <div>
                            <p className="text-sm font-medium">Sair da conta</p>
                            <p className="text-xs text-muted-foreground">Encerra sua sessão atual</p>
                        </div>
                        <a href="/api/auth/logout" className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border border-border hover:bg-accent transition-colors">
                            <LogOut className="h-3.5 w-3.5" />Sair
                        </a>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div>
                            <p className="text-sm font-medium text-destructive">Excluir conta (LGPD)</p>
                            <p className="text-xs text-muted-foreground">Remove permanentemente todos os dados</p>
                        </div>
                        <Button variant="destructive" size="sm" className="text-xs">Excluir Conta</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
