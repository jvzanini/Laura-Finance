"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Rotas liberadas mesmo para usuários bloqueados — permitem pagar,
 * ajustar conta e sair sem ficar em loop de redirect.
 */
const WHITELIST = ["/subscription", "/settings", "/api", "/logout"];

function isAllowed(pathname: string | null): boolean {
    if (!pathname) return false;
    return WHITELIST.some((p) => pathname.startsWith(p));
}

/**
 * PaywallGate é um guard client-side que força o redirect para
 * /subscription quando o backend sinaliza que a assinatura está
 * bloqueada. Rodar no client simplifica o acesso ao pathname e
 * evita ler headers dinâmicos no layout server.
 */
export function PaywallGate({ isBlocked }: { isBlocked: boolean }) {
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isBlocked) return;
        if (isAllowed(pathname)) return;
        router.replace("/subscription?blocked=1");
    }, [isBlocked, pathname, router]);

    return null;
}
