"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister monta uma vez no RootLayout e registra /sw.js.
 * Em dev (NODE_ENV !== "production") o registro é pulado para não
 * interferir no HMR do Next/Turbopack — service worker cacheado pode
 * esconder mudanças durante edição.
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;
        if (process.env.NODE_ENV !== "production") return;

        const register = async () => {
            try {
                const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                }
            } catch (err) {
                console.warn("[PWA] Service Worker registration failed:", err);
            }
        };

        // Aguarda o "load" para não competir com o primeiro render.
        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register, { once: true });
        }
    }, []);

    return null;
}
