"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export interface SwitcherProduct {
  readonly id: string;
  readonly name: string;
  readonly paused: boolean;
}

const sections = [
  { slug: "brief", label: "Brief" },
  { slug: "seo", label: "SEO" },
  { slug: "social", label: "Social" },
  { slug: "launch", label: "Launch" },
  { slug: "analytics", label: "Analytics" },
] as const;

/** The section of a product page, e.g. "seo" in /app/products/p1/seo. */
const sectionOf = (path: string) => path.split("/")[4] ?? "brief";

/** Moves between the workspace's products, staying on the same section, and between sections. */
export function ProductNav({
  current,
  products,
  reportsOnly = false,
}: {
  readonly current: string;
  readonly products: readonly SwitcherProduct[];
  /** A client viewer only reads reports, so the other sections are not offered. */
  readonly reportsOnly?: boolean;
}) {
  const router = useRouter();
  const section = sectionOf(usePathname());

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
      <div className="space-y-1">
        <label htmlFor="product-switcher" className="block text-xs font-medium text-slate-500">
          Product
        </label>
        <select
          id="product-switcher"
          value={current}
          onChange={(event) => {
            router.push(
              `/app/products/${event.target.value}/${reportsOnly ? "analytics" : section}`,
            );
          }}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm sm:w-64 dark:border-slate-700 dark:bg-slate-900"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.paused ? `${product.name} (paused)` : product.name}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Product sections" className="-mx-1 flex gap-1 overflow-x-auto text-sm">
        {sections
          .filter(({ slug }) => !reportsOnly || slug === "analytics")
          .map(({ slug, label }) => (
            <Link
              key={slug}
              href={`/app/products/${current}/${slug}`}
              aria-current={slug === section ? "page" : undefined}
              className="rounded-lg px-3 py-1.5 font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:aria-[current=page]:bg-brand-700/15 dark:aria-[current=page]:text-brand-400"
            >
              {label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
