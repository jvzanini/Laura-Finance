import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UpgradeDialog } from "@/components/features/UpgradeDialog";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect("/register");
    }

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar Placeholder */}
            <aside className="w-64 border-r border-border hidden md:flex flex-col bg-card/30 backdrop-blur-sm">
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-bold text-white tracking-widest uppercase">Laura</h2>
                </div>
                <nav className="flex-1 p-4 space-y-2 flex flex-col">
                    {/* Menu Items skeleton map */}
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-muted/50 rounded-md animate-pulse" />
                    ))}
                    <a href="/settings" className="h-10 mt-6 flex items-center justify-center rounded-md border border-destructive/50 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
                        Meus Dados / LGPD
                    </a>
                </nav>
                <div className="p-4 border-t border-border mt-auto">
                    <UpgradeDialog />
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
