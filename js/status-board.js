const REFRESH_MS = 60000;

const SYSTEM_LABELS = {
  operational: "Operational",
  degraded: "Degraded",
  partial: "Partial outage",
  major: "Major outage",
  unknown: "Unknown",
  checking: "Checking",
};

const LOCATION_LABELS = (window.UMRTLocations && window.UMRTLocations.LABELS) || {
  open: "Open",
  limited: "Limited",
  closed: "Closed",
  seasonal: "Seasonal",
};

const CF_LABELS = {
  operational: "Operational",
  degraded_performance: "Degraded",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  under_maintenance: "Maintenance",
  none: "Operational",
  minor: "Partial outage",
  major: "Major outage",
  critical: "Major outage",
  unknown: "Unknown",
};

const CF_TONE = {
  operational: "ok",
  none: "ok",
  degraded_performance: "warn",
  partial_outage: "warn",
  minor: "warn",
  under_maintenance: "warn",
  major_outage: "down",
  major: "down",
  critical: "down",
  unknown: "unknown",
};

const $ = (id) => document.getElementById(id);

function toneForSystem(state) {
  if (state === "operational") return "ok";
  if (state === "degraded" || state === "partial") return "warn";
  if (state === "major") return "down";
  return "unknown";
}

function toneForLocation(state) {
  if (window.UMRTLocations) return window.UMRTLocations.tone(state);
  if (state === "open") return "ok";
  if (state === "limited" || state === "seasonal") return "warn";
  if (state === "closed") return "down";
  return "unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatChecked(iso) {
  if (!iso) return "Not yet checked";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Not yet checked";
  const delta = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (delta < 10) return "Checked just now";
  if (delta < 60) return `Checked ${delta}s ago`;
  const mins = Math.round(delta / 60);
  return mins === 1 ? "Checked 1 min ago" : `Checked ${mins} min ago`;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { ok: false, error: (err && err.message) || "network" };
  }
}

function renderOverall(overall, meta) {
  const banner = $("overall");
  const label = $("overall-label");
  const detail = $("overall-meta");
  if (!banner || !label || !detail) return;
  const indicator = (overall && overall.indicator) || "unknown";
  banner.className = `overall overall-${indicator}`;
  label.textContent = (overall && overall.label) || "Status unknown";
  detail.textContent = meta;
}

function renderComponents(components, errorDetail) {
  const list = $("network-list");
  if (!list) return;
  if (!components || !components.length) {
    list.innerHTML = `<p class="board-empty">${escapeHtml(
      errorDetail || "Health check unavailable — not assuming all-clear."
    )}</p>`;
    return;
  }
  list.innerHTML = components
    .map((c) => {
      const state = c.state || "unknown";
      const tone = toneForSystem(state);
      const pill = SYSTEM_LABELS[state] || SYSTEM_LABELS.unknown;
      const ms = typeof c.ms === "number" && c.ms > 0 ? ` · ${c.ms} ms` : "";
      const href = c.url ? escapeHtml(c.url) : "";
      return `<details class="svc">
        <summary>
          <span class="svc-copy">
            <span class="svc-name">${escapeHtml(c.name)}</span>
            <span class="svc-label">${escapeHtml(c.label || "")}</span>
          </span>
          <span class="pill pill-${tone}" aria-label="${escapeHtml(pill)}">${escapeHtml(pill)}</span>
        </summary>
        <div class="svc-detail">
          <p>${escapeHtml(c.detail || "No extra detail.")}${escapeHtml(ms)}</p>
          ${href ? `<p><a href="${href}" rel="noopener">Open ${escapeHtml(c.name)}</a></p>` : ""}
        </div>
      </details>`;
    })
    .join("");
}

function locationItems(data) {
  if (window.UMRTLocations) return window.UMRTLocations.allItems(data);
  const items = Array.isArray(data.locations) ? data.locations.slice() : [];
  if (data.beyond) items.push({ ...data.beyond, beyond: true });
  return items;
}

function locationPill(loc, groupId) {
  if (window.UMRTLocations) return window.UMRTLocations.pill(loc, groupId);
  return loc.pill || LOCATION_LABELS[loc.state] || loc.state;
}

function renderLocationTile(loc, groupId, active) {
  const state = loc.state || "unknown";
  const tone = toneForLocation(state);
  const pill = locationPill(loc, groupId);
  const title = loc.beyond ? loc.name : loc.code || loc.name;
  const sub = loc.beyond ? loc.regions || "" : loc.name || "";
  return `<button type="button" class="loc-tile loc-${tone}${active ? " is-active" : ""}" data-loc="${escapeHtml(
    loc.id
  )}" aria-pressed="${active ? "true" : "false"}">
    <span class="loc-title">${escapeHtml(title)}</span>
    <span class="loc-sub">${escapeHtml(sub)}</span>
    <span class="pill pill-${tone}" aria-label="${escapeHtml(pill)}">${escapeHtml(pill)}</span>
  </button>`;
}

