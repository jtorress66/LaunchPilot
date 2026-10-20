import {
  formatMetricValue,
  metricLabels,
  ok,
  type ReportMetric,
  type Result,
  type WeeklyReport,
} from "@launchpilot/domain";
import type {
  Analysis,
  AnalysisError,
  AnalysisRequest,
  WeeklyReportAnalyst,
} from "@launchpilot/ports";

const percent = (change: number) => `${String(Math.round(Math.abs(change) * 100))}%`;

/** For search position a lower number is better, so its verbs are reversed. */
const verbOf = (m: ReportMetric & { change: number }) => {
  if (Math.round(m.change * 100) === 0) return "held steady at";
  const better = m.name === "search_position" ? m.change < 0 : m.change > 0;
  if (m.name === "search_position") return better ? "improved to" : "slipped to";
  return `${better ? "rose" : "fell"} ${percent(m.change)} to`;
};

const compared = (report: WeeklyReport) =>
  report.metrics.filter((m): m is ReportMetric & { change: number } => m.change !== null);

const summaryOf = (report: WeeklyReport) => {
  const [first] = report.metrics;
  if (first === undefined) return "No figures this week: no source answered.";
  const biggest = compared(report).reduce<(ReportMetric & { change: number }) | undefined>(
    (best, m) => (best === undefined || Math.abs(m.change) > Math.abs(best.change) ? m : best),
    undefined,
  );
  if (biggest === undefined) {
    return `This is the first week with figures to compare. ${metricLabels[first.name]}: ${formatMetricValue(first.name, first.value)}.`;
  }
  return `${metricLabels[biggest.name]} ${verbOf(biggest)} ${formatMetricValue(biggest.name, biggest.value)} compared with the week before.`;
};

const highlightsOf = (report: WeeklyReport) => [
  ...report.topPages
    .slice(0, 1)
    .map((p) => `"${p.url}" had ${formatMetricValue("visitors", p.visitors)} visitors.`),
  ...report.topQueries
    .slice(0, 1)
    .map(
      (q) => `"${q.query}" brought ${formatMetricValue("search_clicks", q.clicks)} search clicks.`,
    ),
];

const suggestionOf = (report: WeeklyReport) => {
  const [query] = report.topQueries;
  if (query !== undefined) return `Write a post that answers "${query.query}".`;
  const searchConsoleOk = report.sources.some(
    (s) => s.source === "search_console" && s.status === "ok",
  );
  return searchConsoleOk
    ? "Publish one new article this week."
    : "Connect Search Console to see which searches bring visitors.";
};

/** Deterministic, offline notes from the report alone. For development, tests and E2E. */
export class TemplateAnalyst implements WeeklyReportAnalyst {
  analyse({ report }: AnalysisRequest): Promise<Result<Analysis, AnalysisError>> {
    return Promise.resolve(
      ok({
        summary: summaryOf(report),
        highlights: highlightsOf(report),
        suggestions: [suggestionOf(report)],
        citedFacts: [],
      }),
    );
  }
}
