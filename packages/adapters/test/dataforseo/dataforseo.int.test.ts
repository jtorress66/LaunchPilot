import type { KeywordIdea } from "@nuvantre/ports";
import { describeKeywordProviderContract } from "@nuvantre/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DataForSeoKeywordProvider } from "../../src";
import authFailed from "./recorded/auth-failed.json";
import insufficientFunds from "./recorded/insufficient-funds.json";
import keywordIdeas from "./recorded/keyword-ideas.json";
import locationsAndLanguages from "./recorded/locations-and-languages.json";
import serverError from "./recorded/server-error.json";
import taskError from "./recorded/task-error.json";

const BASE = "https://api.dataforseo.com";
const endpoint = `${BASE}/v3/dataforseo_labs/google/keyword_ideas/live`;
const LOGIN = "founder@acme.dev";
const PASSWORD = "dfs-recorded-password";

const listingEndpoint = `${BASE}/v3/dataforseo_labs/locations_and_languages`;
let listingRequests = 0;

/** DataForSEO Labs' market list; reset to this after every test. */
const server = setupServer(
  http.get(listingEndpoint, () => {
    listingRequests += 1;
    return HttpResponse.json(locationsAndLanguages);
  }),
);
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  listingRequests = 0;
});
afterAll(() => {
  server.close();
});

const provider = () => new DataForSeoKeywordProvider({ login: LOGIN, password: PASSWORD });

const respondWith = (body: JsonBodyType, status = 200) => {
  const captured: { body?: unknown; authorization?: string | null } = {};
  server.use(
    http.post(endpoint, async ({ request }) => {
      captured.body = await request.json();
      captured.authorization = request.headers.get("authorization");
      return HttpResponse.json(body, { status });
    }),
  );
  return captured;
};

/** The recorded envelope with the given ideas as its items. */
const withItems = (ideas: readonly KeywordIdea[]) => {
  const task = keywordIdeas.tasks[0];
  const result = task?.result[0];
  return {
    ...keywordIdeas,
    tasks: [
      {
        ...task,
        result: [
          {
            ...result,
            items: ideas.map((idea) => ({
              se_type: "google",
              keyword: idea.keyword,
              keyword_info: { search_volume: idea.monthlySearches },
              keyword_properties: { keyword_difficulty: idea.difficulty },
            })),
          },
        ],
      },
    ],
  };
};

describeKeywordProviderContract("DataForSeoKeywordProvider (recorded API)", () => ({
  provider: provider(),
  givenIdeas: (ideas) => {
    respondWith(withItems(ideas));
  },
  givenFailure: () => {
    respondWith(serverError, 500);
    return undefined;
  },
  unsupportedMarket: { language: "fr", market: "FR" },
}));

const query = {
  seeds: ["privacy analytics"],
  locale: { language: "en", market: "US" },
  limit: 3,
};

describe("DataForSeoKeywordProvider", () => {
  it("asks DataForSEO Labs for keyword ideas with Basic auth", async () => {
    const captured = respondWith(keywordIdeas);
    await provider().suggest(query);
    expect(captured.authorization).toBe(
      `Basic ${Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64")}`,
    );
    expect(captured.body).toEqual([
      {
        keywords: ["privacy analytics"],
        location_code: 2840,
        language_code: "en",
        limit: 3,
        include_seed_keyword: true,
      },
    ]);
  });

  it("maps search volume and difficulty, treating missing values as zero and the hardest", async () => {
    respondWith(keywordIdeas);
    expect(await provider().suggest(query)).toEqual({
      ok: true,
      value: [
        { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 14 },
        { keyword: "privacy friendly analytics", monthlySearches: 1300, difficulty: 41 },
        { keyword: "google analytics alternative", monthlySearches: 0, difficulty: 100 },
      ],
    });
  });

  it("never returns more ideas than asked for", async () => {
    respondWith(keywordIdeas);
    const result = await provider().suggest({ ...query, limit: 2 });
    expect(result.ok && result.value).toHaveLength(2);
  });

  it.each([
    ["an exhausted balance", insufficientFunds, 402, "quota_exceeded", false],
    ["rejected credentials", authFailed, 401, "invalid_request", false],
    ["a failed task inside a 200 response", taskError, 200, "invalid_request", false],
    ["a server error", serverError, 500, "unavailable", true],
  ] as const)("reports %s as %s", async (_case, body, status, code, retryable) => {
    respondWith(body, status);
    const result = await provider().suggest(query);
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(PASSWORD);
  });

  it("reports an unreachable API as unavailable", async () => {
    server.use(http.post(endpoint, () => HttpResponse.error()));
    expect(await provider().suggest(query)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("researches Brazilian Portuguese with Brazil's location and the Portuguese language", async () => {
    const captured = respondWith(keywordIdeas);
    await provider().suggest({ ...query, locale: { language: "pt", market: "BR" } });
    expect(captured.body).toMatchObject([{ location_code: 2076, language_code: "pt" }]);
  });

  it("says there is no keyword data for a market DataForSEO does not list, without asking for ideas", async () => {
    expect(
      await provider().suggest({ ...query, locale: { language: "fr", market: "FR" } }),
    ).toEqual({
      ok: false,
      error: {
        code: "unsupported_market",
        message: "DataForSEO has no keyword data for French (France)",
        retryable: false,
      },
    });
  });

  it("reads the market list once per provider", async () => {
    respondWith(keywordIdeas);
    const shared = provider();
    await shared.suggest(query);
    await shared.suggest(query);
    expect(listingRequests).toBe(1);
  });

  it("reports a market list it cannot read as unavailable, and asks again next time", async () => {
    const shared = provider();
    server.use(
      http.get(listingEndpoint, () => HttpResponse.json(serverError, { status: 500 }), {
        once: true,
      }),
    );
    expect(await shared.suggest(query)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
    respondWith(keywordIdeas);
    expect((await shared.suggest(query)).ok).toBe(true);
  });

  it("uses a configured base URL", async () => {
    const other = "https://dataforseo.stub.test";
    server.use(
      http.get(`${other}/v3/dataforseo_labs/locations_and_languages`, () =>
        HttpResponse.json(locationsAndLanguages),
      ),
      http.post(`${other}/v3/dataforseo_labs/google/keyword_ideas/live`, () =>
        HttpResponse.json(keywordIdeas),
      ),
    );
    const stubbed = new DataForSeoKeywordProvider({
      login: LOGIN,
      password: PASSWORD,
      baseUrl: other,
    });
    expect((await stubbed.suggest(query)).ok).toBe(true);
  });
});
