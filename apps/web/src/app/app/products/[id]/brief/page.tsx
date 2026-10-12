import { productId } from "@launchpilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefEditor } from "../../../../../components/brief/brief-editor";
import { BriefStatusBadge } from "../../../../../components/brief/brief-status-badge";
import { DraftBriefForm } from "../../../../../components/brief/draft-brief-form";
import { getAppContainer } from "../../../../../container";
import { requireUser } from "../../../../_lib/auth";

export const metadata: Metadata = { title: "Product Brief — LaunchPilot" };

interface BriefPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ saved?: string }>;
}

export default async function BriefPage({ params, searchParams }: BriefPageProps) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  if (!/^[\w-]{1,100}$/.test(id)) notFound();
  const { workspace } = await requireUser();
  const result = await getAppContainer().getBrief.execute({ workspace, productId: productId(id) });
  if (!result.ok) notFound();
  const { product, brief } = result.value;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{product.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Product Brief</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Who you serve, the problem you solve and the facts agents may state. Drafted from{" "}
            <a href={product.url} target="_blank" rel="noreferrer" className="underline">
              {product.url}
            </a>
            , then edited and approved by you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brief ? <BriefStatusBadge status={brief.status} /> : null}
          {brief?.status === "approved" ? (
            <Link
              href={`/app/products/${product.id}/seo`}
              className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Next: SEO →
            </Link>
          ) : null}
        </div>
      </div>

      <DraftBriefForm
        productId={product.id}
        host={new URL(product.url).host}
        hasBrief={brief !== undefined}
      />

      {brief ? (
        <BriefEditor
          key={brief.version}
          productId={product.id}
          content={brief.content}
          status={brief.status}
          justSaved={saved === "1"}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No brief yet. LaunchPilot reads your site and drafts one for you to edit and approve.
          Facts your site does not support are left out.
        </p>
      )}
    </div>
  );
}
