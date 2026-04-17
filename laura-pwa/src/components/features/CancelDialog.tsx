"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscriptionCancelAction } from "@/lib/actions/subscription";

function formatBR(dateIso?: string | null): string | null {
    if (!dateIso) return null;
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * CancelDialog confirma o cancelamento — a ação real só dispara
 * após o usuário apertar "Sim, cancelar". Mostra claramente a data
 * até quando o acesso continua ativo (period end) para reduzir
 * atrito / expectativa frustrada.
 */
export function CancelDialog({
    currentPeriodEnd,
    trigger,
}: {
    currentPeriodEnd?: string | null;
    trigger: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const limitDate = formatBR(currentPeriodEnd);

    const handleCancel = () => {
        setError(null);
        startTransition(async () => {
            const res = await subscriptionCancelAction();
            if (res.ok) {
                setOpen(false);
                router.refresh();
                return;
            }
            setError(res.message || "Falha ao cancelar assinatura");
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="cancel-dialog">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle
                            className="h-5 w-5 text-red-400"
                            aria-hidden="true"
                        />
                        <DialogTitle className="text-lg">
                            Cancelar assinatura?
                        </DialogTitle>
                    </div>
                    <DialogDescription className="pt-1">
                        {limitDate ? (
                            <>
                                Você continuará tendo acesso até{" "}
                                <strong>{limitDate}</strong>. Depois disso a
                                conta entra em modo somente leitura até nova
                                assinatura.
                            </>
                        ) : (
                            <>
                                Você continuará tendo acesso até o fim do
                                período atual. Depois disso a conta entra em
                                modo somente leitura até nova assinatura.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                {error ? (
                    <p className="text-sm text-red-400" role="alert">
                        {error}
                    </p>
                ) : null}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                        data-testid="cancel-dialog-keep"
                        className="min-h-[44px]"
                    >
                        Manter assinatura
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={isPending}
                        data-testid="cancel-dialog-confirm"
                        className="min-h-[44px] gap-2"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Sim, cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
