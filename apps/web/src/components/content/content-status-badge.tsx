import type { ContentItemStatus } from "@nuvantre/domain";

const labels: Record<ContentItemStatus, string> = {
  draft: "Draft",
  in_review: "Waiting for your approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  archived: "Archived",
};

const tones: Partial<Record<ContentItemStatus, string>> = {
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  published: "bg-brand-600 text-white",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function ContentStatusBadge({ status }: { readonly status: ContentItemStatus }) {
  return (
    <span
      data-testid="content-status"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tones[status] ?? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {labels[status]}
    </span>
  );
}
