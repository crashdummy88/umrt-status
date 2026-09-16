import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyProbe, summarizeOverall, buildHealth, HOSTS } from "../functions/lib/health.js";
import { normalizeCloudflare, pickComponents, unavailableCloudflare } from "../functions/lib/cloudflare.js";

describe("classifyProbe", () => {
  it("marks self operational without a network call", () => {
    const result = classifyProbe({ self: true });
    assert.equal(result.state, "operational");
    assert.match(result.detail, /serving the health check/);
  });

  it("treats 2xx/3xx as operational", () => {
    assert.equal(classifyProbe({ status: 200 }).state, "operational");
    assert.equal(classifyProbe({ status: 301 }).state, "operational");
  });

  it("does not fake green on timeout or network failure", () => {
    assert.equal(classifyProbe({ error: "timeout" }).state, "unknown");
    assert.equal(classifyProbe({ error: "network" }).state, "unknown");
  });

  it("treats WAF/bot 401/403 as unknown, not down", () => {
    assert.equal(classifyProbe({ status: 403 }).state, "unknown");
    assert.match(classifyProbe({ status: 403 }).detail, /Protected/);
  });

  it("treats 5xx as major and other 4xx as degraded", () => {
    assert.equal(classifyProbe({ status: 502 }).state, "major");
    assert.equal(classifyProbe({ status: 404 }).state, "degraded");
  });
});

describe("summarizeOverall", () => {
  it("is green only when every component is operational", () => {
    const overall = summarizeOverall([
      { state: "operational" },
      { state: "operational" },
    ]);
    assert.equal(overall.indicator, "operational");
    assert.equal(overall.label, "All systems operational");
  });

  it("is unknown (not green) when every probe is unknown", () => {
    const overall = summarizeOverall([{ state: "unknown" }, { state: "unknown" }]);
    assert.equal(overall.indicator, "unknown");
    assert.equal(overall.label, "Status unknown");
  });

  it("is major when any component is major", () => {
    const overall = summarizeOverall([
      { state: "operational" },
      { state: "major" },
    ]);
    assert.equal(overall.indicator, "major");
    assert.equal(overall.label, "Major outage");
  });

  it("is partial for mixed degraded/unknown", () => {
    const overall = summarizeOverall([
      { state: "operational" },
      { state: "unknown" },
    ]);
    assert.equal(overall.indicator, "partial");
    assert.equal(overall.label, "Partial outage");
  });
});

describe("buildHealth", () => {
  it("lists the eight UMRT hosts and short-circuits self", async () => {
    const fetchImpl = async () => ({ status: 200, body: { cancel() {} } });
    const payload = await buildHealth({ fetchImpl, now: new Date("2026-09-16T12:00:00.000Z") });
    assert.equal(payload.ok, true);
    assert.equal(payload.components.length, HOSTS.length);
    assert.deepEqual(
      payload.components.map((c) => c.name),
      HOSTS.map((h) => h.name)
    );
    const self = payload.components.find((c) => c.id === "status");
    assert.equal(self.state, "operational");
    assert.equal(self.httpStatus, null);
    assert.equal(payload.overall.indicator, "operational");
  });

  it("stays honest when probes fail", async () => {
    const fetchImpl = async () => {
      throw new Error("network");
    };
    const payload = await buildHealth({ fetchImpl });
    const remote = payload.components.filter((c) => c.id !== "status");
    assert.ok(remote.every((c) => c.state === "unknown"));
    assert.equal(payload.overall.indicator, "partial");
  });
});

describe("cloudflare normalize", () => {
  it("picks Pages, Workers, and Authoritative DNS", () => {
    const picked = pickComponents({
      components: [
        { name: "Pages", status: "operational", group: false },
        { name: "Workers", status: "degraded_performance", group: false },
        { name: "Authoritative DNS", status: "operational", group: false },
        { name: "Workers AI", status: "major_outage", group: false },
      ],
    });
    assert.equal(picked.length, 3);
    assert.equal(picked[1].status, "degraded_performance");
  });

  it("maps Statuspage indicator to a customer label", () => {
    const body = normalizeCloudflare({
      status: { indicator: "minor", description: "Minor Service Outage" },
      components: [],
      incidents: [{ name: "Edge hiccup", status: "investigating", impact: "minor" }],
    });
    assert.equal(body.ok, true);
    assert.equal(body.indicator, "minor");
    assert.equal(body.label, "Cloudflare partial outage");
    assert.equal(body.incidents.length, 1);
  });

  it("returns an unknown fallback payload", () => {
    const body = unavailableCloudflare("nope");
    assert.equal(body.ok, false);
    assert.equal(body.indicator, "unknown");
    assert.equal(body.url, "https://www.cloudflarestatus.com/");
  });
});
