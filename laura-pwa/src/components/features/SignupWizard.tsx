"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Mail, MessageCircle, ShieldCheck, AlertCircle } from "lucide-react";

import {
    signupStartAction,
    signupVerifyEmailAction,
    signupVerifyWhatsappAction,
    signupFinalizeAction,
    signupResendEmailAction,
    signupResendWhatsappAction,
} from "@/lib/actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { OTPCodeInput } from "./OTPCodeInput";

// ── Schema validation (step 1) ─────────────────────────────────────────
const step1Schema = z
    .object({
        name: z.string().trim().min(3, "Digite seu nome completo (mínimo 3 caracteres)."),
        email: z.string().trim().email("E-mail inválido."),
        whatsapp: z
            .string()
            .refine(v => {
                const digits = v.replace(/\D/g, "");
                return digits.length >= 10 && digits.length <= 15;
            }, "WhatsApp inválido."),
        password: z
            .string()
            .min(8, "Senha deve ter ao menos 8 caracteres.")
            .regex(/[A-Za-z]/, "Senha precisa ter ao menos uma letra.")
            .regex(/\d/, "Senha precisa ter ao menos um número."),
        confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
        message: "As senhas não coincidem.",
        path: ["confirmPassword"],
    });

type Step1Values = z.infer<typeof step1Schema>;

// ── Utils ──────────────────────────────────────────────────────────────
function maskWhatsappBR(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (!digits) return "";
    // +55 (XX) XXXXX-XXXX (13 dígitos no total)
    let rest = digits;
    let ddi = "";
    if (rest.length > 11) {
        ddi = rest.slice(0, rest.length - 11);
        rest = rest.slice(rest.length - 11);
    } else if (rest.length === 11 || rest.length === 10) {
        ddi = "55";
    } else {
        // Parcial: exibe o que tem sem ddi.
        return rest;
    }
    const ddd = rest.slice(0, 2);
    const part1 = rest.slice(2, 7);
    const part2 = rest.slice(7);
    let out = `+${ddi}`;
    if (ddd) out += ` (${ddd})`;
    if (part1) out += ` ${part1}`;
    if (part2) out += `-${part2}`;
    return out;
}

function normalizeWhatsappForSubmit(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    // Se não começar com ddi 55 e tiver 10-11 dígitos, prefixa 55.
    if (digits.length <= 11) return `+55${digits}`;
    return `+${digits}`;
}

const STORAGE_KEY = "laura_signup_state";

type PersistedState = {
    step: 1 | 2 | 3;
    pendingId: string | null;
    emailMasked: string;
    whatsappMasked: string;
    channelsWarning: string | null;
    formDraft?: {
        name?: string;
        email?: string;
        whatsapp?: string;
    };
};

function loadPersisted(): PersistedState | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedState;
    } catch {
        return null;
    }
}

function savePersisted(state: PersistedState) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // storage cheio/desabilitado — ignora silenciosamente.
    }
}

