import { formatChange, formatMetricValue, metricLabels, type ReportMetric } from "@nuvantre/domain";
import { sourceName } from "./source-name";

/** Up is good except for search position, where a lower number is better. */
const directionOf = ({ name, change }: ReportMetric) => {
  if (change === null || Math.round(change * 100) === 0) return "flat" as const;
  const better = name === "search_position" ? change < 0 : change > 0;
  return better ? ("better" as const) : ("worse" as const);
};

const styles = {
  better: { label: "better", tone: "text-emerald-700 dark:text-emerald-400" },
  worse: { label: "worse", tone: "text-red-700 dark:text-red-400" },
  flat: { label: "", tone: "text-slate-500" },
} as const;

/** The arrow shows which way the number moved; colour and label say whether that is good. */
const arrowOf = (direction: keyof typeof styles, change: number | null) =>
  direction === "flat" || change === null ? "–" : change > 0 ? "▲" : "▼";

/** One headline figure: value, week-over-week change (arrow, text and label, never colour alone). */
export function MetricTile({ metric }: { readonly metric: ReportMetric }) {
  const direction = directionOf(metric);
  const style = styles[direction];
  const arrow = arrowOf(direction, metric.change);
  return (
    <div
      data-testid={`metric-${metric.name}`}
      className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">{metricLabels[metric.name]}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {formatMetricValue(metric.name, metric.value)}
      </p>
      <p className={`mt-1 text-sm font-medium ${style.tone}`}>
        <span aria-hidden="true">{arrow} </span>
        <span data-testid="change">{formatChange(metric.change)}</span>
        {style.label ? <span className="sr-only"> ({style.label})</span> : null}
        {metric.previous === null ? null : (
          <span className="font-normal text-slate-500">
            {" "}
            vs {formatMetricValue(metric.name, metric.previous)}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">{sourceName(metric.source)}</p>
    </div>
  );
}
