import { buildHealth, jsonResponse, CACHE_SECONDS } from "../lib/health.js";

async function cachedJson(ctx, cacheKeyUrl, builder) {
  const cache = caches.default;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const body = await builder();
  const res = jsonResponse(body, { cacheSeconds: CACHE_SECONDS });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export async function onRequestGet(ctx) {
  try {
    const url = new URL("/api/health", ctx.request.url);
    return await cachedJson(ctx, url.toString(), () => buildHealth());
  } catch {
    return jsonResponse(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        cacheSeconds: 15,
        overall: { indicator: "unknown", label: "Status unknown" },
        components: [],
        error: "Health probe failed — not assuming all-clear.",
      },
      { status: 503, cacheSeconds: 15 }
    );
  }
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "max-age=600",
    },
  });
}
