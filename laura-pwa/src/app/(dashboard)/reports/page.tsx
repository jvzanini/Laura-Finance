import { fetchDREAction, fetchReportsFilterDataAction } from "@/lib/actions/reports";
import { ReportsView } from "./ReportsView";

export default async function ReportsPage() {
    const [dre, filterData] = await Promise.all([
        fetchDREAction(),
        fetchReportsFilterDataAction(),
    ]);

    return <ReportsView dre={dre} filterData={filterData} />;
}
