"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/actions/passwordReset";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.append("email", email);
        startTransition(async () => {
            const res = await requestPasswordResetAction(fd);
            if ("error" in res && res.error) {
                setError(res.error);
                return;
            }
            setSubmitted(true);
        });
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <header className="mb-6 space-y-1 text-center">
                <h1 className="text-2xl font-semibold text-white">Recuperar senha</h1>
                <p className="text-sm text-white/60">
                    {submitted
                        ? "Se o e-mail estiver cadastrado, você receberá um link em instantes."
                        : "Informe seu e-mail para receber um link de redefinição."}
                </p>
            </header>

            {submitted ? (
                <div className="space-y-4">
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
                    >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-semibold">E-mail enviado</p>
                            <p className="text-xs text-emerald-200/80">
                                Confira sua caixa de entrada (e a pasta de spam). O link é válido por 30 minutos.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/login"
                        className="inline-flex w-full min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                        Voltar ao login
                    </Link>
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
                        <Label htmlFor="email" className="text-white/80">E-mail da conta</Label>
                        <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="voce@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isPending}
                                className="h-11 pl-9 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                            />
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Enviando…
                            </>
                        ) : (
                            "Enviar link de redefinição"
                        )}
                    </Button>
                    <p className="text-center text-sm text-white/60">
                        Lembrou a senha?{" "}
                        <Link
                            href="/login"
                            className="text-white/90 transition hover:text-white underline-offset-4 hover:underline"
                        >
                            Voltar ao login
                        </Link>
                    </p>
                </form>
            )}
        </div>
    );
}
