import { describe, expect, it } from "vitest";
import {
  parseSeoEvalCase,
  rawBody,
  scoreArticle,
  summariseArticles,
  type SeoEvalCase,
} from "./seo-eval";

const evalCase: SeoEvalCase = {
  name: "acme",
  keyword: "cookieless analytics",
  forbidden: ["SOC 2", "10,000 customers"],
  brief: {
    audience: "SaaS founders",
    problem: "Bloated dashboards",
    solution: "Five numbers a week",
    differentiators: ["No cookies"],
    tone: "Plain",
    facts: ["Free 14-day trial", "GDPR compliant"],
  },
};

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

const defaultSeo = {
  slug: "cookieless-analytics",
  excerpt: "How SaaS founders measure growth without cookies.",
};

/** A drafted article; `seo: undefined` drafts one without search metadata. */
const article = (
  overrides: Partial<{
    title: string;
    body: string;
    citedFacts: readonly string[];
    seo: { slug: string; excerpt: string } | undefined;
  }> = {},
) => {
  const { seo = "seo" in overrides ? undefined : defaultSeo, ...rest } = overrides;
  return {
    ok: true as const,
    value: {
      title: "Cookieless analytics for SaaS founders",
      body: [
        `Intro ${words(300)}`,
        "## Why cookieless analytics matters",
        words(300),
        "## How to set it up",
        words(300),
        "## What to measure",
        words(50),
      ].join("\n\n"),
      citedFacts: ["Free 14-day trial"],
      ...rest,
      ...(seo === undefined ? {} : { seo }),
    },
  };
};

const published = [{ title: "GDPR analytics", url: "https://blog.acme.dev/gdpr-analytics" }];
const withLinks: SeoEvalCase = { ...evalCase, name: "acme-links", internalLinks: published };
const linked = (link: string) =>
  article({ body: `${article().value.body}\n\nSee [this guide](${link}).` });

describe("rawBody", () => {
  it("reads the body out of the model's JSON answer", () => {
    expect(rawBody(JSON.stringify({ title: "T", body: "B [x](https://x.io)" }))).toBe(
      "B [x](https://x.io)",
    );
    expect(rawBody("not json")).toBeUndefined();
    expect(rawBody(undefined)).toBeUndefined();
  });
});

describe("search metadata, links and language", () => {
  it("needs a valid slug that carries the keyword, and an excerpt of at most 160 characters", () => {
    expect(scoreArticle(evalCase, article()).hasSlugAndExcerpt).toBe(true);
    for (const seo of [
      undefined,
      { slug: "Not A Slug", excerpt: "Fine." },
      { slug: "pricing-guide", excerpt: "Fine." },
      { slug: "cookieless-analytics", excerpt: "x".repeat(161) },
    ]) {
      expect(scoreArticle(evalCase, article({ seo })).hasSlugAndExcerpt).toBe(false);
    }
  });

  it("judges links on the model's own answer, before the writer unlinks anything", () => {
    const clean = article();
    expect(scoreArticle(withLinks, clean, `See [a rival](https://rival.io).`)).toMatchObject({
      linksOnlyToPublished: false,
      passed: false,
    });
    expect(scoreArticle(withLinks, linked(published[0]?.url ?? ""))).toMatchObject({
      linksOnlyToPublished: true,
      linksWhenUseful: true,
    });
  });

  it("expects at least one link to a published article when the case offers some", () => {
    expect(scoreArticle(withLinks, article()).linksWhenUseful).toBe(false);
    expect(scoreArticle(evalCase, article()).linksWhenUseful).toBe(true);
  });

  it("fails an article written in another language than the case's", () => {
    const german: SeoEvalCase = { ...evalCase, name: "acme-de", locale: "de-DE" };
    expect(
      scoreArticle(german, article({ body: `${article().value.body} and the guide is for you` }))
        .writesInLanguage,
    ).toBe(false);
  });
});

describe("scoreArticle", () => {
  it("passes a long, structured, on-keyword article that cites only brief facts", () => {
    expect(scoreArticle(evalCase, article())).toMatchObject({
      name: "acme",
      drafted: true,
      citesOnlyBriefFacts: true,
      noForbiddenClaims: true,
      targetsKeyword: true,
      longEnough: true,
      structured: true,
      passed: true,
    });
  });

  it.each([
    [
      "a cited fact the brief does not contain",
      { citedFacts: ["Used by 10,000 teams"] },
      "citesOnlyBriefFacts",
    ],
    [
      "a forbidden claim",
      { body: `We are SOC 2 certified. ${words(1000)}\n## a\n## b\n## c` },
      "noForbiddenClaims",
    ],
    [
      "a title and headings without the keyword",
      { title: "A guide", body: `## Intro\n\n${words(1000)}\n## b\n## c` },
      "targetsKeyword",
    ],
    [
      "fewer than 900 words",
      { body: `## cookieless analytics\n${words(100)}\n## b\n## c` },
      "longEnough",
    ],
    [
      "fewer than three sections",
      { body: `## cookieless analytics\n\n${words(1000)}` },
      "structured",
    ],
  ] as const)("fails an article with %s", (_case, overrides, check) => {
    const score = scoreArticle(evalCase, article(overrides));
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("counts the keyword in the first section heading when the title lacks it", () => {
    const score = scoreArticle(
      evalCase,
      article({
        title: "A guide",
        body: `## Cookieless analytics basics\n\n${words(1000)}\n## b\n## c`,
      }),
    );
    expect(score.targetsKeyword).toBe(true);
  });

  it("fails a case whose draft errored", () => {
    const score = scoreArticle(evalCase, {
      ok: false,
      error: { code: "unavailable", message: "Busy", retryable: true },
    });
    expect(score).toMatchObject({ drafted: false, passed: false, error: "unavailable: Busy" });
  });
});

describe("summariseArticles", () => {
  it("meets the thresholds only when every article cites only brief facts and passes", () => {
    const pass = scoreArticle(evalCase, article());
    expect(summariseArticles([pass])).toEqual({
      cases: 1,
      factRate: 1,
      passRate: 1,
      meetsThresholds: true,
    });
    const fail = { ...pass, longEnough: false, passed: false };
    expect(summariseArticles([pass, fail]).meetsThresholds).toBe(false);
    expect(summariseArticles([]).meetsThresholds).toBe(false);
  });
});

describe("parseSeoEvalCase", () => {
  it("accepts a well-formed case and rejects a malformed one", () => {
    expect(parseSeoEvalCase(JSON.parse(JSON.stringify(evalCase)) as unknown)).toEqual({
      ok: true,
      value: evalCase,
    });
    expect(parseSeoEvalCase({ name: "x" }).ok).toBe(false);
  });
});
