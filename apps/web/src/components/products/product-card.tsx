import type { ProductCard } from "@nuvantre/application";
import Link from "next/link";
import { ArchiveButton, MakeActiveForm } from "./product-actions";

const briefLabel = {
  none: "Brief not drafted",
  draft: "Brief draft · review",
  approved: "Brief approved",
} as const;

const link = "text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400";

const percent = (change: number) => `${change > 0 ? "+" : ""}${String(Math.round(change * 100))}%`;

/** One product on the dashboard: where it stands and what is waiting. */
export function ProductCardItem({
  card,
  active,
}: {
  readonly card: ProductCard;
  readonly active: readonly { readonly id: string; readonly name: string }[];
}) {
  const { product } = card;
  const base = `/app/products/${product.id}`;
  const facts = [
    briefLabel[card.briefStatus],
    `${String(card.waitingForApproval)} waiting for approval`,
    `${String(card.scheduled)} scheduled`,
    `${String(card.publishedThisMonth)} published this month`,
    card.blogConnected ? "Blog connected" : "No blog yet",
    product.autopilotSince ? "Autopilot on" : "Autopilot off",
    card.visitors
      ? `${String(card.visitors.value)} visitors last week${card.visitors.change === null ? "" : ` (${percent(card.visitors.change)})`}`
      : "No report yet",
  ];

  return (
    <li
      data-testid="product-card"
      className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <Link href={`${base}/brief`} className="hover:underline">
              {product.name}
            </Link>
            <span
              data-testid="product-standing"
              className={
                card.standing === "active"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }
            >
              {card.standing === "active" ? "Active" : "Paused"}
            </span>
          </p>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm text-slate-500 hover:underline"
          >
            {product.url}
          </a>
        </div>
        <ArchiveButton id={product.id} name={product.name} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href={`${base}/seo`} className={link}>
          SEO
        </Link>
        <Link href={`${base}/social`} className={link}>
          Social
        </Link>
        <Link href={`${base}/launch`} className={link}>
          Launch
        </Link>
        <Link href={`${base}/analytics`} className={link}>
          Analytics
        </Link>
      </div>
      {card.standing === "paused" ? (
        <MakeActiveForm id={product.id} name={product.name} active={active} />
      ) : null}
    </li>
  );
}
