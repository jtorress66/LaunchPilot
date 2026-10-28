import { can, productId } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SendReportForm } from "../../../../../../components/agency/agency-forms";
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
  const access = await requireUser();
  const { workspace } = access;
  const result = await getAppContainer().analytics.getReport.execute({
    workspace,
    productId: productId(id),
    weekKey: week,
  });
  if (!result.ok) notFound();
  const { product, report } = result.value;
  const canSend = can(access.role, "send_reports");
  const saved = canSend
    ? await getAppContainer().getReportRecipients.execute({ access, productId: product.id })
    : null;
  const recipients = saved?.ok ? saved.value : null;
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
      {canSend ? (
        <section
          aria-labelledby="email-report"
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 id="email-report" className="text-lg font-semibold">
            Email this report
          </h2>
          <SendReportForm
            productId={product.id}
            weekKey={report.weekKey}
            recipients={recipients?.emails.join(", ") ?? ""}
            weekly={recipients?.weekly ?? false}
          />
        </section>
      ) : null}
    </div>
  );
}
