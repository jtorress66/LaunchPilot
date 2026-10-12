import type { BriefStatus } from "@launchpilot/domain";

export function BriefStatusBadge({ status }: { readonly status: BriefStatus }) {
  return (
    <span
      data-testid="brief-status"
      className={
        status === "approved"
          ? "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      }
    >
      {status === "approved" ? "Approved" : "Draft"}
    </span>
  );
}
