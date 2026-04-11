import { fetchInvoicesAction } from "@/lib/actions/invoicesRepo";
import { InvoicesList } from "./InvoicesList";

export default async function InvoicesPage() {
    const invoices = await fetchInvoicesAction();
    return <InvoicesList invoices={invoices} />;
}
