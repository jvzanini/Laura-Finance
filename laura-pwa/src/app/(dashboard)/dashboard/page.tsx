import { CardWizard } from "@/components/features/CardWizard";
import { CategoryBudget } from "@/components/features/CategoryBudget";
import { MemberWizard } from "@/components/features/MemberWizard";
import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";
import { DashboardChart } from "@/components/features/DashboardChart";
import { DashboardHero } from "@/components/features/DashboardHero";

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Visão geral das suas finanças em tempo real.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <MemberWizard />
                    <CardWizard />
                </div>
            </div>

            {/* Metric Cards */}
            <DashboardHero />

            {/* Charts + Sidebar Grid */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Main Chart — 3 cols */}
                <div className="lg:col-span-3">
                    <DashboardChart />
                </div>

                {/* Category Budgets — 2 cols */}
                <div className="lg:col-span-2">
                    <CategoryBudget />
                </div>
            </div>

            {/* Recent Transactions */}
            <RecentTransactionsFeed />
        </div>
    );
}
