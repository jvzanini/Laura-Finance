"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type LauraShowcaseSize = "md" | "lg" | "xl" | "hero";

export type LauraShowcaseProps = {
    size?: LauraShowcaseSize;
    parallax?: boolean;
    priority?: boolean;
    className?: string;
    alt?: string;
};

const SIZE_CLASS: Record<LauraShowcaseSize, string> = {
    md: "h-48 w-48",
    lg: "h-64 w-64 sm:h-72 sm:w-72",
    xl: "h-72 w-72 sm:h-80 sm:w-80 md:h-96 md:w-96",
    hero: "h-80 w-80 sm:h-96 sm:w-96 md:h-[28rem] md:w-[28rem]",
};

const SIZE_PIXELS: Record<LauraShowcaseSize, string> = {
    md: "(min-width: 768px) 192px, 192px",
    lg: "(min-width: 640px) 288px, 256px",
    xl: "(min-width: 768px) 384px, (min-width: 640px) 320px, 288px",
    hero: "(min-width: 768px) 448px, (min-width: 640px) 384px, 320px",
};

/**
 * LauraShowcase — tratamento premium "full-bust" da Laura, sem clip
 * circular. Usa o PNG transparente diretamente, com 3 camadas de halo
 * animadas atrás (radial pulse, conic aura rotativa, lightspot
 * superior) e respiração sutil + flutuação no PNG. Parallax opcional
 * em desktop (pointer:fine) move imagem ±6px conforme cursor.
 */
export function LauraShowcase({
    size = "lg",
    parallax = false,
    priority = false,
    className,
    alt = "Laura, sua assistente financeira da Laura Finance",
}: LauraShowcaseProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const imageWrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!parallax) return;
        // Detecta dispositivo com pointer fino (desktop). Em touch não ativa.
        const mq = window.matchMedia("(pointer: fine)");
        if (!mq.matches) return;
        const wrapper = wrapperRef.current;
        const target = imageWrapperRef.current;
        if (!wrapper || !target) return;

        let frame = 0;
        let pendingX = 0;
        let pendingY = 0;

        const handle = (e: MouseEvent) => {
            const rect = wrapper.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            // Offset normalizado [-1, 1] em torno do centro
            const dx = (e.clientX - cx) / (rect.width / 2);
            const dy = (e.clientY - cy) / (rect.height / 2);
            pendingX = Math.max(-1, Math.min(1, dx)) * 8;
            pendingY = Math.max(-1, Math.min(1, dy)) * 8;
            if (frame) return;
            frame = requestAnimationFrame(() => {
                target.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0)`;
                frame = 0;
            });
        };
        const reset = () => {
            if (frame) cancelAnimationFrame(frame);
            target.style.transform = "translate3d(0, 0, 0)";
        };

        window.addEventListener("mousemove", handle, { passive: true });
        wrapper.addEventListener("mouseleave", reset);
        return () => {
            window.removeEventListener("mousemove", handle);
            wrapper.removeEventListener("mouseleave", reset);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [parallax]);

    return (
        <div
            ref={wrapperRef}
            className={cn(
                "pointer-events-none relative inline-flex items-center justify-center",
                SIZE_CLASS[size],
                className
            )}
        >
            {/* Camada 1: aura conic rotativa (lentíssima, dá "vida" sem distrair) */}
            <span
                aria-hidden
                className="animate-laura-aura-rotate pointer-events-none absolute inset-[-25%] rounded-full opacity-50 blur-2xl"
                style={{
                    background:
                        "conic-gradient(from 0deg, rgba(124,58,237,0.55), rgba(217,70,239,0.55), rgba(244,114,182,0.45), rgba(124,58,237,0.55))",
                }}
            />

            {/* Camada 2: halo radial pulsante (foco no centro) */}
            <span
                aria-hidden
                className="animate-laura-halo-pulse pointer-events-none absolute inset-[-15%] rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(124,58,237,0.85), rgba(217,70,239,0.55) 45%, rgba(244,114,182,0.25) 70%, transparent 80%)",
                }}
            />

            {/* Camada 3: lightspot superior — simula luz natural caindo de cima */}
            <span
                aria-hidden
                className="pointer-events-none absolute -top-4 left-1/2 h-1/2 w-3/4 -translate-x-1/2 rounded-full opacity-30 blur-2xl"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(255,255,255,0.55), transparent 75%)",
                }}
            />

            {/* PNG transparente da Laura — apenas respiração sutil
                (sem float vertical nem shimmer: feedback do usuário
                "parece de jogo, fica feio"). Parallax opcional via prop. */}
            <div
                ref={imageWrapperRef}
                className="relative z-10 h-full w-full transition-transform duration-300 ease-out"
            >
                <div className="animate-laura-breathe relative h-full w-full">
                    <Image
                        src="/brand/laura-portrait.png"
                        alt={alt}
                        fill
                        sizes={SIZE_PIXELS[size]}
                        priority={priority}
                        className="object-contain object-bottom drop-shadow-[0_25px_40px_rgba(124,58,237,0.45)]"
                    />
                </div>
            </div>
        </div>
    );
}
