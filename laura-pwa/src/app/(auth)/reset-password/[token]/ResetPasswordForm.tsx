"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Lock, CheckCircle2 } from "lucide-react";
import { confirmPasswordResetAction } from "@/lib/actions/passwordReset";

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (newPassword.length < 6) {
            setError("A nova senha precisa ter 6+ caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        const fd = new FormData();
        fd.append("token", token);
        fd.append("newPassword", newPassword);

        startTransition(async () => {
            const res = await confirmPasswordResetAction(fd);
            if ("error" in res && res.error) {
                setError(res.error);
                return;
            }
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2000);
        });
    };

    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        Nova senha
                    </CardTitle>
                    <CardDescription>
                        Redefinindo a senha para <strong>{email}</strong>
                    </CardDescription>
                </CardHeader>
                {success ? (
                    <CardContent className="space-y-4">
                        <div className="bg-emerald-500/15 text-emerald-500 p-4 rounded-md text-sm flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-1">Senha atualizada!</p>
                                <p className="text-xs text-emerald-400/80">
                                    Você será redirecionado para a tela de login em instantes.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Nova senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        minLength={6}
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={isPending}
                                        className="pl-9"
                                        placeholder="6+ caracteres"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        minLength={6}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={isPending}
                                        className="pl-9"
                                        placeholder="Digite novamente"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full" type="submit" disabled={isPending}>
                                {isPending ? "Atualizando..." : "Redefinir senha"}
                            </Button>
                            <div className="text-center text-sm text-muted-foreground">
                                <Link
                                    href="/login"
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    Cancelar
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    );
}
