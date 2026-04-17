import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { verifyEmailToken } from "@/lib/verifyEmailToken";
import { confirmEmailVerificationAction } from "@/lib/actions/auth";

// Rota server-side que valida o token, marca email_verified, e mostra
// estado final. Se já estava verificado, mostra mensagem idempotente.

export default async function VerifyEmailPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const pre = verifyEmailToken(token);

    if (!pre.valid) {
        return (
            <div className="rounded-3xl border border-red-500/30 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <div className="mb-4 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
                        <AlertCircle className="h-7 w-7 text-red-400" />
                    </div>
                    <h1 className="text-xl font-semibold text-white">Link inválido ou expirado</h1>
                    <p className="mt-1 text-sm text-white/60">{pre.error}</p>
                </div>
                <Link
                    href="/login"
                    className="inline-flex w-full min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-medium text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-400"
                >
                    Ir para o login
                </Link>
            </div>
        );
    }

    const result = await confirmEmailVerificationAction(token);
    const success = "success" in result && result.success === true;
    const already = "alreadyVerified" in result && result.alreadyVerified === true;

    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <div className="mb-4 flex flex-col items-center text-center">
                <div
                    className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${
                        success ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}
                >
                    {success ? (
                        <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    ) : (
                        <AlertCircle className="h-7 w-7 text-red-400" />
                    )}
                </div>
                <h1 className="text-xl font-semibold text-white">
                    {already
                        ? "E-mail já estava verificado"
                        : success
                            ? "E-mail verificado!"
                            : "Falha na verificação"}
                </h1>
                <p className="mt-1 text-sm text-white/60">
                    {success
                        ? `Sua conta ${pre.email} está confirmada. Agora você pode acessar o dashboard completo.`
                        : ("error" in result ? result.error : "Erro desconhecido")}
                </p>
            </div>
            <Link
                href="/dashboard"
                className="inline-flex w-full min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-medium text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-400"
            >
                Ir para o dashboard
            </Link>
        </div>
    );
}
