import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";
import { fetchCategorySummariesAction } from "@/lib/actions/categories";

export default async function TransactionsPage() {
    const catResult = await fetchCategorySummariesAction();
    const categories = ("categories" in catResult ? catResult.categories : []) ?? [];

    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Todas as movimentações registradas pela Laura via WhatsApp.
                </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <input type="month" defaultValue={defaultMonth} className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground" />
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todas Categorias</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Tipos</option>
                    <option value="expense">Despesas</option>
                    <option value="income">Entradas</option>
                </select>
                <button className="ml-auto h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                    Exportar CSV
                </button>
            </div>

            <RecentTransactionsFeed />
        </div>
    );
}
