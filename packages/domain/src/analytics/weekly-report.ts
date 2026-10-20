import type { ProductId, WeeklyReportId } from "../shared/ids";
import {
  metricNames,
  metricOwners,
  type MetricName,
  type MetricsSnapshot,
  type PageRow,
  type QueryRow,
} from "./metrics";
import { weekKey, type ReportWeek } from "./report-week";

/** What one source returned for the report week, and for the week before when it could. */
export type SourceOutcome =
  | {
      readonly kind: "ok";
      readonly current: MetricsSnapshot;
      readonly previous: MetricsSnapshot | null;
    }
  | { readonly kind: "not_connected" }
  | { readonly kind: "failed"; readonly reason: string };

export interface SourceResult {
  readonly source: string;
  readonly outcome: SourceOutcome;
}

export interface ReportMetric {
  readonly name: MetricName;
  readonly value: number;
  readonly previous: number | null;
  /** Week-over-week change as a fraction (0.2 is +20%); null when last week was 0 or missing. */
  readonly change: number | null;
  readonly source: string;
}

export interface SourceStatus {
  readonly source: string;
  readonly status: "ok" | "not_connected" | "failed";
  readonly reason: string | null;
}

export interface AnalystNotes {
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly suggestions: readonly string[];
}

export interface WeeklyReport {
  readonly id: WeeklyReportId;
  readonly productId: ProductId;
  readonly week: ReportWeek;
  readonly weekKey: string;
  readonly metrics: readonly ReportMetric[];
  readonly topPages: readonly PageRow[];
  readonly topQueries: readonly QueryRow[];
  readonly sources: readonly SourceStatus[];
  readonly notes: AnalystNotes | null;
  /** Why the analyst's notes are missing, when they are. */
  readonly notesError: string | null;
  readonly builtAt: Date;
}

const TOP = 10;

type Answered = Extract<SourceOutcome, { kind: "ok" }>;

const answered = (results: readonly SourceResult[]) =>
  results.flatMap((r) => (r.outcome.kind === "ok" ? [r.outcome] : []));

const rank = (metric: MetricName, source: string) => {
  const index = metricOwners[metric].indexOf(source);
  return index === -1 ? metricOwners[metric].length : index;
};

/** The most trusted answering source that reports `metric`. */
const ownerOf = (metric: MetricName, sources: readonly Answered[]) =>
  sources
    .filter((s) => s.current.values[metric] !== undefined)
    .reduce<Answered | undefined>(
      (best, s) =>
        best === undefined || rank(metric, s.current.source) < rank(metric, best.current.source)
          ? s
          : best,
      undefined,
    );

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

const changeOf = (value: number, previous: number | null) =>
  previous === null || previous === 0 ? null : round4((value - previous) / previous);

const metricOf = (name: MetricName, sources: readonly Answered[]): ReportMetric[] => {
  const owner = ownerOf(name, sources);
  const value = owner?.current.values[name];
  if (owner === undefined || value === undefined) return [];
  const previous = owner.previous?.values[name] ?? null;
  return [
    { name, value, previous, change: changeOf(value, previous), source: owner.current.source },
  ];
};

const topPagesOf = (owner: Answered | undefined) =>
  [...(owner?.current.topPages ?? [])]
    .sort((a, b) => b.visitors - a.visitors || a.url.localeCompare(b.url))
    .slice(0, TOP);

const topQueriesOf = (owner: Answered | undefined) =>
  [...(owner?.current.topQueries ?? [])]
    .sort((a, b) => b.clicks - a.clicks || a.query.localeCompare(b.query))
    .slice(0, TOP);

const statusOf = ({ source, outcome }: SourceResult): SourceStatus => ({
  source,
  status: outcome.kind,
  reason: outcome.kind === "failed" ? outcome.reason : null,
});

/** Merges every source's week into one report. Pure: the sources are fetched by the caller. */
export const buildWeeklyReport = (input: {
  readonly id: WeeklyReportId;
  readonly productId: ProductId;
  readonly week: ReportWeek;
  readonly results: readonly SourceResult[];
  readonly now: Date;
}): WeeklyReport => {
  const sources = answered(input.results);
  return {
    id: input.id,
    productId: input.productId,
    week: input.week,
    weekKey: weekKey(input.week),
    metrics: metricNames.flatMap((name) => metricOf(name, sources)),
    topPages: topPagesOf(ownerOf("visitors", sources)),
    topQueries: topQueriesOf(ownerOf("search_clicks", sources)),
    sources: input.results.map(statusOf),
    notes: null,
    notesError: null,
    builtAt: input.now,
  };
};

/** Adds the notes; only their own fields are kept, whatever else the analyst returned. */
export const withAnalystNotes = (report: WeeklyReport, notes: AnalystNotes): WeeklyReport => ({
  ...report,
  notes: { summary: notes.summary, highlights: notes.highlights, suggestions: notes.suggestions },
  notesError: null,
});

export const withoutAnalystNotes = (report: WeeklyReport, reason: string): WeeklyReport => ({
  ...report,
  notes: null,
  notesError: reason,
});
