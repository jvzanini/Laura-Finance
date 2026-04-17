import { SubscriptionManager } from "@/components/features/SubscriptionManager";

/**
 * /subscription é o hub único de assinatura: aceita o redirect do
 * PaywallGate (?blocked=1) e do Stripe checkout (?checkout=success
 * ou ?checkout=cancel). A info de subscription é carregada no
 * layout pai via SubscriptionProvider, então aqui só renderizamos.
 */
export default function SubscriptionPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Assinatura
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Gerencie seu plano, cartão e renovação.
                </p>
            </div>
            <SubscriptionManager />
        </div>
    );
}
