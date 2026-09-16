/** Normalize Atlassian Statuspage summary.json for the board. */

export const CF_SUMMARY_URL = "https://www.cloudflarestatus.com/api/v2/summary.json";
export const CF_STATUS_URL = "https://www.cloudflarestatus.com/";
export const CACHE_SECONDS = 60;
export const FETCH_TIMEOUT_MS = 8000;

const WATCH_COMPONENTS = ["Pages", "Workers", "Authoritative DNS"];

const INDICATOR_LABELS = {
  none: "Cloudflare operational",
  minor: "Cloudflare partial outage",
  major: "Cloudflare major outage",
  critical: "Cloudflare major outage",
};

export function pickComponents(summary) {
  const list = Array.isArray(summary && summary.components) ? summary.components : [];
  return WATCH_COMPONENTS.map((name) => {
    const match = list.find((c) => c && c.name === name && !c.group);
    return {
      name,
      status: match ? match.status : "unknown",
      found: Boolean(match),
    };
  });
}

export function normalizeCloudflare(summary, { checkedAt = new Date().toISOString() } = {}) {
  const status = (summary && summary.status) || {};
  const indicator = status.indicator || "unknown";
  const label =
    INDICATOR_LABELS[indicator] ||
    status.description ||
    "Cloudflare status unavailable";

  const incidents = Array.isArray(summary && summary.incidents)
    ? summary.incidents
        .filter((i) => i && i.status && i.status !== "resolved")
        .slice(0, 2)
        .map((i) => ({
          name: i.name,
          status: i.status,
          impact: i.impact,
        }))
    : [];

  return {
    ok: true,
    checkedAt,
    indicator,
    label,
    description: status.description || label,
    url: CF_STATUS_URL,
    components: pickComponents(summary),
    incidents,
  };
}

export function unavailableCloudflare(reason) {
  return {
    ok: false,
    checkedAt: new Date().toISOString(),
    indicator: "unknown",
    label: "Cloudflare status unavailable",
    description: reason || "Could not load the public Cloudflare Statuspage.",
    url: CF_STATUS_URL,
    components: WATCH_COMPONENTS.map((name) => ({ name, status: "unknown", found: false })),
    incidents: [],
  };
}

export async function fetchCloudflareSummary({ fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(CF_SUMMARY_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "UMRT-StatusBoard/1.0 (+https://status.unitedmobilerv.com/)",
      },
    });
    if (!res.ok) {
      return unavailableCloudflare(`Statuspage returned HTTP ${res.status}`);
    }
    const summary = await res.json();
    return normalizeCloudflare(summary);
  } catch (err) {
    const reason =
      err && (err.name === "AbortError" || err.message === "The operation was aborted.")
        ? "Statuspage probe timed out"
        : "Could not load the public Cloudflare Statuspage";
    return unavailableCloudflare(reason);
  } finally {
    clearTimeout(timer);
  }
}
