import {
  describeWeek,
  formatChange,
  formatMetricValue,
  metricLabels,
  type Product,
  type ReportBranding,
  type WeeklyReport,
} from "@nuvantre/domain";
import { escapeHtml } from "./html";

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const DEFAULT_ACCENT = "#0f172a";

/**
 * A weekly report as an email a client reads: the figures with their change, then the analyst's
 * notes. With branding it carries only the agency's name, colour, logo and footer.
 */
export const renderReportEmail = (input: {
  report: WeeklyReport;
  product: Pick<Product, "name">;
  branding: ReportBranding | null;
}): RenderedEmail => {
  const { report, product, branding } = input;
  const subject = `${product.name} — weekly report, ${report.weekKey}`;
  const week = describeWeek(report.week);
  const signature = branding ? branding.senderName : "Sent by Nuvantre";
  const accent = branding?.accentColor ?? DEFAULT_ACCENT;
  const figures = report.metrics.map((m) => ({
    label: metricLabels[m.name],
    value: formatMetricValue(m.name, m.value),
    change: formatChange(m.change),
  }));
  const notes = report.notes;

  const text = [
    `${product.name} — weekly report`,
    `${report.weekKey} · ${week} (UTC)`,
    "",
    ...(figures.length === 0
      ? ["No source returned figures for this week."]
      : figures.map((f) => `${f.label}: ${f.value} (${f.change})`)),
    "",
    ...(notes
      ? [
          notes.summary,
          ...notes.highlights.map((h) => `• ${h}`),
          "",
          "Next week:",
          ...notes.suggestions.map((s) => `• ${s}`),
        ]
      : ["No notes this week."]),
    "",
    "—",
    signature,
    ...(branding?.footer ? [branding.footer] : []),
  ].join("\n");

  const e = escapeHtml;
  const list = (items: readonly string[]) =>
    items.length === 0
      ? ""
      : `<ul style="padding-left:20px;margin:8px 0">${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;
  const rows = figures
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0">${e(f.label)}</td><td style="padding:6px 12px 6px 0;font-weight:600">${e(f.value)}</td><td style="padding:6px 0;color:#475569">${e(f.change)}</td></tr>`,
    )
    .join("");
  const html = [
    `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">`,
    `<div style="max-width:600px;margin:0 auto;background:#ffffff">`,
    `<div style="background:${e(accent)};color:#ffffff;padding:20px 24px">`,
    branding?.logoUrl
      ? `<img src="${e(branding.logoUrl)}" alt="${e(branding.senderName)}" height="32" style="display:block;margin-bottom:12px">`
      : "",
    `<div style="font-size:20px;font-weight:700">${e(product.name)} — weekly report</div>`,
    `<div style="opacity:.85;font-size:14px">${e(report.weekKey)} · ${e(week)} (UTC)</div>`,
    `</div><div style="padding:24px">`,
    figures.length === 0
      ? `<p>No source returned figures for this week.</p>`
      : `<table style="border-collapse:collapse;font-size:15px">${rows}</table>`,
    notes
      ? `<h2 style="font-size:16px;margin:24px 0 8px">Summary</h2><p>${e(notes.summary)}</p>${list(notes.highlights)}<h2 style="font-size:16px;margin:16px 0 8px">Next week</h2>${list(notes.suggestions)}`
      : `<p style="color:#475569">No notes this week.</p>`,
    `</div><div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:13px;color:#475569">`,
    `<div style="font-weight:600;color:${e(accent)}">${e(signature)}</div>`,
    branding?.footer ? `<div>${e(branding.footer)}</div>` : "",
    `</div></div></body></html>`,
  ].join("");

  return { subject, html, text };
};
