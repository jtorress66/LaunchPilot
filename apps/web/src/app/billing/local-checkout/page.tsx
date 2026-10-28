import { plans } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContainer } from "../../../container";
import { payLocalCheckoutAction } from "../../_lib/actions";
import { requireUser } from "../../_lib/auth";

export const metadata: Metadata = { title: "Test checkout — Nuvantre" };
export const dynamic = "force-dynamic";

/** Stand-in for a hosted checkout, available only with BILLING_PROVIDER=local. */
export default async function LocalCheckoutPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ plan?: string }>;
}) {
  if (!getAppContainer().localCheckout) notFound();
  const { user } = await requireUser();
  const { plan: planId } = await searchParams;
  if (planId !== "starter" && planId !== "growth" && planId !== "agency") notFound();
  const plan = plans[planId];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <p className="bg-amber-400 px-4 py-2 text-center text-xs font-bold tracking-wide text-amber-950 uppercase">
          Test mode: no real payment is taken
        </p>
        <div className="space-y-6 p-6 sm:p-8">
          <div>
            <h1 className="text-xl font-semibold">Subscribe to Nuvantre {plan.name}</h1>
            <p className="mt-1 text-3xl font-bold">
              ${plan.priceMonthlyUsd}
              <span className="text-base font-normal text-slate-500"> per month</span>
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Billed to {user.email}</p>
          <form action={payLocalCheckoutAction}>
            <input type="hidden" name="plan" value={planId} />
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Pay ${plan.priceMonthlyUsd} (test)
            </button>
          </form>
          <Link
            href="/app/billing?checkout=canceled"
            className="block text-center text-sm text-slate-600 hover:underline dark:text-slate-400"
          >
            Cancel and go back
          </Link>
        </div>
      </div>
    </main>
  );
}
