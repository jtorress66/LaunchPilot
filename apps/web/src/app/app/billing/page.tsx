import { planIds, plans } from "@launchpilot/domain";
import type { Metadata } from "next";
import { getAppContainer } from "../../../container";
import { upgradeAction } from "../../_lib/actions";
import { requireUser } from "../../_lib/auth";

export const metadata: Metadata = { title: "Billing — LaunchPilot" };

const notices: Record<string, { tone: string; text: string }> = {
  success: {
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    text: "Payment received. Your plan is updated as soon as the payment provider confirms it.",
  },
  canceled: {
    tone: "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    text: "Checkout canceled. You have not been charged.",
  },
  unavailable: {
    tone: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    text: "Checkout is unavailable right now. Please try again in a moment.",
  },
};

export default async function BillingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ checkout?: string }>;
}) {
  const { workspace } = await requireUser();
  const { checkout } = await searchParams;
  const dashboard = await getAppContainer().getDashboard.execute(workspace);
  const notice = checkout ? notices[checkout] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans and billing</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          You are on the <strong>{dashboard.plan.name}</strong> plan. Cancel any time.
        </p>
      </div>
      {notice ? (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.tone}`}>
          {notice.text}
        </p>
      ) : null}
      <ul className="grid gap-6 md:grid-cols-3">
        {planIds.map((id) => {
          const plan = plans[id];
          const current = id === dashboard.plan.id;
          return (
            <li
              key={id}
              aria-label={`${plan.name} plan`}
              className={`flex flex-col rounded-2xl border bg-white p-6 dark:bg-slate-900 ${current ? "border-brand-500 ring-2 ring-brand-500/30" : "border-slate-200 dark:border-slate-800"}`}
            >
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2">
                <span className="text-3xl font-bold">${plan.priceMonthlyUsd}</span>
                <span className="text-sm text-slate-500">/month</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  {plan.limits.products === 1 ? "1 product" : `${plan.limits.products} products`}
                </li>
                <li>{plan.limits.contentItemsPerMonth} content items per month</li>
                <li>Founder approval before anything publishes</li>
              </ul>
              {current ? (
                <p className="mt-6 rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold dark:bg-slate-800">
                  Current plan
                </p>
              ) : plan.priceMonthlyUsd > 0 ? (
                <form action={upgradeAction} className="mt-6">
                  <input type="hidden" name="plan" value={id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
                  >
                    Upgrade to {plan.name}
                  </button>
                </form>
              ) : (
                <p className="mt-6 text-center text-sm text-slate-500">
                  Included with every account
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
