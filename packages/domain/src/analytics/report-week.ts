import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";

/** A reporting week: Monday 00:00 UTC up to (not including) the next Monday. */
export interface ReportWeek {
  readonly start: Date;
  readonly end: Date;
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/** Monday 00:00 UTC of the week containing `date`. */
const mondayOf = (date: Date) => {
  const day = startOfUtcDay(date);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY);
};

const weekFrom = (start: Date): ReportWeek => ({
  start,
  end: new Date(start.getTime() + WEEK),
});

/** The latest week that has fully ended by `now`. */
export const lastCompleteWeek = (now: Date): ReportWeek =>
  weekFrom(new Date(mondayOf(now).getTime() - WEEK));

export const previousWeek = (week: ReportWeek): ReportWeek =>
  weekFrom(new Date(week.start.getTime() - WEEK));

/** Monday of ISO week 1: the week containing 4 January. */
const firstIsoMonday = (year: number) => mondayOf(new Date(Date.UTC(year, 0, 4)));

/** The ISO week name, e.g. `2026-W42`, of the week starting `week.start`. */
export const weekKey = (week: ReportWeek): string => {
  // The ISO year is the year of the week's Thursday.
  const year = new Date(week.start.getTime() + 3 * DAY).getUTCFullYear();
  const number = Math.round((week.start.getTime() - firstIsoMonday(year).getTime()) / WEEK) + 1;
  return `${String(year)}-W${String(number).padStart(2, "0")}`;
};

const WEEK_KEY = /^(\d{4})-W(\d{2})$/;

export const parseWeekKey = (key: string): Result<ReportWeek, DomainError> => {
  const match = WEEK_KEY.exec(key);
  const invalid = err(domainError("invalid_text", `"${key}" is not an ISO week like 2026-W42`));
  if (!match) return invalid;
  const year = Number(match[1]);
  const number = Number(match[2]);
  const week = weekFrom(new Date(firstIsoMonday(year).getTime() + (number - 1) * WEEK));
  return number >= 1 && weekKey(week) === key ? ok(week) : invalid;
};
