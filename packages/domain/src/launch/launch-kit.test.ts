import { describe, expect, it } from "vitest";
import { launchKitId, productId, userId } from "../shared/ids";
import {
  approveLaunchKit,
  createLaunchKit,
  editLaunchKit,
  listingLimits,
  type Listing,
} from "./launch-kit";

const t0 = new Date("2026-10-15T09:00:00.000Z");
const t1 = new Date("2026-10-15T10:00:00.000Z");
const founder = { kind: "founder" as const, userId: userId("user_founder") };

const aListing = (overrides: Partial<Listing> = {}): Listing => ({
  name: "Acme Analytics",
  tagline: "Privacy-friendly analytics in one weekly email",
  shortDescription: "Five numbers that matter, without cookies or dashboards.",
  longDescription: "Acme sends founders the five numbers that matter every Monday.",
  features: ["No cookies", "Setup in two minutes", "Weekly email"],
  categories: ["Analytics", "SaaS"],
  makerComment: "Hi everyone! We built Acme because dashboards were eating our week.",
  ...overrides,
});

const kit = (listing: Listing = aListing()) => {
  const result = createLaunchKit({
    id: launchKitId("kit_1"),
    productId: productId("prod_1"),
    listing,
    now: t0,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("launch kit", () => {
  it("starts as an unapproved first version with trimmed fields", () => {
    expect(kit(aListing({ tagline: "  Privacy-friendly analytics  " }))).toEqual({
      id: "kit_1",
      productId: "prod_1",
      version: 1,
      status: "draft",
      listing: aListing({ tagline: "Privacy-friendly analytics" }),
      approval: null,
      updatedAt: t0,
    });
  });

  it("keeps listing limits in one table", () => {
    expect(listingLimits).toMatchObject({
      name: 60,
      tagline: 60,
      shortDescription: 160,
      longDescription: 1000,
      makerComment: 1000,
    });
  });

  it.each([
    [
      "a tagline over 60 characters",
      { tagline: "a".repeat(61) },
      "Tagline must be at most 60 characters",
    ],
    ["an empty name", { name: " " }, "Name must not be empty"],
    ["fewer than 3 features", { features: ["One", "Two"] }, "List 3 to 6 key features"],
    [
      "more than 6 features",
      { features: ["1", "2", "3", "4", "5", "6", "7"] },
      "List 3 to 6 key features",
    ],
    ["no categories", { categories: [] }, "List 1 to 3 categories"],
    ["more than 3 categories", { categories: ["a", "b", "c", "d"] }, "List 1 to 3 categories"],
    [
      "a feature over 120 characters",
      { features: ["a".repeat(121), "b", "c"] },
      "Feature must be at most 120 characters",
    ],
  ])("refuses %s", (_case, overrides, message) => {
    const result = createLaunchKit({
      id: launchKitId("kit_1"),
      productId: productId("prod_1"),
      listing: aListing(overrides),
      now: t0,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_text", message } });
  });

  it("is approved by the founder only", () => {
    expect(approveLaunchKit(kit(), founder, { now: t1 })).toMatchObject({
      ok: true,
      value: { status: "approved", approval: { by: "user_founder", at: t1 }, updatedAt: t1 },
    });
    expect(approveLaunchKit(kit(), { kind: "agent", agent: "launch" }, { now: t1 })).toMatchObject({
      ok: false,
      error: { code: "approval_requires_founder" },
    });
  });

  it("cannot be approved twice", () => {
    const approved = approveLaunchKit(kit(), founder, { now: t1 });
    if (!approved.ok) throw new Error("not approved");
    expect(approveLaunchKit(approved.value, founder, { now: t1 }).ok).toBe(false);
  });

  it("goes back for approval as a new version whenever it is edited", () => {
    const approved = approveLaunchKit(kit(), founder, { now: t1 });
    if (!approved.ok) throw new Error("not approved");
    const edited = editLaunchKit(
      approved.value,
      aListing({ tagline: "Analytics, minus the noise" }),
      {
        now: t1,
      },
    );
    expect(edited).toMatchObject({
      ok: true,
      value: {
        status: "draft",
        version: 2,
        approval: null,
        listing: { tagline: "Analytics, minus the noise" },
      },
    });
  });

  it("refuses an invalid edit", () => {
    expect(editLaunchKit(kit(), aListing({ tagline: "" }), { now: t1 }).ok).toBe(false);
  });
});
