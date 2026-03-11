import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UpgradeDialog } from "@/components/features/UpgradeDialog";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

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
            <main className="flex-1 overflow-y-auto w-full pt-4 md:p-8">
                <div className="md:hidden p-4 mb-2 flex justify-between items-center border-b pb-4">
                    <SidebarTrigger />
                    <h2 className="text-xl font-black text-primary tracking-widest uppercase">Laura</h2>
                    <div />
                </div>
                <div className="px-4">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    );
}
