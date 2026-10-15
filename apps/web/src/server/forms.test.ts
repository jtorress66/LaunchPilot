import { describe, expect, it } from "vitest";
import {
  articleForm,
  launchKitForm,
  liveForm,
  parseDirectoryFilter,
  rejectForm,
  blogConnectionForm,
  briefForm,
  parseForm,
  postForm,
  productForm,
  scheduleForm,
  seedKeywordsForm,
  signUpForm,
  upgradeForm,
} from "./forms";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("form parsing", () => {
  it("returns typed values for a valid sign-up form", () => {
    expect(
      parseForm(signUpForm, form({ email: "founder@acme.dev", password: "correct horse" })),
    ).toEqual({
      ok: true,
      value: { email: "founder@acme.dev", password: "correct horse" },
    });
  });

  it("returns a friendly message per field", () => {
    expect(parseForm(signUpForm, form({ email: "", password: "" }))).toEqual({
      ok: false,
      error: { email: "Enter your email address", password: "Enter a password" },
    });
  });

  it("caps field lengths so huge inputs never reach the database", () => {
    const result = parseForm(productForm, form({ name: "x".repeat(101), url: "https://acme.dev" }));
    expect(result).toEqual({ ok: false, error: { name: "Use at most 100 characters" } });
  });

  it("accepts only paid plans for an upgrade", () => {
    expect(parseForm(upgradeForm, form({ plan: "growth" }))).toEqual({
      ok: true,
      value: { plan: "growth" },
    });
    expect(parseForm(upgradeForm, form({ plan: "free" })).ok).toBe(false);
  });

  it("treats a missing field like an empty one", () => {
    expect(parseForm(productForm, form({ url: "https://acme.dev" }))).toEqual({
      ok: false,
      error: { name: "Enter a product name" },
    });
  });

  it("reads a brief, one list item per line, dropping blank lines", () => {
    const result = parseForm(
      briefForm,
      form({
        audience: " Solo founders ",
        problem: "No time for marketing",
        solution: "An AI marketing team",
        tone: "Direct",
        differentiators: "Approval first\r\n\n  Weekly loop  \n",
        facts: "Free 14-day trial\n",
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        audience: " Solo founders ",
        problem: "No time for marketing",
        solution: "An AI marketing team",
        tone: "Direct",
        differentiators: ["Approval first", "Weekly loop"],
        facts: ["Free 14-day trial"],
      },
    });
  });

  it("accepts a brief with no facts so the founder can save work in progress", () => {
    const result = parseForm(
      briefForm,
      form({ audience: "a", problem: "b", solution: "c", tone: "d" }),
    );
    expect(result.ok && result.value.facts).toEqual([]);
  });

  it("caps brief fields, list items and list length", () => {
    const base = { audience: "a", problem: "b", solution: "c", tone: "d" };
    expect(parseForm(briefForm, form({ ...base, audience: "x".repeat(2001) }))).toEqual({
      ok: false,
      error: { audience: "Use at most 2000 characters" },
    });
    expect(parseForm(briefForm, form({ ...base, facts: "x".repeat(501) }))).toEqual({
      ok: false,
      error: { facts: "Keep each line under 500 characters" },
    });
    const many = Array.from({ length: 21 }, (_, i) => `Fact ${i}`).join("\n");
    expect(parseForm(briefForm, form({ ...base, facts: many }))).toEqual({
      ok: false,
      error: { facts: "Use at most 20 lines" },
    });
  });

  it("reads a WordPress connection, requiring every field", () => {
    expect(
      parseForm(
        blogConnectionForm,
        form({ siteUrl: "https://blog.acme.dev", username: "admin", secret: "abcd efgh" }),
      ),
    ).toEqual({
      ok: true,
      value: { siteUrl: "https://blog.acme.dev", username: "admin", secret: "abcd efgh" },
    });
    expect(parseForm(blogConnectionForm, form({}))).toEqual({
      ok: false,
      error: {
        siteUrl: "Enter your blog's address",
        username: "Enter your WordPress username",
        secret: "Enter an Application Password",
      },
    });
  });

  it("reads one to five seed topics, one per line", () => {
    expect(parseForm(seedKeywordsForm, form({ seeds: "privacy analytics\n\n gdpr \n" }))).toEqual({
      ok: true,
      value: { seeds: ["privacy analytics", "gdpr"] },
    });
    expect(parseForm(seedKeywordsForm, form({ seeds: " " }))).toEqual({
      ok: false,
      error: { seeds: "Enter at least one topic" },
    });
    expect(parseForm(seedKeywordsForm, form({ seeds: "a\nb\nc\nd\ne\nf" }))).toEqual({
      ok: false,
      error: { seeds: "Use at most 5 lines" },
    });
    expect(parseForm(seedKeywordsForm, form({ seeds: "x".repeat(81) }))).toEqual({
      ok: false,
      error: { seeds: "Keep each line under 80 characters" },
    });
  });

  it("reads an article edit with a capped title and body", () => {
    expect(parseForm(articleForm, form({ title: "Title", body: "Body" }))).toEqual({
      ok: true,
      value: { title: "Title", body: "Body" },
    });
    expect(parseForm(articleForm, form({ title: "x".repeat(201), body: "b" }))).toEqual({
      ok: false,
      error: { title: "Use at most 200 characters" },
    });
  });
});

