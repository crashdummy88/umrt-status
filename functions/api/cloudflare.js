import { fetchCloudflareSummary, unavailableCloudflare } from "../lib/cloudflare.js";
import { jsonResponse, CACHE_SECONDS } from "../lib/health.js";

export async function onRequestGet(ctx) {
  try {
    const cache = caches.default;
    const cacheKey = new Request(new URL("/api/cloudflare", ctx.request.url).toString(), {
      method: "GET",
    });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const body = await fetchCloudflareSummary();
    const res = jsonResponse(body, { cacheSeconds: CACHE_SECONDS });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch {
    return jsonResponse(unavailableCloudflare("Health proxy failed"), {
      status: 503,
      cacheSeconds: 15,
    });
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
