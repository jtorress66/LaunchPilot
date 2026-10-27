import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { getAppContainer } from "../../../container";
import { describeActivity } from "../../../server/activity";
import { requireUser } from "../../_lib/auth";

export const metadata: Metadata = { title: "Activity — Nuvantre" };

const pageQuery = z.object({ before: z.coerce.date().optional().catch(undefined) });

const when = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function ActivityPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await requireUser();
  const { before } = pageQuery.parse(await searchParams);
  const page = await getAppContainer().getActivity.execute({
    workspace,
    ...(before ? { before } : {}),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Everything approved, published, scheduled or connected in your workspace, newest first.
        </p>
      </div>
      {page.entries.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Nothing has happened yet.
        </p>
      ) : (
        <ol
          aria-label="Activity"
          className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
        >
          {page.entries.map((entry) => {
            const line = describeActivity(entry);
            return (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
                <time dateTime={entry.at.toISOString()} className="w-44 text-sm text-slate-500">
                  {when.format(entry.at)} UTC
                </time>
                {line.href ? (
                  <Link href={line.href} className="text-sm font-medium hover:underline">
                    {line.sentence}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{line.sentence}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {page.nextBefore ? (
        <Link
          href={`/app/activity?before=${encodeURIComponent(page.nextBefore.toISOString())}`}
          className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Older activity
        </Link>
      ) : null}
    </div>
  );
}
