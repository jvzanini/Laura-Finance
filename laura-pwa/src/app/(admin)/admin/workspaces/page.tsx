import { fetchAdminWorkspacesAction, fetchAdminPlansAction } from "@/lib/actions/adminConfig";
import WorkspacesView from "@/components/admin/WorkspacesView";

export default async function WorkspacesPage() {
    const [wsResult, plansResult] = await Promise.all([
        fetchAdminWorkspacesAction(),
        fetchAdminPlansAction(),
    ]);

    const workspaces = "workspaces" in wsResult ? (wsResult.workspaces ?? []) : [];
    const plans = "plans" in plansResult
        ? (plansResult.plans ?? []).map((p: { slug: string; name: string }) => ({ slug: p.slug, name: p.name }))
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} registrado{workspaces.length !== 1 ? "s" : ""}
                </p>
            </div>
            <WorkspacesView workspaces={workspaces} plans={plans} />
        </div>
    );
}
