import { productId } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatusBadge } from "../../../../../components/content/content-status-badge";
import { DirectoryBrowser } from "../../../../../components/launch/directory-browser";
import { GenerateKitButton } from "../../../../../components/launch/generate-kit-button";
import { LaunchKitEditor } from "../../../../../components/launch/launch-kit-editor";
import { TrackerRow } from "../../../../../components/launch/tracker-row";
import { channelName } from "../../../../../components/social/channel-name";
import { getAppContainer } from "../../../../../container";
import { parseDirectoryFilter } from "../../../../../server/forms";
import { requireAccess } from "../../../../_lib/auth";
import { idParam } from "../../../../_lib/params";

export const metadata: Metadata = { title: "Launch — Nuvantre" };

const card =
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

interface LaunchPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LaunchPage({ params, searchParams }: LaunchPageProps) {
  const [{ id: raw }, query] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  const { workspace } = await requireAccess("draft");
  const app = getAppContainer();
  const filter = parseDirectoryFilter(query);
  const [overview, directories] = await Promise.all([
    app.getLaunchOverview.execute({ workspace, productId: productId(id) }),
    app.listDirectories.execute({ workspace, productId: productId(id), filter }),
  ]);
  if (!overview.ok || !directories.ok) notFound();
  const { product, briefApproved, kit, community, rows, counts } = overview.value;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">{product.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Launch</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Generate your launch kit, pick where to launch, and track every submission. You submit
          each one yourself; Nuvantre never submits or posts for you here.
        </p>
      </div>

      {briefApproved ? null : (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Approve your Product Brief first: the launch kit may only state the facts it contains.{" "}
          <Link href={`/app/products/${product.id}/brief`} className="font-semibold underline">
            Go to the brief
          </Link>
        </p>
      )}

      <section aria-labelledby="kit" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kit" className="text-lg font-semibold">
            Launch kit
          </h2>
          {kit ? (
            <span data-testid="kit-status" className="text-sm font-semibold">
              {kit.status === "approved" ? "Approved" : "Waiting for your approval"}
            </span>
          ) : null}
        </div>
        {briefApproved ? (
          <GenerateKitButton productId={product.id} regenerate={kit !== null} />
        ) : null}
        {kit ? (
          <LaunchKitEditor
            key={kit.version}
            productId={product.id}
            listing={kit.listing}
            status={kit.status}
            justSaved={query.saved === "1"}
          />
        ) : null}
      </section>

      {community.length > 0 ? (
        <section aria-labelledby="community" className={card}>
          <h2 id="community" className="text-lg font-semibold">
            Community posts
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Drafts you post yourself. Approve each one before marking its community submitted.
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {community.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="w-28 font-semibold">{channelName(item.channel)}</span>
                <Link
                  href={`/app/content/${item.id}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {item.title}
                </Link>
                <ContentStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tracker" className={card}>
        <h2 id="tracker" className="text-lg font-semibold">
          Tracker
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {counts.planned} planned · {counts.submitted} submitted · {counts.live} live ·{" "}
          {counts.rejected} rejected · {counts.skipped} skipped
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Add directories below to start your launch.</p>
        ) : (
          <ul aria-label="Submissions" className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <TrackerRow key={row.submission.id} productId={product.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <section id="directories" aria-labelledby="directories-heading" className={card}>
        <h2 id="directories-heading" className="text-lg font-semibold">
          Where to launch
        </h2>
        <DirectoryBrowser productId={product.id} entries={directories.value} filter={filter} />
      </section>
    </div>
  );
}
