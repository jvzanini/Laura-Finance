import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { verifyResetToken } from "@/lib/resetToken";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const verified = verifyResetToken(token);

    if (!verified.valid) {
        return (
            <div className="rounded-2xl border border-red-500/30 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <div className="mb-4 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
                        <AlertCircle className="h-7 w-7 text-red-400" />
                    </div>
                    <h1 className="text-xl font-semibold text-white">Link inválido ou expirado</h1>
                    <p className="mt-1 text-sm text-white/60">{verified.error}</p>
                </div>
                <div className="space-y-2">
                    <Link
                        href="/forgot-password"
                        className="inline-flex w-full min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        Solicitar novo link
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex w-full min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                        Voltar ao login
                    </Link>
                </div>
            </div>
        );
    }

    return <ResetPasswordForm token={token} email={verified.email} />;
}
