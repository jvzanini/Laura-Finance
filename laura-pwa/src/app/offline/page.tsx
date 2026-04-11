import { WifiOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Rota estática servida como fallback pelo service worker quando o user
// está offline e a rota solicitada não está cacheada. Não depende de
// sessão ou DB, logo é sempre disponível.
export const dynamic = "force-static";

export default function OfflinePage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="max-w-md w-full border-border/50 bg-card">
                <CardHeader className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-2">
                        <WifiOff className="h-7 w-7 text-amber-500" />
                    </div>
                    <CardTitle className="text-xl">Você está offline</CardTitle>
                    <CardDescription className="text-sm">
                        A Laura Finance precisa de conexão para trazer dados reais do seu
                        workspace. Volte quando estiver com internet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Link
                        href="/dashboard"
                        className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </Link>
                    <p className="text-xs text-muted-foreground text-center">
                        Algumas páginas visitadas recentemente ficam disponíveis offline via
                        cache. Tente voltar para /dashboard.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
