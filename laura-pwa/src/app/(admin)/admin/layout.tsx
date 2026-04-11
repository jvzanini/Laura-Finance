import { redirect } from "next/navigation";
import Link from "next/link";
import { assertSuperAdmin } from "@/lib/actions/admin";
import { ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * Admin layout com gate de super admin. Redireciona para /dashboard
 * se o user não tem privilégios — proteção dupla (server component
 * bloqueia antes de renderizar, e as actions chamadas nas pages
 * também validam via assertSuperAdmin).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const gate = await assertSuperAdmin();
    if (!gate.ok) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-amber-500/30 bg-amber-500/5 sticky top-0 z-30 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-amber-500">Super Admin</p>
                        <p className="text-[10px] text-muted-foreground -mt-0.5">
                            Visão operacional cross-workspace — acesso restrito
                        </p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs border border-border hover:bg-accent transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Voltar ao Dashboard
                    </Link>
                </div>
            </header>
            <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">{children}</main>
        </div>
    );
}
