import {
    fetchDREAction,
    fetchReportsFilterDataAction,
    fetchCategoryReportAction,
    fetchSubcategoryReportAction,
    fetchCardReportAction,
    fetchPaymentMethodReportAction,
    fetchTravelReportAction,
    fetchComparativeReportAction,
    fetchTrendReportAction,
    fetchMemberReportAction,
} from "@/lib/actions/reports";
import { ReportsView } from "./ReportsView";

export default async function ReportsPage() {
    const [
        dre,
        filterData,
        categories,
        subcategories,
        cards,
        methods,
        travel,
        comparative,
        trend,
        members,
    ] = await Promise.all([
        fetchDREAction(),
        fetchReportsFilterDataAction(),
        fetchCategoryReportAction(),
        fetchSubcategoryReportAction(),
        fetchCardReportAction(),
        fetchPaymentMethodReportAction(),
        fetchTravelReportAction(),
        fetchComparativeReportAction(),
        fetchTrendReportAction(),
        fetchMemberReportAction(),
    ]);

    return (
        <ReportsView
            dre={dre}
            filterData={filterData}
            categories={categories}
            subcategories={subcategories}
            cards={cards}
            methods={methods}
            travel={travel}
            comparative={comparative}
            trend={trend}
            members={members}
        />
    );
}
