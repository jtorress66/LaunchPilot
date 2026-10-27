import { describe, expect, it } from "vitest";
import { plans } from "../billing/plans";
import { productId, workspaceId } from "../shared/ids";
import { parseHttpUrl } from "../shared/url";
import type { Product } from "./product";
import {
  allocateSlots,
  archiveProduct,
  checkProductActive,
  restoreProduct,
  slotsInUse,
  standingOf,
  swapSlots,
} from "./product-slots";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const url = parseHttpUrl("https://acme.dev");
if (!url.ok) throw new Error("fixture url");

const product = (id: string, created: number, overrides: Partial<Product> = {}): Product => ({
  id: productId(id),
  workspaceId: workspaceId("ws_1"),
  name: id.toUpperCase(),
  url: url.value,
  createdAt: day(created),
  autopilotSince: null,
  locale: { language: "en", market: "US" },
  archivedAt: null,
  slotOrder: day(created),
  ...overrides,
});

const a = product("a", 1);
const b = product("b", 2);
const c = product("c", 3);
const ids = (list: readonly Product[]) => list.map((p) => p.id);

describe("allocateSlots", () => {
  it("keeps every product active while the plan has room", () => {
    expect(allocateSlots([c, a, b], plans.growth)).toEqual({
      active: [a, b, c],
      paused: [],
      archived: [],
    });
  });

  it("pauses the newest products when the plan has fewer slots, e.g. after a downgrade", () => {
    const allocation = allocateSlots([b, c, a], plans.starter);
    expect(ids(allocation.active)).toEqual(["a"]);
    expect(ids(allocation.paused)).toEqual(["b", "c"]);
  });

  it("fills slots by slot order, so a product moved forward stays active", () => {
    const moved = { ...c, slotOrder: day(0) };
    expect(ids(allocateSlots([a, b, moved], plans.free).active)).toEqual(["c"]);
  });

  it("breaks a tie in slot order by id, so the result never depends on input order", () => {
    const twin = product("aa", 1);
    expect(ids(allocateSlots([twin, a], plans.free).active)).toEqual(["a"]);
    expect(ids(allocateSlots([a, twin], plans.free).active)).toEqual(["a"]);
  });

  it("leaves archived products out of the slots", () => {
    const archived = archiveProduct(a, day(9));
    const allocation = allocateSlots([archived, b, c], plans.starter);
    expect(ids(allocation.active)).toEqual(["b"]);
    expect(ids(allocation.paused)).toEqual(["c"]);
    expect(allocation.archived).toEqual([archived]);
    expect(slotsInUse([archived, b, c])).toBe(2);
  });
});

describe("standing and the active check", () => {
  const allocation = allocateSlots([a, b, archiveProduct(c, day(9))], plans.starter);

  it("tells whether a product is active, paused or archived", () => {
    expect(standingOf(a.id, allocation)).toBe("active");
    expect(standingOf(b.id, allocation)).toBe("paused");
    expect(standingOf(c.id, allocation)).toBe("archived");
    expect(standingOf(productId("other"), allocation)).toBeUndefined();
  });

  it("lets an active product work", () => {
    expect(checkProductActive(a, allocation, plans.starter)).toEqual({ ok: true, value: null });
  });

  it("explains why a paused product cannot work, and how to free it", () => {
    expect(checkProductActive(b, allocation, plans.starter)).toEqual({
      ok: false,
      error: {
        code: "product_paused",
        message:
          "B is paused: the Starter plan includes 1 product. Upgrade, or archive or pause another product.",
      },
    });
    const growth = allocateSlots([a, b, c, product("d", 4)], plans.growth);
    const paused = growth.paused[0];
    if (!paused) throw new Error("expected a paused product");
    expect(checkProductActive(paused, growth, plans.growth)).toMatchObject({
      error: { message: expect.stringContaining("the Growth plan includes 3 products") as unknown },
    });
  });

  it("asks to restore an archived product first", () => {
    expect(checkProductActive(c, allocation, plans.starter)).toEqual({
      ok: false,
      error: {
        code: "product_archived",
        message: "C is archived. Restore it to work on it again.",
      },
    });
  });
});

describe("archive, restore and swap", () => {
  it("archives a product, keeping it otherwise as it was", () => {
    expect(archiveProduct(a, day(9))).toEqual({ ...a, archivedAt: day(9) });
  });

  it("restores an archived product to the end of the slot order when a slot is free", () => {
    const archived = archiveProduct(c, day(9));
    const allocation = allocateSlots([a, b, archived], plans.growth);
    expect(restoreProduct(archived, allocation, plans.growth, day(10))).toEqual({
      ok: true,
      value: { ...c, archivedAt: null, slotOrder: day(10) },
    });
  });

  it("refuses to restore when every slot is in use", () => {
    const archived = archiveProduct(b, day(9));
    const allocation = allocateSlots([a, archived], plans.starter);
    expect(restoreProduct(archived, allocation, plans.starter, day(10))).toEqual({
      ok: false,
      error: {
        code: "no_free_slot",
        message:
          "The Starter plan includes 1 product, all in use. Upgrade, or archive another product first.",
      },
    });
  });

  it("leaves a product that is not archived as it is", () => {
    expect(restoreProduct(a, allocateSlots([a], plans.free), plans.free, day(10))).toEqual({
      ok: true,
      value: a,
    });
  });

  it("swaps two products' places in the slot order", () => {
    expect(swapSlots(c, a)).toEqual([
      { ...c, slotOrder: a.slotOrder },
      { ...a, slotOrder: c.slotOrder },
    ]);
  });
});