describe("post and schedule forms", () => {
  it("accepts post text up to LinkedIn's limit; the domain enforces each channel's own", () => {
    expect(parseForm(postForm, form({ body: "Hello" }))).toEqual({
      ok: true,
      value: { body: "Hello" },
    });
    expect(parseForm(postForm, form({ body: " " }))).toEqual({
      ok: false,
      error: { body: "The post needs text" },
    });
    expect(parseForm(postForm, form({ body: "a".repeat(3001) })).ok).toBe(false);
  });

  it("turns the founder's local date and time into UTC using their timezone offset", () => {
    // getTimezoneOffset() is 300 in New York in winter (UTC-5).
    expect(
      parseForm(scheduleForm, form({ publishAt: "2026-12-01T09:30", tzOffset: "300" })),
    ).toEqual({ ok: true, value: { publishAt: new Date("2026-12-01T14:30:00.000Z") } });
    expect(
      parseForm(scheduleForm, form({ publishAt: "2026-12-01T09:30", tzOffset: "-60" })),
    ).toEqual({ ok: true, value: { publishAt: new Date("2026-12-01T08:30:00.000Z") } });
  });

  it.each([
    [{ publishAt: "", tzOffset: "0" }, "publishAt", "Choose a date and time"],
    [{ publishAt: "tomorrow", tzOffset: "0" }, "publishAt", "Choose a date and time"],
    [{ publishAt: "2026-12-01T09:30", tzOffset: "abc" }, "tzOffset", "Unknown timezone"],
    [{ publishAt: "2026-12-01T09:30", tzOffset: "9999" }, "tzOffset", "Unknown timezone"],
  ])("refuses %o", (entries, field, message) => {
    expect(parseForm(scheduleForm, form(entries))).toEqual({
      ok: false,
      error: { [field]: message },
    });
  });
});

describe("launch forms", () => {
  const kit = {
    name: "Acme Analytics",
    tagline: "Analytics in one weekly email",
    shortDescription: "Five numbers, every Monday.",
    longDescription: "Acme sends five numbers.",
    features: "No cookies\n\nSetup in two minutes\nWeekly email",
    categories: "Analytics\nSaaS",
    makerComment: "Hi everyone!",
  };

  it("reads the kit editor, one feature or category per line", () => {
    expect(parseForm(launchKitForm, form(kit))).toEqual({
      ok: true,
      value: {
        ...kit,
        features: ["No cookies", "Setup in two minutes", "Weekly email"],
        categories: ["Analytics", "SaaS"],
      },
    });
  });

  it("names the field that is too long", () => {
    expect(parseForm(launchKitForm, form({ ...kit, tagline: "a".repeat(61) }))).toEqual({
      ok: false,
      error: { tagline: "Use at most 60 characters" },
    });
  });

  it("needs a listing URL to mark a submission live and a reason to reject it", () => {
    expect(parseForm(liveForm, form({ listingUrl: " " }))).toEqual({
      ok: false,
      error: { listingUrl: "Paste the address of your listing" },
    });
    expect(parseForm(rejectForm, form({ reason: "" }))).toEqual({
      ok: false,
      error: { reason: "Say why it was rejected" },
    });
  });

  it("reads directory filters from the query string, free by default", () => {
    expect(parseDirectoryFilter({})).toEqual({ pricing: "free" });
    expect(parseDirectoryFilter({ kind: "community", pricing: "all", topic: "ai" })).toEqual({
      kind: "community",
      topic: "ai",
    });
    expect(parseDirectoryFilter({ kind: "nonsense", pricing: "paid" })).toEqual({
      pricing: "paid",
    });
  });
});
