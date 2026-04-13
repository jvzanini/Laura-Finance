import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "laura_session_token";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (aligned cookie + payload)

function getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("SESSION_SECRET é obrigatória em produção");
        }
        return "laura-dev-session-secret-change-me";
    }
    return secret;
}

function b64url(input: Buffer | string): string {
    const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    return Buffer.from(s, "base64");
}

function sign(payloadB64: string): string {
    return b64url(crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest());
}

export async function createSession(userId: string) {
    const payload = { userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, v: 1 };
    const payloadB64 = b64url(JSON.stringify(payload));
    const token = `${payloadB64}.${sign(payloadB64)}`;

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_TTL_SECONDS,
        path: "/",
    });
}

export async function deleteSession() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    try {
        const parts = token.split(".");
        if (parts.length !== 2) return null;
        const [payloadB64, sigB64] = parts;

        // Verify HMAC
        const expected = crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest();
        let provided: Buffer;
        try {
            provided = fromB64url(sigB64);
        } catch {
            return null;
        }
        if (provided.length !== expected.length || !crypto.timingSafeEqual(expected, provided)) {
            return null;
        }

        const payload = JSON.parse(fromB64url(payloadB64).toString("utf-8"));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) return null;
        return payload;
    } catch {
        return null;
    }
}
