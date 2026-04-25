import { cn } from "@/lib/utils";

import { LauraAvatar, type LauraAvatarProps } from "./LauraAvatar";

export type LauraBrandMarkVariant = "navbar" | "footer" | "sidebar" | "auth";

export type LauraBrandMarkProps = {
    variant: LauraBrandMarkVariant;
    className?: string;
};

type Config = {
    avatar: Required<
        Pick<LauraAvatarProps, "size" | "halo" | "ring">
    > & {
        priority?: boolean;
    };
    container: string;
    wordmarkWrapper?: string;
    wordmarkClass: string;
    finance: string;
    showSubtitle: boolean;
    subtitleClass?: string;
};

const VARIANT_CONFIG: Record<LauraBrandMarkVariant, Config> = {
    navbar: {
        avatar: { size: "sm", halo: "soft", ring: "subtle" },
        container: "inline-flex items-center gap-2",
        wordmarkClass: "text-xl font-bold tracking-tight text-white",
        finance:
            "bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent",
        showSubtitle: false,
    },
    footer: {
        avatar: { size: "sm", halo: "soft", ring: "subtle" },
        container: "inline-flex items-center gap-2",
        wordmarkClass: "text-lg font-bold tracking-tight text-white",
        finance:
            "bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent",
        showSubtitle: false,
    },
    sidebar: {
        avatar: { size: "md", halo: "soft", ring: "primary" },
        container: "flex items-center gap-3",
        wordmarkWrapper: "flex flex-col group-data-[collapsible=icon]:hidden",
        wordmarkClass: "text-base font-bold tracking-tight",
        finance: "",
        showSubtitle: true,
        subtitleClass: "text-[11px] text-muted-foreground",
    },
    auth: {
        avatar: { size: "xl", halo: "intense", ring: "subtle", priority: true },
        container: "inline-flex flex-col items-center gap-3",
        wordmarkClass:
            "text-lg font-semibold tracking-tight text-white sm:text-xl",
        finance: "",
        showSubtitle: false,
    },
};

export function LauraBrandMark({ variant, className }: LauraBrandMarkProps) {
    const cfg = VARIANT_CONFIG[variant];
    const { avatar, container, wordmarkWrapper, wordmarkClass, finance, showSubtitle, subtitleClass } = cfg;

    const wordmark = (
        <span className={wordmarkClass}>
            Laura{" "}
            {finance ? (
                <span className={finance}>Finance</span>
            ) : (
                <>Finance</>
            )}
        </span>
    );

    const subtitle = showSubtitle ? (
        <span className={subtitleClass}>Gestão Inteligente</span>
    ) : null;

    return (
        <span className={cn(container, className)}>
            <LauraAvatar
                size={avatar.size}
                halo={avatar.halo}
                ring={avatar.ring}
                priority={avatar.priority}
            />
            {wordmarkWrapper ? (
                <span className={wordmarkWrapper}>
                    {wordmark}
                    {subtitle}
                </span>
            ) : (
                <>
                    {wordmark}
                    {subtitle}
                </>
            )}
        </span>
    );
}
