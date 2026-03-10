"use client";

import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
    const [state, formAction, pending] = useActionState(
        async (prevState: { error?: string } | null, formData: FormData) => registerAction(formData),
        null
    );

    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">Criar sua Conta</CardTitle>
                    <CardDescription>
                        Inicialize seu Workspace Laura para gerenciar as finanças.
                    </CardDescription>
                </CardHeader>
                <form action={formAction}>
                    <CardContent className="space-y-4">
                        {state?.error && (
                            <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm mb-4">
                                {state.error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="name">Seu Nome Completo</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Carlos Alberto"
                                required
                                disabled={pending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail Profissional</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="nome@empresa.com"
                                required
                                disabled={pending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha Segura</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                disabled={pending}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" type="submit" disabled={pending}>
                            {pending ? "Criando Workspace Seguro..." : "Começar a usar Laura"}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            Já tem uma conta?{" "}
                            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                                Faça o Login
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
