import crypto from "crypto";

// Signed password reset token. Formato: base64url(JSON(payload)).base64url(HMAC)
// HMAC sobre o payload base64url usando RESET_TOKEN_SECRET (ou
// SESSION_SECRET como fallback). TTL default de 30 minutos embutido
// no payload — verifyResetToken checa expiração.
//
// Por que HMAC e não JWT lib: evita adicionar `jose`/`jsonwebtoken`
// deps; o shape é pequeno o suficiente para fazer à mão sem erro, e
// o escopo é um único tipo de token (reset password). Se expandir
// para tokens de convite, magic link login etc, adotar `jose`.

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutos

function getSecret(): string {
    return (
        process.env.RESET_TOKEN_SECRET ||
        process.env.SESSION_SECRET ||
        "laura-reset-fallback-dev-secret"
    );
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

type ResetPayload = {
    uid: string;        // user id
    email: string;      // para double-check contra tampering de uid
    exp: number;        // unix timestamp (seconds)
    v: number;          // version — bumpar se o shape mudar
};

export function createResetToken(userId: string, email: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
    const payload: ResetPayload = {
        uid: userId,
        email,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
        v: 1,
    };
    const payloadB64 = b64url(JSON.stringify(payload));
    const hmac = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
    const sigB64 = b64url(hmac);
    return `${payloadB64}.${sigB64}`;
}

export type VerifyResult =
    | { valid: true; userId: string; email: string }
    | { valid: false; error: string };

export function verifyResetToken(token: string): VerifyResult {
    if (!token || typeof token !== "string") {
        return { valid: false, error: "Token ausente ou inválido." };
    }
    const parts = token.split(".");
    if (parts.length !== 2) {
        return { valid: false, error: "Formato de token inválido." };
    }
    const [payloadB64, sigB64] = parts;

    // Compara HMAC com timingSafeEqual
    const expectedMac = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
    let providedMac: Buffer;
    try {
        providedMac = fromB64url(sigB64);
    } catch {
        return { valid: false, error: "Assinatura mal-formada." };
    }
    if (providedMac.length !== expectedMac.length) {
        return { valid: false, error: "Assinatura inválida." };
    }
    if (!crypto.timingSafeEqual(expectedMac, providedMac)) {
        return { valid: false, error: "Assinatura inválida." };
    }

    // Decode payload
    let parsed: ResetPayload;
    try {
        parsed = JSON.parse(fromB64url(payloadB64).toString("utf-8")) as ResetPayload;
    } catch {
        return { valid: false, error: "Payload corrompido." };
    }

    if (parsed.v !== 1) {
        return { valid: false, error: "Versão de token não suportada." };
    }
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp < now) {
        return { valid: false, error: "Token expirado. Solicite um novo link de reset." };
    }
    if (!parsed.uid || !parsed.email) {
        return { valid: false, error: "Payload incompleto." };
    }

    return { valid: true, userId: parsed.uid, email: parsed.email };
}