function clearPersisted() {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

// ── Componente principal ──────────────────────────────────────────────
export function SignupWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const desiredPlan = searchParams.get("plan") ?? undefined;

    const [step, setStep] = React.useState<1 | 2 | 3>(1);
    const [pendingId, setPendingId] = React.useState<string | null>(null);
    const [emailMasked, setEmailMasked] = React.useState("");
    const [whatsappMasked, setWhatsappMasked] = React.useState("");
    const [channelsWarning, setChannelsWarning] = React.useState<string | null>(null);

    const [serverError, setServerError] = React.useState<string | null>(null);
    const [otpError, setOtpError] = React.useState(false);
    const [verifying, setVerifying] = React.useState(false);

    // Contadores de reenvio (em segundos) — um para cada canal.
    const [emailResendIn, setEmailResendIn] = React.useState(60);
    const [whatsappResendIn, setWhatsappResendIn] = React.useState(60);

    const form = useForm<Step1Values>({
        resolver: zodResolver(step1Schema),
        defaultValues: {
            name: "",
            email: "",
            whatsapp: "",
            password: "",
            confirmPassword: "",
        },
        mode: "onTouched",
    });

    // Hidrata state inicial a partir de sessionStorage (SSR-safe via useEffect).
    const hydratedRef = React.useRef(false);
    React.useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;
        const persisted = loadPersisted();
        if (!persisted) return;
        if (persisted.formDraft) form.reset({
            name: persisted.formDraft.name ?? "",
            email: persisted.formDraft.email ?? "",
            whatsapp: persisted.formDraft.whatsapp ?? "",
            password: "",
            confirmPassword: "",
        });
        if (persisted.pendingId) setPendingId(persisted.pendingId);
        if (persisted.emailMasked) setEmailMasked(persisted.emailMasked);
        if (persisted.whatsappMasked) setWhatsappMasked(persisted.whatsappMasked);
        if (persisted.channelsWarning) setChannelsWarning(persisted.channelsWarning);
        if (persisted.step) setStep(persisted.step);
    }, [form]);

    // Persiste mudanças relevantes.
    React.useEffect(() => {
        if (!hydratedRef.current) return;
        const draft = form.getValues();
        savePersisted({
            step,
            pendingId,
            emailMasked,
            whatsappMasked,
            channelsWarning,
            formDraft: {
                name: draft.name,
                email: draft.email,
                whatsapp: draft.whatsapp,
            },
        });
    }, [step, pendingId, emailMasked, whatsappMasked, channelsWarning, form]);

    // Countdown para reenvio de email (step 2).
    React.useEffect(() => {
        if (step !== 2) return;
        if (emailResendIn <= 0) return;
        const t = setTimeout(() => setEmailResendIn(s => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(t);
    }, [step, emailResendIn]);

    // Countdown para reenvio de whatsapp (step 3).
    React.useEffect(() => {
        if (step !== 3) return;
        if (whatsappResendIn <= 0) return;
        const t = setTimeout(() => setWhatsappResendIn(s => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(t);
    }, [step, whatsappResendIn]);

    // ── Step 1 submit ─────────────────────────────────────────────────
    const onSubmitStep1 = form.handleSubmit(async values => {
        setServerError(null);
        const res = await signupStartAction({
            name: values.name.trim(),
            email: values.email.trim(),
            whatsapp: normalizeWhatsappForSubmit(values.whatsapp),
            password: values.password,
            desiredPlan,
        });
        if (!res.ok) {
            setServerError(res.message || "Não conseguimos iniciar seu cadastro. Tente novamente.");
            return;
        }
        setPendingId(res.data.pending_id);
        setEmailMasked(res.data.email_masked);
        setWhatsappMasked(res.data.whatsapp_masked);
        setChannelsWarning(res.data.channels_warning ?? null);
        setEmailResendIn(60);
        setWhatsappResendIn(60);
        setStep(2);
    });

    // ── Step 2: verificar email ───────────────────────────────────────
    const handleVerifyEmail = async (code: string) => {
        if (!pendingId || verifying) return;
        setServerError(null);
        setOtpError(false);
        setVerifying(true);
        const res = await signupVerifyEmailAction({ pendingId, code });
        setVerifying(false);
        if (!res.ok) {
            setOtpError(true);
            setServerError("Código inválido. Tente novamente.");
            return;
        }
        setStep(3);
        setWhatsappResendIn(60);
    };

    // ── Step 3: verificar whatsapp + finalize ────────────────────────
    const handleVerifyWhatsapp = async (code: string) => {
        if (!pendingId || verifying) return;
        setServerError(null);
        setOtpError(false);
        setVerifying(true);
        const wppRes = await signupVerifyWhatsappAction({ pendingId, code });
        if (!wppRes.ok) {
            setVerifying(false);
            setOtpError(true);
            setServerError("Código inválido. Tente novamente.");
            return;
        }
        // Dispara finalize imediatamente.
        const finalizeRes = await signupFinalizeAction({ pendingId });
        setVerifying(false);
        if (!finalizeRes.ok) {
            setServerError(
                finalizeRes.message || "Verificação concluída, mas houve erro ao criar sua conta. Tente novamente."
            );
            return;
        }
        clearPersisted();
        router.push("/dashboard");
    };

    // ── Handlers de reenvio ──────────────────────────────────────────
    const handleResendEmail = async () => {
        if (!pendingId || emailResendIn > 0) return;
        setServerError(null);
        setOtpError(false);
        const res = await signupResendEmailAction({ pendingId });
        if (!res.ok) {
            setServerError(res.message || "Não conseguimos reenviar o e-mail.");
            return;
        }
        setEmailResendIn(60);
    };

    const handleResendWhatsapp = async () => {
        if (!pendingId || whatsappResendIn > 0) return;
        setServerError(null);
        setOtpError(false);
        const res = await signupResendWhatsappAction({ pendingId });
        if (!res.ok) {
            setServerError(res.message || "Não conseguimos reenviar o código no WhatsApp.");
            return;
        }
        setWhatsappResendIn(60);
    };

    // ── Navegação ────────────────────────────────────────────────────
    const handleBackToStep1 = () => {
        // Trocar email/whatsapp: mantém o rascunho, limpa pending.
        setPendingId(null);
        setEmailMasked("");
        setWhatsappMasked("");
        setChannelsWarning(null);
        setOtpError(false);
        setServerError(null);
        setStep(1);
    };

    const handleBackToStep2 = () => {
        setOtpError(false);
        setServerError(null);
        setStep(2);
    };

    const hasWhatsappWarning =
        !!channelsWarning && /whatsapp.*indispon/i.test(channelsWarning);

    return (
        <div className="w-full">
            {/* Progress */}
            <ProgressBar current={step} total={3} />

            <div
                className={cn(
                    "relative overflow-hidden rounded-2xl",
                    "bg-white/5 backdrop-blur-sm border border-white/10",
                    "shadow-2xl p-6 sm:p-8"
                )}
                data-testid="signup-wizard-card"
            >
                {step !== 1 && (
                    <button
                        type="button"
                        onClick={step === 2 ? handleBackToStep1 : handleBackToStep2}
                        className={cn(
                            "absolute left-3 top-3 inline-flex items-center justify-center",
                            "min-h-11 min-w-11 rounded-full text-white/70 hover:text-white",
                            "hover:bg-white/5 transition"
                        )}
                        aria-label="Voltar"
                        data-testid="btn-signup-back"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                )}

                {step === 1 && (
                    <Step1Form
                        form={form}
                        onSubmit={onSubmitStep1}
                        serverError={serverError}
                        submitting={form.formState.isSubmitting}
                    />
                )}

                {step === 2 && (
                    <StepVerify
                        icon={<Mail className="h-6 w-6" />}
                        title="Verifique seu e-mail"
                        description={
                            <>
                                Enviamos um código de 6 dígitos para{" "}
                                <strong className="text-white">{emailMasked || "seu e-mail"}</strong>.
                                Confira também a pasta de spam.
                            </>
                        }
                        channelWarning={null}
                        otpError={otpError}
                        verifying={verifying}
                        serverError={serverError}
                        resendIn={emailResendIn}
                        onComplete={handleVerifyEmail}
                        onResend={handleResendEmail}
                        changeLabel="Trocar e-mail"
                        onChange={handleBackToStep1}
                        testIdPrefix="email"
                    />
                )}

                {step === 3 && (
                    <StepVerify
                        icon={<MessageCircle className="h-6 w-6" />}
                        title="Verifique seu WhatsApp"
                        description={
                            <>
                                Enviamos um código de 6 dígitos para{" "}
                                <strong className="text-white">{whatsappMasked || "seu WhatsApp"}</strong>.
                                Pode demorar alguns segundos até chegar.
                            </>
                        }
                        channelWarning={
                            hasWhatsappWarning
                                ? "O envio pelo WhatsApp pode estar instável agora. Tente reenviar o código se ele não chegar."
                                : null
                        }
                        otpError={otpError}
                        verifying={verifying}
                        serverError={serverError}
                        resendIn={whatsappResendIn}
                        onComplete={handleVerifyWhatsapp}
                        onResend={handleResendWhatsapp}
                        changeLabel="Trocar WhatsApp"
                        onChange={handleBackToStep1}
                        testIdPrefix="whatsapp"
                    />
                )}
            </div>

            <p className="mt-6 text-center text-xs text-white/40">
                <ShieldCheck className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
                Sua conta é protegida com verificação em dois canais.
            </p>
        </div>
    );
}

// ── Sub-componentes ────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
    const pct = Math.round((current / total) * 100);
    return (
        <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                <span>Passo {current} de {total}</span>
                <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="progressbar"
                />
            </div>
        </div>
    );
}

type Step1FormProps = {
    form: ReturnType<typeof useForm<Step1Values>>;
    onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    serverError: string | null;
    submitting: boolean;
};

function WhatsappField({
    control,
    setValue,
    hasError,
}: {
    control: Control<Step1Values>;
    setValue: (name: keyof Step1Values, value: string, opts?: { shouldValidate?: boolean; shouldTouch?: boolean }) => void;
    hasError: boolean;
}) {
    const raw = useWatch({ control, name: "whatsapp" }) ?? "";
    return (
        <Input
            id="signup-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+55 (11) 91234-5678"
            data-testid="input-whatsapp"
            value={maskWhatsappBR(raw)}
            onChange={e => {
                const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 13);
                setValue("whatsapp", onlyDigits, { shouldValidate: true, shouldTouch: true });
            }}
            aria-invalid={hasError ? "true" : undefined}
            className="h-11"
        />
    );
}

function Step1Form({ form, onSubmit, serverError, submitting }: Step1FormProps) {
    const { register, formState, setValue, control } = form;
    const { errors } = formState;

    return (
        <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="signup-step1">
            <header className="space-y-1 text-center">
                <h1 className="text-2xl font-semibold text-white">Crie sua conta</h1>
                <p className="text-sm text-white/60">
                    Comece a organizar suas finanças pelo WhatsApp.
                </p>
            </header>

            {serverError && (
                <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{serverError}</span>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-white/80">Nome completo</Label>
                <Input
                    id="signup-name"
                    autoComplete="name"
                    placeholder="Maria Silva"
                    data-testid="input-name"
                    {...register("name")}
                    aria-invalid={errors.name ? "true" : undefined}
                    className="h-11"
                />
                {errors.name && <FieldError message={errors.name.message} />}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-white/80">E-mail</Label>
                <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    data-testid="input-email"
                    {...register("email")}
                    aria-invalid={errors.email ? "true" : undefined}
                    className="h-11"
                />
                {errors.email && <FieldError message={errors.email.message} />}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-whatsapp" className="text-white/80">WhatsApp</Label>
                <WhatsappField control={control} setValue={setValue} hasError={!!errors.whatsapp} />
                {errors.whatsapp ? (
                    <FieldError message={errors.whatsapp.message} />
                ) : (
                    <p className="text-xs text-white/40">
                        Usamos para enviar o código de verificação e receber suas mensagens.
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-white/80">Senha</Label>
                <PasswordInput
                    id="signup-password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres, com letra e número"
                    data-testid="input-password"
                    withLockIcon={false}
                    {...register("password")}
                    aria-invalid={errors.password ? "true" : undefined}
                    className="h-11"
                />
                {errors.password && <FieldError message={errors.password.message} />}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="text-white/80">Confirmar senha</Label>
                <PasswordInput
                    id="signup-confirm"
                    autoComplete="new-password"
                    placeholder="Repita sua senha"
                    data-testid="input-confirm-password"
                    withLockIcon={false}
                    {...register("confirmPassword")}
                    aria-invalid={errors.confirmPassword ? "true" : undefined}
                    className="h-11"
                />
                {errors.confirmPassword && <FieldError message={errors.confirmPassword.message} />}
            </div>

            <Button
                type="submit"
                disabled={submitting}
                data-testid="btn-signup-next"
                className="w-full min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            >
                {submitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando códigos…
                    </>
                ) : (
                    "Continuar"
                )}
            </Button>

            <p className="text-center text-xs text-white/50">
                Já tem conta?{" "}
                <a href="/login" className="text-white/80 hover:text-white transition underline-offset-4 hover:underline">
                    Entrar
                </a>
            </p>
        </form>
    );
}

type StepVerifyProps = {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    channelWarning: string | null;
    otpError: boolean;
    verifying: boolean;
    serverError: string | null;
    resendIn: number;
    onComplete: (code: string) => void;
    onResend: () => void;
    changeLabel: string;
    onChange: () => void;
    testIdPrefix: string;
};

function StepVerify({
    icon,
    title,
    description,
    channelWarning,
    otpError,
    verifying,
    serverError,
    resendIn,
    onComplete,
    onResend,
    changeLabel,
    onChange,
    testIdPrefix,
}: StepVerifyProps) {
    return (
        <div className="space-y-6" data-testid={`signup-step-${testIdPrefix}`}>
            <header className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30">
                    {icon}
                </div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <p className="text-sm text-white/60">{description}</p>
            </header>

            {channelWarning && (
                <div
                    role="status"
                    aria-live="polite"
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
                >
                    {channelWarning}
                </div>
            )}

            <OTPCodeInput onComplete={onComplete} disabled={verifying} error={otpError} />

            {serverError && (
                <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{serverError}</span>
                </div>
            )}

            {verifying && (
                <p className="flex items-center justify-center gap-2 text-sm text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando…
                </p>
            )}

            <div className="flex flex-col items-center gap-2 text-sm">
                <button
                    type="button"
                    onClick={onResend}
                    disabled={resendIn > 0 || verifying}
                    data-testid={`btn-resend-${testIdPrefix}`}
                    className={cn(
                        "min-h-11 px-3 rounded-lg text-white/70 hover:text-white transition",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                >
                    {resendIn > 0 ? `Reenviar código em ${resendIn}s` : "Reenviar código"}
                </button>
                <button
                    type="button"
                    onClick={onChange}
                    className="text-xs text-white/50 hover:text-white/80 transition"
                    data-testid={`btn-change-${testIdPrefix}`}
                >
                    {changeLabel}
                </button>
            </div>
        </div>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p role="alert" className="text-xs text-red-300">
            {message}
        </p>
    );
}

export default SignupWizard;
