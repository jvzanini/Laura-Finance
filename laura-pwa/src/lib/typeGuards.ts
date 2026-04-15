// Type guards reutilizaveis para normalizar payloads unknown -> T.
// Uso canonico: apos fetch/action cujo retorno nao e tipado.

import type { JsonValue } from "@/types/admin";

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

export function isString(value: unknown): value is string {
    return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
    return typeof value === "number" && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}

/**
 * Retorna o valor de uma chave em objeto unknown sem exigir any.
 */
export function getField(value: unknown, key: string): unknown {
    return isObject(value) ? value[key] : undefined;
}

export function getString(value: unknown, key: string, fallback = ""): string {
    const v = getField(value, key);
    return isString(v) ? v : fallback;
}

export function getNumber(value: unknown, key: string, fallback = 0): number {
    const v = getField(value, key);
    return isNumber(v) ? v : fallback;
}

export function getBoolean(value: unknown, key: string, fallback = false): boolean {
    const v = getField(value, key);
    return isBoolean(v) ? v : fallback;
}

export function getStringOrNull(value: unknown, key: string): string | null {
    const v = getField(value, key);
    if (isString(v)) return v;
    if (v === null) return null;
    return null;
}

export function getArray(value: unknown, key: string): unknown[] {
    const v = getField(value, key);
    return isArray(v) ? v : [];
}

export function getRecord(value: unknown, key: string): Record<string, unknown> {
    const v = getField(value, key);
    return isObject(v) ? v : {};
}

/**
 * Extrai um JsonValue de forma segura. Useful para campos jsonb do banco.
 */
export function toJsonValue(value: unknown): JsonValue {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(toJsonValue);
    }
    if (isObject(value)) {
        const out: { [key: string]: JsonValue } = {};
        for (const k of Object.keys(value)) {
            out[k] = toJsonValue(value[k]);
        }
        return out;
    }
    return null;
}
