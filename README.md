# umrt-status

Live Cloudflare Pages status board for **United Mobile RV LLC** — `status.unitedmobilerv.com`.

- Xbox-style overall banner + interactive network list + MT·WY·ID·WA corridor tiles + Cloudflare strip
- Tokens: black `#1A1A1A` · gold `#C9972C` · white · Inter/system fonts
- Prefer Text **(616) 606-5277** · Book CTAs → https://book.unitedmobilerv.com/
- Hours · Route · Announcements stay as their own pages
- Pages Functions: `GET /api/health` (edge probes, ~60s cache) and `GET /api/cloudflare` (Statuspage proxy)

## Edit corridor / location status (Matt)

Edit **`data/locations.json`** and merge to `main`. No redesign.

| Field | What to change |
| --- | --- |
| `updated` | Date you edited (`YYYY-MM-DD`) |
| `headline` | Line under “Location / corridor” on the home board |
| `locations[].state` | `open` · `limited` · `closed` · `seasonal` |
| `locations[].note` | Short customer-facing detail (shown when they tap the tile) |
| `beyond` | Optional off-corridor tile (`MI / WI / SD · MN / ND / OR`) |

The homepage and `/route/` both read this file. After deploy, CDN cache on `/data/locations.json` is ~60 seconds.

Do **not** invent Starlink certifications. Creds stay: Victron Professional Certified Installer · weBoost Authorized Installer · Peplink Certified Associate · Starlink installs only (never “Certified”).
