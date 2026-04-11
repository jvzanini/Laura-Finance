import { fetchCategoriesAction } from "@/lib/actions/categories";
import { CategoriesView, type Category } from "./CategoriesView";

export default async function CategoriesPage() {
    const res = await fetchCategoriesAction();
    const categories: Category[] = "categories" in res && res.categories ? (res.categories as Category[]) : [];

    return <CategoriesView categories={categories} />;
}
