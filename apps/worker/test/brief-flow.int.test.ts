import {
  createDatabase,
  createPostgresRepositories,
  ScryptPasswordHasher,
  SystemClock,
  UuidIdGenerator,
  RandomTokenGenerator,
} from "@nuvantre/adapters";
import { ExtractiveBriefDrafter } from "@nuvantre/agents";
import {
  ApproveBrief,
  CreateProduct,
  GenerateBrief,
  GetBrief,
  SignUp,
  UpdateBrief,
} from "@nuvantre/application";
import { FakeSiteCrawler } from "@nuvantre/testing";
import { afterAll, describe, expect, it } from "vitest";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const db = createDatabase(inject("databaseUrl"));
afterAll(async () => {
  await db.destroy();
});

const world = () => ({
  ...createPostgresRepositories(db),
  ids: new UuidIdGenerator(),
  clock: new SystemClock(),
  hasher: new ScryptPasswordHasher(),
  tokens: new RandomTokenGenerator(),
  crawler: new FakeSiteCrawler(),
  drafter: new ExtractiveBriefDrafter(),
});

describe("brief flow on Postgres", () => {
  it("drafts, edits and approves a brief that survives a reload", async () => {
    const deps = world();
    const signed = await new SignUp(deps).execute({
      email: `brief-${deps.ids.next()}@acme.dev`,
      password: "correct horse battery",
    });
    if (!signed.ok) throw new Error(signed.error.message);
    const { workspace, user } = signed.value;
    const product = await new CreateProduct(deps).execute({
      workspace,
      name: "Acme Analytics",
      url: "https://acme.dev",
    });
    if (!product.ok) throw new Error(product.error.message);
    deps.crawler.addSite(product.value.url, [
      {
        url: product.value.url,
        title: "Acme Analytics",
        text: "Privacy-friendly analytics for SaaS founders.\nStart a free 14-day trial.",
      },
    ]);
    const target = { workspace, productId: product.value.id };

    const generated = await new GenerateBrief(deps).execute(target);
    if (!generated.ok) throw new Error(generated.error.message);
    const edited = { ...generated.value.brief.content, audience: "Bootstrapped founders" };
    expect((await new UpdateBrief(deps).execute({ ...target, content: edited })).ok).toBe(true);
    const approved = await new ApproveBrief(deps).execute({
      ...target,
      actor: { kind: "founder", userId: user.id },
    });
    expect(approved.ok).toBe(true);

    const reloaded = await new GetBrief(world()).execute(target);
    expect(reloaded.ok && reloaded.value.brief).toMatchObject({
      id: generated.value.brief.id,
      version: 2,
      status: "approved",
      approval: { by: user.id },
      content: {
        audience: "Bootstrapped founders",
        facts: ["Start a free 14-day trial."],
      },
    });
  });
});
