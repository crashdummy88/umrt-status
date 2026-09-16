/** Shared probe + rollup for /api/health. Safe to import from Pages Functions and node:test. */

export const CACHE_SECONDS = 60;
export const PROBE_TIMEOUT_MS = 8000;

export const HOSTS = [
  {
    id: "hub",
    name: "unitedmobilerv.com",
    label: "WordPress hub",
    url: "https://unitedmobilerv.com/",
  },
  {
    id: "book",
    name: "book.unitedmobilerv.com",
    label: "Booking",
    url: "https://book.unitedmobilerv.com/",
  },
  {
    id: "shop",
    name: "shop.unitedmobilerv.com",
    label: "Shop",
    url: "https://shop.unitedmobilerv.com/",
  },
  {
    id: "forum",
    name: "forum.unitedmobilerv.com",
    label: "Forum",
    url: "https://forum.unitedmobilerv.com/",
  },
  {
    id: "portal",
    name: "portal.unitedmobilerv.com",
    label: "Portal",
    url: "https://portal.unitedmobilerv.com/",
  },
  {
    id: "software",
    name: "software.unitedmobilerv.com",
    label: "Software hub",
    url: "https://software.unitedmobilerv.com/",
  },
  {
    id: "docs",
    name: "docs.unitedmobilerv.com",
    label: "Docs",
    url: "https://docs.unitedmobilerv.com/",
  },
  {
    id: "status",
    name: "status.unitedmobilerv.com",
    label: "Status board (self)",
    url: "https://status.unitedmobilerv.com/",
    self: true,
  },
];

export function classifyProbe({ status, error, self }) {
  if (self) {
    return {
      state: "operational",
      detail: "This board is serving the health check.",
    };
  }
  if (error === "timeout") {
    return { state: "unknown", detail: "Probe timed out — not assuming all-clear." };
  }
  if (error) {
    return { state: "unknown", detail: "Probe failed — could not confirm from the edge." };
  }
  if (status >= 200 && status < 400) {
    return { state: "operational", detail: `Reached (HTTP ${status})` };
  }
  if (status === 401 || status === 403) {
    return {
      state: "unknown",
      detail: `Protected (HTTP ${status}) — bot/WAF may be blocking the probe; site may still be up.`,
    };
  }
  if (status >= 500) {
    return { state: "major", detail: `Origin error (HTTP ${status})` };
  }
  if (status >= 400) {
    return { state: "degraded", detail: `Unexpected response (HTTP ${status})` };
  }
  return { state: "unknown", detail: `Unexpected HTTP ${status}` };
}

export function summarizeOverall(components) {
  const states = components.map((c) => c.state);
  if (!states.length) {
    return { indicator: "unknown", label: "Status unknown" };
  }
  if (states.every((s) => s === "operational")) {
    return { indicator: "operational", label: "All systems operational" };
  }
  if (states.every((s) => s === "unknown")) {
    return { indicator: "unknown", label: "Status unknown" };
  }
  if (states.some((s) => s === "major")) {
    return { indicator: "major", label: "Major outage" };
  }
  return { indicator: "partial", label: "Partial outage" };
}

export async function probeUrl(url, { timeoutMs = PROBE_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const started = Date.now();
  const run = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "UMRT-StatusBoard/1.0 (+https://status.unitedmobilerv.com/)",
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });
      if (res.body && typeof res.body.cancel === "function") {
        try {
          res.body.cancel();
        } catch {
          /* ignore */
        }
      }
      return { status: res.status, ms: Date.now() - started };
    } catch (err) {
      if (err && (err.name === "AbortError" || err.message === "The operation was aborted.")) {
        return { error: "timeout", ms: Date.now() - started };
      }
      return { error: (err && err.message) || "network", ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  };

  const head = await run("HEAD");
  if (!head.error && (head.status === 405 || head.status === 501)) {
    return run("GET");
  }
  return head;
}

export async function buildHealth({ fetchImpl = fetch, now = new Date() } = {}) {
  const components = await Promise.all(
    HOSTS.map(async (host) => {
      if (host.self) {
        const classified = classifyProbe({ self: true });
        return {
          id: host.id,
          name: host.name,
          label: host.label,
          url: host.url,
          state: classified.state,
          detail: classified.detail,
          httpStatus: null,
          ms: 0,
        };
      }
      const result = await probeUrl(host.url, { fetchImpl });
      const classified = classifyProbe(result);
      return {
        id: host.id,
        name: host.name,
        label: host.label,
        url: host.url,
        state: classified.state,
        detail: classified.detail,
        httpStatus: result.status ?? null,
        ms: result.ms ?? null,
      };
    })
  );

  return {
    ok: true,
    checkedAt: now.toISOString(),
    cacheSeconds: CACHE_SECONDS,
    overall: summarizeOverall(components),
    components,
  };
}

export function jsonResponse(body, { status = 200, cacheSeconds = CACHE_SECONDS } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
    },
  });
}
