// Zernio's public API changelog (GET /v1/changelog, no key), shaped after its SDK types.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assessZernioChange, fetchZernioChangelog, type ZernioChangelogEntry } from "../../src";
import page1 from "./recorded/changelog-page-1.json";
import page2 from "./recorded/changelog-page-2.json";

const BASE = "https://zernio.com/api";
const since = new Date("2026-10-05T00:00:00.000Z");

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const entry = (overrides: Partial<ZernioChangelogEntry> = {}): ZernioChangelogEntry => ({
  id: "chg_1",
  type: "improvement",
  impact: "none",
  platforms: [],
  message: "Faster uploads.",
  publishedAt: "2026-10-11T00:00:00.000Z",
  specVersion: null,
  url: "https://docs.zernio.com/changelog#chg_1",
  changes: {
    endpoints: { added: [], removed: [], modified: [] },
    schemas: { added: [], removed: [], modified: [] },
  },
  ...overrides,
});

const endpoints = (
  kind: "added" | "removed" | "modified",
  method: string,
  path: string,
): ZernioChangelogEntry["changes"] => ({
  endpoints: { added: [], removed: [], modified: [], [kind]: [{ method, path }] },
  schemas: { added: [], removed: [], modified: [] },
});

describe("fetchZernioChangelog", () => {
  it("reads every page published since the given time, without an API key", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${BASE}/v1/changelog`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        expect(request.headers.has("authorization")).toBe(false);
        return HttpResponse.json(url.searchParams.has("before") ? page2 : page1);
      }),
    );
    const result = await fetchZernioChangelog({ since });
    expect(result.ok && result.value.map((e) => e.id)).toEqual([
      "chg_posts_field_removed",
      "chg_tiktok_feature",
      "chg_linkedin_deprecation",
    ]);
    expect(requests[1]?.searchParams.get("before")).toBe(page1.nextCursor);
  });

  it("stops paging once entries are older than the window", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/changelog`, () => {
        calls += 1;
        return HttpResponse.json(page1);
      }),
    );
    const result = await fetchZernioChangelog({ since: new Date("2026-10-10T12:00:00.000Z") });
    expect(result.ok && result.value.map((e) => e.id)).toEqual(["chg_posts_field_removed"]);
    expect(calls).toBe(1);
  });

  it.each([
    ["an outage", () => HttpResponse.json({ error: "Down" }, { status: 503 }), "HTTP 503"],
    ["an unexpected format", () => HttpResponse.json({ items: [] }), "unexpected format"],
    ["no answer", () => HttpResponse.error(), "could not be reached"],
  ])("reports %s", async (_case, reply, message) => {
    server.use(http.get(`${BASE}/v1/changelog`, reply));
    const result = await fetchZernioChangelog({ since });
    expect(result.ok ? undefined : result.error).toContain(message);
  });
});

describe("assessZernioChange", () => {
  it.each([
    [
      "an endpoint we call was modified",
      entry({ changes: endpoints("modified", "POST", "/v1/posts") }),
      "Changes POST /v1/posts, which LaunchPilot calls",
    ],
    [
      "an endpoint we call was removed, even with an /api prefix",
      entry({ changes: endpoints("removed", "get", "/api/v1/accounts") }),
      "Removes GET /v1/accounts, which LaunchPilot calls",
    ],
    [
      "the connect endpoint we call changed",
      entry({ changes: endpoints("modified", "GET", "/v1/connect/{platform}") }),
      "Changes GET /v1/connect/{platform}, which LaunchPilot calls",
    ],
    [
      "a response schema we read was removed",
      entry({
        changes: {
          endpoints: { added: [], removed: [], modified: [] },
          schemas: { added: [], removed: ["SocialAccount"], modified: [] },
        },
      }),
      "Removes the SocialAccount schema, which LaunchPilot reads",
    ],
    [
      "action is required on X",
      entry({ impact: "action_required", platforms: ["x"] }),
      "Needs action on X",
    ],
    [
      "LinkedIn posting is deprecated",
      entry({ type: "deprecation", platforms: ["linkedin"] }),
      "Deprecates something on LinkedIn",
    ],
    [
      "a breaking change with no platform named",
      entry({ type: "breaking_change", impact: "action_required" }),
      "Breaking change for every integration",
    ],
  ])("flags an entry where %s", (_case, change, reason) => {
    expect(assessZernioChange(change)).toEqual({ affected: true, reasons: [reason] });
  });

  it.each([
    ["a new endpoint", entry({ changes: endpoints("added", "POST", "/v1/posts/bulk") })],
    [
      "a change to an endpoint we never call",
      entry({ changes: endpoints("removed", "GET", "/v1/analytics") }),
    ],
    [
      "action needed only on TikTok",
      entry({ impact: "action_required", type: "breaking_change", platforms: ["tiktok"] }),
    ],
    [
      "an additive schema change",
      entry({
        impact: "additive",
        changes: {
          endpoints: { added: [], removed: [], modified: [] },
          schemas: { added: [], removed: [], modified: ["Post"] },
        },
      }),
    ],
  ])("ignores %s", (_case, change) => {
    expect(assessZernioChange(change)).toEqual({ affected: false, reasons: [] });
  });

  it("lists every reason an entry matters", () => {
    expect(
      assessZernioChange(
        entry({
          impact: "action_required",
          type: "breaking_change",
          platforms: ["x", "linkedin"],
          changes: endpoints("modified", "POST", "/v1/posts"),
        }),
      ).reasons,
    ).toEqual([
      "Changes POST /v1/posts, which LaunchPilot calls",
      "Needs action on X",
      "Needs action on LinkedIn",
    ]);
  });
});
