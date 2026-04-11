"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import { Mail, CheckCircle2 } from "lucide-react";
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
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        Recuperar senha
                    </CardTitle>
                    <CardDescription>
                        {submitted
                            ? "Se o e-mail estiver cadastrado, você receberá um link em instantes."
                            : "Informe seu e-mail para receber um link de redefinição."}
                    </CardDescription>
                </CardHeader>
                {submitted ? (
                    <CardContent className="space-y-4">
                        <div className="bg-emerald-500/15 text-emerald-500 p-4 rounded-md text-sm flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-1">E-mail enviado</p>
                                <p className="text-xs text-emerald-400/80">
                                    Cheque sua caixa de entrada (e a pasta de spam). O link é válido por 30 minutos.
                                    Se você não recebeu nada em 2 minutos, o e-mail pode não estar cadastrado.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/login"
                            className="w-full inline-flex items-center justify-center h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
                        >
                            Voltar ao login
                        </Link>
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
                                <Label htmlFor="email">E-mail da conta</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="nome@empresa.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isPending}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full" type="submit" disabled={isPending}>
                                {isPending ? "Enviando..." : "Enviar link de reset"}
                            </Button>
                            <div className="text-center text-sm text-muted-foreground">
                                Lembrou a senha?{" "}
                                <Link
                                    href="/login"
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    Voltar ao login
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    );
}
