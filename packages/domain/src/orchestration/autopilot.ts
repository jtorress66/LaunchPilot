import { lastCompleteWeek, type ReportWeek } from "../analytics/report-week";
import type { Product } from "../product/product";

const WEEK = 7 * 86_400_000;
/** The loop runs after the 06:00 weekly reports, so it can plan from last week's figures. */
const LOOP_HOUR = 7 * 60 * 60 * 1000;

/** Switching it on again keeps the original date. */
export const enableAutopilot = (product: Product, now: Date): Product => ({
  ...product,
  autopilotSince: product.autopilotSince ?? now,
});

export const disableAutopilot = (product: Product): Product => ({
  ...product,
  autopilotSince: null,
});

/** The week the loop plans: this Monday 00:00 UTC to the next. */
export const loopWeekOf = (now: Date): ReportWeek => {
  const start = lastCompleteWeek(now).end;
  return { start, end: new Date(start.getTime() + WEEK) };
};

/** From Monday 07:00 UTC; any later run that week catches up. */
export const loopIsDue = (now: Date): boolean =>
  now.getTime() >= loopWeekOf(now).start.getTime() + LOOP_HOUR;
