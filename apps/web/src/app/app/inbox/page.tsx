import { maxLengthOf } from "@nuvantre/domain";
import { AgentReviewNote } from "../../../components/autopilot/agent-review-note";
import type { Metadata } from "next";
import Link from "next/link";
import { InboxApproveButton } from "../../../components/inbox/approve-button";
import { channelName } from "../../../components/social/channel-name";
import { getAppContainer } from "../../../container";
import { requireUser } from "../../_lib/auth";

export const metadata: Metadata = { title: "Inbox — Nuvantre" };

const PREVIEW = 600;

export default async function InboxPage() {
  const { workspace } = await requireUser();
  const entries = await getAppContainer().getInbox.execute({ workspace });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Everything your agents drafted, waiting for your approval. Nothing is published until you
          approve it.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          You are all caught up.
        </p>
      ) : (
        <ul aria-label="Waiting for approval" className="space-y-4">
          {entries.map(({ item, product }) => (
            <li
              key={item.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {channelName(item.channel)}
                </span>
                <span>·</span>
                <span>{product.name}</span>
                <span>·</span>
                <span>
                  {item.body.length} / {maxLengthOf(item.channel)} characters
                </span>
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {item.body.length > PREVIEW ? `${item.body.slice(0, PREVIEW)}…` : item.body}
              </p>
              <AgentReviewNote review={item.agentReview} />
              <div className="flex flex-wrap items-start gap-3">
                <InboxApproveButton itemId={item.id} title={item.title} />
                <Link
                  href={`/app/content/${item.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
