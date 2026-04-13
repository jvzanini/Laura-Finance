import crypto from "crypto";

// Signed email verification token. Mesma arquitetura do resetToken.ts
// mas com propósito distinto ("v_email") codificado no payload para
// prevenir cross-use (um token de reset não funciona como verify).

const VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24h (mais longo que o de reset)

function getSecret(): string {
    const secret = process.env.VERIFY_EMAIL_SECRET || process.env.SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("VERIFY_EMAIL_SECRET é obrigatória em produção");
        }
        return "laura-verify-fallback-dev-secret";
    }
    return secret;
}

function b64url(input: Buffer | string): string {
    const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    return Buffer.from(s, "base64");
}

type VerifyPayload = {
    uid: string;
    email: string;
    exp: number;
    p: "v_email";  // purpose — evita reuse cross-feature
    v: number;     // schema version
};

export function createVerifyEmailToken(userId: string, email: string): string {
    const payload: VerifyPayload = {
        uid: userId,
        email,
        exp: Math.floor(Date.now() / 1000) + VERIFY_TTL_SECONDS,
        p: "v_email",
        v: 1,
    };
    const payloadB64 = b64url(JSON.stringify(payload));
    const hmac = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
    return `${payloadB64}.${b64url(hmac)}`;
}

export type VerifyEmailResult =
    | { valid: true; userId: string; email: string }
    | { valid: false; error: string };

export function verifyEmailToken(token: string): VerifyEmailResult {
    if (!token || typeof token !== "string") {
        return { valid: false, error: "Token ausente." };
    }
    const parts = token.split(".");
    if (parts.length !== 2) return { valid: false, error: "Formato inválido." };

    const [payloadB64, sigB64] = parts;
    const expected = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
    let provided: Buffer;
    try {
        provided = fromB64url(sigB64);
    } catch {
        return { valid: false, error: "Assinatura mal-formada." };
    }
    if (provided.length !== expected.length || !crypto.timingSafeEqual(expected, provided)) {
        return { valid: false, error: "Assinatura inválida." };
    }

    let parsed: VerifyPayload;
    try {
        parsed = JSON.parse(fromB64url(payloadB64).toString("utf-8")) as VerifyPayload;
    } catch {
        return { valid: false, error: "Payload corrompido." };
    }

    if (parsed.v !== 1) return { valid: false, error: "Versão não suportada." };
    if (parsed.p !== "v_email") return { valid: false, error: "Purpose inválido." };
    if (!parsed.uid || !parsed.email) return { valid: false, error: "Payload incompleto." };

    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp < now) {
        return { valid: false, error: "Link expirado. Solicite um novo." };
    }

    return { valid: true, userId: parsed.uid, email: parsed.email };
}
