import { fetchPaymentProcessorsAction } from "@/lib/actions/paymentProcessors";
import { PushInvoiceForm } from "./PushInvoiceForm";

export default async function PushInvoicePage() {
    const processors = await fetchPaymentProcessorsAction();
    return <PushInvoiceForm processors={processors} />;
}
