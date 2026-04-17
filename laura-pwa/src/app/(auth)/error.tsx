"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="rounded-2xl border border-red-500/30 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <div className="mb-4 flex flex-col items-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h1 className="text-xl font-semibold text-white">Erro no fluxo de autenticação</h1>
                <p className="mt-1 text-sm text-white/60">
                    Não consegui processar seu login/cadastro agora. Pode ser o banco temporariamente
                    indisponível — tente de novo em instantes.
                </p>
            </div>
            <Button onClick={reset} className="w-full min-h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
            </Button>
        </div>
    );
}
