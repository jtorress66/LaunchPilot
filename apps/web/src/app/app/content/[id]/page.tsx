import { contentItemId } from "@launchpilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEditor } from "../../../../components/content/article-editor";
import { ContentStatusBadge } from "../../../../components/content/content-status-badge";
import { getAppContainer } from "../../../../container";
import { requireUser } from "../../../_lib/auth";
import { idParam } from "../../../_lib/params";

export const metadata: Metadata = { title: "Article — LaunchPilot" };

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/app/products/${product.id}/seo`}
            className="text-sm text-slate-500 hover:underline"
          >
            {product.name} · SEO
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

      {item.publication ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Live on your blog:{" "}
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

      <ArticleEditor
        key={item.version}
        itemId={item.id}
        title={item.title}
        body={item.body}
        status={item.status}
        justSaved={saved === "1"}
      />
    </div>
  );
}
