"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
    const [state, formAction, pending] = useActionState(
        async (_prev: { error?: string } | null, formData: FormData) => loginAction(formData),
        null
    );

    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <header className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-semibold text-white">Bem-vindo de volta</h1>
                <p className="text-sm text-white/60">Entre com suas credenciais da Laura Finance.</p>
            </header>

            <form action={formAction} className="space-y-5">
                {state?.error && (
                    <div
                        role="alert"
                        aria-live="polite"
                        className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{state.error}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/80">E-mail</Label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            required
                            disabled={pending}
                            data-testid="input-email"
                            className="h-11 pl-9 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-white/80">Senha</Label>
                        <Link
                            href="/forgot-password"
                            className="text-xs text-white/60 transition hover:text-white"
                        >
                            Esqueci minha senha
                        </Link>
                    </div>
                    <PasswordInput
                        id="password"
                        name="password"
                        autoComplete="current-password"
                        required
                        disabled={pending}
                        data-testid="input-password"
                        className="h-11 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={pending}
                    data-testid="btn-login-submit"
                    className="w-full min-h-11 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-fuchsia-400"
                >
                    {pending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando…
                        </>
                    ) : (
                        "Entrar"
                    )}
                </Button>

                <p className="text-center text-sm text-white/60">
                    Não tem uma conta?{" "}
                    <Link href="/register" className="text-white/90 transition hover:text-white underline-offset-4 hover:underline">
                        Criar conta
                    </Link>
                </p>
            </form>
        </div>
    );
}
