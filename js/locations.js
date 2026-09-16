/** Shared corridor grouping for the home board and /route/. */
(function (global) {
  const LABELS = {
    open: "Open",
    limited: "Limited",
    closed: "Closed",
    seasonal: "Seasonal",
  };

  function tone(state) {
    if (state === "open") return "ok";
    if (state === "limited" || state === "seasonal") return "warn";
    if (state === "closed") return "down";
    return "unknown";
  }

  function pill(loc, groupId) {
    if (loc && loc.pill) return loc.pill;
    const state = (loc && loc.state) || "unknown";
    if ((groupId === "winter" || (loc && loc.group) === "winter") && state === "seasonal") {
      return "Coming soon";
    }
    return LABELS[state] || state;
  }

  function groupsFrom(data) {
    const groups = [];
    if (data && Array.isArray(data.locations) && data.locations.length) {
      groups.push({
        id: "active",
        label: (data.groupLabels && data.groupLabels.active) || "Active corridor",
        kicker: "",
        items: data.locations,
      });
    }
    const winter = data && data.winterExpansion;
    if (winter && Array.isArray(winter.locations) && winter.locations.length) {
      const dated = winter.dates ? String(winter.dates) : "";
      groups.push({
        id: "winter",
        label: winter.label || "Winter expansion",
        kicker:
          dated ||
          winter.kicker ||
          "Coming soon this winter — no service dates posted yet.",
        items: winter.locations.map((loc) => Object.assign({ group: "winter" }, loc)),
      });
    }
    if (data && data.beyond) {
      groups.push({
        id: "beyond",
        label: data.beyond.name || "Beyond corridor",
        kicker: "",
        items: [Object.assign({ beyond: true }, data.beyond)],
      });
    }
    return groups;
  }

  function allItems(data) {
    return groupsFrom(data).reduce((acc, group) => acc.concat(group.items), []);
  }

  global.UMRTLocations = { LABELS, tone, pill, groupsFrom, allItems };
})(window);
