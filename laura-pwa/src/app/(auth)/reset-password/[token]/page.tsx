import { verifyResetToken } from "@/lib/resetToken";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function ResetPasswordPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const verified = verifyResetToken(token);

    if (!verified.valid) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4">
                <Card className="w-full max-w-md mx-auto border-destructive/30">
                    <CardHeader className="text-center">
                        <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                            <AlertCircle className="h-7 w-7 text-destructive" />
                        </div>
                        <CardTitle className="text-xl">Link inválido ou expirado</CardTitle>
                        <CardDescription className="text-sm">{verified.error}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link
                            href="/forgot-password"
                            className="w-full inline-flex items-center justify-center h-9 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            Solicitar novo link
                        </Link>
                        <Link
                            href="/login"
                            className="w-full inline-flex items-center justify-center h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
                        >
                            Voltar ao login
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <ResetPasswordForm token={token} email={verified.email} />;
}
