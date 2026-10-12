import type { ContentItem } from "../content-item/content-item";

export interface CalendarDay {
  /** UTC date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly items: readonly ContentItem[];
}

export interface Calendar {
  readonly days: readonly CalendarDay[];
  /** Approved items waiting for a publish time. */
  readonly unscheduled: readonly ContentItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = (at: Date) => at.toISOString().slice(0, 10);

/** When an item appears on the calendar: its publish time, or when it went out. */
const calendarTime = (item: ContentItem): Date | null => {
  if (item.status === "scheduled") return item.publishAt;
  if (item.status === "published") return item.publication?.at ?? null;
  return null;
};

/** Groups scheduled and published items by UTC day, for `days` days starting on `from`'s day. */
export const buildCalendar = (
  items: readonly ContentItem[],
  { from, days }: { readonly from: Date; readonly days: number },
): Calendar => {
  const timed = items
    .map((item) => ({ item, at: calendarTime(item) }))
    .filter((entry): entry is { item: ContentItem; at: Date } => entry.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const start = Date.parse(utcDate(from));
  return {
    days: Array.from({ length: days }, (_, i) => {
      const date = utcDate(new Date(start + i * DAY_MS));
      return { date, items: timed.filter((e) => utcDate(e.at) === date).map((e) => e.item) };
    }),
    unscheduled: items.filter((item) => item.status === "approved" && item.publishAt === null),
  };
};
