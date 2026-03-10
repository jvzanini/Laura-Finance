"use server";

import { getSession } from "@/lib/session";

export type WhatsappInstance = {
    id: string;
    alias: string;
    status: "disconnected" | "connecting" | "connected";
    qrCodeString?: string;
    connectedNumber?: string;
};

// Emulação do Backend do Whats1000/EvolutionAPI
// Quando em Go, esse endpoint será real: HTTP GET /instances
export async function fetchUserInstancesAction(): Promise<{ error?: string, instances?: WhatsappInstance[] }> {
    const session = await getSession();
    if (!session || !session.userId) {
        return { error: "Não autorizado" };
    }

    // Mock das instâncias pra Front-End preview
    // Na próxima sprint isso consumirá o banco ou a API do Go.
    return {
        instances: [
            { id: "inst_123", alias: "Laura Principal", status: "connected", connectedNumber: "5511999998888" },
            { id: "inst_456", alias: "Laura Casa", status: "disconnected" }
        ]
    };
}

export async function generateQrCodeAction(instanceId: string): Promise<{ error?: string, qrCodeString?: string }> {
    const session = await getSession();
    if (!session || !session.userId) {
        return { error: "Sessão inválida" };
    }

    // Simulação do Webhook puxando o QR base64/hash da Evolution API (Demora ~2 segundos normalmente)
    // using instanceId variable:
    console.log("Fetching qr code for instance", instanceId);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // String aleatória que vai renderizar o gráfico QR React:
    return {
        qrCodeString: "LAURA_AUTH_" + Math.random().toString(36).substring(2, 15) + "_SEC_TOKEN"
    };
}
