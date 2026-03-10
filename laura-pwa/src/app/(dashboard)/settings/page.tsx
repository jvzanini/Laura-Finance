"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/lib/actions/lgpd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsLGPDPage() {
    const [state, formAction, pending] = useActionState(
        async (prevState: { error?: string } | null, formData: FormData) => deleteAccountAction(formData),
        null
    );

    return (
        <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Privacidade e Dados (LGPD)</h1>
                <p className="text-muted-foreground">
                    Gerencie seu &quot;Direito ao Esquecimento&quot; e controle total das suas informações transacionais.
                </p>
            </div>

            <Card className="border-destructive bg-destructive/5">
                <CardHeader>
                    <CardTitle className="text-destructive font-bold text-xl">Zona de Perigo: Excluir Conta</CardTitle>
                    <CardDescription>
                        <strong className="text-red-400">ATENÇÃO:</strong> Esta ação é irreversível.
                        Apagar o Workspace forçará um *Hard Delete* em cascata no banco de dados.
                        Isso removerá instantaneamente todo o seu histórico transacional, cartões, categorias,
                        limites e fará o cancelamento automático de sua assinatura SaaS se você for um usuário PRO.
                        <br /><br />
                        Para sua segurança, apenas o proprietário da conta pode executar esta etapa.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="flex flex-col space-y-4">
                        {state?.error && (
                            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded font-medium border border-destructive/20">
                                {state.error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="confirmString" className="text-sm font-medium">
                                Digite a frase exata: <strong className="select-all">DELETAR MINHA CONTA</strong>
                            </label>
                            <Input
                                name="confirmString"
                                id="confirmString"
                                autoComplete="off"
                                placeholder="DELETAR MINHA CONTA"
                                disabled={pending}
                                className="font-mono bg-background"
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button variant="destructive" type="submit" disabled={pending} className="w-full md:w-auto px-8 font-semibold">
                                {pending ? "Aniquilando Dados..." : "Excluir Definitivamente"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
