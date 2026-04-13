import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/settings", "/cards", "/transactions", "/categories", "/invoices", "/goals", "/investments", "/members", "/reports"];
const ADMIN_PATHS = ["/admin"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // Check session cookie for protected routes
    const sessionToken = request.cookies.get("laura_session_token")?.value;
    const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
    const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));

    if ((isProtected || isAdmin) && !sessionToken) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|offline).*)",
    ],
};