function renderLocations(data) {
  const mount = $("location-groups") || $("location-grid");
  const headline = $("location-headline");
  const detail = $("location-detail");
  if (!mount || !data) return;
  if (headline && data.headline) headline.textContent = data.headline;
  const groups = window.UMRTLocations
    ? window.UMRTLocations.groupsFrom(data)
    : [{ id: "active", label: "Active corridor", kicker: "", items: locationItems(data) }];
  if (!groups.length) return;
  mount.innerHTML = groups
    .map((group) => {
      const kicker = group.kicker
        ? `<p class="loc-group-kicker">${escapeHtml(group.kicker)}</p>`
        : "";
      const tiles = group.items
        .map((loc, index) => renderLocationTile(loc, group.id, group.id === "active" && index === 0))
        .join("");
      return `<div class="loc-group" data-group="${escapeHtml(group.id)}">
        <h3>${escapeHtml(group.label)}</h3>
        ${kicker}
        <div class="loc-grid">${tiles}</div>
      </div>`;
    })
    .join("");

  const items = locationItems(data);
  const show = (id) => {
    const loc = items.find((item) => item.id === id) || items[0];
    if (!detail || !loc) return;
    const groupId = loc.group || (loc.beyond ? "beyond" : "active");
    const pill = locationPill(loc, groupId);
    detail.innerHTML = `<strong>${escapeHtml(loc.name)}</strong> · ${escapeHtml(pill)}. ${escapeHtml(
      loc.note || ""
    )}`;
    mount.querySelectorAll(".loc-tile").forEach((btn) => {
      const on = btn.getAttribute("data-loc") === loc.id;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };

  mount.querySelectorAll(".loc-tile").forEach((btn) => {
    btn.addEventListener("click", () => show(btn.getAttribute("data-loc")));
  });
  if (items[0]) show(items[0].id);
}

function renderCloudflare(data) {
  const root = $("cf-body");
  if (!root) return;
  if (!data || data.ok === false) {
    root.innerHTML = `<p>Could not load Cloudflare Statuspage. <a href="https://www.cloudflarestatus.com/" rel="noopener">Check Cloudflare status</a> — not assuming all-clear.</p>`;
    return;
  }
  const tone = CF_TONE[data.indicator] || "unknown";
  const overall = CF_LABELS[data.indicator] || data.label || "Unknown";
  const comps = (data.components || [])
    .map((c) => {
      const cTone = CF_TONE[c.status] || "unknown";
      const cLabel = CF_LABELS[c.status] || c.status;
      return `<li><span>${escapeHtml(c.name)}</span> <span class="pill pill-${cTone}" aria-label="${escapeHtml(
        cLabel
      )}">${escapeHtml(cLabel)}</span></li>`;
    })
    .join("");
  const incidents = (data.incidents || [])
    .map((i) => `<p class="cf-incident">${escapeHtml(i.name)} (${escapeHtml(i.status)})</p>`)
    .join("");
  root.innerHTML = `
    <div class="cf-overall">
      <span class="pill pill-${tone}" aria-label="${escapeHtml(overall)}">${escapeHtml(overall)}</span>
      <span>${escapeHtml(data.description || data.label || "")}</span>
    </div>
    <ul class="cf-components">${comps}</ul>
    ${incidents}
    <p class="fine"><a href="https://www.cloudflarestatus.com/" rel="noopener">cloudflarestatus.com</a></p>
  `;
}

function unknownHealth() {
  return {
    ok: false,
    overall: { indicator: "unknown", label: "Status unknown" },
    components: [],
  };
}

async function refresh() {
  const stamp = $("refresh-stamp");
  const [healthRaw, cfRaw, locationsRaw] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/cloudflare"),
    fetchJson("/data/locations.json"),
  ]);

  const health = healthRaw && healthRaw.overall ? healthRaw : unknownHealth();
  if (!healthRaw.ok && !healthRaw.overall) {
    renderOverall(health.overall, "Health endpoint unavailable — not assuming all-clear.");
    renderComponents([], healthRaw.error);
  } else {
    renderOverall(health.overall, formatChecked(health.checkedAt));
    renderComponents(health.components, health.error);
  }

  renderCloudflare(cfRaw);
  if (
    locationsRaw &&
    (locationsRaw.locations || locationsRaw.winterExpansion || locationsRaw.headline)
  ) {
    renderLocations(locationsRaw);
  }
  if (stamp) stamp.textContent = formatChecked((health && health.checkedAt) || cfRaw.checkedAt);
}

function startBoard() {
  const button = $("refresh-now");
  if (button) {
    button.addEventListener("click", () => {
      button.disabled = true;
      refresh().finally(() => {
        button.disabled = false;
      });
    });
  }
  refresh();
  setInterval(refresh, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startBoard);
} else {
  startBoard();
}
