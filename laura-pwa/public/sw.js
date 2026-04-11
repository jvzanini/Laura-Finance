// Service Worker do Laura Finance PWA.
//
// Estratégias:
//   - Precache: rotas shell (/, /offline) + ícones do manifest.
//   - Navigation requests: network-first com fallback para offline page.
//   - Static assets (/_next/static/*, imagens): cache-first longo.
//   - Server actions / APIs: network-only (passa direto, sem cache).
//
// Versão do cache. Bumpar esta constante força invalidação de
// todos os caches antigos na ativação.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `laura-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `laura-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
    "/",
    "/offline",
    "/manifest.json",
    "/favicon.ico",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);
            // addAll falha se qualquer URL der 404 — usamos add individual
            // com try/catch para tolerar páginas que ainda não compilaram.
            await Promise.all(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        await cache.add(url);
                    } catch (err) {
                        console.warn("[SW] precache falhou para", url, err);
                    }
                })
            );
            self.skipWaiting();
        })()
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                    .map((k) => caches.delete(k))
            );
            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Só intercepta GETs. POSTs (server actions) passam direto.
    if (req.method !== "GET") return;

    const url = new URL(req.url);

    // Ignora extensões de terceiros e cross-origin (menos next/static CDN).
    if (url.origin !== self.location.origin) return;

    // APIs e server actions: network-only.
    if (url.pathname.startsWith("/api/")) return;

    // Navigation requests (HTML documents): network-first com offline fallback.
    if (req.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req);
                    const cache = await caches.open(RUNTIME_CACHE);
                    cache.put(req, fresh.clone());
                    return fresh;
                } catch {
                    const cache = await caches.open(RUNTIME_CACHE);
                    const cached = await cache.match(req);
                    if (cached) return cached;
                    const offline = await caches.match(OFFLINE_URL);
                    return (
                        offline ??
                        new Response("Offline", {
                            status: 503,
                            statusText: "Service Unavailable",
                            headers: { "content-type": "text/plain" },
                        })
                    );
                }
            })()
        );
        return;
    }

    // Static chunks do Next.js e assets: cache-first.
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.endsWith(".ico") ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".svg") ||
        url.pathname.endsWith(".webp") ||
        url.pathname.endsWith(".woff2")
    ) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(STATIC_CACHE);
                const cached = await cache.match(req);
                if (cached) return cached;
                try {
                    const fresh = await fetch(req);
                    if (fresh.ok) cache.put(req, fresh.clone());
                    return fresh;
                } catch {
                    // Mesmo os assets raros (SVG de ícone) podem falhar.
                    return Response.error();
                }
            })()
        );
        return;
    }

    // Outras requests GET: stale-while-revalidate no runtime cache.
    event.respondWith(
        (async () => {
            const cache = await caches.open(RUNTIME_CACHE);
            const cached = await cache.match(req);
            const freshPromise = fetch(req)
                .then((res) => {
                    if (res.ok) cache.put(req, res.clone());
                    return res;
                })
                .catch(() => undefined);
            return cached ?? (await freshPromise) ?? Response.error();
        })()
    );
});
