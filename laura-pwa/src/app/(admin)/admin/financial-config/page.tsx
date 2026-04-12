import {
    fetchAdminBanksAction,
    fetchAdminCardBrandsAction,
    fetchAdminBrokersAction,
    fetchAdminInvestmentTypesAction,
} from "@/lib/actions/adminConfig";
import { Landmark, CreditCard, TrendingUp, PieChart } from "lucide-react";

function StatusBadge({ active }: { active: boolean }) {
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${active !== false ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
            {active !== false ? "Ativo" : "Inativo"}
        </span>
    );
}

function SectionTable({
    title,
    icon: Icon,
    items,
    extraColumns,
}: {
    title: string;
    icon: any;
    items: any[];
    extraColumns?: { label: string; render: (item: any) => React.ReactNode }[];
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">{title}</h2>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">{items.length} itens</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nome</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Slug</th>
                            {extraColumns?.map((col) => (
                                <th key={col.label} className="text-center px-4 py-2 font-medium text-muted-foreground text-xs">{col.label}</th>
                            ))}
                            <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs">Ordem</th>
                            <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any) => (
                            <tr key={item.id || item.slug} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                                <td className="px-4 py-2.5 font-medium">{item.name}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.slug}</td>
                                {extraColumns?.map((col) => (
                                    <td key={col.label} className="px-4 py-2.5 text-center">{col.render(item)}</td>
                                ))}
                                <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{item.sort_order ?? "-"}</td>
                                <td className="px-4 py-2.5 text-center"><StatusBadge active={item.active !== false} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {items.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Nenhum item cadastrado</div>
            )}
        </div>
    );
}

export default async function FinancialConfigPage() {
    const [banksRes, brandsRes, brokersRes, typesRes] = await Promise.all([
        fetchAdminBanksAction(),
        fetchAdminCardBrandsAction(),
        fetchAdminBrokersAction(),
        fetchAdminInvestmentTypesAction(),
    ]);

    const banks = "items" in banksRes ? (banksRes.items ?? []) : [];
    const brands = "items" in brandsRes ? (brandsRes.items ?? []) : [];
    const brokers = "items" in brokersRes ? (brokersRes.items ?? []) : [];
    const types = "items" in typesRes ? (typesRes.items ?? []) : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuracao Financeira</h1>
                <p className="text-sm text-muted-foreground mt-1">Bancos, bandeiras de cartao, corretoras e tipos de investimento</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <SectionTable title="Bancos" icon={Landmark} items={banks} />
                <SectionTable title="Bandeiras de Cartao" icon={CreditCard} items={brands} />
                <SectionTable
                    title="Corretoras"
                    icon={TrendingUp}
                    items={brokers}
                    extraColumns={[
                        {
                            label: "Emoji",
                            render: (item: any) => <span className="text-lg">{item.emoji || "-"}</span>,
                        },
                        {
                            label: "Categoria",
                            render: (item: any) =>
                                item.category ? (
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400">
                                        {item.category}
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                ),
                        },
                    ]}
                />
                <SectionTable title="Tipos de Investimento" icon={PieChart} items={types} />
            </div>
        </div>
    );
}
