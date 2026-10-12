import { productId, type BriefContent, type Product, type Workspace } from "@launchpilot/domain";
import { describe, expect, it } from "vitest";
import {
  ApproveBrief,
  CreateProduct,
  GenerateBrief,
  GetBrief,
  GetDashboard,
  UpdateBrief,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

const pages = [
  { url: "https://acme.dev/", title: "Acme", text: "Analytics for SaaS founders.\nMore." },
  { url: "https://acme.dev/pricing", title: "Pricing", text: "Free 14-day trial." },
];

/** A signed-up founder with one product whose site the fake crawler can read. */
const withProduct = async (world: World = makeWorld()) => {
  const { workspace, user } = await signedUp(world);
  const created = await new CreateProduct(world).execute({
    workspace,
    name: "Acme Analytics",
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  world.crawler.addSite(created.value.url, pages);
  return { world, workspace, user, product: created.value };
};

const generate = async (world: World, workspace: Workspace, product: Product) => {
  const result = await new GenerateBrief(world).execute({ workspace, productId: product.id });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const edited: BriefContent = {
  audience: "Bootstrapped SaaS founders",
  problem: "Analytics tools are bloated",
  solution: "Five numbers in a weekly email",
  differentiators: ["No cookies"],
  tone: "Plain",
  facts: ["Free 14-day trial."],
};

describe("GenerateBrief", () => {
  it("drafts a brief from the product's crawled site", async () => {
    const { world, workspace, product } = await withProduct();
    const { brief, droppedClaims } = await generate(world, workspace, product);
    expect(brief).toMatchObject({
      productId: product.id,
      status: "draft",
      version: 1,
      content: { facts: ["Analytics for SaaS founders.", "Free 14-day trial."] },
    });
    expect(droppedClaims).toEqual([]);
    expect(world.drafter.requests[0]).toMatchObject({
      productName: "Acme Analytics",
      site: { url: product.url, pages },
    });
    expect(await world.briefs.findLatestForProduct(product.id)).toEqual(brief);
  });

  it("reports the claims the drafter dropped", async () => {
    const { world, workspace, product } = await withProduct();
    world.drafter.respondWith({
      content: edited,
      evidence: [{ statement: "Free 14-day trial.", quote: "Free 14-day trial." }],
      droppedClaims: ["Used by 10,000 teams"],
    });
    expect((await generate(world, workspace, product)).droppedClaims).toEqual([
      "Used by 10,000 teams",
    ]);
  });

  it("redrafting revises the existing brief instead of creating another", async () => {
    const { world, workspace, product } = await withProduct();
    const first = await generate(world, workspace, product);
    const second = await generate(world, workspace, product);
    expect(second.brief).toMatchObject({ id: first.brief.id, version: 2, status: "draft" });
  });

  it("does not draft for a product in another workspace", async () => {
    const { world, product } = await withProduct();
    const { workspace: other } = await signedUp(world, "other@acme.dev");
    const result = await new GenerateBrief(world).execute({
      workspace: other,
      productId: product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });

  it("reports a product that does not exist", async () => {
    const { world, workspace } = await withProduct();
    const result = await new GenerateBrief(world).execute({
      workspace,
      productId: productId("missing"),
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });

  it("reports a site that cannot be crawled, with the crawler's explanation", async () => {
    const { world, workspace, product } = await withProduct();
    world.crawler.makeUnreachable(product.url);
    const result = await new GenerateBrief(world).execute({ workspace, productId: product.id });
    expect(result).toEqual({
      ok: false,
      error: { code: "crawl_failed", message: `${product.url} could not be reached` },
    });
  });

  it("passes a drafting failure through so the caller can tell if retrying helps", async () => {
    const { world, workspace, product } = await withProduct();
    const error = { code: "rate_limited", message: "Slow down", retryable: true } as const;
    world.drafter.failNext(error);
    const result = await new GenerateBrief(world).execute({ workspace, productId: product.id });
    expect(result).toEqual({ ok: false, error });
    expect(await world.briefs.findLatestForProduct(product.id)).toBeUndefined();
  });
});

describe("GetBrief", () => {
  it("returns the product with no brief before one is drafted", async () => {
    const { world, workspace, product } = await withProduct();
    expect(await new GetBrief(world).execute({ workspace, productId: product.id })).toEqual({
      ok: true,
      value: { product, brief: undefined },
    });
  });

  it("returns the latest brief once drafted", async () => {
    const { world, workspace, product } = await withProduct();
    const { brief } = await generate(world, workspace, product);
    const result = await new GetBrief(world).execute({ workspace, productId: product.id });
    expect(result.ok && result.value.brief).toEqual(brief);
  });

  it("hides another workspace's product", async () => {
    const { world, product } = await withProduct();
    const { workspace: other } = await signedUp(world, "other@acme.dev");
    const result = await new GetBrief(world).execute({ workspace: other, productId: product.id });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("UpdateBrief", () => {
  it("saves the founder's edits as a new draft version", async () => {
    const { world, workspace, product } = await withProduct();
    await generate(world, workspace, product);
    const result = await new UpdateBrief(world).execute({
      workspace,
      productId: product.id,
      content: edited,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { version: 2, status: "draft", content: edited },
    });
    expect((await world.briefs.findLatestForProduct(product.id))?.content).toEqual(edited);
  });

  it("returns an approved brief to draft when it is edited", async () => {
    const { world, workspace, user, product } = await withProduct();
    await generate(world, workspace, product);
    await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
    const result = await new UpdateBrief(world).execute({
      workspace,
      productId: product.id,
      content: edited,
    });
    expect(result.ok && result.value.status).toBe("draft");
  });

  it("rejects invalid edits without saving them", async () => {
    const { world, workspace, product } = await withProduct();
    const { brief } = await generate(world, workspace, product);
    const result = await new UpdateBrief(world).execute({
      workspace,
      productId: product.id,
      content: { ...edited, audience: " " },
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    expect(await world.briefs.findLatestForProduct(product.id)).toEqual(brief);
  });

  it("reports a product without a brief", async () => {
    const { world, workspace, product } = await withProduct();
    const result = await new UpdateBrief(world).execute({
      workspace,
      productId: product.id,
      content: edited,
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_found");
  });
});

describe("ApproveBrief", () => {
  it("records the founder's approval", async () => {
    const { world, workspace, user, product } = await withProduct();
    await generate(world, workspace, product);
    const result = await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { status: "approved", approval: { by: user.id, at: world.clock.now() } },
    });
    expect((await world.briefs.findLatestForProduct(product.id))?.status).toBe("approved");
  });

  it("never lets an agent approve", async () => {
    const { world, workspace, product } = await withProduct();
    await generate(world, workspace, product);
    const result = await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "agent", agent: "brief" },
    });
    expect(result.ok ? undefined : result.error.code).toBe("approval_requires_founder");
  });

  it("needs at least one fact", async () => {
    const { world, workspace, user, product } = await withProduct();
    await generate(world, workspace, product);
    await new UpdateBrief(world).execute({
      workspace,
      productId: product.id,
      content: { ...edited, facts: [] },
    });
    const result = await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_has_no_facts");
  });

  it("reports a product without a brief", async () => {
    const { world, workspace, user, product } = await withProduct();
    const result = await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_found");
  });
});

describe("GetDashboard brief status", () => {
  it("shows whether each product's brief is missing, a draft or approved", async () => {
    const { world, workspace, user, product } = await withProduct();
    const status = async () =>
      (await new GetDashboard(world).execute(workspace)).briefStatus[product.id];
    expect(await status()).toBe("none");
    await generate(world, workspace, product);
    expect(await status()).toBe("draft");
    await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
    expect(await status()).toBe("approved");
  });
});
