import { RecentTransactionsFeed } from "@/components/features/RecentTransactionsFeed";

export default function TransactionsPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Todas as movimentações registradas pela Laura via WhatsApp.
                </p>
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border border-border/50 bg-card">
                <input type="month" defaultValue="2026-03" className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground" />
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todas Categorias</option>
                    <option>Alimentação</option>
                    <option>Transporte</option>
                    <option>Lazer</option>
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Tipos</option>
                    <option value="expense">Despesas</option>
                    <option value="income">Entradas</option>
                </select>
                <select className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground">
                    <option value="">Todos Membros</option>
                </select>
                <button className="ml-auto h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                    Exportar CSV
                </button>
            </div>

            {/* Full transactions feed */}
            <RecentTransactionsFeed />
        </div>
    );
}
