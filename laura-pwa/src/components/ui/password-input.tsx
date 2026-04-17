"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    withLockIcon?: boolean;
    containerClassName?: string;
};

/**
 * Input de senha com botão toggle (olhinho) para mostrar/ocultar.
 * - Tap target 44×44 no botão.
 * - aria-label em PT-BR.
 * - Pode receber um `ref` (usado pelo react-hook-form `register`).
 * - Se `withLockIcon=true`, exibe o cadeado à esquerda (default true).
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, containerClassName, withLockIcon = true, disabled, ...props }, ref) => {
        const [visible, setVisible] = React.useState(false);
        return (
            <div className={cn("relative", containerClassName)}>
                {withLockIcon && (
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                )}
                <Input
                    {...props}
                    ref={ref}
                    type={visible ? "text" : "password"}
                    disabled={disabled}
                    className={cn(withLockIcon ? "pl-9" : "", "pr-11", className)}
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    disabled={disabled}
                    aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={visible}
                    tabIndex={-1}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/50 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
        );
    },
);
PasswordInput.displayName = "PasswordInput";
