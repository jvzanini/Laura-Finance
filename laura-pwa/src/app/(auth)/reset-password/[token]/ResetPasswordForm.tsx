"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
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
            setError("A nova senha precisa ter pelo menos 6 caracteres.");
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
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <header className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-semibold text-white">Nova senha</h1>
                <p className="text-sm text-white/60">
                    Redefinindo a senha para <strong className="text-white">{email}</strong>
                </p>
            </header>

            {success ? (
                <div
                    role="status"
                    className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
                >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold">Senha atualizada!</p>
                        <p className="text-xs text-emerald-200/80">
                            Você será redirecionado para a tela de login em instantes.
                        </p>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-white/80">Nova senha</Label>
                        <PasswordInput
                            id="newPassword"
                            minLength={6}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isPending}
                            className="h-11 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                            placeholder="6+ caracteres"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-white/80">Confirmar nova senha</Label>
                        <PasswordInput
                            id="confirmPassword"
                            minLength={6}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isPending}
                            className="h-11 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                            placeholder="Digite novamente"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full min-h-11 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-fuchsia-400"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Atualizando…
                            </>
                        ) : (
                            "Redefinir senha"
                        )}
                    </Button>
                    <p className="text-center text-sm text-white/60">
                        <Link
                            href="/login"
                            className="text-white/80 transition hover:text-white underline-offset-4 hover:underline"
                        >
                            Cancelar
                        </Link>
                    </p>
                </form>
            )}
        </div>
    );
}
