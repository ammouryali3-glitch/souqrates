/**
 * Cloudflare Worker — SKZ Bot CDN Proxy
 * ----------------------------------------
 * Deploy this script from your Cloudflare dashboard:
 *   Workers & Pages → Create Worker → Paste this code → Deploy
 *
 * Set the environment variable TARGET_ORIGIN to your Replit app domain.
 * Example: https://your-app.replit.app
 *
 * Routes to configure in Cloudflare:
 *   *your-domain.com/api/*    → this worker (caches API responses)
 *   *your-domain.com/*        → this worker (edge-caches HTML/assets)
 */

const CACHE_RULES = [
  // Static assets — long cache
  { pattern: /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|webp|svg|ico)(\?.*)?$/, ttl: 86400, stale: 604800 },
  // API: runtime config — short cache (public, safe to cache at edge)
  { pattern: /\/api\/admin\/runtime-config/, ttl: 30, stale: 60 },
  // API: leaderboard — short cache
  { pattern: /\/api\/user\/leaderboard/, ttl: 15, stale: 30 },
  // Everything else — no cache
  { pattern: /.*/, ttl: 0, stale: 0 },
];

export default {
  async fetch(request, env) {
    const origin = env.TARGET_ORIGIN;
    if (!origin) {
      return new Response("TARGET_ORIGIN env var not set", { status: 500 });
    }

    const url = new URL(request.url);
    const targetUrl = `${origin}${url.pathname}${url.search}`;

    const rule = CACHE_RULES.find((r) => r.pattern.test(url.pathname));
    const ttl = rule?.ttl ?? 0;

    // For non-cacheable requests, just proxy
    if (ttl === 0 || request.method !== "GET") {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      });
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          ...Object.fromEntries(resp.headers.entries()),
          "X-SKZ-Edge": "miss",
        },
      });
    }

    // Try Cloudflare cache
    const cache = caches.default;
    const cacheKey = new Request(targetUrl, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...Object.fromEntries(cached.headers.entries()),
          "X-SKZ-Edge": "hit",
        },
      });
    }

    // Fetch from origin and cache
    const resp = await fetch(targetUrl, { headers: request.headers });
    const responseToCache = new Response(resp.body, {
      status: resp.status,
      headers: {
        ...Object.fromEntries(resp.headers.entries()),
        "Cache-Control": `public, max-age=${ttl}, stale-while-revalidate=${rule?.stale ?? 0}`,
        "X-SKZ-Edge": "miss",
      },
    });

    if (resp.status === 200) {
      await cache.put(cacheKey, responseToCache.clone());
    }

    return responseToCache;
  },
};
