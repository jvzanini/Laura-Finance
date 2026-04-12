import { fetchWhatsAppInstancesAction } from "@/lib/actions/adminConfig";
import { WhatsAppManager } from "./WhatsAppManager";

export default async function WhatsAppPage() {
    const result = await fetchWhatsAppInstancesAction();
    const instances = "instances" in result ? (result.instances ?? []) : [];

    return <WhatsAppManager initial={instances} />;
}
