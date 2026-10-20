import type { AgentReview } from "@launchpilot/domain";

/** The reviewer agent's recommendation on a draft. The founder still decides. */
export function AgentReviewNote({ review }: { readonly review: AgentReview | null }) {
  if (review === null) return null;
  const passes = review.decision === "pass";
  const count = review.issues.length;
  return (
    <div
      data-testid="agent-review"
      className={`rounded-lg border p-3 text-sm ${
        passes
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
    >
      <p className="font-semibold">
        {passes
          ? "Reviewer: passes"
          : `Reviewer: ${String(count)} ${count === 1 ? "issue" : "issues"}`}
        {review.redrafted ? (
          <span className="font-normal"> · rewritten once after review</span>
        ) : null}
      </p>
      {count > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {review.issues.map((issue) => (
            <li key={issue.message}>
              <span className="font-medium">
                {issue.severity === "blocker" ? "Must fix" : "Suggestion"}:
              </span>{" "}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
