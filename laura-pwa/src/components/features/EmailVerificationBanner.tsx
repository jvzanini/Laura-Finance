"use client";

import { useState, useTransition } from "react";
import { Mail, X, CheckCircle2 } from "lucide-react";
import { resendVerificationEmailAction } from "@/lib/actions/auth";

/**
 * EmailVerificationBanner mostra um aviso discreto no topo do layout
 * do dashboard quando o user logado ainda não verificou o email.
 * Possui botão "Reenviar" com estado de loading e feedback de sucesso.
 *
 * O componente é client porque precisa de state local + transition.
 * O wrapper server component no layout decide se monta baseado em
 * profile.emailVerified.
 */
export function EmailVerificationBanner({ email }: { email: string }) {
    const [dismissed, setDismissed] = useState(false);
    const [resent, setResent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (dismissed) return null;

    const handleResend = () => {
        setError(null);
        startTransition(async () => {
            const res = await resendVerificationEmailAction();
            if ("error" in res && res.error) {
                setError(res.error);
                return;
            }
            setResent(true);
            setTimeout(() => setResent(false), 4000);
        });
    };

    return (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-500">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0 text-[12px]">
                    {resent ? (
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Email de verificação reenviado para <strong>{email}</strong>
                        </span>
                    ) : error ? (
                        <span className="text-red-400">{error}</span>
                    ) : (
                        <>
                            Seu email <strong>{email}</strong> ainda não foi verificado. Confira sua caixa de entrada — o link é válido por 24h.
                        </>
                    )}
                </div>
                <button
                    onClick={handleResend}
                    disabled={isPending || resent}
                    className="text-[11px] font-semibold px-2 py-1 rounded border border-amber-500/40 hover:bg-amber-500/20 transition-colors disabled:opacity-60"
                >
                    {isPending ? "Enviando..." : resent ? "Enviado" : "Reenviar"}
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    aria-label="Dispensar"
                    className="h-6 w-6 rounded flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
