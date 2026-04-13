"use server";

import { pool } from "@/lib/db";
import { callLauraGo } from "@/lib/apiClient";

type OptionItem = {
    id: string;
    name: string;
    slug: string;
    emoji?: string;
    category?: string;
    color?: string;
    active: boolean;
};

const ALLOWED_OPTION_TABLES = new Set([
    "bank_options", "card_brand_options", "broker_options",
    "investment_type_options", "goal_templates",
]);

async function fetchOptions(goPath: string, table: string): Promise<OptionItem[]> {
    if (!ALLOWED_OPTION_TABLES.has(table)) {
        throw new Error(`Tabela não permitida: ${table}`);
    }
    try {
        const res = await callLauraGo<{ items: OptionItem[] }>(goPath);
        if (res) return res.items ?? [];
    } catch { /* fallback */ }

    const result = await pool.query(`SELECT row_to_json(t) as data FROM ${table} t WHERE active = true ORDER BY sort_order, name`);
    return result.rows.map(r => r.data);
}

export async function fetchBankOptionsAction() {
    return fetchOptions("/api/v1/options/banks", "bank_options");
}

export async function fetchCardBrandOptionsAction() {
    return fetchOptions("/api/v1/options/card-brands", "card_brand_options");
}

export async function fetchBrokerOptionsAction() {
    return fetchOptions("/api/v1/options/brokers", "broker_options");
}

export async function fetchInvestmentTypeOptionsAction() {
    return fetchOptions("/api/v1/options/investment-types", "investment_type_options");
}

export async function fetchGoalTemplateOptionsAction() {
    return fetchOptions("/api/v1/options/goal-templates", "goal_templates");
}
