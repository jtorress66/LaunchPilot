import type { AutopilotRun } from "@nuvantre/domain";
import Link from "next/link";
import { setAutopilotAction } from "../../app/_lib/autopilot-actions";
import { RunNowButton } from "./run-now-button";

const describeRun = (run: AutopilotRun): string => {
  const { outcome } = run;
  if (outcome.kind === "skipped") return `Skipped: ${outcome.reason}`;
  if (outcome.kind === "failed") return `Could not plan the week: ${outcome.reason}`;
  const s = outcome.summary;
  return [
    `${String(s.drafted)} drafts waiting for you`,
    s.redrafted > 0 ? `${String(s.redrafted)} rewritten after review` : "",
    s.failed > 0 ? `${String(s.failed)} could not be drafted` : "",
    s.stoppedAtLimit ? "stopped at the plan's monthly limit" : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

const weekOf = (run: AutopilotRun) =>
  run.week.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The weekly autopilot switch, a manual run, and what the latest week produced. */
export function AutopilotCard({
  productId,
  enabledSince,
  latest,
}: {
  readonly productId: string;
  readonly enabledSince: Date | null;
  readonly latest: AutopilotRun | null;
}) {
  const on = enabledSince !== null;
  return (
    <section
      id="autopilot"
      aria-labelledby="autopilot-heading"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="autopilot-heading" className="text-lg font-semibold">
          Weekly autopilot
        </h2>
        <span data-testid="autopilot-state" className="text-sm font-semibold">
          {on ? "On" : "Off"}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Every Monday from 07:00 UTC the strategist plans the week from your brief and last
        week&apos;s report, the writers draft it and the reviewer checks each draft. Everything
        waits in your{" "}
        <Link href="/app/inbox" className="underline">
          Inbox
        </Link>
        : nothing is published until you approve it.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <form action={setAutopilotAction.bind(null, productId, !on)}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {on ? "Turn autopilot off" : "Turn autopilot on"}
          </button>
        </form>
        <RunNowButton productId={productId} />
      </div>
      {latest ? (
        <p data-testid="autopilot-latest" className="text-sm">
          <span className="font-medium">Week of {weekOf(latest)}:</span> {describeRun(latest)}
        </p>
      ) : null}
    </section>
  );
}
