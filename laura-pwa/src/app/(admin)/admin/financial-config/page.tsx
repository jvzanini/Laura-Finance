import {
    fetchAdminBanksAction,
    fetchAdminCardBrandsAction,
    fetchAdminBrokersAction,
    fetchAdminInvestmentTypesAction,
} from "@/lib/actions/adminConfig";
import { AdminOptionsCrud } from "@/components/admin/AdminOptionsCrud";

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
                <AdminOptionsCrud
                    resource="banks"
                    items={banks}
                    title="Bancos"
                    iconName="Landmark"
                    fields={[
                        { name: "name", label: "Nome", placeholder: "Ex: Nubank", required: true },
                        { name: "slug", label: "Slug", placeholder: "nubank" },
                    ]}
                />
                <AdminOptionsCrud
                    resource="card-brands"
                    items={brands}
                    title="Bandeiras de Cartao"
                    iconName="CreditCard"
                    fields={[
                        { name: "name", label: "Nome", placeholder: "Ex: Visa", required: true },
                        { name: "slug", label: "Slug", placeholder: "visa" },
                    ]}
                />
                <AdminOptionsCrud
                    resource="brokers"
                    items={brokers}
                    title="Corretoras"
                    iconName="TrendingUp"
                    fields={[
                        { name: "name", label: "Nome", placeholder: "Ex: XP", required: true },
                        { name: "slug", label: "Slug", placeholder: "xp" },
                        { name: "emoji", label: "Emoji", placeholder: "🏦" },
                        { name: "category", label: "Categoria", placeholder: "nacional" },
                    ]}
                />
                <AdminOptionsCrud
                    resource="investment-types"
                    items={types}
                    title="Tipos de Investimento"
                    iconName="PieChart"
                    fields={[
                        { name: "name", label: "Nome", placeholder: "Ex: Renda Fixa", required: true },
                        { name: "slug", label: "Slug", placeholder: "renda-fixa" },
                    ]}
                />
            </div>
        </div>
    );
}
