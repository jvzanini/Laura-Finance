"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    User,
    Phone,
    Mail,
    Shield,
    Eye,
    Bell,
    Moon,
    LogOut,
    Trash2,
    Camera,
    CheckCircle2,
} from "lucide-react";
import {
    updateUserProfileAction,
    updateUserSettingsAction,
    changePasswordAction,
} from "@/lib/actions/userProfile";
import type { UserProfile, UserSettings } from "@/lib/types/userProfile";

export function SettingsView({ profile }: { profile: UserProfile }) {
    const [name, setName] = useState(profile.name);
    const [email, setEmail] = useState(profile.email);
    const [phone, setPhone] = useState(profile.phoneNumber ?? "");
    const [hideBalances, setHideBalances] = useState(profile.settings.hideBalances);
    const [notifications, setNotifications] = useState(profile.settings.notifications);
    const [darkMode, setDarkMode] = useState(profile.settings.darkMode);
    const [prefsSaved, setPrefsSaved] = useState(false);

    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [showPwdForm, setShowPwdForm] = useState(false);

    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [pwdSuccess, setPwdSuccess] = useState(false);

    const [isPending, startTransition] = useTransition();

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError(null);
        setProfileSuccess(false);

        const fd = new FormData();
        fd.append("name", name);
        fd.append("email", email);
        fd.append("phone_number", phone);

        startTransition(async () => {
            const res = await updateUserProfileAction(fd);
            if ("error" in res && res.error) {
                setProfileError(res.error);
                return;
            }
            setProfileSuccess(true);
            setTimeout(() => setProfileSuccess(false), 3000);
        });
    };

    const handleTogglePref = (key: keyof UserSettings, value: boolean) => {
        // Atualização otimista: já move o Switch; se der erro, rola de volta.
        if (key === "hideBalances") setHideBalances(value);
        if (key === "notifications") setNotifications(value);
        if (key === "darkMode") setDarkMode(value);
        setPrefsSaved(false);

        startTransition(async () => {
            const res = await updateUserSettingsAction({ [key]: value });
            if ("error" in res && res.error) {
                // Rollback
                if (key === "hideBalances") setHideBalances(!value);
                if (key === "notifications") setNotifications(!value);
                if (key === "darkMode") setDarkMode(!value);
                setProfileError(res.error);
                return;
            }
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 2000);
        });
    };

    const handleChangePwd = (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError(null);
        setPwdSuccess(false);

        const fd = new FormData();
        fd.append("currentPassword", currentPwd);
        fd.append("newPassword", newPwd);

        startTransition(async () => {
            const res = await changePasswordAction(fd);
            if ("error" in res && res.error) {
                setPwdError(res.error);
                return;
            }
            setPwdSuccess(true);
            setCurrentPwd("");
            setNewPwd("");
            setTimeout(() => {
                setPwdSuccess(false);
                setShowPwdForm(false);
            }, 2000);
        });
    };

    const roleLabel =
        profile.role === "proprietário"
            ? `Proprietário do Workspace "${profile.workspaceName}"`
            : `${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} em "${profile.workspaceName}"`;

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
                    <CardDescription className="text-xs">
                        Informações pessoais da sua conta. Alterações afetam login, nudges e exibição.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveProfile} className="space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                                    {name.charAt(0).toUpperCase()}
                                </div>
                                <button
                                    type="button"
                                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                                    title="Upload de avatar (backlog)"
                                >
                                    <Camera className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div>
                                <p className="font-semibold">{name}</p>
                                <p className="text-xs text-muted-foreground">{roleLabel}</p>
                            </div>
                        </div>

                        {profileError && (
                            <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                                {profileError}
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="bg-emerald-500/15 text-emerald-500 p-3 rounded-md text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Perfil atualizado!
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                    <User className="h-3 w-3" /> Nome Completo
                                </Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-9 bg-background"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                    <Mail className="h-3 w-3" /> E-mail
                                </Label>
                                <Input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    className="h-9 bg-background"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                    <Phone className="h-3 w-3" /> Telefone (WhatsApp)
                                </Label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="5511999999999"
                                    className="h-9 bg-background"
                                    disabled={isPending}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                    <Shield className="h-3 w-3" /> Senha
                                </Label>
                                <Input type="password" value="••••••••" readOnly className="h-9 bg-background" />
                                <button
                                    type="button"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => setShowPwdForm(!showPwdForm)}
                                >
                                    {showPwdForm ? "Cancelar" : "Alterar senha"}
                                </button>
                            </div>
                        </div>

                        <Button size="sm" type="submit" disabled={isPending} className="w-full sm:w-auto">
                            {isPending ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </form>

                    {showPwdForm && (
                        <form
                            onSubmit={handleChangePwd}
                            className="space-y-3 pt-5 mt-5 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Trocar Senha
                            </p>
                            {pwdError && (
                                <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                                    {pwdError}
                                </div>
                            )}
                            {pwdSuccess && (
                                <div className="bg-emerald-500/15 text-emerald-500 p-3 rounded-md text-sm flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Senha alterada!
                                </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Senha atual</Label>
                                    <Input
                                        type="password"
                                        value={currentPwd}
                                        onChange={(e) => setCurrentPwd(e.target.value)}
                                        className="h-9 bg-background"
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Nova senha (mín. 6 chars)</Label>
                                    <Input
                                        type="password"
                                        value={newPwd}
                                        onChange={(e) => setNewPwd(e.target.value)}
                                        className="h-9 bg-background"
                                        disabled={isPending}
                                    />
                                </div>
                            </div>
                            <Button type="submit" size="sm" disabled={isPending}>
                                {isPending ? "Atualizando..." : "Confirmar nova senha"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>

            {/* Preferences — persistidas em users.settings JSONB */}
            <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        Preferências
                        {prefsSaved && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Salvo
                            </span>
                        )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Preferências persistidas no banco e sincronizadas entre dispositivos.
                    </CardDescription>
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
                        <Switch
                            checked={hideBalances}
                            onCheckedChange={(v) => handleTogglePref("hideBalances", v)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Notificações push</p>
                                <p className="text-xs text-muted-foreground">Alertas de teto, faturas e relatórios</p>
                            </div>
                        </div>
                        <Switch
                            checked={notifications}
                            onCheckedChange={(v) => handleTogglePref("notifications", v)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Moon className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Modo escuro</p>
                                <p className="text-xs text-muted-foreground">Tema dark premium ativo</p>
                            </div>
                        </div>
                        <Switch
                            checked={darkMode}
                            onCheckedChange={(v) => handleTogglePref("darkMode", v)}
                            disabled={isPending}
                        />
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
                        <a
                            href="/api/auth/logout"
                            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border border-border hover:bg-accent transition-colors"
                            data-testid="btn-logout"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Sair
                        </a>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div>
                            <p className="text-sm font-medium text-destructive">Excluir conta (LGPD)</p>
                            <p className="text-xs text-muted-foreground">Remove permanentemente todos os dados</p>
                        </div>
                        <Button variant="destructive" size="sm" className="text-xs">
                            Excluir Conta
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
