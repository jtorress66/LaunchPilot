import { describeWeek, formatMetricValue, type WeeklyReport } from "@launchpilot/domain";
import { MetricTile } from "./metric-tile";
import { sourceName } from "./source-name";

const statusText = ({ status, reason }: WeeklyReport["sources"][number]) =>
  status === "ok" ? "ok" : status === "not_connected" ? "not connected" : (reason ?? "failed");

const table = "w-full text-left text-sm";
const th = "py-2 pr-4 font-medium text-slate-600 dark:text-slate-400";
const td = "py-2 pr-4 tabular-nums";

/** A weekly report as the founder reads it: figures, the analyst's notes, top rows and sources. */
export function ReportView({ report }: { readonly report: WeeklyReport }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {report.weekKey} · {describeWeek(report.week)} (UTC)
      </p>

      {report.metrics.length === 0 ? (
        <p className="text-sm text-slate-500">No source returned figures for this week.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Figures">
          {report.metrics.map((m) => (
            <MetricTile key={m.name} metric={m} />
          ))}
        </div>
      )}

      <section aria-labelledby="notes" className="space-y-2">
        <h3 id="notes" className="font-semibold">
          Analyst&apos;s notes
        </h3>
        {report.notes ? (
          <div data-testid="analyst-notes" className="space-y-2 text-sm">
            <p>{report.notes.summary}</p>
            {report.notes.highlights.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {report.notes.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <p className="font-medium">Next week</p>
            <ul className="list-disc space-y-1 pl-5">
              {report.notes.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Notes are unavailable for this report{report.notesError ? `: ${report.notesError}` : ""}
            . Build it again to retry.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="top-pages">
          <h3 id="top-pages" className="font-semibold">
            Top pages
          </h3>
          {report.topPages.length === 0 ? (
            <p className="text-sm text-slate-500">No page data this week.</p>
          ) : (
            <table className={table} aria-labelledby="top-pages">
              <thead>
                <tr>
                  <th className={th}>Page</th>
                  <th className={th}>Visitors</th>
                </tr>
              </thead>
              <tbody>
                {report.topPages.map((p) => (
                  <tr key={p.url} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="max-w-0 truncate py-2 pr-4">{p.url}</td>
                    <td className={td}>{formatMetricValue("visitors", p.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section aria-labelledby="top-queries">
          <h3 id="top-queries" className="font-semibold">
            Top searches
          </h3>
          {report.topQueries.length === 0 ? (
            <p className="text-sm text-slate-500">No search data this week.</p>
          ) : (
            <table className={table} aria-labelledby="top-queries">
              <thead>
                <tr>
                  <th className={th}>Search</th>
                  <th className={th}>Clicks</th>
                  <th className={th}>Impr.</th>
                  <th className={th}>Pos.</th>
                </tr>
              </thead>
              <tbody>
                {report.topQueries.map((q) => (
                  <tr key={q.query} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="max-w-0 truncate py-2 pr-4">{q.query}</td>
                    <td className={td}>{formatMetricValue("search_clicks", q.clicks)}</td>
                    <td className={td}>{formatMetricValue("search_impressions", q.impressions)}</td>
                    <td className={td}>{formatMetricValue("search_position", q.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section aria-labelledby="sources">
        <h3 id="sources" className="font-semibold">
          Sources
        </h3>
        <ul aria-label="Sources" className="mt-1 space-y-1 text-sm">
          {report.sources.map((s) => (
            <li key={s.source}>
              <span className="font-medium">{sourceName(s.source)}</span>: {statusText(s)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
