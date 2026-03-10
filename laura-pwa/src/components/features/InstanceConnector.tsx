"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchUserInstancesAction, generateQrCodeAction, WhatsappInstance } from "@/lib/actions/whatsapp";
import { QrCode, Smartphone, RefreshCw, Unplug, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function InstanceConnector() {
    const [instances, setInstances] = useState<WhatsappInstance[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrStates, setQrStates] = useState<Record<string, string>>({});
    const [loadingQrs, setLoadingQrs] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadInstances = async () => {
            setLoading(true);
            const res = await fetchUserInstancesAction();
            if (res.instances) setInstances(res.instances);
            setLoading(false);
        };
        loadInstances();
    }, []);

    const requestQrCode = async (instanceId: string) => {
        setLoadingQrs(prev => ({ ...prev, [instanceId]: true }));
        const res = await generateQrCodeAction(instanceId);

        if (res.qrCodeString) {
            const code: string = res.qrCodeString;
            setQrStates(prev => ({ ...prev, [instanceId]: code }));
        } else {
            alert("Falha ao gerar QR Code: " + res.error);
        }
        setLoadingQrs(prev => ({ ...prev, [instanceId]: false }));
    };

    if (loading) {
        return <Skeleton className="w-full h-[400px] rounded-box bg-muted/20" />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
            {instances?.map(inst => (
                <Card key={inst.id} className="bg-card w-full shadow-lg border-primary/20 relative overflow-hidden">
                    {/* Gradient Decorator */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary/10"></div>

                    <CardHeader>
                        <CardTitle className="flex justify-between items-center text-xl">
                            <span className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-primary" />
                                {inst.alias}
                            </span>
                            {inst.status === "connected" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        </CardTitle>
                        <CardDescription>Gerencie a camada de pareamento do PWA com o número Master.</CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-col items-center justify-center min-h-[280px]">
                        {inst.status === "connected" ? (
                            <div className="flex flex-col items-center gap-4 text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20 w-full animate-in zoom-in-95 duration-500">
                                <div className="p-4 bg-emerald-500/20 rounded-full">
                                    <Smartphone className="w-12 h-12 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-emerald-400">Instância Conectada</h4>
                                    <p className="text-sm text-muted-foreground font-mono mt-1">
                                        Número: +{inst.connectedNumber}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-4">Tokens 2FA Seguros, Gateway ativo.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6 w-full">
                                {!qrStates[inst.id] && !loadingQrs[inst.id] ? (
                                    <div className="p-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl w-full flex flex-col items-center">
                                        <QrCode className="w-12 h-12 mb-4 opacity-50" />
                                        <p>A Instância está desconectada.</p>
                                    </div>
                                ) : loadingQrs[inst.id] ? (
                                    <div className="p-16 flex flex-col items-center gap-4 text-primary">
                                        <RefreshCw className="w-10 h-10 animate-spin" />
                                        <span className="text-sm font-semibold tracking-widest uppercase animate-pulse">Solicitando Gateway Evolution...</span>
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-xl shadow-lg border-4 border-primary/20 animate-in zoom-in-95 duration-500">
                                        <QRCodeSVG value={qrStates[inst.id]} size={200} level="H" />
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="bg-muted/10 border-t border-border mt-auto pt-6 pb-6">
                        {inst.status === "connected" ? (
                            <Button variant="destructive" className="w-full font-bold shadow-md">
                                <Unplug className="w-4 h-4 mr-2" /> Desconectar Sessão Deste Fone
                            </Button>
                        ) : (
                            <Button
                                onClick={() => requestQrCode(inst.id)}
                                disabled={loadingQrs[inst.id]}
                                className="w-full font-bold shadow-md"
                            >
                                {qrStates[inst.id] ? "↺ Gerar Novo Código Expirado" : "Gerar QR Code de Vínculo"}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
