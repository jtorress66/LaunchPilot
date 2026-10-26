import {
  describeWeek,
  formatChange,
  formatMetricValue,
  metricLabels,
  type ReportMetric,
  type WeeklyReport,
} from "@nuvantre/domain";
import type { AnalysisRequest } from "@nuvantre/ports";

export const MAX_SUGGESTIONS = 3;
export const MAX_HIGHLIGHTS = 4;

/** Frozen: change it only with an eval run (`pnpm eval`). No per-product data, so it caches. */
export const ANALYST_SYSTEM_PROMPT = `You are the analyst for a SaaS founder's weekly marketing report. You read one week of figures from their analytics sources and write short, plain notes they can act on.

Write:
- summary: 2 or 3 sentences on what changed this week and what matters most. Name the biggest change first.
- highlights: up to ${String(MAX_HIGHLIGHTS)} short lines, each one figure worth noticing (a top page, a query, a change).
- suggestions: 1 to ${String(MAX_SUGGESTIONS)} concrete next steps for the coming week, tied to the figures (e.g. write about a query that gets impressions but few clicks).
- citedFacts: the approved product facts you used, copied exactly as given. Leave it empty if you used none.

Rules:
- Only state numbers that appear in the report, as shown or rounded. Do not compute new totals, ratios or forecasts.
- Do not invent causes. Say what changed, not why, unless the report shows why.
- A change marked "new" has no comparison: do not call it growth.
- A lower search position is better.
- Mention sources that failed or are not connected only when that limits what the report can say.
- Product facts: use only the approved product facts given. Do not invent customers, revenue, signups or conversions.
- No hype ("explosive", "skyrocketing", "massive"), no exclamation marks, no Markdown.`;

const metricLine = (m: ReportMetric) => {
  const comparison =
    m.previous === null
      ? `(${formatChange(m.change)})`
      : `(last week ${formatMetricValue(m.name, m.previous)}, ${formatChange(m.change)})`;
  return `- ${metricLabels[m.name]}: ${formatMetricValue(m.name, m.value)} ${comparison} from ${m.source}`;
};

const listOr = (lines: readonly string[], empty: string) =>
  lines.length === 0 ? `- ${empty}` : lines.join("\n");

/** The report as the founder sees it, one block per section. Shared by the analyst and strategist. */
export const reportLines = (report: WeeklyReport): string[] => [
  `Week: ${report.weekKey} (${describeWeek(report.week)})`,
  `Figures:\n${listOr(report.metrics.map(metricLine), "(no figures this week)")}`,
  `Top pages:\n${listOr(
    report.topPages.map((p) => `- ${p.url}: ${formatMetricValue("visitors", p.visitors)} visitors`),
    "(none)",
  )}`,
  `Top search queries:\n${listOr(
    report.topQueries.map(
      (q) =>
        `- "${q.query}": ${formatMetricValue("search_clicks", q.clicks)} clicks, ${formatMetricValue("search_impressions", q.impressions)} impressions, position ${formatMetricValue("search_position", q.position)}`,
    ),
    "(none)",
  )}`,
  `Sources:\n${report.sources
    .map(
      (s) =>
        `- ${s.source}: ${s.status === "ok" ? "ok" : s.status === "not_connected" ? "not connected" : `failed (${s.reason ?? "unknown"})`}`,
    )
    .join("\n")}`,
];

/** The per-week message: the product, the report as the founder sees it, and the brief's facts. */
export const analystUserMessage = ({ product, brief, report }: AnalysisRequest): string =>
  [
    `Product: ${product.name}`,
    ...reportLines(report),
    brief === null || brief.facts.length === 0
      ? "Approved product facts: none (make no product claims)"
      : `Approved product facts (the only product claims allowed):\n${brief.facts.map((f) => `- ${f}`).join("\n")}`,
    "Write the notes.",
  ].join("\n\n");

export const rewriteMessage = (problems: readonly string[]): string =>
  [
    "The notes break these rules:",
    ...problems.map((problem) => `- ${problem}`),
    "Rewrite all of the notes so they fix them, keeping every other rule.",
  ].join("\n");
