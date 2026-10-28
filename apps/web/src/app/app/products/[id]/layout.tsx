import { can } from "@nuvantre/domain";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { MakeActiveForm } from "../../../../components/products/product-actions";
import { ProductNav } from "../../../../components/products/product-nav";
import { getAppContainer } from "../../../../container";
import { requireUser } from "../../../_lib/auth";
import { idParam } from "../../../_lib/params";

/** Every product page: the switcher, the section tabs, and why a paused product cannot work. */
export default async function ProductLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}) {
  const id = idParam((await params).id);
  const { workspace, role } = await requireUser();
  const lineup = await getAppContainer().getProductLineup.execute(workspace);
  const listed = [
    ...lineup.active.map((p) => ({ id: p.id, name: p.name, paused: false })),
    ...lineup.paused.map((p) => ({ id: p.id, name: p.name, paused: true })),
  ];
  const archived = lineup.archived.find((p) => p.id === id);
  const paused = lineup.paused.find((p) => p.id === id);
  if (!archived && !listed.some((p) => p.id === id)) notFound();

  return (
    <div className="space-y-6">
      {archived ? (
        <p
          role="status"
          className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <strong>{archived.name}</strong> is archived. Its work is kept; restore it from the{" "}
          <Link href="/app" className="font-semibold underline">
            dashboard
          </Link>{" "}
          to work on it again.
        </p>
      ) : (
        <ProductNav current={id} products={listed} reportsOnly={!can(role, "draft")} />
      )}
      {paused ? (
        <div
          role="status"
          data-testid="paused-banner"
          className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p>
            <strong>{paused.name} is paused.</strong> The {lineup.plan.name} plan includes{" "}
            {lineup.plan.limits.products === 1
              ? "1 product"
              : `${String(lineup.plan.limits.products)} products`}
            . You can read and edit it, but nothing is drafted or published until it is active
            again.{" "}
            <Link href="/app/billing" className="font-semibold underline">
              Upgrade
            </Link>
          </p>
          {can(role, "manage_products") ? (
            <MakeActiveForm
              id={paused.id}
              name={paused.name}
              active={lineup.active.map((p) => ({ id: p.id, name: p.name }))}
            />
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
