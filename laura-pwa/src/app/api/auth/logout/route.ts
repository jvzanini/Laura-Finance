import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function GET(request: Request) {
    await deleteSession();
    // Construir URL do /login usando host forwarded pelo Traefik/reverse proxy.
    // `request.url` atrás de proxy devolve o hostname interno do container
    // (ex. laura-pwa:3000) — usar X-Forwarded-Host + X-Forwarded-Proto.
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const reqUrl = new URL(request.url);
    const host = forwardedHost ?? reqUrl.host;
    const proto = forwardedHost ? forwardedProto : reqUrl.protocol.replace(":", "");
    return NextResponse.redirect(`${proto}://${host}/login`);
}
