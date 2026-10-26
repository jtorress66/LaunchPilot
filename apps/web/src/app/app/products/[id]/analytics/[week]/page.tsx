import { productId } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "../../../../../../components/analytics/report-view";
import { getAppContainer } from "../../../../../../container";
import { requireUser } from "../../../../../_lib/auth";
import { idParam } from "../../../../../_lib/params";

export const metadata: Metadata = { title: "Weekly report — Nuvantre" };

const WEEK = /^\d{4}-W\d{2}$/;

export default async function WeeklyReportPage({
  params,
}: {
  readonly params: Promise<{ id: string; week: string }>;
}) {
  const { id: raw, week } = await params;
  const id = idParam(raw);
  if (!WEEK.test(week)) notFound();
  const { workspace } = await requireUser();
  const result = await getAppContainer().analytics.getReport.execute({
    workspace,
    productId: productId(id),
    weekKey: week,
  });
  if (!result.ok) notFound();
  const { product, report } = result.value;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/products/${product.id}/analytics`}
          className="text-sm text-slate-500 hover:underline"
        >
          {product.name} · Analytics
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Weekly report {report.weekKey}</h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <ReportView report={report} />
      </div>
    </div>
  );
}
