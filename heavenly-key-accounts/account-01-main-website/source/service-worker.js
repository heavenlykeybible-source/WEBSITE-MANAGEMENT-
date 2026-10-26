/**
 * Heavenly Key — Service Worker
 * Strategy:
 *  - App shell (CSS/JS/icons/fonts already fetched): cache-first
 *  - HTML pages: network-first, falling back to cache, then /offline.html
 *  - API calls (/api/...): network-only — never cache moderator-pending
 *    content or personal submissions; a visited Bible chapter, devotional,
 *    or article is cached separately by the page itself once AI 1's API
 *    is live (see API-INTEGRATION.md §5 for that plan)
 */
/**
 * Heavenly Key — Service Worker
 * Strategy:
 *  - App shell (CSS/JS/icons/fonts already fetched): cache-first
 *  - HTML pages: network-first, falling back to cache, then /offline.html
 *  - API calls (/api/...): network-only — never cache moderator-pending
 *    content or personal submissions; a visited Bible chapter, devotional,
 *    or article is cached separately by the page itself once AI 1's API
 *    is live (see API-INTEGRATION.md §5 for that plan)
 *
 * NOTE: ASSET_VERSION must match the ?v= query string used in index.html
 * and pages/*.html (see build_pages.py). If you bump one, bump both —
 * there's no build step here to keep them in sync automatically. This
 * is tracked as a known limitation in KNOWN-ISSUES.md.
 */
const ASSET_VERSION = "1.2.5";
const CACHE_VERSION = "hk-v20-error-recovery";
const APP_SHELL_CACHE = CACHE_VERSION + "-shell";
const PAGES_CACHE = CACHE_VERSION + "-pages";

const APP_SHELL = [
  "/",
  "/index.html",
  "/css/heavenly-ecosystem.css?v=20261026",
  "/assets/ministry/rotating-world-land.svg",
  "/offline.html",
  "/404.html",
  "/500.html",
  `/css/tokens.css?v=${ASSET_VERSION}`,
  `/css/base.css?v=${ASSET_VERSION}`,
  `/css/components.css?v=${ASSET_VERSION}`,
  `/css/ui-components.css?v=${ASSET_VERSION}`,
  `/css/media-components.css?v=${ASSET_VERSION}`,
  `/css/home.css?v=${ASSET_VERSION}`,
  `/css/inner.css?v=${ASSET_VERSION}`,
  `/js/main.js?v=${ASSET_VERSION}`,
  "/js/hk-standard-footer.js",
  "/js/hk-standard-footer.css",
  `/js/api-client.js?v=${ASSET_VERSION}`,
  `/js/ui-components.js?v=${ASSET_VERSION}`,
  `/js/homepage-components.js?v=${ASSET_VERSION}`,
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("hk-") && key !== APP_SHELL_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return; // never cache POSTs (form submissions)
  // Never intercept or persist resources from other origins (including external apps).
  if (url.origin !== self.location.origin) return;

  // API calls: never cache — always hit the network. (Cached Bible chapters,
  // devotionals, and articles are handled at the page level once AI 1's API
  // is live, per API-INTEGRATION.md §5, not blanket-cached here.)
  if (url.pathname.startsWith("/api/")) return;

  // Never cache private administration, previews or temporary protected development routes.
  if (url.pathname.includes('/pages/admin') || url.pathname.includes('/pages/community') || url.pathname === '/home' || url.pathname.startsWith('/home/')) return;

  // Static app-shell assets: cache-first, populating the cache on a
  // miss so anything not in the fixed APP_SHELL list (new stylesheets,
  // the ~15 ministry photos under /assets/ministry/, future icons)
  // still becomes available offline after being seen once — a plain
  // caches.match()-or-fetch() without this write-back would silently
  // never cache anything outside the precache list.
  if (
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok && res.type !== 'opaque' && !/private|no-store/i.test(res.headers.get('cache-control') || '')) {
            const resClone = res.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML pages: network-first, cache fallback, offline page as last resort
  if (req.headers.get("accept") && req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          // Keep correct status codes and preserve JSON/API responses; render friendly
          // recovery pages only for public HTML navigation when the Worker controls it.
          if (res.status === 404 || res.status >= 500) {
            const fallbackPath = res.status === 404 ? "/404.html" : "/500.html";
            const fallback = await caches.match(fallbackPath) || await fetch(fallbackPath);
            if (fallback.ok) return new Response(fallback.body, {
              status: res.status,
              statusText: res.statusText,
              headers: {"Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
            });
          }
          // Never persist error pages or responses marked private/no-store.
          if (res.ok && res.type !== "opaque" && !/private|no-store/i.test(res.headers.get("cache-control") || "")) {
            const resClone = res.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/offline.html")))
    );
  }
});


