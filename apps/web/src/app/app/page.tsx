import type { Metadata } from "next";
import Link from "next/link";
import { PlanBadge } from "../../components/app/plan-badge";
import { UsageMeter } from "../../components/app/usage-meter";
import { ProductForm } from "../../components/forms/product-form";
import { getAppContainer } from "../../container";
import { requireUser } from "../_lib/auth";

export const metadata: Metadata = { title: "Dashboard — LaunchPilot" };

const briefLinkLabel = {
  none: "Draft brief",
  draft: "Brief draft · review",
  approved: "Brief approved",
} as const;

export default async function DashboardPage() {
  const { workspace } = await requireUser();
  const dashboard = await getAppContainer().getDashboard.execute(workspace);
  const { plan, products } = dashboard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add the products you want LaunchPilot to market.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge name={plan.name} paid={plan.priceMonthlyUsd > 0} />
          {dashboard.subscriptionStatus === "past_due" ? (
            <span className="text-sm text-amber-700 dark:text-amber-400">Payment past due</span>
          ) : null}
          <Link
            href="/app/billing"
            className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {plan.priceMonthlyUsd > 0 ? "Manage plan" : "Upgrade"}
          </Link>
        </div>
      </div>

      <section
        aria-labelledby="usage"
        className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="usage" className="sr-only">
          Usage
        </h2>
        <UsageMeter label="Products" used={dashboard.usage.products} limit={plan.limits.products} />
        <UsageMeter
          label="Content items this month"
          used={dashboard.usage.contentItemsThisMonth}
          limit={plan.limits.contentItemsPerMonth}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="products">
          <h2 id="products" className="text-lg font-semibold">
            Products
          </h2>
          {products.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              No products yet. Add your first one to get started.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{product.name}</p>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-slate-500 hover:underline"
                    >
                      {product.url}
                    </a>
                  </div>
                  <div className="flex gap-4">
                    <Link
                      href={`/app/products/${product.id}/brief`}
                      className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {briefLinkLabel[dashboard.briefStatus[product.id] ?? "none"]}
                    </Link>
                    <Link
                      href={`/app/products/${product.id}/seo`}
                      className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      SEO
                    </Link>
                    <Link
                      href={`/app/products/${product.id}/social`}
                      className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Social
                    </Link>
                    <Link
                      href={`/app/products/${product.id}/launch`}
                      className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Launch
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          aria-labelledby="add-product"
          className="h-fit rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 id="add-product" className="mb-4 text-lg font-semibold">
            Add a product
          </h2>
          <ProductForm />
        </section>
      </div>
    </div>
  );
}
