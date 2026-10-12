import type { KeywordIdea } from "@launchpilot/ports";
import { describeKeywordProviderContract } from "@launchpilot/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DataForSeoKeywordProvider } from "../../src";
import authFailed from "./recorded/auth-failed.json";
import insufficientFunds from "./recorded/insufficient-funds.json";
import keywordIdeas from "./recorded/keyword-ideas.json";
import serverError from "./recorded/server-error.json";
import taskError from "./recorded/task-error.json";

const BASE = "https://api.dataforseo.com";
const endpoint = `${BASE}/v3/dataforseo_labs/google/keyword_ideas/live`;
const LOGIN = "founder@acme.dev";
const PASSWORD = "dfs-recorded-password";

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
}));

const query = { seeds: ["privacy analytics"], locale: "en-US", limit: 3 };

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

  it("refuses a locale it cannot map without calling the API", async () => {
    expect(await provider().suggest({ ...query, locale: "xx-YY" })).toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Keyword data is not available for xx-YY",
        retryable: false,
      },
    });
  });

  it("uses a configured base URL", async () => {
    const other = "https://dataforseo.stub.test";
    server.use(
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
