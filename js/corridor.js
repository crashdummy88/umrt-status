function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function hydrateCorridor() {
  const mount = document.getElementById("route-groups") || document.getElementById("route-grid");
  const headline = document.getElementById("route-headline");
  const lede = document.getElementById("route-lede");
  if (!mount) return;
  try {
    const res = await fetch("/data/locations.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (headline && data.headline) headline.textContent = data.headline;
    if (lede) {
      const active = Array.isArray(data.corridor) ? data.corridor.join(" · ") : "MT · WY · ID · WA";
      const winterCodes = ((data.winterExpansion && data.winterExpansion.locations) || [])
        .map((loc) => loc.code)
        .filter(Boolean)
        .join(" · ");
      const extra = winterCodes
        ? ` Winter expansion: <strong>${escapeHtml(winterCodes)}</strong>.`
        : "";
      lede.innerHTML = `<strong>${escapeHtml(active)}</strong> active corridor.${extra}`;
    }
    const groups = window.UMRTLocations
      ? window.UMRTLocations.groupsFrom(data)
      : [{ id: "active", label: "Active corridor", kicker: "", items: data.locations || [] }];
    mount.innerHTML = groups
      .map((group) => {
        const kicker = group.kicker
          ? `<p class="loc-group-kicker">${escapeHtml(group.kicker)}</p>`
          : "";
        const tiles = group.items
          .map((loc) => {
            const state = loc.state || "unknown";
            const tone = window.UMRTLocations ? window.UMRTLocations.tone(state) : "unknown";
            const pill = window.UMRTLocations ? window.UMRTLocations.pill(loc, group.id) : state;
            const title = loc.code || loc.name;
            const sub = loc.regions || loc.name || "";
            return `<article class="loc-tile loc-${tone}" data-loc="${escapeHtml(loc.id || "")}">
              <span class="loc-title">${escapeHtml(title)}</span>
              <span class="loc-sub">${escapeHtml(sub)}</span>
              <span class="pill pill-${tone}" aria-label="${escapeHtml(pill)}">${escapeHtml(pill)}</span>
              <p class="loc-note">${escapeHtml(loc.note || "")}</p>
            </article>`;
          })
          .join("");
        return `<div class="loc-group" data-group="${escapeHtml(group.id)}">
          <h3>${escapeHtml(group.label)}</h3>
          ${kicker}
          <div class="loc-grid">${tiles}</div>
        </div>`;
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
