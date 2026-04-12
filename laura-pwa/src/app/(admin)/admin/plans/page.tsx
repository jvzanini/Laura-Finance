import { fetchAdminPlansAction } from "@/lib/actions/adminConfig";
import { CreditCard } from "lucide-react";
import PlansEditor from "./PlansEditor";

export default async function PlansPage() {
    const result = await fetchAdminPlansAction();
    const plans = "plans" in result ? (result.plans ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Planos de Assinatura</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie planos Standard e VIP, capabilities e limites</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                </div>
            </div>

            <PlansEditor plans={plans} />
        </div>
    );
}
