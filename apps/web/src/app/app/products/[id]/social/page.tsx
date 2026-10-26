import { productId } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatusBadge } from "../../../../../components/content/content-status-badge";
import { CalendarView } from "../../../../../components/social/calendar-view";
import { channelName } from "../../../../../components/social/channel-name";
import { DraftWeekButton } from "../../../../../components/social/draft-week-button";
import { SocialConnectCard } from "../../../../../components/social/social-connect-card";
import { getAppContainer } from "../../../../../container";
import { requireUser } from "../../../../_lib/auth";
import { idParam } from "../../../../_lib/params";

export const metadata: Metadata = { title: "Social — Nuvantre" };

const card =
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

interface SocialPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ linked?: string }>;
}

export default async function SocialPage({ params, searchParams }: SocialPageProps) {
  const [{ id: raw }, { linked }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  const { workspace } = await requireUser();
  const result = await getAppContainer().getSocialOverview.execute({
    workspace,
    productId: productId(id),
  });
  if (!result.ok) notFound();
  const { product, briefApproved, linkedChannels, posts, calendar } = result.value;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">{product.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Social</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Draft a week of X and LinkedIn posts, approve them, and publish now or on a schedule.
        </p>
      </div>

      {linked === "0" ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          Linking was cancelled or failed. Try connecting again.
        </p>
      ) : null}

      {briefApproved ? null : (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Approve your Product Brief first: posts may only state the facts it contains.{" "}
          <Link href={`/app/products/${product.id}/brief`} className="font-semibold underline">
            Go to the brief
          </Link>
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section aria-labelledby="draft" className={card}>
            <h2 id="draft" className="text-lg font-semibold">
              This week&apos;s posts
            </h2>
            {briefApproved ? (
              <DraftWeekButton productId={product.id} />
            ) : (
              <p className="text-sm text-slate-500">Available once the brief is approved.</p>
            )}
            {posts.length === 0 ? null : (
              <ul aria-label="Posts" className="divide-y divide-slate-200 dark:divide-slate-800">
                {posts.map((post) => (
                  <li key={post.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="w-20 font-semibold">{channelName(post.channel)}</span>
                    <Link
                      href={`/app/content/${post.id}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {post.title}
                    </Link>
                    <ContentStatusBadge status={post.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="calendar" className={card}>
            <h2 id="calendar" className="text-lg font-semibold">
              Calendar
            </h2>
            <CalendarView calendar={calendar} />
          </section>
        </div>

        <section aria-labelledby="accounts" className={`h-fit ${card}`}>
          <h2 id="accounts" className="text-lg font-semibold">
            Your accounts
          </h2>
          <SocialConnectCard productId={product.id} linkedChannels={linkedChannels} />
        </section>
      </div>
    </div>
  );
}
