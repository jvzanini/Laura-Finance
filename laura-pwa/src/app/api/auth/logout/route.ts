import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function GET(request: Request) {
    await deleteSession();
    // Usar request.url como base — funciona em dev/CI/prod sem env var.
    return NextResponse.redirect(new URL("/login", request.url));
}
