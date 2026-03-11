import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

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
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Top Header Bar */}
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
                    <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Laura Finance</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {/* Future: notifications bell, avatar */}
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">NA</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
