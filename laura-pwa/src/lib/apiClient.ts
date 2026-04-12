import { cookies } from "next/headers";

// Cliente HTTP server-side para chamar a API REST do laura-go.
// Usado pelas server actions do PWA como camada unificada: quando
// LAURA_GO_API_URL está setado e o backend responde, o dado vem de lá.
// Quando o env está vazio ou o backend está offline, callLauraGo
// retorna null sinalizando que o chamador deve usar o fallback local
// (query direta no Postgres via `@/lib/db`).
//
// Por que não usar fetch relativo? Server actions rodam no processo
// Node do Next — fetch("/api/v1/...") tentaria o próprio host do PWA
// (que não existe), então precisamos de URL absoluta.

const API_BASE = process.env.LAURA_GO_API_URL || "";

export type LauraApiError = {
    status: number;
    message: string;
};

/**
 * callLauraGo faz GET/POST para o namespace /api/v1/* do laura-go
 * propagando o cookie de sessão do request atual (via next/headers).
 * Retorna:
 *   - T (objeto JSON tipado) quando a chamada dá 200
 *   - null quando o env está vazio (sinal de "use fallback local")
 *   - lança erro LauraApiError para 4xx/5xx recuperáveis no chamador
 */
export async function callLauraGo<T>(
    path: string,
    options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T | null> {
    if (!API_BASE) return null;

    // Forward do cookie de sessão — o middleware RequireSession do Go
    // lê o mesmo laura_session_token que o PWA grava em session.ts.
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("laura_session_token");
    const cookieHeader = sessionCookie ? `laura_session_token=${sessionCookie.value}` : "";

    const url = `${API_BASE.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: options.method ?? "GET",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookieHeader,
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
            cache: "no-store",
        });
    } catch (err) {
        // Network error — backend offline, unreachable, etc. Sinaliza
        // para fallback local sem ruído.
        console.warn("[apiClient] laura-go unreachable, falling back:", err);
        return null;
    }

    if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        const apiErr: LauraApiError = { status: res.status, message };
        throw apiErr;
    }

    return (await res.json()) as T;
}

/**
 * isLauraGoEnabled permite aos chamadores verificar se o cliente
 * está configurado, útil para decidir entre early-return para o
 * fallback ou tentar mesmo assim.
 */
export async function isLauraGoEnabled(): Promise<boolean> {
    return Boolean(API_BASE);
}
