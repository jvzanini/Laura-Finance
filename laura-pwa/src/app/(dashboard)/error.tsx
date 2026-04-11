"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Dashboard Error Boundary]", error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="max-w-md w-full border-destructive/30 bg-card">
                <CardHeader className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                        <AlertCircle className="h-7 w-7 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">Algo deu errado por aqui</CardTitle>
                    <CardDescription className="text-sm">
                        Uma operação do dashboard falhou. Isso pode ser um erro temporário
                        de conexão com o banco ou uma inconsistência nos dados.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error.message && (
                        <div className="rounded-md bg-destructive/10 p-3 text-xs font-mono text-destructive break-words">
                            {error.message}
                        </div>
                    )}
                    {error.digest && (
                        <p className="text-[10px] text-muted-foreground font-mono text-center">
                            Código: {error.digest}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <Button onClick={reset} className="flex-1 gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Tentar novamente
                        </Button>
                        <Link
                            href="/dashboard"
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                        >
                            <Home className="h-4 w-4" />
                            Voltar ao início
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
