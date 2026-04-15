// Tipos compartilhados para ações admin.

/**
 * Valor genérico aceito por colunas jsonb no banco ou endpoints admin.
 * Permite number/string/boolean/arrays/objetos aninhados.
 */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | JsonValue[]
    | { [key: string]: JsonValue };

export interface SystemConfigRow {
    key: string;
    value: JsonValue;
    description: string | null;
}

export interface SubscriptionPlanRow {
    slug: string;
    name: string;
    price_cents: number;
    stripe_price_id: string | null;
    capabilities: Record<string, boolean>;
    ai_model_config: Record<string, JsonValue>;
    limits: Record<string, JsonValue>;
    features_description: string[];
    active: boolean;
    sort_order: number;
}

export interface PaymentProcessorRow {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    config: Record<string, JsonValue>;
}

export interface AdminOptionRow {
    id: string;
    name: string;
    active: boolean;
    sort_order: number;
    [key: string]: JsonValue;
}

export interface AdminWorkspaceRow {
    id: string;
    name: string;
    plan_slug: string;
    suspended_at: string | null;
    created_at: string;
    owner_name: string;
    owner_email: string;
    member_count: number;
    tx_count: number;
}

export interface AdminAuditLogEntry {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_value: JsonValue | null;
    new_value: JsonValue | null;
    created_at: string;
    admin_user_id: string;
    admin_name: string;
}

export interface AdminWriteResult {
    success?: boolean;
    id?: string;
    error?: string;
}

export interface LauraGoError {
    status?: number;
    message?: string;
}

/**
 * Type guard para erro vindo do callLauraGo (compatível com qualquer shape).
 */
export function isLauraGoError(err: unknown): err is LauraGoError {
    return typeof err === "object" && err !== null;
}
