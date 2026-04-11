import { fetchDebtRolloversAction } from "@/lib/actions/invoices";
import { PushHistoryView, type PushHistoryRow } from "./PushHistoryView";

export default async function PushHistoryPage() {
    const res = await fetchDebtRolloversAction();
    const rollovers: PushHistoryRow[] =
        "rollovers" in res && res.rollovers
            ? res.rollovers.map((r) => ({
                  id: r.id,
                  date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
                  card: r.card,
                  cardColor: r.cardColor,
                  institution: r.institution,
                  invoiceValue: Number(r.invoiceValue),
                  totalFees: Number(r.totalFees),
                  totalOperations: Number(r.totalOperations),
                  installments: r.installments,
                  status: r.status,
              }))
            : [];

    return <PushHistoryView rollovers={rollovers} />;
}
