import { contentItemId, type ContentItemStatus } from "@nuvantre/domain";
import { aContentItem } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { CreateProduct, RejectContentItem } from "../src";
import { makeWorld, ownerAccess, signedUp } from "./world";

const setUp = async () => {
  const world = makeWorld();
  const { workspace, user } = await signedUp(world);
  const created = await new CreateProduct(world).execute({
    workspace,
    name: "Acme",
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  const access = ownerAccess(workspace);
  const save = async (status: ContentItemStatus, id = "item_1") => {
    const item = aContentItem({ id: contentItemId(id), productId: created.value.id, status });
    await world.contentItems.save(item);
    return item;
  };
  const reject = (itemId: string, reason = "Not our audience") =>
    new RejectContentItem(world).execute({ access, itemId: contentItemId(itemId), reason });
  return { world, workspace, user, access, product: created.value, save, reject };
};

describe("RejectContentItem", () => {
  it("rejects an article waiting for approval, with the founder's reason", async () => {
    const s = await setUp();
    await s.save("in_review");
    const result = await s.reject("item_1");
    expect(result).toMatchObject({
      ok: true,
      value: {
        status: "rejected",
        rejection: {
          by: { kind: "founder", userId: s.user.id },
          reason: "Not our audience",
        },
      },
    });
    expect(await s.world.contentItems.findById(contentItemId("item_1"))).toMatchObject({
      status: "rejected",
    });
  });

  it.each(["draft", "approved"] as const)("can reject an article that is %s", async (status) => {
    const s = await setUp();
    await s.save(status);
    expect(await s.reject("item_1")).toMatchObject({
      ok: true,
      value: { status: "rejected", approval: null },
    });
  });

  it("stores 'No reason given' when the founder leaves the reason blank", async () => {
    const s = await setUp();
    await s.save("in_review");
    expect(await s.reject("item_1", "   ")).toMatchObject({
      ok: true,
      value: { rejection: { reason: "No reason given" } },
    });
  });

  it("records the rejection in the Activity log", async () => {
    const s = await setUp();
    const item = await s.save("in_review");
    await s.reject("item_1");
    expect(s.world.audit.entries.at(-1)).toMatchObject({
      workspaceId: s.workspace.id,
      actor: { kind: "founder", userId: s.user.id },
      action: "content_rejected",
      subject: { kind: "content", id: item.id, label: item.title },
    });
  });

  it.each(["scheduled", "published"] as const)(
    "refuses an article that is %s and records nothing",
    async (status) => {
      const s = await setUp();
      await s.save(status);
      const before = s.world.audit.entries.length;
      expect(await s.reject("item_1")).toMatchObject({
        ok: false,
        error: { code: "invalid_transition" },
      });
      expect(await s.world.contentItems.findById(contentItemId("item_1"))).toMatchObject({
        status,
      });
      expect(s.world.audit.entries).toHaveLength(before);
    },
  );

  it("refuses a client viewer, who can only look", async () => {
    const s = await setUp();
    await s.save("in_review");
    const result = await new RejectContentItem(s.world).execute({
      access: { ...s.access, role: "viewer" },
      itemId: contentItemId("item_1"),
      reason: "Nope",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await s.world.contentItems.findById(contentItemId("item_1"))).toMatchObject({
      status: "in_review",
    });
  });

  it("does not find another workspace's article", async () => {
    const s = await setUp();
    const other = await signedUp(s.world, "other@acme.dev");
    await s.save("in_review");
    const result = await new RejectContentItem(s.world).execute({
      access: ownerAccess(other.workspace),
      itemId: contentItemId("item_1"),
      reason: "Nope",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "content_not_found" } });
  });
});
