import {
    fetchAdminOverviewAction,
    fetchTopWorkspacesByRolloverAction,
    fetchProcessorUsageAction,
    fetchRolloverTrendAction,
    type AdminOverview,
    type TopWorkspaceByRollover,
    type ProcessorUsage,
    type RolloverTrendPoint,
} from "@/lib/actions/admin";
import { AdminCrisisView } from "./AdminCrisisView";

export default async function AdminCrisisPage() {
    const [overviewRes, topWsRes, processorsRes, trendRes] = await Promise.all([
        fetchAdminOverviewAction(),
        fetchTopWorkspacesByRolloverAction(10),
        fetchProcessorUsageAction(),
        fetchRolloverTrendAction(),
    ]);

    const overview: AdminOverview | null =
        "error" in overviewRes ? null : (overviewRes as AdminOverview);
    const topWorkspaces: TopWorkspaceByRollover[] = Array.isArray(topWsRes)
        ? topWsRes
        : [];
    const processors: ProcessorUsage[] = Array.isArray(processorsRes)
        ? processorsRes
        : [];
    const trend: RolloverTrendPoint[] = Array.isArray(trendRes) ? trendRes : [];

    return (
        <AdminCrisisView
            overview={overview}
            topWorkspaces={topWorkspaces}
            processors={processors}
            trend={trend}
        />
    );
}
