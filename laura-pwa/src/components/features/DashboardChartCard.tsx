import { fetchMonthlyCashFlowAction } from "@/lib/actions/dashboardMetrics";
import { DashboardChart } from "./DashboardChart";

export async function DashboardChartCard() {
    const data = await fetchMonthlyCashFlowAction();
    return <DashboardChart data={data} />;
}
