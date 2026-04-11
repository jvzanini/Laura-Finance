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
    type ReportFilters,
} from "@/lib/actions/reports";
import { ReportsView } from "./ReportsView";

type SearchParamsInput = Record<string, string | string[] | undefined>;

function paramsToFilters(sp: SearchParamsInput): ReportFilters {
    const getStr = (k: string): string | undefined => {
        const v = sp[k];
        if (Array.isArray(v)) return v[0];
        return v ?? undefined;
    };
    const type = getStr("type");
    return {
        month: getStr("month"),
        categoryId: getStr("category"),
        memberId: getStr("member"),
        type: type === "income" || type === "expense" ? type : undefined,
    };
}

export default async function ReportsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParamsInput>;
}) {
    const params = await searchParams;
    const filters = paramsToFilters(params);

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
        fetchDREAction(filters),
        fetchReportsFilterDataAction(),
        fetchCategoryReportAction(filters),
        fetchSubcategoryReportAction(filters),
        fetchCardReportAction(filters),
        fetchPaymentMethodReportAction(filters),
        fetchTravelReportAction(filters),
        fetchComparativeReportAction(filters),
        fetchTrendReportAction(filters),
        fetchMemberReportAction(filters),
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
            filters={filters}
        />
    );
}
