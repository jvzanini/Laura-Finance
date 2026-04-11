import { verifyEmailToken } from "@/lib/verifyEmailToken";
import { confirmEmailVerificationAction } from "@/lib/actions/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

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
            <div className="flex h-screen w-full items-center justify-center p-4">
                <Card className="w-full max-w-md mx-auto border-destructive/30">
                    <CardHeader className="text-center">
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                            <AlertCircle className="h-7 w-7 text-destructive" />
                        </div>
                        <CardTitle className="text-xl">Link inválido ou expirado</CardTitle>
                        <CardDescription>{pre.error}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link
                            href="/login"
                            className="w-full inline-flex items-center justify-center h-9 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90"
                        >
                            Ir para o login
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const result = await confirmEmailVerificationAction(token);
    const success = "success" in result && result.success === true;
    const already = "alreadyVerified" in result && result.alreadyVerified === true;

    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="text-center">
                    <div
                        className={`mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-2 ${
                            success ? "bg-emerald-500/10" : "bg-destructive/10"
                        }`}
                    >
                        {success ? (
                            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                        ) : (
                            <AlertCircle className="h-7 w-7 text-destructive" />
                        )}
                    </div>
                    <CardTitle className="text-xl">
                        {already
                            ? "Email já estava verificado"
                            : success
                                ? "Email verificado!"
                                : "Falha na verificação"}
                    </CardTitle>
                    <CardDescription>
                        {success
                            ? `Sua conta ${pre.email} está confirmada. Agora você pode acessar o dashboard completo.`
                            : ("error" in result ? result.error : "Erro desconhecido")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link
                        href="/dashboard"
                        className="w-full inline-flex items-center justify-center h-9 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90"
                    >
                        Ir para o dashboard
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
