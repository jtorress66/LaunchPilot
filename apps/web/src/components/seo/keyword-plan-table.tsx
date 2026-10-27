import type { SeoOverview } from "@nuvantre/application";
import Link from "next/link";
import { ContentStatusBadge } from "../content/content-status-badge";
import { DraftArticleButton } from "./draft-article-button";

type PlannedTask = SeoOverview["campaigns"][number]["tasks"][number];

const number = new Intl.NumberFormat("en-US");

export function KeywordPlanTable({ tasks }: { readonly tasks: readonly PlannedTask[] }) {
  return (
    <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {tasks.map(({ task, item }) => (
        <li
          key={task.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          data-testid="planned-article"
        >
          <div className="min-w-0">
            <p className="font-medium">{task.seo?.keyword ?? task.title}</p>
            {task.seo ? (
              <p className="text-xs text-slate-500">
                {number.format(task.seo.monthlySearches)} searches/month · difficulty{" "}
                {task.seo.difficulty}/100
              </p>
            ) : (
              <p className="text-xs text-slate-500">No search data for this market yet</p>
            )}
          </div>
          {item ? (
            <div className="flex items-center gap-3">
              <ContentStatusBadge status={item.status} />
              <Link
                href={`/app/content/${item.id}`}
                className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Open article
              </Link>
            </div>
          ) : (
            <div className="w-40">
              <DraftArticleButton taskId={task.id} keyword={task.seo?.keyword ?? task.title} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
