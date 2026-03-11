import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardWizard } from "@/components/features/CardWizard";
import { CategoryBudget } from "@/components/features/CategoryBudget";
import { MemberWizard } from "@/components/features/MemberWizard";
import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";
import { DashboardChart } from "@/components/features/DashboardChart";
import { DashboardHero } from "@/components/features/DashboardHero";

export default function DashboardPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                    <p className="text-muted-foreground">
                        Bem-vindo de volta! Aqui está o resumo das suas finanças.
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-col sm:flex-row w-full md:w-auto">
                    <MemberWizard />
                    <CardWizard />
                </div>
            </div>

            {/* Dynamic Dashboard Metrics Hero Section */}
            <DashboardHero />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Visual Area Chart for expenditures history */}
                <DashboardChart />

                {/* WhatsApp mock moved or kept under it */}
                <div className="col-span-3 space-y-4">
                    <CategoryBudget />

                    <Card className="bg-card">
                        <CardHeader>
                            <CardTitle>Últimas Movimentações via WhatsApp</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center space-x-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-[150px]" />
                                        <Skeleton className="h-3 w-[100px]" />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <RecentTransactionsFeed />
        </div>
    );
}
