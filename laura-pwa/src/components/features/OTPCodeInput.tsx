"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type OTPCodeInputProps = {
    onComplete: (code: string) => void;
    disabled?: boolean;
    error?: boolean;
    length?: number;
    autoFocus?: boolean;
};

const DEFAULT_LENGTH = 6;

export function OTPCodeInput({
    onComplete,
    disabled = false,
    error = false,
    length = DEFAULT_LENGTH,
    autoFocus = true,
}: OTPCodeInputProps) {
    const [values, setValues] = React.useState<string[]>(() => Array.from({ length }, () => ""));
    const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
    const lastFiredRef = React.useRef<string | null>(null);

    // Reset interno quando `error` vira true (feedback visual + limpa buffer
    // para o próximo try). Mantemos foco no primeiro slot.
    React.useEffect(() => {
        if (error) {
            setValues(Array.from({ length }, () => ""));
            lastFiredRef.current = null;
            inputsRef.current[0]?.focus();
        }
    }, [error, length]);

    // Auto-focus inicial no primeiro input.
    React.useEffect(() => {
        if (autoFocus && !disabled) {
            inputsRef.current[0]?.focus();
        }
    }, [autoFocus, disabled]);

    const maybeFireComplete = React.useCallback(
        (next: string[]) => {
            if (next.every(v => v !== "")) {
                const code = next.join("");
                if (lastFiredRef.current !== code) {
                    lastFiredRef.current = code;
                    onComplete(code);
                }
            } else {
                lastFiredRef.current = null;
            }
        },
        [onComplete]
    );

    const handleChange = (index: number, rawValue: string) => {
        // Só aceita dígito único. Se o user colar aqui, onPaste lida.
        const digit = rawValue.replace(/\D/g, "").slice(-1);
        setValues(prev => {
            const next = [...prev];
            next[index] = digit;
            // Avança foco se preencheu um dígito.
            if (digit && index < length - 1) {
                inputsRef.current[index + 1]?.focus();
            }
            maybeFireComplete(next);
            return next;
        });
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            // Se o slot atual está vazio, apaga o anterior e volta foco.
            if (!values[index] && index > 0) {
                e.preventDefault();
                setValues(prev => {
                    const next = [...prev];
                    next[index - 1] = "";
                    return next;
                });
                inputsRef.current[index - 1]?.focus();
            }
            return;
        }
        if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            inputsRef.current[index - 1]?.focus();
        }
        if (e.key === "ArrowRight" && index < length - 1) {
            e.preventDefault();
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        const next = Array.from({ length }, (_, i) => pasted[i] ?? "");
        setValues(next);
        // Foca o último slot preenchido (ou o último disponível).
        const lastFilled = Math.min(pasted.length, length) - 1;
        const focusIndex = lastFilled >= 0 ? Math.min(lastFilled + 1, length - 1) : 0;
        inputsRef.current[focusIndex]?.focus();
        maybeFireComplete(next);
    };

    return (
        <div
            className={cn(
                "flex items-center justify-center gap-2 sm:gap-3",
                error && "animate-shake"
            )}
            role="group"
            aria-label="Código de verificação"
            aria-invalid={error || undefined}
        >
            {values.map((value, index) => (
                <input
                    key={index}
                    ref={el => {
                        inputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={value}
                    onChange={e => handleChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    aria-label={`Dígito ${index + 1}`}
                    data-testid={`otp-input-${index}`}
                    className={cn(
                        "w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-semibold",
                        "bg-white/5 border border-white/10 rounded-xl",
                        "text-white placeholder:text-white/30 caret-violet-400",
                        "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60",
                        "transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        error && "border-red-500/60 focus:ring-red-500/40 focus:border-red-500/60"
                    )}
                />
            ))}
        </div>
    );
}

export default OTPCodeInput;
