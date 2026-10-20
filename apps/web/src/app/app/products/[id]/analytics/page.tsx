import { describeWeek, productId } from "@launchpilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildReportButton } from "../../../../../components/analytics/build-report-button";
import { AutopilotCard } from "../../../../../components/autopilot/autopilot-card";
import { DisconnectButton } from "../../../../../components/analytics/disconnect-button";
import { GooglePropertiesForm } from "../../../../../components/analytics/google-properties-form";
import { PlausibleConnectForm } from "../../../../../components/analytics/plausible-connect-form";
import { ReportView } from "../../../../../components/analytics/report-view";
import { getAppContainer } from "../../../../../container";
import { analyticsFailureMessage } from "../../../../../server/messages";
import { requireUser } from "../../../../_lib/auth";
import { idParam } from "../../../../_lib/params";

export const metadata: Metadata = { title: "Analytics — LaunchPilot" };

const card =
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

interface AnalyticsPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ google?: string; plausible?: string; autopilot?: string }>;
}

const googleNotices: Partial<Record<string, string>> = {
  connected: "Google is connected. Choose the properties to report on.",
  saved: "Properties saved.",
  unconfigured: "Google is not set up on this server yet.",
};

const Notice = ({ text, tone }: { readonly text: string; readonly tone: "ok" | "error" }) => (
  <p
    role={tone === "ok" ? "status" : "alert"}
    className={`rounded-2xl border p-4 text-sm ${
      tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-red-200 bg-red-50 text-red-900"
    }`}
  >
    {text}
  </p>
);

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const [{ id: raw }, query] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  const { workspace } = await requireUser();
  const app = getAppContainer();
  const [overview, autopilot] = await Promise.all([
    app.analytics.getOverview.execute({ workspace, productId: productId(id) }),
    app.getAutopilotStatus.execute({ workspace, productId: productId(id) }),
  ]);
  if (!overview.ok || !autopilot.ok) notFound();
  const { product, google, plausible, reports, latest } = overview.value;
  const properties =
    google && app.analytics.google
      ? await app.analytics.google.listProperties.execute({ workspace, productId: product.id })
      : null;
  const googleNotice = query.google ? googleNotices[query.google] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">{product.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Connect Search Console and Google Analytics 4 or Plausible. Every Monday LaunchPilot
          builds last week&apos;s report, with read-only access.
        </p>
      </div>

      {query.google && googleNotice === undefined ? (
        <Notice
          tone="error"
          text={analyticsFailureMessage({
            code: query.google,
            message: "Google could not be connected. Try again.",
          })}
        />
      ) : null}
      {googleNotice ? (
        <Notice tone={query.google === "unconfigured" ? "error" : "ok"} text={googleNotice} />
      ) : null}
      {query.plausible === "connected" ? <Notice tone="ok" text="Plausible is connected." /> : null}
      {query.autopilot === "ran" ? (
        <Notice tone="ok" text="This week's run is done. Review the drafts in your Inbox." />
      ) : null}

      <AutopilotCard
        productId={product.id}
        enabledSince={autopilot.value.enabledSince}
        latest={autopilot.value.latest}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="report" className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="report" className="text-lg font-semibold">
              Latest report
            </h2>
            {google || plausible ? <BuildReportButton productId={product.id} /> : null}
          </div>
          {latest ? (
            <ReportView report={latest} />
          ) : (
            <p className="text-sm text-slate-500">
              {google || plausible
                ? "No report yet. The first one is built next Monday, or build it now."
                : "Connect a source to get your first weekly report."}
            </p>
          )}
          {reports.length > 1 ? (
            <div>
              <h3 className="font-semibold">Past reports</h3>
              <ul aria-label="Past reports" className="mt-1 space-y-1 text-sm">
                {reports.map((r) => (
                  <li key={r.weekKey}>
                    <Link
                      href={`/app/products/${product.id}/analytics/${r.weekKey}`}
                      className="underline"
                    >
                      {r.weekKey}
                    </Link>{" "}
                    <span className="text-slate-500">{describeWeek(r.week)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="google" className={card}>
            <h2 id="google" className="text-lg font-semibold">
              Google
            </h2>
            {!app.analytics.google ? (
              <p className="text-sm text-slate-500">
                Google is not set up on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
                (see README).
              </p>
            ) : google ? (
              <>
                <p className="text-sm" data-testid="google-account">
                  Connected as {google.accountEmail}
                </p>
                {properties?.ok ? (
                  <GooglePropertiesForm
                    productId={product.id}
                    properties={properties.value.properties}
                    chosen={properties.value.chosen}
                  />
                ) : (
                  <p role="alert" className="text-sm text-red-700">
                    {properties
                      ? analyticsFailureMessage(properties.error)
                      : "Google could not be reached."}
                  </p>
                )}
                <DisconnectButton
                  productId={product.id}
                  provider="google"
                  label="Disconnect Google"
                />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Read-only access to Search Console and Google Analytics 4.
                </p>
                <a
                  href={`/api/google/connect?product=${product.id}`}
                  className="inline-flex rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
                >
                  Connect Google
                </a>
              </>
            )}
          </section>

          <section aria-labelledby="plausible" className={card}>
            <h2 id="plausible" className="text-lg font-semibold">
              Plausible
            </h2>
            {plausible ? (
              <>
                <p className="text-sm" data-testid="plausible-site">
                  {plausible.siteId} on {new URL(plausible.baseUrl).host}
                </p>
                <DisconnectButton
                  productId={product.id}
                  provider="plausible"
                  label="Disconnect Plausible"
                />
              </>
            ) : (
              <PlausibleConnectForm productId={product.id} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
