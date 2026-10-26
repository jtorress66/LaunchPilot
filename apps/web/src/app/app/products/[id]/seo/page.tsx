import { productId } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogConnectionForm } from "../../../../../components/seo/blog-connection-form";
import { KeywordPlanTable } from "../../../../../components/seo/keyword-plan-table";
import { SeoPlanForm } from "../../../../../components/seo/seo-plan-form";
import { getAppContainer } from "../../../../../container";
import { requireUser } from "../../../../_lib/auth";
import { idParam } from "../../../../_lib/params";

export const metadata: Metadata = { title: "SEO — Nuvantre" };

const card =
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

export default async function SeoPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  const { workspace } = await requireUser();
  const result = await getAppContainer().getSeoOverview.execute({
    workspace,
    productId: productId(id),
  });
  if (!result.ok) notFound();
  const { product, briefApproved, connection, campaigns } = result.value;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">{product.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">SEO</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Research keywords, plan articles, and publish the ones you approve to your blog.
        </p>
      </div>

      {briefApproved ? null : (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Approve your Product Brief first: articles may only state the facts it contains.{" "}
          <Link href={`/app/products/${product.id}/brief`} className="font-semibold underline">
            Go to the brief
          </Link>
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section aria-labelledby="plan" className={card}>
            <h2 id="plan" className="text-lg font-semibold">
              Plan articles
            </h2>
            {briefApproved ? (
              <SeoPlanForm productId={product.id} />
            ) : (
              <p className="text-sm text-slate-500">Available once the brief is approved.</p>
            )}
          </section>

          {campaigns.map(({ campaign, tasks }) => (
            <section key={campaign.id} aria-label={campaign.name} className="space-y-3">
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <p className="text-sm text-slate-500">{campaign.goal}</p>
              <KeywordPlanTable tasks={tasks} />
            </section>
          ))}
        </div>

        <section aria-labelledby="blog" className={`h-fit ${card}`}>
          <h2 id="blog" className="text-lg font-semibold">
            Your blog
          </h2>
          <BlogConnectionForm productId={product.id} connected={connection} />
        </section>
      </div>
    </div>
  );
}
