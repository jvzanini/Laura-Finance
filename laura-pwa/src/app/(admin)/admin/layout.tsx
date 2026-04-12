import { redirect } from "next/navigation";
import { assertSuperAdmin } from "@/lib/actions/admin";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const gate = await assertSuperAdmin();
    if (!gate.ok) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-background flex">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
