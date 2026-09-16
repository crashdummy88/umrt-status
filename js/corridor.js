function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LABELS = { open: "Open", limited: "Limited", closed: "Closed", seasonal: "Seasonal" };
const TONE = { open: "ok", limited: "warn", closed: "down", seasonal: "warn" };

async function hydrateCorridor() {
  const grid = document.getElementById("route-grid");
  const headline = document.getElementById("route-headline");
  const lede = document.getElementById("route-lede");
  if (!grid) return;
  try {
    const res = await fetch("/data/locations.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (headline && data.headline) headline.textContent = data.headline;
    if (lede && Array.isArray(data.corridor)) {
      const extra = data.beyond && data.beyond.regions ? ` ${data.beyond.regions} case-by-case.` : "";
      lede.innerHTML = `<strong>${escapeHtml(data.corridor.join(" · "))}</strong> corridor.${extra}`;
    }
    const items = (data.locations || []).concat(data.beyond ? [data.beyond] : []);
    grid.innerHTML = items
      .map((loc) => {
        const state = loc.state || "unknown";
        const tone = TONE[state] || "unknown";
        const pill = LABELS[state] || state;
        const title = loc.code || loc.name;
        const sub = loc.regions || loc.name || "";
        return `<article class="loc-tile loc-${tone}">
          <span class="loc-title">${escapeHtml(title)}</span>
          <span class="loc-sub">${escapeHtml(sub)}</span>
          <span class="pill pill-${tone}" aria-label="${escapeHtml(pill)}">${escapeHtml(pill)}</span>
          <p class="loc-note">${escapeHtml(loc.note || "")}</p>
        </article>`;
      })
      .join("");
  } catch {
    /* keep static fallback already in the page */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrateCorridor);
} else {
  hydrateCorridor();
}
