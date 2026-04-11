import { DashboardChart } from "@/components/features/DashboardChart";
import { DashboardHero } from "@/components/features/DashboardHero";
import { CategoryBudget } from "@/components/features/CategoryBudget";
import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";
import { FinancialScoreCard } from "@/components/features/FinancialScoreCard";
import { UpcomingBills } from "@/components/features/UpcomingBills";

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Visão geral das suas finanças em tempo real.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/50 rounded-lg px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Atualizado agora
                </div>
            </div>

            {/* Metric Cards */}
            <DashboardHero />

            {/* Score + Chart Row */}
            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <FinancialScoreCard />
                </div>
                <div className="lg:col-span-3">
                    <DashboardChart />
                </div>
            </div>

            {/* Upcoming Bills + Category Budgets */}
            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <UpcomingBills />
                </div>
                <div className="lg:col-span-3">
                    <CategoryBudget />
                </div>
            </div>

            {/* Recent Transactions */}
            <RecentTransactionsFeed />
        </div>
    );
}
