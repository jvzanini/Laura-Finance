"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Auth Error Boundary]", error);
    }, [error]);

    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="max-w-md w-full border-destructive/30 bg-card">
                <CardHeader className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                        <AlertCircle className="h-7 w-7 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">Erro no fluxo de autenticação</CardTitle>
                    <CardDescription className="text-sm">
                        Não consegui processar seu login/cadastro agora. Pode ser o banco
                        temporariamente indisponível — tente de novo em instantes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={reset} className="w-full gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
