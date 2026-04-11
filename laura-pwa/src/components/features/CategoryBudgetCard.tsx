import { fetchCategoryBudgetsAction } from "@/lib/actions/dashboardMetrics";
import { CategoryBudget } from "./CategoryBudget";

export async function CategoryBudgetCard() {
    const categories = await fetchCategoryBudgetsAction();
    return <CategoryBudget categories={categories} />;
}
