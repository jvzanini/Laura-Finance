"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "laura-install-prompt-dismissed";

/**
 * InstallPrompt escuta o evento `beforeinstallprompt` do browser e
 * mostra um banner premium sugerindo instalar o PWA. Respeita um
 * dismiss persistido em localStorage para não bombardear o usuário
 * que já disse "não quero".
 */
export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Se o usuário já dismissou, não mostra.
        if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

        const handler = (e: Event) => {
            e.preventDefault();
            const event = e as BeforeInstallPromptEvent;
            setDeferredPrompt(event);
            setVisible(true);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setDeferredPrompt(null);
            setVisible(false);
        }
    };

    const handleDismiss = () => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(DISMISS_KEY, "1");
        }
        setVisible(false);
    };

    if (!visible || !deferredPrompt) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border border-primary/30 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Instalar Laura Finance</p>
                    <p className="text-[11px] text-muted-foreground">
                        Acesse rápido pelo celular, funciona offline
                    </p>
                </div>
                <button
                    onClick={handleInstall}
                    className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
                >
                    Instalar
                </button>
                <button
                    onClick={handleDismiss}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent transition-colors flex items-center justify-center shrink-0"
                    aria-label="Dispensar"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
