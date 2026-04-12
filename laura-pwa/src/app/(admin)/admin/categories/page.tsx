import { fetchAdminCategoryTemplatesFullAction } from "@/lib/actions/adminConfig";
import { CategoriesManager } from "./CategoriesManager";
import { Tag } from "lucide-react";

export default async function CategoriesPage() {
    const result = await fetchAdminCategoryTemplatesFullAction();
    const categories = "templates" in result ? result.templates : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Categorias e Subcategorias</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie as categorias e subcategorias disponíveis para os workspaces. {categories.length} categorias cadastradas.
                    </p>
                </div>
            </div>
            <CategoriesManager initial={categories} />
        </div>
    );
}
