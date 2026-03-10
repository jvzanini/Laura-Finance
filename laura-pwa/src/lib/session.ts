import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "laura_session_token";

export async function createSession(userId: string) {
    // Mock JWT/Session logic for MVP
    // Ideally use 'jose' or a similar library to create a JWT
    const token = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 86400000 })).toString("base64");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
    });
}

export async function deleteSession() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;
    // Basic mock payload parsing
    try {
        const payload = JSON.parse(Buffer.from(sessionToken, "base64").toString());
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}
