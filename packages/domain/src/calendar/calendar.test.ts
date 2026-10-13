import { describe, expect, it } from "vitest";
import type { ContentItem, ContentItemStatus } from "../content-item/content-item";
import { buildCalendar } from "./calendar";

const item = (id: string, status: ContentItemStatus, at: string | null, publishedAt?: string) =>
  ({
    id,
    status,
    channel: "x",
    publishAt: at === null ? null : new Date(at),
    publication: publishedAt
      ? { externalUrl: "https://x.com/acme/status/1", at: new Date(publishedAt) }
      : null,
  }) as unknown as ContentItem;

const from = new Date("2026-10-12T15:00:00.000Z");

describe("buildCalendar", () => {
  it("lists every day in the window, starting today (UTC)", () => {
    const calendar = buildCalendar([], { from, days: 3 });
    expect(calendar.days.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("puts scheduled posts on their day and published posts on the day they went out, in time order", () => {
    const calendar = buildCalendar(
      [
        item("late", "scheduled", "2026-10-13T18:00:00.000Z"),
        item("early", "scheduled", "2026-10-13T08:00:00.000Z"),
        item("done", "published", null, "2026-10-12T16:00:00.000Z"),
        item("outside", "scheduled", "2026-10-20T08:00:00.000Z"),
      ],
      { from, days: 3 },
    );
    expect(calendar.days.map((d) => d.items.map((i) => i.id))).toEqual([
      ["done"],
      ["early", "late"],
      [],
    ]);
  });

  it("lists approved posts without a time as unscheduled, and ignores other statuses", () => {
    const calendar = buildCalendar(
      [item("a", "approved", null), item("r", "in_review", null), item("d", "draft", null)],
      { from, days: 1 },
    );
    expect(calendar.unscheduled.map((i) => i.id)).toEqual(["a"]);
    expect(calendar.days[0]?.items).toEqual([]);
  });
});
