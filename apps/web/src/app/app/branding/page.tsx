import type { Metadata } from "next";
import { BrandingForm } from "../../../components/agency/agency-forms";
import { getAppContainer } from "../../../container";
import { requireAccess } from "../../_lib/auth";

export const metadata: Metadata = { title: "Branding — Nuvantre" };

const card =
  "rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

export default async function BrandingPage() {
  const access = await requireAccess("manage_branding");
  const result = await getAppContainer().getBranding.execute({ access });
  const branding = result.ok ? result.value : null;
  const accent = branding?.accentColor ?? "#0f172a";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report branding</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Weekly reports you email to clients carry your name, colour and logo, never
          Nuvantre&apos;s. Every client workspace uses this branding.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="branding-form" className={card}>
          <h2 id="branding-form" className="sr-only">
            Branding
          </h2>
          <BrandingForm
            defaults={{
              senderName: branding?.senderName ?? access.workspace.name,
              accentColor: accent,
              logoUrl: branding?.logoUrl ?? "",
              replyTo: branding?.replyTo ?? access.user.email,
              footer: branding?.footer ?? "",
            }}
          />
        </section>
        <section aria-labelledby="preview" className={`${card} h-fit space-y-2`}>
          <h2 id="preview" className="text-lg font-semibold">
            How it looks
          </h2>
          <div
            data-testid="branding-preview"
            className="rounded-lg p-4 text-white"
            style={{ background: accent }}
          >
            <p className="font-bold">Acme Analytics — weekly report</p>
            <p className="text-sm opacity-85">2026-W42</p>
          </div>
          <p className="text-sm text-slate-500">
            From {branding?.senderName ?? "your agency"}
            {branding ? ` · replies go to ${branding.replyTo}` : ""}
          </p>
        </section>
      </div>
    </div>
  );
}
