import { can } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanBadge } from "../../components/app/plan-badge";
import { UsageMeter } from "../../components/app/usage-meter";
import { ProductForm } from "../../components/forms/product-form";
import { ProductCardItem } from "../../components/products/product-card";
import { ReportsDashboard } from "../../components/agency/reports-dashboard";
import { RestoreButton } from "../../components/products/product-actions";
import { getAppContainer } from "../../container";
import { requireUser } from "../_lib/auth";

export const metadata: Metadata = { title: "Dashboard — Nuvantre" };

export default async function DashboardPage() {
  const { workspace, role } = await requireUser();
  const dashboard = await getAppContainer().getDashboard.execute(workspace);
  if (!can(role, "draft"))
    return <ReportsDashboard workspaceName={workspace.name} cards={dashboard.cards} />;
  const { plan, cards } = dashboard;
  const active = cards
    .filter((card) => card.standing === "active")
    .map((card) => ({ id: card.product.id, name: card.product.name }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add the products you want Nuvantre to market.
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
        <section aria-labelledby="products" className="space-y-6">
          <h2 id="products" className="text-lg font-semibold">
            Products
          </h2>
          {cards.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              No products yet. Add your first one to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {cards.map((card) => (
                <ProductCardItem key={card.product.id} card={card} active={active} />
              ))}
            </ul>
          )}
          {dashboard.archived.length > 0 ? (
            <section aria-labelledby="archived" className="space-y-3">
              <h3 id="archived" className="text-sm font-semibold text-slate-500">
                Archived
              </h3>
              <ul className="space-y-2">
                {dashboard.archived.map((product) => (
                  <li
                    key={product.id}
                    data-testid="archived-product"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      {product.name}
                    </span>
                    <RestoreButton id={product.id} name={product.name} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
