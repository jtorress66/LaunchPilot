import type { MetricName } from "./metrics";
import type { WeeklyReport } from "./weekly-report";

const DAY = 86_400_000;

/** Decimal rounding without binary drift: roundTo(1.005, 2) is 1.01. */
const roundTo = (value: number, decimals: number) =>
  Number(
    `${String(Math.round(Number(`${String(value)}e${String(decimals)}`)))}e-${String(decimals)}`,
  );

/** A fraction as a percentage, rounded: percentOf(0.0345, 1) is 3.5. */
const percentOf = (fraction: number, decimals: number) =>
  roundTo(roundTo(fraction, decimals + 2) * 100, decimals);

const counts = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formats: Readonly<Record<MetricName, (value: number) => string>> = {
  visitors: (v) => counts.format(v),
  pageviews: (v) => counts.format(v),
  search_clicks: (v) => counts.format(v),
  search_impressions: (v) => counts.format(v),
  search_ctr: (v) => `${oneDecimal.format(percentOf(v, 1))}%`,
  search_position: (v) => oneDecimal.format(roundTo(v, 1)),
};

/** A metric as the report shows it: `1,234`, `3.5%`, `14.3`. */
export const formatMetricValue = (name: MetricName, value: number): string => formats[name](value);

/** A week-over-week change: `+23%`, `−5%`, `0%`, or `new` when there is nothing to compare. */
export const formatChange = (change: number | null): string => {
  if (change === null) return "new";
  const percent = percentOf(change, 0);
  if (percent === 0) return "0%";
  return `${percent > 0 ? "+" : "−"}${String(Math.abs(percent))}%`;
};

/** A value and its common roundings, so "about 3%" and "3.5%" both match 0.0345. */
const forms = (value: number, scale: "count" | "percent" | "decimal"): number[] => {
  if (scale === "percent") return [percentOf(value, 1), percentOf(value, 0)];
  if (scale === "decimal") return [value, roundTo(value, 1), roundTo(value, 0)];
  return [value];
};

const scaleOf = (name: MetricName) =>
  name === "search_ctr" ? "percent" : name === "search_position" ? "decimal" : "count";

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map((n) => n.replaceAll(",", ""));

const datesOf = ({ week }: WeeklyReport) => {
  const last = new Date(week.end.getTime() - DAY);
  return [week.start, last, week.end].flatMap((d) => [
    d.getUTCDate(),
    d.getUTCMonth() + 1,
    d.getUTCFullYear(),
  ]);
};

/** Every figure a faithful sentence about this report could contain. */
const allowedNumbers = (report: WeeklyReport): Set<number> => {
  const allowed: number[] = [...Array.from({ length: 11 }, (_, i) => i), ...datesOf(report)];
  for (const m of report.metrics) {
    const scale = scaleOf(m.name);
    allowed.push(...forms(m.value, scale));
    if (m.previous !== null) {
      allowed.push(...forms(m.previous, scale), ...forms(Math.abs(m.value - m.previous), scale));
    }
    if (m.change !== null) allowed.push(...forms(Math.abs(m.change), "percent"));
  }
  for (const page of report.topPages) {
    allowed.push(page.visitors, ...numbersIn(page.url).map(Number));
  }
  for (const q of report.topQueries) {
    allowed.push(q.clicks, q.impressions, ...forms(q.position, "decimal"));
    allowed.push(...numbersIn(q.query).map(Number));
  }
  return new Set(allowed);
};

/**
 * The numbers in `text` that the report does not contain, in order. Used to hold the analyst to
 * the report: any figure it states must be one the founder can see.
 */
export const numbersNotInReport = (report: WeeklyReport, text: string): string[] => {
  const allowed = allowedNumbers(report);
  return numbersIn(text).filter((n) => !allowed.has(Number(n)));
};
