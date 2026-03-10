"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function UpgradeDialog() {
    const [loading, setLoading] = useState(false);

    const onUpgrade = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/stripe/checkout", { method: "POST" });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else if (data.error) {
                alert(`API Error: ${data.message || data.error}`);
            }
        } catch (error) {
            console.error("Erro inesperado no Request / Stripe:", error);
            alert("Falha de Comunicação! (Verifique Console)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger>
                <span className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 py-2">
                    ✨ Assinar Laura Finance
                </span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-white">Desbloqueie o PWA Pro</DialogTitle>
                    <DialogDescription>
                        Conceda limites transacionais ilimitados para sua IA Laura e garanta o controle massivo.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Card className="border-primary/50 bg-primary/10">
                        <CardContent className="pt-6">
                            <h3 className="font-bold text-lg mb-2">Plano Pro Mensal</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
                                <li>Acesso Ilimitado ao WhatsApp</li>
                                <li>Desambiguação Avançada</li>
                                <li>Múltiplos Membros Dependentes</li>
                                <li>Suporte Premium</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter>
                    <Button onClick={onUpgrade} disabled={loading} className="w-full">
                        {loading ? "Redirecionando Seguro..." : "Ir para Pagamento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
