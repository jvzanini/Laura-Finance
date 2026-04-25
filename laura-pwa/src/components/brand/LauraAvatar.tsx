"use client";

import Image from "next/image";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type LauraAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
export type LauraAvatarHalo = "none" | "soft" | "intense";
export type LauraAvatarRing = "none" | "violet" | "subtle" | "primary";

export type LauraAvatarProps = {
    size?: LauraAvatarSize;
    halo?: LauraAvatarHalo;
    ring?: LauraAvatarRing;
    priority?: boolean;
    withStatusDot?: boolean;
    animate?: boolean;
    className?: string;
    alt?: string;
};

const SIZE_CLASS: Record<LauraAvatarSize, string> = {
    xs: "size-5",
    sm: "size-8",
    md: "size-9",
    lg: "size-14",
    xl: "size-20 sm:size-24",
    hero: "size-32 md:size-40",
};

const SIZE_PIXELS: Record<LauraAvatarSize, string> = {
    xs: "40px",
    sm: "64px",
    md: "72px",
    lg: "112px",
    xl: "192px",
    hero: "(min-width: 768px) 320px, 256px",
};

const RING_CLASS: Record<LauraAvatarRing, string> = {
    none: "",
    violet: "ring-2 ring-violet-500/40",
    subtle: "ring-1 ring-white/15",
    primary: "ring-1 ring-primary/30",
};

const HALO_CLASS: Record<LauraAvatarHalo, string> = {
    none: "",
    soft: "absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.55),_rgba(217,70,239,0.25),_transparent_75%)] opacity-80 blur-md",
    intense:
        "absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,_rgba(124,58,237,0.7),_rgba(217,70,239,0.45),_rgba(244,114,182,0.25),_transparent_75%)] opacity-90 blur-3xl",
};

const STATUS_DOT_CLASS: Record<LauraAvatarSize, string> = {
    xs: "size-1.5",
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
    xl: "size-3.5",
    hero: "size-4",
};

// Avatares pequenos usam o crop facial mais apertado para destaque do rosto;
// avatares grandes usam o busto completo (mostra blazer e identidade visual).
function srcFor(size: LauraAvatarSize): string {
    if (size === "xs" || size === "sm" || size === "md") {
        return "/brand/laura-face.png";
    }
    return "/brand/laura-portrait.png";
}

export function LauraAvatar({
    size = "sm",
    halo = "none",
    ring = "subtle",
    priority = false,
    withStatusDot = false,
    animate = false,
    className,
    alt = "Laura, sua assistente financeira da Laura Finance",
}: LauraAvatarProps) {
    const sizeClass = SIZE_CLASS[size];
    const ringClass = RING_CLASS[ring];
    const haloClass = HALO_CLASS[halo];
    const dotClass = STATUS_DOT_CLASS[size];
    const sizes = SIZE_PIXELS[size];
    const src = srcFor(size);

    const inner = (
        <span
            className={cn(
                "relative inline-flex shrink-0",
                sizeClass,
                className
            )}
        >
            {halo !== "none" && (
                <span aria-hidden className={cn(haloClass, "pointer-events-none")} />
            )}
            <span
                className={cn(
                    "relative inline-flex overflow-hidden rounded-full bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20",
                    sizeClass,
                    ringClass
                )}
            >
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes={sizes}
                    priority={priority}
                    className="object-cover object-top"
                />
            </span>
            {withStatusDot && (
                <span
                    aria-hidden
                    className={cn(
                        "absolute right-0 bottom-0 rounded-full bg-emerald-400 ring-1 ring-[#0A0A0F]",
                        dotClass
                    )}
                />
            )}
        </span>
    );

    if (!animate) return inner;

    return (
        <motion.span
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="inline-flex"
        >
            {inner}
        </motion.span>
    );
}
