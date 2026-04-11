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
        />
    );
}
