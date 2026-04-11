"use server";

import { pool } from "@/lib/db";

export type PaymentProcessor = {
    slug: string;
    name: string;
    fees: Record<string, number>; // "1x" → 3.5, ...
};

// Fallback mantido em paralelo com laura-go/internal/services/rollover.go
// fallbackFeeTable e com a migration 000016. Usado apenas quando o banco está
// inacessível — em produção a chamada deve sempre hidratar do Postgres.
const FALLBACK: PaymentProcessor[] = [
    { slug: "infinitepay", name: "InfinitePay", fees: { "1x": 3.50, "2x": 4.50, "3x": 5.37, "4x": 6.24, "5x": 7.11, "6x": 7.98, "7x": 8.85, "8x": 9.72, "9x": 10.59, "10x": 11.46, "11x": 12.33, "12x": 13.20 } },
    { slug: "ton", name: "Ton", fees: { "1x": 3.19, "2x": 4.69, "3x": 5.75, "4x": 6.82, "5x": 7.88, "6x": 8.95, "7x": 10.01, "8x": 11.08, "9x": 12.14, "10x": 13.21, "11x": 14.27, "12x": 15.34 } },
    { slug: "stone", name: "Stone", fees: { "1x": 3.29, "2x": 4.59, "3x": 5.89, "4x": 7.19, "5x": 8.49, "6x": 9.79, "7x": 11.09, "8x": 12.39, "9x": 13.69, "10x": 14.99, "11x": 16.29, "12x": 17.59 } },
    { slug: "mercadopago", name: "Mercado Pago", fees: { "1x": 3.49, "2x": 4.89, "3x": 6.29, "4x": 7.69, "5x": 9.09, "6x": 10.49, "7x": 11.89, "8x": 13.29, "9x": 14.69, "10x": 16.09, "11x": 17.49, "12x": 18.89 } },
    { slug: "cielo", name: "Cielo", fees: { "1x": 3.89, "2x": 5.29, "3x": 6.69, "4x": 8.09, "5x": 9.49, "6x": 10.89, "7x": 12.29, "8x": 13.69, "9x": 15.09, "10x": 16.49, "11x": 17.89, "12x": 19.29 } },
    { slug: "pagbank", name: "PagBank", fees: { "1x": 3.39, "2x": 4.79, "3x": 6.19, "4x": 7.59, "5x": 8.99, "6x": 10.39, "7x": 11.79, "8x": 13.19, "9x": 14.59, "10x": 15.99, "11x": 17.39, "12x": 18.79 } },
];

export async function fetchPaymentProcessorsAction(): Promise<PaymentProcessor[]> {
    try {
        const res = await pool.query(
            "SELECT slug, name, fees FROM payment_processors WHERE active = TRUE ORDER BY name ASC"
        );
        if (res.rowCount === 0) return FALLBACK;
        return res.rows.map((r) => ({
            slug: r.slug,
            name: r.name,
            fees: r.fees as Record<string, number>,
        }));
    } catch (err) {
        console.error("fetchPaymentProcessorsAction error:", err);
        return FALLBACK;
    }
}
