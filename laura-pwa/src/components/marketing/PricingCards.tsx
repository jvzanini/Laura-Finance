import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PricingClient, type PublicPlan } from "./PricingClient";

type RawPlan = {
    slug: string;
    name: string;
    price_cents: number;
    price_cents_yearly?: number | null;
    price_cents_yearly_discount?: number | null;
    monthly_enabled?: boolean;
    yearly_enabled?: boolean;
    features_description: string[] | string | null;
    sort_order: number;
    is_most_popular?: boolean;
};

type PlansResponse = {
    plans: RawPlan[];
};

function normalizeFeatures(raw: RawPlan["features_description"]): string[] {
    if (Array.isArray(raw)) {
        return raw.filter((f): f is string => typeof f === "string" && f.length > 0);
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(
                    (f): f is string => typeof f === "string" && f.length > 0
                );
            }
        } catch {
            // fallback: cada linha vira uma feature
            return raw
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
        }
    }
    return [];
}

async function fetchPlans(): Promise<PublicPlan[] | null> {
    const goUrl = process.env.LAURA_GO_API_URL || "http://localhost:8080";
    try {
        const res = await fetch(`${goUrl}/api/v1/public/plans`, {
            cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as PlansResponse;
        if (!data.plans || !Array.isArray(data.plans)) return null;
        return data.plans
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map<PublicPlan>((p) => ({
                slug: p.slug,
                name: p.name,
                priceCents: p.price_cents,
                priceCentsYearly:
                    typeof p.price_cents_yearly === "number"
                        ? p.price_cents_yearly
                        : null,
                priceCentsYearlyDiscount:
                    typeof p.price_cents_yearly_discount === "number"
                        ? p.price_cents_yearly_discount
                        : null,
                monthlyEnabled: p.monthly_enabled !== false,
                yearlyEnabled: p.yearly_enabled === true,
                features: normalizeFeatures(p.features_description),
                sortOrder: p.sort_order,
                isMostPopular: Boolean(p.is_most_popular),
            }));
    } catch (err) {
        console.warn("[PricingCards] falha ao buscar planos:", err);
        return null;
    }
}

function Fallback() {
    return (
        <section
            id="planos"
            aria-labelledby="planos-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2
                        id="planos-heading"
                        className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Planos para cada família
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Confira as opções disponíveis e escolha a que melhor combina com
                        vocês.
                    </p>
                </div>
                <div className="mt-14 flex justify-center">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
                        <h3 className="text-xl font-semibold text-white">
                            Veja os planos
                        </h3>
                        <p className="mt-2 text-sm text-zinc-300">
                            Descubra todas as opções ao criar sua conta.
                        </p>
                        <Link href="/register" className="mt-6 inline-block w-full">
                            <Button className="h-12 w-full rounded-xl bg-violet-600 text-base font-semibold text-white hover:bg-violet-500">
                                Ver planos
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

export async function PricingCards() {
    const plans = await fetchPlans();

    if (!plans || plans.length === 0) {
        return <Fallback />;
    }

    return <PricingClient plans={plans} />;
}
