import { DashboardChart } from "@/components/features/DashboardChart";
import { DashboardHero } from "@/components/features/DashboardHero";
import { CategoryBudget } from "@/components/features/CategoryBudget";
import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header — Clean, no action buttons */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Visão geral das suas finanças em tempo real.
                </p>
            </div>

            {/* Metric Cards */}
            <DashboardHero />

            {/* Chart + Category Budgets */}
            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <DashboardChart />
                </div>
                <div className="lg:col-span-2">
                    <CategoryBudget />
                </div>
            </div>

            {/* Recent Transactions */}
            <RecentTransactionsFeed />
        </div>
    );
}
