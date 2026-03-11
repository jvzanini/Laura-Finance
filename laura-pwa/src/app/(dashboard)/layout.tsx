import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";

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
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/50 px-4 md:px-6 bg-card/50 backdrop-blur-md sticky top-0 z-30">
                    <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Laura Finance</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {/* Notifications bell */}
                        <button className="relative h-9 w-9 rounded-lg bg-transparent hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" id="notifications-bell">
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                        </button>

                        <Separator orientation="vertical" className="h-6" />

                        {/* User profile dropdown */}
                        <UserProfileDropdown />
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
