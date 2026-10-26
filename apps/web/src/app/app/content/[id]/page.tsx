import {
  communityChannels,
  contentItemId,
  socialChannels,
  type CommunityChannel,
  type SocialChannel,
} from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEditor } from "../../../../components/content/article-editor";
import { AgentReviewNote } from "../../../../components/autopilot/agent-review-note";
import { ContentStatusBadge } from "../../../../components/content/content-status-badge";
import { CommunityPostEditor } from "../../../../components/content/community-post-editor";
import { PostEditor } from "../../../../components/content/post-editor";
import { channelName } from "../../../../components/social/channel-name";
import { LocalTime } from "../../../../components/social/local-time";
import { getAppContainer } from "../../../../container";
import { requireUser } from "../../../_lib/auth";
import { idParam } from "../../../_lib/params";

export const metadata: Metadata = { title: "Content — Nuvantre" };

const socialChannel = (channel: string): SocialChannel | undefined =>
  socialChannels.find((c) => c === channel);
const communityChannel = (channel: string): CommunityChannel | undefined =>
  communityChannels.find((c) => c === channel);

interface ContentPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ saved?: string }>;
}

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { workspace } = await requireUser();
  const result = await getAppContainer().getContentItem.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
  });
  if (!result.ok) notFound();
  const { item, task, product } = result.value;
  const social = socialChannel(item.channel);
  const community = communityChannel(item.channel);
  const section = social ? "social" : community ? "launch" : "seo";
  const sectionName = social ? "Social" : community ? "Launch" : "SEO";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/app/products/${product.id}/${section}`}
            className="text-sm text-slate-500 hover:underline"
          >
            {product.name} · {sectionName}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          {task.seo ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Target keyword: <strong>{task.seo.keyword}</strong>
            </p>
          ) : null}
        </div>
        <ContentStatusBadge status={item.status} />
      </div>

      {item.status === "in_review" ? <AgentReviewNote review={item.agentReview} /> : null}

      {item.publication ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Live on {social ? channelName(social) : "your blog"}:{" "}
          <a
            href={item.publication.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            {item.publication.externalUrl}
          </a>
        </p>
      ) : null}

      {item.status === "scheduled" && item.publishAt ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Scheduled for <LocalTime iso={item.publishAt.toISOString()} />.
        </p>
      ) : null}
      {item.failure ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          Publishing failed: {item.failure.reason}
        </p>
      ) : null}

      {community ? (
        <CommunityPostEditor
          key={item.version}
          itemId={item.id}
          channel={community}
          title={item.title}
          body={item.body}
          status={item.status}
          justSaved={saved === "1"}
        />
      ) : social ? (
        <PostEditor
          key={item.version}
          itemId={item.id}
          channel={social}
          body={item.body}
          status={item.status}
          justSaved={saved === "1"}
        />
      ) : (
        <ArticleEditor
          key={item.version}
          itemId={item.id}
          title={item.title}
          body={item.body}
          status={item.status}
          justSaved={saved === "1"}
        />
      )}
    </div>
  );
}
