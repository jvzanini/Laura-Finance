"use server";

import { createSession } from "@/lib/session";

const GO_URL = process.env.LAURA_GO_API_URL || "http://localhost:8080";

type StartResponse = {
    pending_id: string;
    email_masked: string;
    whatsapp_masked: string;
    channels_warning?: string;
};

type FinalizeResponse = {
    user_id: string;
    workspace_id: string;
    email: string;
};

async function callGo<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
    try {
        const res = await fetch(`${GO_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
            cache: "no-store",
        });
        const text = await res.text();
        if (!res.ok) {
            let msg = text;
            try {
                const parsed = JSON.parse(text);
                msg = parsed.message || parsed.error || text;
            } catch {
                // keep raw text
            }
            return { ok: false, status: res.status, message: msg || `HTTP ${res.status}` };
        }
        const data = text ? (JSON.parse(text) as T) : ({} as T);
        return { ok: true, data };
    } catch (err) {
        console.error("[signup action] go call failed", err);
        return { ok: false, status: 0, message: "Erro de conexão com o servidor" };
    }
}

export async function signupStartAction(input: {
    name: string;
    email: string;
    whatsapp: string;
    password: string;
    desiredPlan?: string;
}) {
    const res = await callGo<StartResponse>("/api/v1/public/signup/start", {
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp,
        password: input.password,
        desired_plan_slug: input.desiredPlan ?? "",
    });
    return res;
}

export async function signupVerifyEmailAction(input: { pendingId: string; code: string }) {
    return callGo<{ verified: boolean }>("/api/v1/public/signup/verify-email", {
        pending_id: input.pendingId,
        code: input.code,
    });
}

export async function signupVerifyWhatsappAction(input: { pendingId: string; code: string }) {
    return callGo<{ verified: boolean }>("/api/v1/public/signup/verify-whatsapp", {
        pending_id: input.pendingId,
        code: input.code,
    });
}

export async function signupFinalizeAction(input: { pendingId: string }) {
    const res = await callGo<FinalizeResponse>("/api/v1/public/signup/finalize", {
        pending_id: input.pendingId,
    });
    if (!res.ok) return res;
    await createSession(res.data.user_id);
    return res;
}

export async function signupResendEmailAction(input: { pendingId: string }) {
    return callGo<{ ok: boolean }>("/api/v1/public/signup/resend-email", {
        pending_id: input.pendingId,
    });
}

export async function signupResendWhatsappAction(input: { pendingId: string }) {
    return callGo<{ ok: boolean }>("/api/v1/public/signup/resend-whatsapp", {
        pending_id: input.pendingId,
    });
}
