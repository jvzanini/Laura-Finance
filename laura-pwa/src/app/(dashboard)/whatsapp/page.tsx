"use client";

import { InstanceConnector } from "@/components/features/InstanceConnector";
import { Link2 } from "lucide-react";

export default function WhatsappConfigPage() {
    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Link2 className="w-6 h-6 text-primary" />  Conexões de Dispositivos API
                </h1>
                <p className="text-muted-foreground mr-12 text-sm leading-relaxed max-w-2xl">
                    Utilize o aplicativo do WhatsApp Oficial para apontar a câmera e se autenticar
                    no ecossistema The Laura Finance Platform. Sua chave transitará sobre o gateway criptografado
                    e será vinculada permanentemente ao seu banco isolado (PostgresC/Go).
                </p>
                <div className="bg-primary/10 border border-primary/20 mt-4 p-4 rounded-lg inline-block w-fit text-sm">
                    <strong>⚠️ Dica Anti-Hack:</strong> Esta tela possui autenticação de payload única (SPA secure-mode).
                    QR Codes expiram automaticamente a cada 30 segundos mitigando injeções por interceptação.
                </div>
            </div>

            <InstanceConnector />
        </div>
    );
}
